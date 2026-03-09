"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { User } from "@supabase/auth-helpers-nextjs"
import ConversationList from "@/components/ConversationList"
import { ChatInterface } from "@/components/ChatInterface"
import MainLayout from "@/components/main-layout"
import { Suspense } from "react"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

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
  latestMessage?: {
    content: string
    created_at: string
    sender_id: string
  }
  unread_count?: number
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
  reply_to?: {
    id: string
    content: string
    sender: {
      full_name: string
    }
  }
  sender?: {
    id: string
    username: string
    full_name: string
    avatar_url: string
  }
  reply_to_message?: {
    id: string
    content: string
    sender: {
      id: string
      username: string
      full_name: string
    }
  }
  reactions?: Array<{
    emoji: string
    count: number
    reacted_by_user: boolean
  }>
}

function MessagesPageContent() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const { toast } = useToast()
  const supabase = createClientComponentClient()
  const searchParams = useSearchParams()
  const fetchConvDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messagesFetchControllerRef = useRef<AbortController | null>(null)

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error) {
          console.error('Error getting user:', error)
        } else {
          setUser(user)
        }
      } catch (error) {
        console.error('Error in getUser:', error)
      } finally {
        setAuthLoading(false)
      }
    }

    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch conversations
  const fetchConversations = async () => {
    if (!user?.id) return

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          participant_one:profiles!participant_one_id (
            id,
            username,
            full_name,
            avatar_url
          ),
          participant_two:profiles!participant_two_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .or(`participant_one_id.eq.${user?.id},participant_two_id.eq.${user?.id}`)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Supabase error details:', error)
        throw error
      }

      if (!data) {
        console.warn('No conversation data returned')
        setConversations([])
        return
      }

      // Filter out conversations where both participants are missing
      const conversationsWithParticipants = data.filter(conversation => {
        return conversation.participant_one || conversation.participant_two
      }).map(conversation => {
        const otherParticipant = conversation.participant_one?.id === user?.id 
          ? conversation.participant_two 
          : conversation.participant_one
        
        return {
          id: conversation.id,
          participant_one_id: conversation.participant_one_id,
          participant_two_id: conversation.participant_two_id,
          otherParticipant: otherParticipant ? {
            ...otherParticipant,
            is_online: false // Default to false, will be updated by real-time subscriptions
          } : undefined,
          updated_at: conversation.updated_at,
          created_at: conversation.created_at
        }
      })

      const conversationIds = conversationsWithParticipants.map(c => c.id)
      type LatestMessageRow = {
        id: string
        content: string
        created_at: string
        sender_id: string
        conversation_id: string
      }
      let latestMessagesMap: Record<string, LatestMessageRow> = {}
      if (conversationIds.length > 0) {
        const { data: latestMessagesAll } = await supabase
          .from('messages')
          .select('id, content, created_at, sender_id, conversation_id')
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false })
        for (const m of (latestMessagesAll || []) as LatestMessageRow[]) {
          if (!latestMessagesMap[m.conversation_id]) {
            latestMessagesMap[m.conversation_id] = m
          }
        }
      }
      const conversationsWithMessages = conversationsWithParticipants.map(conv => ({
        ...conv,
        latestMessage: latestMessagesMap[conv.id] || null
      }))

      const transformedConversations = conversationsWithMessages.map(conv => ({
        id: conv.id,
        participant_one_id: conv.participant_one_id,
        participant_two_id: conv.participant_two_id,
        otherParticipant: conv.otherParticipant,
        latestMessage: conv.latestMessage ? {
          content: conv.latestMessage.content,
          created_at: conv.latestMessage.created_at,
          sender_id: conv.latestMessage.sender_id
        } : undefined,
        updated_at: conv.updated_at,
        created_at: conv.created_at
      }))

      setConversations(transformedConversations)
    } catch (error: any) {
      console.error('Error fetching conversations:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code
      })
      toast({
        title: "Error",
        description: `Failed to load conversations: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const scheduleFetchConversations = (delay = 300) => {
    if (fetchConvDebounceRef.current) {
      clearTimeout(fetchConvDebounceRef.current)
    }
    fetchConvDebounceRef.current = setTimeout(() => {
      fetchConversations()
    }, delay)
  }

  // Fetch messages for selected conversation
  const fetchMessages = async (conversationId: string) => {
    setMessagesLoading(true)
    try {
      if (messagesFetchControllerRef.current) {
        messagesFetchControllerRef.current.abort()
      }
      const controller = new AbortController()
      messagesFetchControllerRef.current = controller
      const response = await fetch(`/api/messages?conversation_id=${conversationId}`, { signal: controller.signal })
      if (response.ok) {
        const data = await response.json()
        setMessages(data)
      } else {
        console.error('Failed to fetch messages:', response.status, response.statusText)
        toast({
          title: "Error",
          description: "Failed to load messages",
          variant: "destructive"
        })
      }
    } catch (error: unknown) {
      if ((error as { name?: string })?.name !== 'AbortError') {
        console.error('Error fetching messages:', error)
        toast({
          title: "Error",
          description: "Failed to load messages",
          variant: "destructive"
        })
      }
    } finally {
      setMessagesLoading(false)
    }
  }

  // Handle conversation selection
  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation)
    setMessages([])
    fetchMessages(conversation.id)
    // Mark messages as read when opening conversation
    fetch('/api/messages/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversation.id }),
    }).catch(() => {})
  }

  // Send message
  const handleSendMessage = async (content?: string, replyToId?: string) => {
    const finalContent = (content ?? messageInput).trim()
    if (!finalContent || !selectedConversation || sendingMessage) return

    setSendingMessage(true)
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          content: finalContent,
          reply_to_id: replyToId || replyingTo?.id
        }),
      })

      if (response.ok) {
        const newMessage = await response.json()
        setMessages(prev => [...prev, newMessage])
        setConversations(prev => prev.map(conv => 
          conv.id === selectedConversation.id 
            ? { ...conv, latestMessage: { content: newMessage.content, created_at: newMessage.created_at, sender_id: newMessage.sender_id }, updated_at: newMessage.created_at }
            : conv
        ))
        setMessageInput('')
        setReplyingTo(null)
        toast({
          title: "Success",
          description: "Message sent successfully"
        })
      } else {
        console.error('Failed to send message:', response.status, response.statusText)
        const errorData = await response.json().catch(() => ({}))
        toast({
          title: "Error",
          description: errorData.error || "Failed to send message",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      })
    } finally {
      setSendingMessage(false)
    }
  }

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    setMessageInput(prev => prev + emoji)
  }

  // Create or get conversation with a user
  const createConversation = async (username: string) => {
    try {
      // First, get the user's profile by username
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .eq('username', username)
        .single()

      if (error || !profile) {
        toast({
          title: "Error",
          description: "User not found",
          variant: "destructive"
        })
        return
      }

      // Create or get conversation
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participant_id: profile.id
        })
      })

      if (response.ok) {
        const { conversation } = await response.json()
        
        // Create conversation object for UI
        const newConversation = {
          id: conversation.id,
          participant_one_id: conversation.participant_one_id,
          participant_two_id: conversation.participant_two_id,
          otherParticipant: {
            ...profile,
            is_online: false // Default to false, will be updated by real-time subscriptions
          },
          latestMessage: undefined,
          updated_at: conversation.updated_at,
          created_at: conversation.created_at
        }

        // Check if conversation already exists in state
        const existingIndex = conversations.findIndex(conv => conv.id === conversation.id)
        if (existingIndex === -1) {
          setConversations(prev => [newConversation, ...prev])
        }
        
        setSelectedConversation(newConversation)
        setMessages([])
        
        toast({
          title: "Conversation started",
          description: `You can now message ${profile.full_name}`,
        })
      }
    } catch (error) {
      console.error('Error creating conversation:', error)
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive"
      })
    }
  }

  // Load conversations on mount
  useEffect(() => {
    if (user?.id && !authLoading) {
      fetchConversations()
    }
  }, [user, authLoading])

  // Realtime: conversation list updates
  useEffect(() => {
    if (!user?.id) return
    const ch = supabase
      .channel('realtime:conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `or(participant_one_id.eq.${user.id},participant_two_id.eq.${user.id})`,
        },
        () => scheduleFetchConversations()
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id])

  // When conversation is selected: fetch messages, mark read, subscribe to messages (INSERT + UPDATE)
  useEffect(() => {
    if (!user?.id || !selectedConversation?.id) return

    fetchMessages(selectedConversation.id)
    fetch('/api/messages/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: selectedConversation.id }),
    }).catch(() => {})

    const channelName = `realtime:messages:${selectedConversation.id}`
    const ch = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        async (payload: { new: Record<string, unknown> }) => {
          scheduleFetchConversations()
          const id = payload.new?.id as string
          if (!id) return
          const { data: newMessage } = await supabase
            .from('messages')
            .select(`
              *,
              sender:profiles!messages_sender_id_fkey(id,username,full_name,avatar_url),
              reply_to_message:messages!messages_reply_to_fkey(id,content,sender:profiles!messages_sender_id_fkey(*))
            `)
            .eq('id', id)
            .single()
          if (newMessage) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMessage.id)) return prev
              return [...prev, newMessage as Message]
            })
            // Recipient: mark as delivered so sender sees two grey ticks
            if ((newMessage as Message).sender_id !== user?.id) {
              fetch('/api/messages/mark-delivered', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message_id: (newMessage as Message).id }),
              }).catch(() => {})
            }
            setConversations(prev =>
              prev.map(conv =>
                conv.id === selectedConversation.id
                  ? {
                      ...conv,
                      latestMessage: {
                        content: (newMessage as Message).content,
                        created_at: (newMessage as Message).created_at,
                        sender_id: (newMessage as Message).sender_id,
                      },
                      updated_at: (newMessage as Message).created_at,
                    }
                  : conv
              )
            )
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation.id}`,
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
  }, [user?.id, selectedConversation?.id])

  // Handle user parameter from URL to start a conversation
  useEffect(() => {
    const userParam = searchParams.get('user')
    if (userParam && user && conversations.length >= 0) {
      // Check if conversation with this user already exists
      const existingConversation = conversations.find(
        conv => conv.otherParticipant && conv.otherParticipant.username === userParam
      )
      
      if (existingConversation) {
        // Select existing conversation
        setSelectedConversation(existingConversation)
      } else {
        // Create new conversation with the user
        createConversation(userParam)
      }
    }
  }, [searchParams, user, conversations])

  if (authLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-foreground">Loading...</h2>
            <p className="text-muted-foreground">Please wait while we load your messages</p>
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
            <h2 className="text-xl font-semibold mb-2 text-foreground">Please sign in</h2>
            <p className="text-muted-foreground">You need to be signed in to view messages</p>
          </div>
        </div>
      </MainLayout>
    )
  }





  return (
    <MainLayout>
      <div className="h-[calc(100vh-3.5rem)] lg:h-full min-h-0 flex flex-col">
        {/* Mobile: conversation list only; tap conversation -> /messages/[id] */}
        <div className="lg:hidden flex-1 flex flex-col min-h-0">
          <ConversationList
            conversations={conversations}
            loading={loading}
            showMobileView={true}
          />
        </div>

        {/* Desktop: split pane */}
        <div className="hidden lg:flex flex-1 min-h-0">
          {/* Left Pane - Conversation List */}
          <div className="w-1/3 border-r border-border">
            <ConversationList
              conversations={conversations}
              loading={loading}
              selectedConversationId={selectedConversation?.id}
              onConversationSelect={handleConversationSelect}
              showMobileView={false}
            />
          </div>

          {/* Right Pane - Chat Interface */}
          <div className="flex-1">
            {selectedConversation ? (
              <ChatInterface
                conversation={selectedConversation}
                messages={messages}
                loading={messagesLoading}
                currentUserId={user?.id || ''}
                onSendMessage={handleSendMessage}
                onDeleteMessage={() => {}}
                onDeleteConversation={() => {}}
                showMobileView={false}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
              />
            ) : (
              <div className="flex items-center justify-center h-full bg-muted/30">
                <div className="text-center text-muted-foreground">
                  <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium mb-2 text-foreground">Select a conversation</h3>
                  <p className="text-sm">Choose a conversation from the list to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="h-screen flex">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-muted-foreground mb-2">
                Loading Messages...
              </h2>
            </div>
          </div>
        </div>
      </MainLayout>
    }>
      <MessagesPageContent />
    </Suspense>
  )
}
