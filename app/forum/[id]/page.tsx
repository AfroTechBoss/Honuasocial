"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import MainLayout from "@/components/main-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  Users,
  MessageSquare,
  Plus,
  Search,
  ArrowLeft,
  Pin,
  Lock,
  Clock,
  ThumbsUp,
  MoreHorizontal,
  Flag,
  Share2,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

// Define types for our data
type Thread = {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
  forum_id: string
  author_id: string
  is_pinned: boolean
  is_locked: boolean
  views_count: number
  replies_count: number
  author: {
    id: string
    username: string
    full_name: string
    avatar_url: string
  }
}

type Forum = {
  id: string
  name: string
  description: string
  category: string
  member_count: number
  thread_count: number
  latest_activity: string
  moderators: (string | {
    id?: string
    username?: string
    full_name?: string
    avatar_url?: string
  })[]
  is_private: boolean
  creator: string
  admin_id: string
  created_at: string
  cover_image?: string
  rules?: string[]
}

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

  if (diffInHours < 1) return "Just now"
  if (diffInHours < 24) return `${diffInHours}h ago`
  if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
  return date.toLocaleDateString()
}

export default function ForumDetailPage() {
  const params = useParams()
  const { toast } = useToast()
  const supabase = createClientComponentClient()
  const forumId = params.id as string
  
  const [forum, setForum] = useState<Forum | null>(null)
  const [threads, setThreads] = useState<Thread[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [threadSort, setThreadSort] = useState("activity")
  const [newThreadTitle, setNewThreadTitle] = useState("")
  const [newThreadContent, setNewThreadContent] = useState("")
  const [isCreatingThread, setIsCreatingThread] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [isLocked, setIsLocked] = useState(false)

  // Check if the current user is the creator of the forum
  const isForumCreator = () => {
    if (!currentUser || !forum) return false
    return forum.admin_id === currentUser.id
  }
  
  // Check if the user is logged in
  const isLoggedIn = () => {
    return !!currentUser
  }

  // Fetch forum and threads data
  useEffect(() => {
    const fetchUserSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setCurrentUser(session.user)
        }
      } catch (error) {
        console.error("Error fetching user session:", error)
      }
    }

    fetchUserSession()
  }, [])

  useEffect(() => {
    const fetchForumData = async () => {
      if (!forumId) return
      
      setIsLoading(true)
      try {
        // Fetch forum details
        const forumResponse = await fetch(`/api/forums/${forumId}`)
        if (!forumResponse.ok) {
          throw new Error(`Failed to fetch forum: ${forumResponse.statusText}`)
        }
        const forumData = await forumResponse.json()
        setForum(forumData)
        
        // Fetch threads for this forum
        const threadsResponse = await fetch(`/api/forums/${forumId}/threads`)
        if (!threadsResponse.ok) {
          throw new Error(`Failed to fetch threads: ${threadsResponse.statusText}`)
        }
        const threadsData = await threadsResponse.json()
        setThreads(threadsData)
      } catch (error) {
        console.error("Error fetching forum data:", error)
        toast({
          title: "Error",
          description: "Failed to load forum data. Please try again later.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchForumData()
  }, [forumId, toast])

  // Filter threads based on search query
  const filteredThreads = threads.filter(thread => 
    thread.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    thread.content?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const sortedThreads = [...filteredThreads].sort((a, b) => {
    if (threadSort === "replies") return (b.replies_count || 0) - (a.replies_count || 0)
    if (threadSort === "views") return (b.views_count || 0) - (a.views_count || 0)
    return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
  })

  // Handle creating a new thread
  const handleCreateThread = async () => {
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to create a thread.",
        variant: "destructive",
      })
      return
    }

    if (!newThreadTitle.trim() || !newThreadContent.trim()) {
      toast({
        title: "Validation error",
        description: "Thread title and content are required.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch(`/api/forums/${forumId}/threads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newThreadTitle,
          content: newThreadContent,
          is_pinned: isPinned,
          is_locked: isLocked,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to create thread: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Add the new thread to the threads list
      setThreads(prevThreads => [data, ...prevThreads])
      
      // Reset form and close dialog
      setNewThreadTitle("")
      setNewThreadContent("")
      setIsPinned(false)
      setIsLocked(false)
      setIsCreatingThread(false)
      
      toast({
        title: "Success",
        description: "Thread created successfully!",
      })
    } catch (error) {
      console.error("Error creating thread:", error)
      toast({
        title: "Error",
        description: "Failed to create thread. Please try again later.",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="max-w-6xl mx-auto p-4 flex justify-center items-center" style={{ minHeight: "60vh" }}>
          <Loader2 className="w-10 h-10 animate-spin text-green-600" />
        </div>
      </MainLayout>
    )
  }

  if (!forum) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto p-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Forum Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">The forum you're looking for doesn't exist.</p>
          <Button asChild>
            <Link href="/forum">Back to Forums</Link>
          </Button>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto p-2 sm:p-4 pb-20 lg:pb-4">
        {/* Back Navigation */}
        <div className="mb-4 sm:mb-6 relative z-10">
          <Button variant="ghost" asChild className="mb-2 sm:mb-4 h-10 sm:h-auto px-2 sm:px-4">
            <Link href="/forum">
              <ArrowLeft className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="text-sm sm:text-base">Back to Forums</span>
            </Link>
          </Button>
        </div>

        {/* Forum Header */}
        <div className="relative mb-4 sm:mb-8 overflow-hidden">
          <div
            className="h-32 sm:h-48 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg bg-cover bg-center"
            style={{ backgroundImage: forum.cover_image ? `url(${forum.cover_image})` : undefined }}
          >
            <div className="absolute inset-0 bg-black bg-opacity-40 rounded-lg"></div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-6 text-white">
            <div className="flex flex-col space-y-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1 sm:mb-2">
                  <h1 className="text-lg sm:text-3xl font-bold truncate pr-2">{forum.name}</h1>
                  {forum.is_private && <Lock className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />}
                </div>
                <p className="text-xs sm:text-lg opacity-90 mb-2 line-clamp-2 pr-2">{forum.description}</p>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm mb-3 sm:mb-0">
                  <div className="flex items-center space-x-1">
                    <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="whitespace-nowrap">{(forum.member_count || 0).toLocaleString()} members</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="whitespace-nowrap">{forum.thread_count || 0} threads</span>
                  </div>
                  <Badge variant="secondary" className="bg-white/20 text-white text-xs px-2 py-1">
                    {forum.category}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 sm:justify-end">
                <Button 
                  className="bg-green-600 hover:bg-green-700 h-9 sm:h-10 text-sm w-full sm:w-auto" 
                  onClick={() => {
                    if (!isLoggedIn()) {
                      toast({
                        title: "Authentication required",
                        description: "You must be logged in to create a thread.",
                        variant: "destructive",
                      })
                      return
                    }
                    setIsCreatingThread(true)
                  }}
                >
                  <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">New Thread</span>
                  <span className="sm:hidden">New</span>
                </Button>
                {isLoggedIn() && (
                  <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white h-9 sm:h-10 text-sm w-full sm:w-auto">
                    <span className="hidden sm:inline">Join Forum</span>
                    <span className="sm:hidden">Join</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
          <div className="lg:col-span-3">
            {/* Search and Filters */}
            <div className="mb-4 sm:mb-6 space-y-2">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search threads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 sm:h-auto text-sm sm:text-base"
                  />
                </div>
                <Select value={threadSort} onValueChange={setThreadSort}>
                  <SelectTrigger className="w-full sm:w-[220px] h-10 sm:h-auto">
                    <SelectValue placeholder="Sort threads" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activity">Latest Activity</SelectItem>
                    <SelectItem value="replies">Most Replies</SelectItem>
                    <SelectItem value="views">Most Views</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">{sortedThreads.length} threads found</p>
            </div>

            {/* Create Thread Form */}
            {isCreatingThread && (
              <Card className="mb-4 sm:mb-6">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl">Create New Thread</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                  <Input
                    placeholder="Thread title..."
                    value={newThreadTitle}
                    onChange={(e) => setNewThreadTitle(e.target.value)}
                    className="h-10 sm:h-auto text-sm sm:text-base"
                  />
                  <Textarea
                    placeholder="What would you like to discuss?"
                    value={newThreadContent}
                    onChange={(e) => setNewThreadContent(e.target.value)}
                    rows={4}
                    className="min-h-[100px] sm:min-h-[120px] text-sm sm:text-base resize-none"
                  />
                  
                  {/* Admin/Creator Options */}
                  {isForumCreator() && (
                    <div className="flex flex-col space-y-2 p-3 border rounded-md border-gray-200 dark:border-gray-800">
                      <h4 className="text-sm font-medium">Admin Options</h4>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="pin-thread"
                          checked={isPinned}
                          onChange={(e) => setIsPinned(e.target.checked)}
                          className="rounded text-green-600 focus:ring-green-600 w-4 h-4"
                        />
                        <label htmlFor="pin-thread" className="text-sm">Pin Thread</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="lock-thread"
                          checked={isLocked}
                          onChange={(e) => setIsLocked(e.target.checked)}
                          className="rounded text-green-600 focus:ring-green-600 w-4 h-4"
                        />
                        <label htmlFor="lock-thread" className="text-sm">Lock Thread</label>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <Button onClick={handleCreateThread} className="bg-green-600 hover:bg-green-700 h-10 text-sm sm:text-base">
                      Create Thread
                    </Button>
                    <Button variant="outline" onClick={() => setIsCreatingThread(false)} className="h-10 text-sm sm:text-base">
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Threads List */}
            <div className="space-y-3 sm:space-y-4">
              {sortedThreads.length === 0 ? (
                <Card>
                  <CardContent className="p-4 sm:p-6 text-center">
                    <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm sm:text-base">No threads found</p>
                    <Button 
                      onClick={() => {
                        if (!isLoggedIn()) {
                          toast({
                            title: "Authentication required",
                            description: "You must be logged in to create a thread.",
                            variant: "destructive",
                          })
                          return
                        }
                        setIsCreatingThread(true)
                      }} 
                      className="bg-green-600 hover:bg-green-700 h-10 text-sm sm:text-base"
                    >
                      <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                      Create Thread
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                sortedThreads.map((thread) => (
                  <Card key={thread.id} className="hover:shadow-md transition-shadow overflow-hidden">
                    <CardContent className="p-3 sm:p-6">
                      <div className="flex items-start space-x-3 sm:space-x-4">
                        <Avatar className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
                          <AvatarImage src={thread.author?.avatar_url || "/placeholder.svg"} />
                          <AvatarFallback className="text-xs sm:text-sm">{thread.author?.full_name?.charAt(0) || thread.author?.username?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-start space-x-2 mb-2">
                            <div className="flex items-center space-x-1 flex-shrink-0">
                              {thread.is_pinned && <Pin className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />}
                              {thread.is_locked && <Lock className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />}
                            </div>
                            <Link
                              href={`/forum/thread/${thread.id}`}
                              className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 hover:text-green-600 line-clamp-2 flex-1 break-words"
                            >
                              {thread.title}
                            </Link>
                          </div>

                          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-3 line-clamp-2 break-words">{thread.content}</p>

                          <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400 min-w-0">
                              <div className="flex items-center space-x-1 min-w-0">
                                <span>by</span>
                                <Link
                                  href={`/profile/${thread.author?.username || 'unknown'}`}
                                  className="font-medium hover:text-green-600 truncate max-w-[100px] sm:max-w-[150px]"
                                >
                                  {thread.author?.full_name || thread.author?.username || 'Unknown User'}
                                </Link>
                              </div>
                              <div className="flex items-center space-x-1 flex-shrink-0">
                                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="whitespace-nowrap">{formatTimeAgo(thread.created_at)}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end flex-shrink-0">
                              <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                <div className="flex items-center space-x-1">
                                  <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                                  <span>{thread.replies_count || 0}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <span className="whitespace-nowrap">{thread.views_count || 0} views</span>
                                </div>
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 sm:h-auto sm:w-auto sm:p-2 ml-2">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem className="text-sm">
                                    <Share2 className="w-4 h-4 mr-2" />
                                    Share
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-sm">
                                    <Flag className="w-4 h-4 mr-2" />
                                    Report
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 sm:space-y-6">
            {forum.rules && forum.rules.length > 0 && (
              <Card>
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="text-base sm:text-lg font-semibold">Forum Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {forum.rules.map((rule, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <span className="text-green-600 font-bold text-xs sm:text-sm">{index + 1}.</span>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{rule}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {forum.moderators && forum.moderators.length > 0 && (
              <Card>
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="text-base sm:text-lg font-semibold">Moderators</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {forum.moderators.map((moderator, index) => {
                    const isString = typeof moderator === 'string'
                    const modObj = isString ? null : moderator
                    const displayName = isString ? moderator : (modObj?.username || modObj?.full_name || 'Unknown')
                    const avatarUrl = isString ? "/placeholder.svg" : (modObj?.avatar_url || "/placeholder.svg")
                    const initials = isString 
                      ? moderator.charAt(0).toUpperCase() 
                      : (modObj?.full_name?.charAt(0)?.toUpperCase() || modObj?.username?.charAt(0)?.toUpperCase() || 'M')
                    
                    return (
                      <div key={modObj?.id || displayName || index} className="flex items-center space-x-3">
                        <Avatar className="w-7 h-7 sm:w-8 sm:h-8">
                          <AvatarImage src={avatarUrl} />
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-medium truncate">
                            @{displayName}
                          </p>
                          <p className="text-xs text-gray-500">Moderator</p>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-base sm:text-lg font-semibold">Forum Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Threads</span>
                  <span className="text-xs sm:text-sm font-medium">{forum.thread_count || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Members</span>
                  <span className="text-xs sm:text-sm font-medium">{(forum.member_count || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Last Activity</span>
                  <span className="text-xs sm:text-sm font-medium truncate ml-2">{forum.latest_activity ? formatTimeAgo(forum.latest_activity) : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Created By</span>
                  <span className="text-xs sm:text-sm font-medium truncate ml-2">{forum.creator || 'Unknown'}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}

