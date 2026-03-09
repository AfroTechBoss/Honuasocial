'use client'

import { useState, useEffect } from 'react'
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

  const normalizeConversation = (conv: any): Conversation => {
    const fallbackOtherId = conv.participant_one_id === user?.id ? conv.participant_two_id : conv.participant_one_id
    const sourceOther = conv.otherParticipant

    const normalizedOtherParticipant = sourceOther
      ? {
          id: sourceOther.id,
          username: sourceOther.username || 'user',
          full_name: sourceOther.full_name || sourceOther.username || 'User',
          avatar_url: sourceOther.avatar_url || '/placeholder.svg',
          is_online: !!sourceOther.is_online,
        }
      : fallbackOtherId
        ? {
            id: fallbackOtherId,
            username: 'user',
            full_name: 'User',
            avatar_url: '/placeholder.svg',
            is_online: false,
          }
        : undefined

    return {
      id: conv.id,
      participant_one_id: conv.participant_one_id,
      participant_two_id: conv.participant_two_id,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      otherParticipant: normalizedOtherParticipant,
    }
  }

    const isGenericParticipant = (participant?: Conversation['otherParticipant']) => {
    if (!participant) return true
    const fullName = (participant.full_name || '').trim().toLowerCase()
    const username = (participant.username || '').trim().toLowerCase()
    return fullName === '' || fullName === 'user' || username === '' || username === 'user'
  }

  const fetchConversationFromList = async (): Promise<Conversation | null> => {
    const listResponse = await fetch('/api/conversations')
    if (!listResponse.ok) return null

    const list = await listResponse.json()
    const matched = (Array.isArray(list) ? list : []).find((item: any) => item.id === conversationId)
    if (!matched) return null

    return {
      id: matched.id,
      participant_one_id: matched.participant_one_id,
      participant_two_id: matched.participant_two_id,
      created_at: matched.created_at,
      updated_at: matched.updated_at,
      otherParticipant: matched.otherParticipant
        ? {
            id: matched.otherParticipant.id,
            username: matched.otherParticipant.username || 'user',
            full_name: matched.otherParticipant.full_name || matched.otherParticipant.username || 'User',
            avatar_url: matched.otherParticipant.avatar_url || '/placeholder.svg',
            is_online: !!matched.otherParticipant.is_online,
          }
        : undefined,
    }
  }

  const fetchConversation = async () => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`)
      if (response.ok) {
        const conv = await response.json()
        const normalized = normalizeConversation(conv)

        if (isGenericParticipant(normalized.otherParticipant)) {
          const fallbackConversation = await fetchConversationFromList()
          if (fallbackConversation && !isGenericParticipant(fallbackConversation.otherParticipant)) {
            setConversation(fallbackConversation)
            return
          }
        }

        setConversation(normalized)
        return
      }

      const fallbackConversation = await fetchConversationFromList()
      if (!fallbackConversation) {
        throw new Error('Failed to fetch conversation')
      }

      setConversation(fallbackConversation)
    } catch (error) {
      console.error('Error fetching conversation:', error)
      toast({
        title: 'Error',
        description: 'Failed to load conversation',
        variant: 'destructive',
      })
    }
  }
  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/messages?conversation_id=${conversationId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch messages')
      }

      const data = await response.json()
      setMessages(Array.isArray(data) ? data : [])

      fetch('/api/messages/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId }),
      }).catch(() => {})
    } catch (error) {
      console.error('Error fetching messages:', error)
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      setAuthLoading(false)
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user?.id || !conversationId) return

    setLoading(true)
    fetchConversation()
    fetchMessages()
  }, [user?.id, conversationId])

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
        (payload: { new: Record<string, unknown> }) => {
          const incomingId = payload.new?.id as string | undefined
          fetchMessages()
          if (incomingId && payload.new?.sender_id !== user?.id) {
            fetch('/api/messages/mark-delivered', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message_id: incomingId }),
            }).catch(() => {})
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
        () => {
          fetchMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [user?.id, conversationId])


  useEffect(() => {
    if (!conversation || !user?.id || messages.length === 0) return
    if (!isGenericParticipant(conversation.otherParticipant)) return

    const otherMessage = messages.find((message) => message.sender_id !== user.id && message.sender)
    if (!otherMessage?.sender) return

    setConversation((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        otherParticipant: {
          id: otherMessage.sender?.id || prev.otherParticipant?.id || 'unknown',
          username: otherMessage.sender?.username || prev.otherParticipant?.username || 'user',
          full_name:
            otherMessage.sender?.full_name ||
            otherMessage.sender?.username ||
            prev.otherParticipant?.full_name ||
            'User',
          avatar_url: otherMessage.sender?.avatar_url || prev.otherParticipant?.avatar_url || '/placeholder.svg',
          is_online: prev.otherParticipant?.is_online || false,
        },
      }
    })
  }, [messages, conversation, user?.id])
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
            <Button onClick={() => router.push('/messages')}>Back to Messages</Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  const handleSendMessageWithReply = async (content: string, replyToId?: string) => {
    if (!conversation || sendingMessage) return

    const trimmed = content.trim()
    if (!trimmed) return

    setSendingMessage(true)

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversation.id,
          content: trimmed,
          reply_to_id: replyToId || replyingTo?.id || null,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const message = await response.json()
      setMessages((prev) => [...prev, message])
      setReplyingTo(null)

      fetch('/api/messages/mark-delivered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: message.id }),
      }).catch(() => {})
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      })
    } finally {
      setSendingMessage(false)
    }
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



