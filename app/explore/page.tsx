"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { default as MainLayout } from "@/components/main-layout"
import PostCard from "@/components/post-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, TrendingUp, Users, Calendar, Sparkles, Verified, Loader2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

interface User {
  id: string
  username: string
  full_name: string
  avatar_url: string
  verified: boolean
  bio?: string
}

interface Post {
  id: string
  content: string
  image_url?: string
  created_at: string
  likes_count: number
  comments_count: number
  shares_count: number
  reposts_count: number
  updated_at: string
  liked_by_user: boolean
  bookmarked_by_user: boolean
  reposted_by_user: boolean
  media_urls?: string[]
  location?: string
  sustainability_category?: string
  impact_score?: number
  parent_id?: string
  link_preview_url?: string
  link_preview_title?: string
  link_preview_description?: string
  link_preview_image?: string
  link_preview_domain?: string
  user: User
}

interface Hashtag {
  hashtag: string
  count: number
  trend: 'up' | 'down' | 'stable'
}

interface Category {
  id: string
  name: string
  description?: string
  icon?: string
  color?: string
  posts_count: number
}

const sustainabilityCategories = [
  "All Categories",
  "Technology",
  "Business",
  "Health & Wellness",
  "Education",
  "Science & Research",
  "Arts & Culture",
  "Sports & Fitness",
  "Travel",
  "Food & Nutrition",
  "Personal Finance",
  "Community & Volunteering",
  "Lifestyle",
  "Entertainment",
  "Environment & Sustainability",
]

export default function ExplorePage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All Categories")
  const [activeTab, setActiveTab] = useState("trending")
  const [trendingHashtags, setTrendingHashtags] = useState<Hashtag[]>([])
  const [featuredUsers, setFeaturedUsers] = useState<User[]>([])
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([])
  const [recentPosts, setRecentPosts] = useState<Post[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [recentLoading, setRecentLoading] = useState(false)

  const fetchTrendingData = useCallback(async (category?: string) => {
    try {
      setLoading(true)
      
      // Fetch trending hashtags
      const hashtagsResponse = await fetch('/api/hashtags/trending?limit=5')
      if (hashtagsResponse.ok) {
        const hashtagsData = await hashtagsResponse.json()
        const hashtags = hashtagsData.hashtags || []
        setTrendingHashtags(hashtags)
      }
      
      // Fetch user suggestions (who to follow)
      const usersResponse = await fetch('/api/users/suggestions?limit=3')
      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        const users = usersData.users || []
        setFeaturedUsers(users)
      }
      
      // Fetch trending posts with optional category filter
      const categoryParam = category && category !== 'All Categories' ? `&category=${encodeURIComponent(category)}` : ''
      const postsResponse = await fetch(`/api/posts/trending?limit=10${categoryParam}`)
      if (postsResponse.ok) {
        const posts = await postsResponse.json()
        setTrendingPosts(posts || [])
      }
    } catch (error) {
      console.error('Error fetching trending data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchRecentPosts = useCallback(async (category?: string) => {
    try {
      setRecentLoading(true)
      const categoryParam = category && category !== 'All Categories' ? `&category=${encodeURIComponent(category)}` : ''
      const response = await fetch(`/api/posts/recent?limit=10${categoryParam}`)
      if (response.ok) {
        const posts = await response.json()
        setRecentPosts(posts || [])
      }
    } catch (error) {
      console.error('Error fetching recent posts:', error)
    } finally {
      setRecentLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTrendingData(selectedCategory)
  }, [])

  useEffect(() => {
    if (activeTab === 'recent' && recentPosts.length === 0) {
      fetchRecentPosts(selectedCategory)
    }
  }, [activeTab, fetchRecentPosts, recentPosts.length, selectedCategory])

  // Refetch data when category changes
  useEffect(() => {
    if (activeTab === 'trending') {
      fetchTrendingData(selectedCategory)
    } else if (activeTab === 'recent') {
      fetchRecentPosts(selectedCategory)
    }
  }, [selectedCategory, activeTab, fetchTrendingData, fetchRecentPosts])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const handlePostUpdate = (postId: string, updates: any) => {
    setTrendingPosts((prevPosts) => prevPosts.map((post) => (post.id === postId ? { ...post, ...updates } : post)))
    setRecentPosts((prevPosts) => prevPosts.map((post) => (post.id === postId ? { ...post, ...updates } : post)))
  }

  const handleFollowUser = async (userId: string) => {
    try {
      const response = await fetch('/api/users/follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })
      
      if (response.ok) {
        // Remove the followed user from suggestions
        setFeaturedUsers(prev => prev.filter(user => user.id !== userId))
      }
    } catch (error) {
      console.error('Error following user:', error)
    }
  }

  const handleHashtagClick = (hashtag: string) => {
    router.push(`/search?q=${encodeURIComponent('#' + hashtag)}`)
  }

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category)
    if (activeTab === 'trending') {
      fetchTrendingData(category)
    } else if (activeTab === 'recent') {
      fetchRecentPosts(category)
    }
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto p-3 sm:p-4 pb-20 lg:pb-4">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">Explore Sustainability</h1>

          {/* Mobile-First Responsive Search Form */}
          <form onSubmit={handleSearch} className="space-y-3 sm:space-y-0 sm:flex sm:space-x-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search posts, users, hashtags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 sm:h-10"
              />
            </div>
            <div className="flex space-x-2 sm:space-x-4">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="flex-1 sm:w-48 h-11 sm:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sustainabilityCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" className="sustainability-gradient px-4 sm:px-6 h-11 sm:h-10">
                <Search className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Search</span>
              </Button>
            </div>
          </form>

          {/* Mobile-Optimized Featured Content Banner */}
          <div className="mb-4 sm:mb-6">
            <Card className="relative overflow-hidden">
              <div className="relative h-40 sm:h-48 md:h-64">
                <Image
                  src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&h=600&fit=crop"
                  alt="Featured sustainability content"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-green-900/80 to-transparent" />
                <div className="absolute inset-0 flex items-center">
                  <div className="p-4 sm:p-6 text-white">
                    <h2 className="text-lg sm:text-2xl md:text-3xl font-bold mb-2 leading-tight">Discover Sustainability Stories</h2>
                    <p className="text-green-100 mb-3 sm:mb-4 max-w-md text-sm sm:text-base leading-relaxed">
                      Explore inspiring content from environmental leaders, innovators, and activists making a
                      difference.
                    </p>
                    <Button className="bg-white text-green-800 hover:bg-green-50 text-sm sm:text-base px-4 sm:px-6 h-9 sm:h-10">Explore Now</Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Mobile-First Layout: Sidebar above main content on mobile */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Sidebar - appears first on mobile */}
          <div className="lg:order-2 space-y-4 sm:space-y-6">
            {/* Trending Topics */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  <span>Trending Topics</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 sm:space-y-3">
                {loading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                  </div>
                ) : trendingHashtags.length > 0 ? (
                  trendingHashtags.map((hashtag, index) => (
                    <div
                      key={hashtag.hashtag}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                      onClick={() => handleHashtagClick(hashtag.hashtag)}
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm sm:text-base">#{hashtag.hashtag}</p>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{hashtag.count.toLocaleString()} posts</p>
                      </div>
                      <Badge variant="secondary" className="text-green-600 text-xs">
                        Trending
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No trending topics found</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Featured Users */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  <span>Who to Follow</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {loading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                  </div>
                ) : featuredUsers.length > 0 ? (
                  featuredUsers.map((user) => (
                    <div key={user.id} className="flex items-center space-x-3">
                      <div className="relative">
                        <Avatar className="w-10 h-10 sm:w-12 sm:h-12">
                          <AvatarImage src={user.avatar_url} alt={user.full_name} />
                          <AvatarFallback>{user.full_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {user.verified && (
                          <Verified className="absolute -bottom-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 text-blue-500 bg-white rounded-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm sm:text-base">{user.full_name}</p>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">@{user.username}</p>
                        {user.bio && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.bio}</p>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-green-600 border-green-600 hover:bg-green-50 text-xs sm:text-sm px-3 sm:px-4 h-8 sm:h-9"
                        onClick={() => handleFollowUser(user.id)}
                      >
                        Follow
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No user suggestions found</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Categories */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sustainabilityCategories.slice(1).map((category) => (
                    <Badge
                      key={category}
                      variant="outline"
                      className={`justify-center p-2 sm:p-3 cursor-pointer hover:bg-green-50 hover:border-green-300 dark:hover:bg-green-900/20 transition-colors text-xs sm:text-sm min-h-[2.5rem] sm:min-h-[3rem] ${
                        selectedCategory === category ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/40 dark:border-green-400 dark:text-green-300' : ''
                      }`}
                      onClick={() => handleCategoryClick(category)}
                    >
                      {category}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content - appears second on mobile */}
          <div className="lg:order-1 lg:col-span-2 space-y-4 sm:space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              {/* Mobile-Optimized Tabs */}
              <TabsList className="grid w-full grid-cols-3 h-12 sm:h-10">
                <TabsTrigger value="trending" className="flex items-center justify-center px-2 sm:px-4 text-xs sm:text-sm">
                  <TrendingUp className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Trending</span>
                </TabsTrigger>
                <TabsTrigger value="recent" className="flex items-center justify-center px-2 sm:px-4 text-xs sm:text-sm">
                  <Calendar className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Recent</span>
                </TabsTrigger>
                <TabsTrigger value="featured" className="flex items-center justify-center px-2 sm:px-4 text-xs sm:text-sm">
                  <Sparkles className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Featured</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="trending" className="space-y-6 mt-6">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                  </div>
                ) : trendingPosts.length > 0 ? (
                  trendingPosts.map((post) => (
                    <PostCard key={post.id} post={post} onUpdate={handlePostUpdate} />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Trending Posts</h3>
                    <p className="text-gray-500 dark:text-gray-400">No trending posts found for this category</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="recent" className="space-y-6 mt-6">
                {recentLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                  </div>
                ) : recentPosts.length > 0 ? (
                  recentPosts.map((post) => (
                    <PostCard key={post.id} post={post} onUpdate={handlePostUpdate} />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Recent Posts</h3>
                    <p className="text-gray-500 dark:text-gray-400">No recent posts found for this category</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="featured" className="space-y-6 mt-6">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                  </div>
                ) : (
                  // Show high-impact posts (posts with impact_score > 7 or high engagement)
                  trendingPosts
                    .filter(post => (post.impact_score && post.impact_score > 7) || 
                                   (post.likes_count + post.comments_count + post.reposts_count) > 10)
                    .slice(0, 5)
                    .map((post) => (
                      <PostCard key={post.id} post={post} onUpdate={handlePostUpdate} />
                    ))
                )}
                {!loading && trendingPosts.filter(post => (post.impact_score && post.impact_score > 7) || 
                                                          (post.likes_count + post.comments_count + post.reposts_count) > 10).length === 0 && (
                  <div className="text-center py-12">
                    <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Featured Content</h3>
                    <p className="text-gray-500 dark:text-gray-400">High-impact sustainability content will appear here</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>


        </div>
      </div>
    </MainLayout>
  )
}
