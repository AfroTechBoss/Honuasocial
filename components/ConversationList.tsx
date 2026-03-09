"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, MessageCircle, ArrowLeft } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

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

interface ConversationListProps {
  conversations: Conversation[]
  loading: boolean
  selectedConversationId?: string
  onConversationSelect?: (conversation: Conversation) => void
  showMobileView: boolean
}

export default function ConversationList({
  conversations,
  loading,
  selectedConversationId,
  onConversationSelect,
  showMobileView
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()

  const filteredConversations = conversations.filter(conversation =>
    conversation.otherParticipant?.full_name
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase()) ||
    conversation.otherParticipant?.username
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase())
  )

  const handleConversationClick = (conversation: Conversation) => {
    if (showMobileView) {
      // Navigate to individual chat page on mobile
      router.push(`/messages/${conversation.id}`)
    } else {
      // Call the selection handler for desktop
      onConversationSelect?.(conversation)
    }
  }

  const formatMessageTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch {
      return "Just now"
    }
  }

  const truncateMessage = (message: string, maxLength: number = 50) => {
    if (message.length <= maxLength) return message
    return message.substring(0, maxLength) + "..."
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3 mb-4">
            {showMobileView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="p-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <h1 className="text-xl font-semibold">Messages</h1>
          </div>
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Loading conversations */}
        <div className="flex-1 overflow-y-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background min-h-0">
      {/* Header - safe area on mobile */}
      <div className="p-4 pb-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3 mb-4">
          {showMobileView && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <h1 className="text-xl font-semibold">Messages</h1>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Conversations List - scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageCircle className="w-16 h-16 mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2 text-foreground">No conversations yet</h3>
            <p className="text-sm text-center px-4">
              {searchQuery
                ? "No conversations match your search"
                : "Start a conversation by visiting someone's profile"}
            </p>
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => handleConversationClick(conversation)}
              className={`p-4 md:p-3 border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors active:bg-muted/70 ${
                selectedConversationId === conversation.id
                  ? "bg-primary/10 border-primary/20"
                  : ""
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="relative">
                  <Avatar className="w-12 h-12 md:w-10 md:h-10">
                    <AvatarImage
                      src={conversation.otherParticipant?.avatar_url}
                      alt={conversation.otherParticipant?.full_name}
                    />
                    <AvatarFallback>
                      {conversation.otherParticipant?.full_name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("") || "?"}
                    </AvatarFallback>
                  </Avatar>
                  {conversation.otherParticipant?.is_online && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                  )}
                </div>

                {/* Conversation Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-foreground truncate">
                      {conversation.otherParticipant?.full_name || "Unknown User"}
                    </h3>
                    {conversation.latestMessage && (
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatMessageTime(conversation.latestMessage.created_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground truncate">
                      {conversation.latestMessage
                        ? truncateMessage(conversation.latestMessage.content)
                        : "No messages yet"}
                    </p>
                    {conversation.unread_count && conversation.unread_count > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-1 min-w-[20px] text-center flex-shrink-0 ml-2">
                        {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

