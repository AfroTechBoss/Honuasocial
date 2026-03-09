"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "@supabase/auth-helpers-react"
import { createClient } from "@/lib/supabase/client"
import { uploadCoverImage } from "@/lib/storage"
import MainLayout from "@/components/main-layout"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  MapPin,
  LinkIcon,
  Calendar,
  MessageCircle,
  Settings,
  UserPlus,
  UserMinus,
  CheckCircle,
  Leaf,
  Camera,
  Upload,
  Trash2,
} from "lucide-react"
import Image from "next/image"
import PostCard from "@/components/post-card"
import ImageModal from "@/components/image-modal"

// Mock user data
const mockUser = {
  id: "user1",
  username: "sarah_green",
  full_name: "Sarah Green",
  avatar_url: "/images/profiles/sarah-green-avatar.png",
  cover_url: "/images/covers/sarah-green-cover.png",
  bio: "Environmental scientist passionate about renewable energy and climate action. PhD in Environmental Science from Stanford. Leading community solar initiatives across the Pacific Northwest. 🌱",
  location: "Portland, Oregon",
  website: "https://sarahgreen.eco",
  verified: true,
  role: "user",
  followers_count: 2847,
  following_count: 456,
  posts_count: 234,
  created_at: "2023-03-15T00:00:00Z",
  sustainability_categories: ["Solar Energy", "Climate Action", "Renewable Energy"],
}

const mockUserPosts = [
  {
    id: "1",
    user: mockUser,
    content:
      "Just installed 20 solar panels on our community center! 🌞 This will reduce our carbon footprint by 80% and save $3,000 annually. Small steps lead to big changes! #SolarEnergy #CommunityAction",
    media_urls: [
      "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=800&h=600&fit=crop",
    ],
    location: "Portland, Oregon",
    sustainability_category: "Solar Energy",
    impact_score: 85,
    likes_count: 234,
    comments_count: 18,
    reposts_count: 45,
    created_at: "2024-01-15T10:30:00Z",
    liked_by_user: false,
    bookmarked_by_user: false,
  },
  {
    id: "2",
    user: mockUser,
    content:
      "Excited to announce our new research on solar panel efficiency improvements! Our team has developed a coating that increases energy capture by 23%. Full paper published in Nature Energy 📊",
    media_urls: [
      "https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=400&h=300&fit=crop",
    ],
    location: "Stanford University",
    sustainability_category: "Solar Energy",
    impact_score: 92,
    likes_count: 567,
    comments_count: 89,
    reposts_count: 123,
    created_at: "2024-01-12T14:20:00Z",
    liked_by_user: true,
    bookmarked_by_user: true,
  },
]

export default function ProfilePage() {
  const params = useParams()
  const username = params.username as string
  const session = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [followsYou, setFollowsYou] = useState(false)
  const [activeTab, setActiveTab] = useState("posts")
  const [showCoverEditModal, setShowCoverEditModal] = useState(false)
  const [selectedCoverImage, setSelectedCoverImage] = useState<string | null>(null)
  const [uploadingCoverImage, setUploadingCoverImage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userNotFound, setUserNotFound] = useState(false)
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<string | null>(null)

  // Check if this is the current user's profile
  const isOwnProfile = session?.user?.user_metadata?.username === username

  // Fetch user profile and posts
  useEffect(() => {
    const fetchUserProfile = async () => {
      setLoading(true)
      try {
        console.log('Fetching profile for username:', username)
        
        // Fetch user profile
        const profileResponse = await fetch(`/api/profiles?username=${username}`)
        
        if (!profileResponse.ok) {
          const errorData = await profileResponse.json().catch(() => ({ error: 'Unknown error' }))
          
          if (profileResponse.status === 404) {
            console.log('Profile not found for username:', username)
            setUserNotFound(true)
            toast({
              title: 'Profile Not Found',
              description: `The user "${username}" does not exist or has been removed.`,
              variant: 'destructive',
            })
            return
          }
          
          throw new Error(errorData.error || `HTTP ${profileResponse.status}: ${profileResponse.statusText}`)
        }
        
        const profileData = await profileResponse.json()
        
        if (!profileData.profile) {
          throw new Error('Profile data is missing from response')
        }
        
        console.log('Profile fetched successfully:', profileData.profile.username)
        setUser(profileData.profile)
        
        // Check follow status if not own profile and user is logged in
        if (!isOwnProfile && session?.user && profileData.profile?.id) {
          try {
            const followResponse = await fetch(`/api/profiles/${profileData.profile.id}/follow`)
            if (followResponse.ok) {
              const followData = await followResponse.json()
              setIsFollowing(followData.is_following)
              setFollowsYou(followData.follows_you)
            }
          } catch (error) {
            console.error('Error checking follow status:', error)
          }
        }
        
        // Fetch user posts and calculate post count
        try {
          const postsResponse = await fetch("/api/posts?limit=100&page=1");
          let postsData = [];
          
          if (postsResponse.ok) {
            postsData = await postsResponse.json();
            const userPosts = (postsData || []).filter((post: any) => post.profiles?.username === username);
            setPosts(userPosts.map((post: any) => ({ ...post, user: post.profiles })));
            
            // Update user with actual post count
            setUser((prev: any) => ({
              ...prev,
              posts_count: userPosts.length
            }));
          } else {
            console.warn('Failed to fetch posts, using empty array');
            setPosts([]);
            setUser((prev: any) => ({
              ...prev,
              posts_count: 0
            }));
          }
        } catch (postsError) {
          console.error('Error fetching posts:', postsError);
          setPosts([]);
          setUser((prev: any) => ({
            ...prev,
            posts_count: 0
          }));
        }
      } catch (error) {
          console.error('Error fetching profile data:', error)
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          
          toast({
            title: 'Error Loading Profile',
            description: errorMessage.includes('Failed to fetch') 
              ? 'Network error. Please check your connection and try again.'
              : errorMessage,
            variant: 'destructive',
          })
        } finally {
          setLoading(false)
        }
    }
    
    if (username) {
      fetchUserProfile()
    }
  }, [username, toast, isOwnProfile, session])

  const handleFollow = async () => {
    if (!user?.id) return

    try {
      const method = isFollowing ? 'DELETE' : 'POST'
      const response = await fetch(`/api/profiles/${user.id}/follow`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update follow status')
      }

      const data = await response.json()
      
      // Update local state
      setIsFollowing(!isFollowing)
      setUser((prev: any) => ({
        ...prev,
        followers_count: data.follower_count,
      }))

      toast({
        title: isFollowing ? "Unfollowed" : "Followed",
        description: isFollowing
          ? `You have unfollowed ${user?.full_name}`
          : `You are now following ${user?.full_name}`,
      })
    } catch (error) {
      console.error('Error updating follow status:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update follow status",
        variant: "destructive",
      })
    }
  }

  const handleMessage = () => {
    if (!user?.username) return
    
    // Navigate to messages page with the user parameter
    router.push(`/messages?user=${user.username}`)
  }

  const handlePostUpdate = (postId: string, updates: any) => {
    // Handle post deletion
    if (updates.deleted) {
      setPosts((prevPosts) => prevPosts.filter((post) => post.id !== postId))
      // Update user's post count
      setUser((prev: any) => ({
        ...prev,
        posts_count: Math.max(0, (prev.posts_count || 0) - 1)
      }))
      return
    }
    
    setPosts((prevPosts) => prevPosts.map((post) => (post.id === postId ? { ...post, ...updates } : post)))
  }

  const handleCoverImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check authentication
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    if (!authUser) {
      toast({
        title: "Authentication required",
        description: "Please log in to upload a cover image.",
        variant: "destructive",
      })
      return
    }

    setUploadingCoverImage(true)

    try {
      const result = await uploadCoverImage(file, authUser.id)
      setSelectedCoverImage(result.url)
      
      toast({
        title: "Cover image uploaded!",
        description: "Your cover image has been uploaded successfully.",
      })
    } catch (error) {
      console.error('Error uploading cover image:', error)
      toast({
        title: "Upload failed",
        description: "Failed to upload cover image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploadingCoverImage(false)
      // Reset the file input
      event.target.value = ''
    }
  }

  const handleSaveCoverImage = async () => {
    if (selectedCoverImage) {
      try {
        // Persist cover image URL to backend
        const response = await fetch('/api/profiles', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cover_url: selectedCoverImage })
        })
        if (!response.ok) {
          throw new Error('Failed to update cover photo')
        }
        const data = await response.json()
        setUser((prev: any) => ({
          ...prev,
          cover_url: data.profile.cover_url,
        }))
        setShowCoverEditModal(false)
        setSelectedCoverImage(null)
        toast({
          title: "Cover photo updated!",
          description: "Your new cover photo has been saved successfully.",
        })
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to update cover photo. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  const handleRemoveCoverImage = async () => {
    try {
      // Simulate API call to remove cover image
      await new Promise((resolve) => setTimeout(resolve, 1000))

      setUser((prev: any) => ({
        ...prev,
        cover_url: "",
      }))

      setShowCoverEditModal(false)
      setSelectedCoverImage(null)

      toast({
        title: "Cover photo removed",
        description: "Your cover photo has been removed successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove cover photo. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto pb-20 lg:pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-t-green-500 border-gray-200 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading profile...</p>
            </div>
          </div>
        ) : userNotFound ? (
          <div className="flex items-center justify-center h-screen">
            <div className="text-center max-w-md mx-auto px-4">
              <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">User Not Found</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                The user "@{username}" doesn't exist or may have been removed.
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={() => window.history.back()}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  Go Back
                </Button>
                <Button 
                  onClick={() => window.location.href = '/'}
                  className="w-full sm:w-auto sustainability-gradient"
                >
                  Go to Home
                </Button>
              </div>
            </div>
          </div>
        ) : user ? (
          <>
            {/* Cover Image */}
            <div className="relative h-48 md:h-64 bg-gradient-to-r from-green-400 to-emerald-500 group">
              {user.cover_url ? (
                <Image src={user.cover_url || "/placeholder.svg"} alt="Profile cover" fill className="object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-r from-green-400 to-emerald-500" />
              )}
              <div className="absolute inset-0 bg-black/20" />

              {/* Cover Photo Edit Button - Only show for own profile */}
              {isOwnProfile && (
                <Button
                  onClick={() => setShowCoverEditModal(true)}
                  className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs sm:text-sm"
                  size="sm"
                >
                  <Camera className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Edit Cover</span>
                  <span className="sm:hidden">Edit</span>
                </Button>
              )}
            </div>

        {/* Profile Header */}
        <div className="relative px-2 sm:px-4 pb-4">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between -mt-12 sm:-mt-16 lg:-mt-20">
            {/* Left Column: Avatar and User Info */}
            <div className="flex-1 lg:max-w-2xl">
              {/* Avatar and Mobile Edit Button */}
              <div className="flex items-end justify-between lg:justify-start space-x-4 w-full lg:w-auto">
                <Avatar className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-white shadow-lg">
                  <AvatarImage src={user.avatar_url || "/placeholder.svg"} />
                  <AvatarFallback className="bg-green-500 text-white text-xl sm:text-2xl">{user.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                
                {/* Edit Profile Button - Mobile: Right of Avatar */}
                {isOwnProfile && (
                  <div className="lg:hidden">
                    <Button variant="outline" size="sm" asChild className="text-xs px-2 py-1">
                      <a href="/settings">
                        <Settings className="w-3 h-3 mr-1" />
                        <span>Edit</span>
                      </a>
                    </Button>
                  </div>
                )}
              </div>

              {/* Name and User Info - Mobile and Tablet Layout */}
              <div className="mt-3 sm:mt-6 space-y-2 sm:space-y-3 text-left lg:hidden">
                {/* Name, Username, and Badges - Compact Header */}
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{user.full_name}</h1>
                        {user.verified && <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6 text-blue-500 flex-shrink-0" />}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">@{user.username}</p>
                    </div>
                  </div>
                </div>

                {/* Bio - Compact */}
                {user.bio && (
                  <p className="text-sm sm:text-base text-gray-900 dark:text-gray-100 leading-snug text-left line-clamp-3">{user.bio}</p>
                )}

                {/* Stats - Mobile/Tablet Only */}
                <div className="flex items-center justify-start space-x-4 sm:space-x-6 py-2">
                  <Link href={`/profile/${user.username}/following`} className="text-center cursor-pointer hover:opacity-80 transition-opacity">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                      {(user.following_count || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Following</div>
                  </Link>
                  <Link href={`/profile/${user.username}/followers`} className="text-center cursor-pointer hover:opacity-80 transition-opacity">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                      {(user.followers_count || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Followers</div>
                  </Link>
                  <div className="text-center">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                      {(user.posts_count || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Posts</div>
                  </div>
                </div>

                {/* Metadata - Compact Single Row */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-gray-600 dark:text-gray-400">
                  {user.location && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate max-w-24 sm:max-w-none">{user.location}</span>
                    </div>
                  )}
                  {user.website && (
                    <div className="flex items-center space-x-1">
                      <LinkIcon className="w-3 h-3" />
                      <a
                        href={user.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-500 truncate max-w-20 sm:max-w-none"
                      >
                        {user.website.replace("https://", "").replace("www.", "")}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span className="whitespace-nowrap">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "Unknown"}
                    </span>
                  </div>
                </div>

                {/* Sustainability Categories - Compact */}
                {user.sustainability_categories && user.sustainability_categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 sm:gap-2">
                    {user.sustainability_categories.slice(0, 3).map((category: string) => (
                      <Badge
                        key={category}
                        variant="secondary"
                        className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs px-2 py-1"
                      >
                        <Leaf className="w-2 h-2 mr-1" />
                        {category}
                      </Badge>
                    ))}
                    {user.sustainability_categories.length > 3 && (
                      <Badge
                        variant="secondary"
                        className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-xs px-2 py-1"
                      >
                        +{user.sustainability_categories.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Desktop User Info Layout */}
              <div className="hidden lg:block mt-6 space-y-4">
                {/* Name, Username, and Badges */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{user.full_name}</h1>
                    {user.verified && <CheckCircle className="w-6 h-6 text-blue-500" />}
                  </div>
                  <p className="text-lg text-gray-600 dark:text-gray-400">@{user.username}</p>
                </div>

                {/* Bio */}
                {user.bio && (
                  <p className="text-base text-gray-900 dark:text-gray-100 leading-relaxed max-w-2xl">{user.bio}</p>
                )}

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
                  {user.location && (
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4" />
                      <span>{user.location}</span>
                    </div>
                  )}
                  {user.website && (
                    <div className="flex items-center space-x-2">
                      <LinkIcon className="w-4 h-4" />
                      <a
                        href={user.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-500"
                      >
                        {user.website.replace("https://", "").replace("www.", "")}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Joined {user.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "Unknown"}
                    </span>
                  </div>
                </div>

                {/* Sustainability Categories */}
                {user.sustainability_categories && user.sustainability_categories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {user.sustainability_categories.slice(0, 5).map((category: string) => (
                      <Badge
                        key={category}
                        variant="secondary"
                        className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-sm px-3 py-1"
                      >
                        <Leaf className="w-3 h-3 mr-1" />
                        {category}
                      </Badge>
                    ))}
                    {user.sustainability_categories.length > 5 && (
                      <Badge
                        variant="secondary"
                        className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-sm px-3 py-1"
                      >
                        +{user.sustainability_categories.length - 5}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Action Buttons and Stats (Desktop Only) */}
            <div className="hidden lg:flex lg:flex-col lg:items-end lg:space-y-4 lg:mt-16 lg:min-w-0 lg:ml-8">
              {/* Action Buttons */}
              <div className="flex flex-col items-end space-y-3">
                {!isOwnProfile ? (
                  <>
                    {followsYou && (
                      <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
                        <span>Follows you</span>
                      </div>
                    )}
                    <div className="flex space-x-3">
                      <Button variant="outline" size="sm" onClick={handleMessage} className="text-sm px-4">
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Message
                      </Button>
                      <Button
                        onClick={handleFollow}
                        className={`text-sm px-4 ${isFollowing ? "bg-gray-200 text-gray-800 hover:bg-gray-300" : "sustainability-gradient"}`}
                      >
                        {isFollowing ? (
                          <>
                            <UserMinus className="w-4 h-4 mr-2" />
                            Unfollow
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 mr-2" />
                            {followsYou ? "Follow back" : "Follow"}
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button variant="outline" size="sm" asChild className="text-sm px-4">
                    <a href="/settings">
                      <Settings className="w-4 h-4 mr-2" />
                      Edit Profile
                    </a>
                  </Button>
                )}
              </div>

              {/* Stats - Desktop Only */}
              <div className="flex space-x-6">
                <Link href={`/profile/${user.username}/following`} className="text-center cursor-pointer hover:opacity-80 transition-opacity">
                  <div className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                    {(user.following_count || 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Following</div>
                </Link>
                <Link href={`/profile/${user.username}/followers`} className="text-center cursor-pointer hover:opacity-80 transition-opacity">
                  <div className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                    {(user.followers_count || 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Followers</div>
                </Link>
                <div className="text-center">
                  <div className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                    {(user.posts_count || 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Posts</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="px-2 sm:px-4 mb-4 sm:mb-6">
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("posts")}
              className={`flex-1 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                activeTab === "posts"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              <span className="hidden sm:inline">Posts ({user.posts_count || 0})</span>
              <span className="sm:hidden">Posts</span>
            </button>
            <button
              onClick={() => setActiveTab("gallery")}
              className={`flex-1 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                activeTab === "gallery"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              Gallery
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-2 sm:px-4">
          {activeTab === "posts" && (
            <div className="space-y-4 sm:space-y-6">
              {posts.length > 0 ? (
                posts.map((post) => (
                  <PostCard key={post.id} post={post} onUpdate={handlePostUpdate} />
                ))
              ) : (
                <div className="text-center py-8 sm:py-12">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No posts yet</h3>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 px-4">
                    {isOwnProfile ? "Share your first sustainability post!" : `${user.full_name} hasn't posted anything yet.`}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "gallery" && (
            <Card>
              <CardContent className="p-4 sm:p-6">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 text-base sm:text-lg">Recent Photos</h3>
                {(() => {
                  // Extract all images from user's posts
                  const allImages: string[] = []
                  posts.forEach(post => {
                    if (post.media_urls && Array.isArray(post.media_urls)) {
                      allImages.push(...post.media_urls)
                    }
                  })
                  
                  return allImages.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                      {allImages.map((src, index) => (
                        <div
                           key={index}
                           className="relative aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden group cursor-pointer"
                           onClick={() => setSelectedGalleryImage(src)}
                         >
                           <Image
                             src={src || "/placeholder.svg"}
                             alt={`Gallery image ${index + 1}`}
                             fill
                             className="object-cover group-hover:scale-105 transition-transform duration-200"
                           />
                           <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
                         </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 sm:py-12">
                      <div className="text-gray-400 mb-4">
                        <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No photos yet</h3>
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 px-4">
                        {isOwnProfile ? "Share posts with photos to see them here!" : `${user.full_name} hasn't shared any photos yet.`}
                      </p>
                    </div>
                  )
                })()
                }
              </CardContent>
            </Card>
          )}
        </div>

        {/* Cover Photo Edit Modal */}
        <Dialog open={showCoverEditModal} onOpenChange={setShowCoverEditModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Cover Photo</DialogTitle>
              <DialogDescription>
                Upload a new cover photo or remove your current one. Recommended size: 1200x400 pixels.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Current/Preview Cover Image */}
              <div className="relative h-32 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                {selectedCoverImage || user.cover_url ? (
                  <Image
                    src={selectedCoverImage || user.cover_url || "/placeholder.svg"}
                    alt="Cover preview"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center">
                    <span className="text-white font-medium">No cover photo</span>
                  </div>
                )}
                {/* TODO: Add cropping/moving UI here for cover photo editing */}
              </div>

              {/* Upload Button */}
              <div className="flex items-center justify-center">
                <label htmlFor="cover-upload" className={uploadingCoverImage ? "cursor-not-allowed" : "cursor-pointer"}>
                  <Button variant="outline" asChild disabled={uploadingCoverImage}>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingCoverImage ? "Uploading..." : "Choose New Photo"}
                    </span>
                  </Button>
                </label>
                <input
                  id="cover-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleCoverImageUpload}
                  className="hidden"
                  disabled={uploadingCoverImage}
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {user.cover_url && (
                <Button variant="outline" onClick={handleRemoveCoverImage} className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove Cover
                </Button>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCoverEditModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveCoverImage}
                  disabled={!selectedCoverImage || uploadingCoverImage}
                  className="sustainability-gradient"
                >
                  {uploadingCoverImage ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Gallery Image Modal */}
        {selectedGalleryImage && (
          <ImageModal
            src={selectedGalleryImage}
            alt="Gallery image"
            onClose={() => setSelectedGalleryImage(null)}
          />
        )}
          </>
        ) : (
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400">Profile not found</p>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
