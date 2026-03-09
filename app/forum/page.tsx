"use client"

import { useState, useEffect } from "react"
import MainLayout from "@/components/main-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Users, MessageSquare, Plus, Search, TrendingUp, Clock, Pin, Lock, Settings, Loader2 } from "lucide-react"
import Link from "next/link"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

// Define types for our data
type Forum = {
  id: string
  name: string
  description: string
  category: string
  member_count: number
  thread_count: number
  latest_activity: string
  moderators: string[]
  is_private: boolean
  creator: string
  admin_id?: string
}

type Thread = {
  id: string
  title: string
  content: string
  author: {
    username: string
    full_name: string
    avatar_url: string
  }
  forum_name: string
  replies_count: number
  views_count: number
  created_at: string
  last_activity: string
  is_pinned: boolean
  is_locked: boolean
}

// Default forum categories - these will be updated based on actual forums
const defaultForumCategories = ["All", "Solar Energy", "Waste Reduction", "Climate Action", "Technology", "Agriculture"]

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

  if (diffInHours < 1) return "Just now"
  if (diffInHours < 24) return `${diffInHours}h ago`
  if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
  return date.toLocaleDateString()
}

export default function ForumPage() {
  const [forums, setForums] = useState<Forum[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [forumSort, setForumSort] = useState("recent")
  const [threadSort, setThreadSort] = useState("activity")
  const [activeTab, setActiveTab] = useState("forums")
  const [isCreateForumOpen, setIsCreateForumOpen] = useState(false)
  const [newForumData, setNewForumData] = useState({
    name: "",
    description: "",
    category: "",
    is_private: false,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [forumCategories, setForumCategories] = useState(defaultForumCategories)
  
  // Predefined categories for forum creation
  const predefinedCategories = [
    "General Discussion",
    "Sustainability",
    "Technology",
    "Environment",
    "Climate Change",
    "Renewable Energy",
    "Green Living",
    "Conservation",
    "Eco-Friendly Products",
    "Community Projects",
    "Education",
    "News & Updates",
    "Q&A",
    "Other"
  ]
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const { toast } = useToast()
  const supabase = createClientComponentClient()
  
  // Fetch user session
  useEffect(() => {
    const fetchUserSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', session.user.id)
          .single()
        
        if (profile) {
          setCurrentUser(profile.username)
        }
      }
    }
    
    fetchUserSession()
  }, [])

  const filteredForums = forums.filter((forum) => {
    const matchesSearch =
      forum.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      forum.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "All" || forum.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const filteredThreads = threads.filter(
    (thread) =>
      thread.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      thread.author?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const sortedForums = [...filteredForums].sort((a, b) => {
    if (forumSort === "members") return (b.member_count || 0) - (a.member_count || 0)
    if (forumSort === "threads") return (b.thread_count || 0) - (a.thread_count || 0)
    return new Date(b.latest_activity || 0).getTime() - new Date(a.latest_activity || 0).getTime()
  })
  const sortedThreads = [...filteredThreads].sort((a, b) => {
    if (threadSort === "replies") return (b.replies_count || 0) - (a.replies_count || 0)
    if (threadSort === "views") return (b.views_count || 0) - (a.views_count || 0)
    return new Date(b.last_activity || 0).getTime() - new Date(a.last_activity || 0).getTime()
  })

  
  const categoryCounts = forums.reduce<Record<string, number>>((acc, forum) => {
    acc[forum.category] = (acc[forum.category] || 0) + 1
    return acc
  }, {})

  const activeMembersCount = new Set(
    [
      ...forums.map((forum) => forum.creator).filter(Boolean),
      ...threads.map((thread) => thread.author?.username).filter(Boolean),
    ].filter((value) => value !== "Unknown User")
  ).size

  const popularTopics = (() => {
    const topicCounts = new Map<string, number>()
    const hashtagRegex = /#([A-Za-z0-9_]+)/g

    for (const thread of threads) {
      const sourceText = `${thread.title || ""} ${thread.content || ""}`
      const matches = sourceText.match(hashtagRegex) || []
      for (const match of matches) {
        const normalized = `#${match.slice(1)}`
        topicCounts.set(normalized, (topicCounts.get(normalized) || 0) + 1)
      }
    }

    if (topicCounts.size > 0) {
      return [...topicCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic]) => topic)
    }

    return Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category]) => `#${category.replace(/\s+/g, "")}`)
  })()


  const getCategoryCount = (category: string) => {
    if (category === "All") return forums.length
    return categoryCounts[category] || 0
  }
  // Function to fetch forums and threads - extracted for reuse
  const fetchForumsAndThreads = async () => {
    setIsLoading(true)
    try {
      // Fetch forums
      const forumsResponse = await fetch('/api/forums')
      if (!forumsResponse.ok) throw new Error('Failed to fetch forums')
      const forumsData = await forumsResponse.json()
      
      // Filter forums to only include those created by real users (with admin_id)
      const userCreatedForums = forumsData.filter((forum: Forum) => forum.admin_id)
      setForums(userCreatedForums)
      
      // Extract unique categories from forums
      const categories = ['All', ...new Set(userCreatedForums.map((forum: Forum) => forum.category))] as string[]
      setForumCategories(categories)
      
      // Fetch all threads from user-created forums for accurate stats/topics
      const threadsPromises = userCreatedForums.map((forum: Forum) => 
        fetch(`/api/forums/${forum.id}/threads`).then(res => res.json())
      )
      
      const threadsArrays = await Promise.all(threadsPromises)
      const allThreads = threadsArrays.flat().map((thread: any) => ({
        id: thread.id,
        title: thread.title,
        content: thread.content || "",
        author: {
          username: thread.author?.username || 'Unknown User',
          full_name: thread.author?.full_name || 'Unknown User',
          avatar_url: thread.author?.avatar_url || null,
        },
        forum_name: userCreatedForums.find((f: Forum) => f.id === thread.forum_id)?.name || '',
        replies_count: thread.replies_count,
        views_count: thread.views_count,
        created_at: thread.created_at,
        last_activity: thread.updated_at || thread.created_at,
        is_pinned: thread.is_pinned,
        is_locked: thread.is_locked,
      }))
      
      setThreads(allThreads)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Error",
        description: "Failed to load forums and threads",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Use the extracted function in useEffect
  useEffect(() => {
    fetchForumsAndThreads()
  }, [])

  const handleCreateForum = async () => {
    if (!currentUser) {
      toast({
        title: "Error",
        description: "You must be logged in to create a forum",
        variant: "destructive",
      })
      return
    }

    if (newForumData.name.trim() && newForumData.description.trim() && newForumData.category) {
      try {
        const response = await fetch('/api/forums', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: newForumData.name,
            description: newForumData.description,
            category: newForumData.category,
            is_private: newForumData.is_private,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to create forum')
        }
        
        // Reset form data and close dialog
        const forumName = newForumData.name
        setNewForumData({ name: "", description: "", category: "", is_private: false })
        setIsCreateForumOpen(false)

        // Refresh forums list to include the newly created forum
        await fetchForumsAndThreads()

        toast({
          title: "Forum created!",
          description: `${forumName} has been created successfully`,
        })
      } catch (error) {
        console.error('Error creating forum:', error)
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to create forum",
          variant: "destructive",
        })
      }
    }
  }

  const isForumCreator = (forum: Forum) => {
    if (!currentUser) return false;
    return forum.creator === currentUser;
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto p-3 sm:p-4 pb-20 lg:pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Community Forum</h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Connect and discuss sustainability topics</p>
            </div>
          </div>
          <div className="flex space-x-2 w-full sm:w-auto">
            <Dialog open={isCreateForumOpen} onOpenChange={setIsCreateForumOpen}>
              <DialogTrigger asChild>
                <Button className="sustainability-gradient w-full sm:w-auto h-10 sm:h-9">
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Create Forum</span>
                  <span className="sm:hidden">Create</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] mx-4 max-h-[90vh] overflow-y-auto">
                <DialogHeader className="space-y-2">
                  <DialogTitle className="text-lg sm:text-xl">Create New Forum</DialogTitle>
                  <DialogDescription>Enter forum details and choose a category</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 sm:space-y-6">
                  <div>
                    <label className="text-sm sm:text-base font-medium mb-2 block">Forum Name</label>
                    <Input
                      placeholder="Enter forum name..."
                      value={newForumData.name}
                      onChange={(e) => setNewForumData((prev) => ({ ...prev, name: e.target.value }))}
                      className="h-10 sm:h-9"
                    />
                  </div>
                  <div>
                    <label className="text-sm sm:text-base font-medium mb-2 block">Description</label>
                    <Textarea
                      placeholder="Describe what this forum is about..."
                      value={newForumData.description}
                      onChange={(e) => setNewForumData((prev) => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="min-h-[80px] sm:min-h-[100px] resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm sm:text-base font-medium mb-2 block">Category</label>
                    <Select
                      value={newForumData.category}
                      onValueChange={(value) => setNewForumData((prev) => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger className="h-10 sm:h-9">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {predefinedCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2 py-2">
                    <input
                      type="checkbox"
                      id="private"
                      checked={newForumData.is_private}
                      onChange={(e) => setNewForumData((prev) => ({ ...prev, is_private: e.target.checked }))}
                      className="rounded h-4 w-4 sm:h-5 sm:w-5"
                    />
                    <label htmlFor="private" className="text-xs sm:text-sm">
                      Make this forum private
                    </label>
                  </div>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 pt-4">
                    <Button onClick={handleCreateForum} className="flex-1 w-full sm:w-auto h-10 sm:h-9">
                      Create Forum
                    </Button>
                    <Button variant="outline" onClick={() => setIsCreateForumOpen(false)} className="w-full sm:w-auto h-10 sm:h-9">
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
          <div className="lg:col-span-3">
            <div className="mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search forums and threads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 sm:h-9"
                  />
                </div>
                <Select
                  value={activeTab === "forums" ? forumSort : threadSort}
                  onValueChange={(value) => {
                    if (activeTab === "forums") {
                      setForumSort(value)
                    } else {
                      setThreadSort(value)
                    }
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[220px] h-10 sm:h-9">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTab === "forums" ? (
                      <>
                        <SelectItem value="recent">Recently Active</SelectItem>
                        <SelectItem value="members">Most Members</SelectItem>
                        <SelectItem value="threads">Most Threads</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="activity">Latest Activity</SelectItem>
                        <SelectItem value="replies">Most Replies</SelectItem>
                        <SelectItem value="views">Most Views</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {activeTab === "forums" ? sortedForums.length : sortedThreads.length} results
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6 h-10 sm:h-9">
                <TabsTrigger value="forums" className="text-sm sm:text-base">Forums</TabsTrigger>
                <TabsTrigger value="threads" className="text-sm sm:text-base">Recent Threads</TabsTrigger>
              </TabsList>

              <TabsContent value="forums" className="space-y-4">
                {isLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                  </div>
                ) : sortedForums.length > 0 ? (
                  sortedForums.map((forum) => (
                    <Card key={forum.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0">
                          <div className="flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 mb-2">
                              <Link
                                href={`/forum/${forum.id}`}
                                className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 hover:text-green-600 break-words"
                              >
                                {forum.name}
                              </Link>
                              <div className="flex items-center space-x-2">
                                {forum.is_private && <Lock className="w-4 h-4 text-gray-500" />}
                                {isForumCreator(forum) && (
                                  <Badge variant="secondary" className="text-xs">
                                    Creator
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{forum.description}</p>
                            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                              <div className="flex items-center space-x-1">
                                <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>{forum.member_count.toLocaleString()} members</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>{forum.thread_count} threads</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>Active {formatTimeAgo(forum.latest_activity)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end space-x-2">
                            <Badge variant="secondary" className="text-xs">{forum.category}</Badge>
                            {isForumCreator(forum) && (
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                                <Link href={`/forum/${forum.id}/manage`}>
                                  <Settings className="w-4 h-4" />
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 sm:py-12 px-4">
                    <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No user-created forums found</h3>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4">
                      {searchQuery 
                        ? "No forums match your search criteria." 
                        : currentUser 
                          ? "Be the first to create a forum for the community!" 
                          : "Log in to create and view community forums."}
                    </p>
                    <Button 
                      onClick={() => {
                        if (currentUser) {
                          setIsCreateForumOpen(true);
                        } else {
                          toast({
                            title: "Login required",
                            description: "You must be logged in to create a forum",
                            variant: "destructive",
                          });
                        }
                      }} 
                      className="sustainability-gradient h-10 sm:h-9"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Forum
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="threads" className="space-y-4">
                {isLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                  </div>
                ) : sortedThreads.length > 0 ? (
                  sortedThreads.map((thread) => (
                    <Card key={thread.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex items-start space-x-3 sm:space-x-4">
                          <Avatar className="w-8 h-8 sm:w-10 sm:h-10">
                            <AvatarImage src={thread.author.avatar_url || "/placeholder.svg"} />
                            <AvatarFallback>{thread.author.full_name.charAt(0)}</AvatarFallback>
                          </Avatar>

                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              {thread.is_pinned && <Pin className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />}
                              <Link
                                href={`/forum/thread/${thread.id}`}
                                className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 hover:text-green-600 break-words"
                              >
                                {thread.title}
                              </Link>
                              {thread.is_locked && <Lock className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />}
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
                              <span>by</span>
                              <Link
                                href={`/profile/${thread.author.username}`}
                                className="font-medium hover:text-green-600"
                              >
                                {thread.author.full_name}
                              </Link>
                              <span>in</span>
                              <Badge variant="outline" className="text-xs">
                                {thread.forum_name}
                              </Badge>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                              <div className="flex items-center space-x-1">
                                <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>{thread.replies_count} replies</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <span>{thread.views_count} views</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>Last activity {formatTimeAgo(thread.last_activity)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 sm:py-12 px-4">
                    <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No threads found</h3>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4">
                      {searchQuery 
                        ? "No threads match your search criteria." 
                        : forums.length > 0 
                          ? "No threads have been created in any forums yet." 
                          : currentUser 
                            ? "Create a forum first to start discussions!" 
                            : "Log in to create forums and participate in discussions."}
                    </p>
                    {forums.length > 0 && (
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4">
                        Visit a forum to create the first thread!
                      </p>
                    )}
                    {forums.length === 0 && currentUser && (
                      <Button 
                        onClick={() => setIsCreateForumOpen(true)} 
                        className="sustainability-gradient h-10 sm:h-9"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Forum
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-base sm:text-lg">Categories</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 sm:space-y-2 pt-0">
                {forumCategories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "ghost"}
                    className="w-full justify-start text-sm sm:text-base h-8 sm:h-9"
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category} ({getCategoryCount(category)})
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Popular Topics</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 sm:space-y-3 pt-0">
                <div className="space-y-1 sm:space-y-2">
                  {popularTopics.length > 0 ? (
                    popularTopics.map((topic) => (
                      <p key={topic} className="text-xs sm:text-sm font-medium">{topic}</p>
                    ))
                  ) : (
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">No topics yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-base sm:text-lg">Forum Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 sm:space-y-3 pt-0">
                <div className="flex justify-between">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Forums</span>
                  <span className="font-medium text-sm sm:text-base">{forums.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Threads</span>
                  <span className="font-medium text-sm sm:text-base">{threads.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Active Members</span>
                  <span className="font-medium text-sm sm:text-base">{activeMembersCount.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}

