'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { User } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { ChatInterface } from '@/components/ChatInterface'
import MainLayout from '@/components/main-layout'
import { useToast } from '@/hooks/use-toast'

interface Conversation {
  id: string
  participant_one_id: string
  participant_two_id: string
  created_at: string
  updated_at: string
  otherParticipant?: {
    id: string
    username: string
    full_name: string
    avatar_url: string
    is_online: boolean
  }
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  updated_at: string
  delivered_at?: string | null
  read_at?: string | null
  reply_to_id?: string
  sender?: {
    id: string
    username: string
    full_name: string
    avatar_url: string
  }
  reply_to?: {
    id: string
    content: string
    sender: {
      full_name: string
    }
  }
  reactions?: Array<{
    emoji: string
    count: number
    reacted_by_user: boolean
  }>
}

export default function ConversationPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClientComponentClient()
  
  const conversationId = params.conversationId as string
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch conversation details
  const fetchConversation = async () => {
    try {
      const { data: conv, error } = await supabase
        .from('conversations')
        .select('id, participant_one_id, participant_two_id, created_at, updated_at')
        .eq('id', conversationId)
        .single()
      
      if (error || !conv) {
        console.error('Error fetching conversation:', {
          message: (error as any)?.message,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
          code: (error as any)?.code
        })
        toast({
          title: "Error",
          description: "Conversation not found",
          variant: "destructive"
        })
        return
      }
      
      if (conv.participant_one_id !== user?.id && conv.participant_two_id !== user?.id) {
        toast({
          title: "Error",
          description: "You don't have access to this conversation",
          variant: "destructive"
        })
        return
      }
      
      const otherId = conv.participant_one_id === user?.id ? conv.participant_two_id : conv.participant_one_id
      let otherProfile: any | undefined
      if (otherId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, is_online')
          .eq('id', otherId)
          .single()
        otherProfile = profile || undefined
      }
      
      setConversation({
        id: conv.id,
        participant_one_id: conv.participant_one_id,
        participant_two_id: conv.participant_two_id,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        otherParticipant: otherProfile ? {
          id: otherProfile.id,
          username: otherProfile.username,
          full_name: otherProfile.full_name,
          avatar_url: otherProfile.avatar_url,
          is_online: !!otherProfile.is_online
        } : undefined
      })
    } catch (error) {
      console.error('Error fetching conversation:', error)
      toast({
        title: "Error",
        description: "Failed to load conversation",
        variant: "destructive"
      })
    }
  }

  // Fetch messages for the conversation
  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey (
            id,
            username,
            full_name,
            avatar_url
          ),
          reply_to_message:messages!messages_reply_to_fkey (
            id,
            content,
            sender:profiles!messages_sender_id_fkey (*)
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      
      if (error) {
        console.error('Error fetching messages:', {
          message: (error as any)?.message,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
          code: (error as any)?.code
        })
      } else {
        const transformed = (data || []).map((m: any) => ({
          ...m,
          reply_to: m.reply_to_message ? {
            id: m.reply_to_message.id,
            content: m.reply_to_message.content,
            sender: {
              full_name: m.reply_to_message.sender?.full_name
            }
          } : undefined
        }))
        setMessages(transformed)
      }
      // Mark as read when we load the conversation
      fetch('/api/messages/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId }),
      }).catch(() => {})
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initialize authentication
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setAuthLoading(false)
    }
    
    getUser()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    
    return () => subscription.unsubscribe()
  }, [])

  // Load conversation and messages on mount
  useEffect(() => {
    if (!user?.id || !conversationId) return
    
    fetchConversation()
    fetchMessages()
  }, [user, conversationId])

  // Set up real-time subscriptions (INSERT + UPDATE for ticks)
  useEffect(() => {
    if (!user?.id || !conversationId) return

    const ch = supabase
      .channel(`realtime:conv:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload: { new: Record<string, unknown> }) => {
          const id = payload.new?.id as string
          if (!id) return
          const { data: msg } = await supabase
            .from('messages')
            .select(`
              *,
              sender:profiles!messages_sender_id_fkey(id,username,full_name,avatar_url),
              reply_to_message:messages!messages_reply_to_fkey(id,content,sender:profiles!messages_sender_id_fkey(*))
            `)
            .eq('id', id)
            .single()
          if (msg) {
            const withReply = {
              ...msg,
              reply_to: (msg as any).reply_to_message
                ? {
                    id: (msg as any).reply_to_message.id,
                    content: (msg as any).reply_to_message.content,
                    sender: {
                      full_name: (msg as any).reply_to_message.sender?.full_name,
                    },
                  }
                : undefined,
            }
            setMessages(prev => {
              if (prev.some(m => m.id === (msg as Message).id)) return prev
              return [...prev, withReply as Message]
            })
            if ((msg as Message).sender_id !== user?.id) {
              fetch('/api/messages/mark-delivered', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message_id: (msg as Message).id }),
              }).catch(() => {})
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const updated = payload.new as Partial<Message>
          if (!updated?.id) return
          setMessages(prev =>
            prev.map(m => (m.id === updated.id ? { ...m, ...updated } : m))
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [user?.id, conversationId])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (authLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Please sign in</h2>
            <p className="text-gray-600">You need to be signed in to view messages</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading conversation...</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (!conversation) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Conversation not found</h2>
            <p className="text-gray-600 mb-4">This conversation may have been deleted or you don't have access to it.</p>
            <Button onClick={() => router.push('/messages')}>
              Back to Messages
            </Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  const handleSendMessageWithReply = (content: string, replyToId?: string) => {
    if (!conversation || sendingMessage) return
    setSendingMessage(true)
    const trimmed = content.trim()
    if (!trimmed) { setSendingMessage(false); return }
    supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: user?.id,
        content: trimmed,
        reply_to_id: replyToId || replyingTo?.id || null,
      })
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(id,username,full_name,avatar_url),
        reply_to_message:messages!messages_reply_to_fkey(id,content,sender:profiles!messages_sender_id_fkey(*))
      `)
      .single()
      .then(({ data: message, error }) => {
        setSendingMessage(false)
        if (error) {
          toast({
            title: "Error",
            description: "Failed to send message",
            variant: "destructive",
          })
          return
        }
        if (message) {
          const withReply = {
            ...message,
            reply_to: (message as any).reply_to_message
              ? {
                  id: (message as any).reply_to_message.id,
                  content: (message as any).reply_to_message.content,
                  sender: {
                    full_name: (message as any).reply_to_message.sender?.full_name,
                  },
                }
              : undefined,
          }
          setMessages(prev => [...prev, withReply as Message])
          setReplyingTo(null)
        }
      })
    supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation.id)
      .then(() => {})
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100dvh-3.5rem)] lg:h-full min-h-0">
        <div className="flex-1 flex min-h-0">
          <ChatInterface
            conversation={conversation}
            messages={messages}
            loading={false}
            currentUserId={user.id}
            onSendMessage={handleSendMessageWithReply}
            onDeleteMessage={() => {}}
            onDeleteConversation={() => {}}
            showMobileView={true}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
          />
        </div>
      </div>
    </MainLayout>
  )
}

