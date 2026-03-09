"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@supabase/auth-helpers-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import MoveBookmarkDialog from "./move-bookmark-dialog"
import {
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share,
  MoreHorizontal,
  MapPin,
  TrendingUp,
  CheckCircle,
  Flag,
  UserPlus,
  UserMinus,
  Trash2,
  FolderPlus,
  Plus,
  FolderOpen,
  Leaf,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import ImageModal from "./image-modal"; // Adjust path if necessary
import { renderContentWithLinksAndMentions } from '@/lib/mention-utils'
import { isGreenEligibleCategory } from '@/lib/categories'

interface PostCardProps {
  post: {
    id: string
    user: {
      id: string
      username: string
      full_name: string
      avatar_url: string
      verified?: boolean
    }
    content: string
    media_urls?: string[]
    location?: string
    sustainability_category?: string
    impact_score?: number
    likes_count: number
    comments_count: number
    reposts_count: number
    created_at: string
    updated_at: string
    parent_id?: string
    liked_by_user: boolean
    bookmarked_by_user: boolean
    reposted_by_user: boolean
    link_preview_url?: string
    link_preview_title?: string
    link_preview_description?: string
    link_preview_image?: string
    link_preview_domain?: string
    collection_id?: string
  }
  onPostDeleted?: () => void
  onUpdate?: (postId: string, updates: any) => void
}

export default function PostCard({ post, onPostDeleted, onUpdate }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.liked_by_user)
  const [isBookmarked, setIsBookmarked] = useState(post.bookmarked_by_user)
  const [likesCount, setLikesCount] = useState(post.likes_count)
  const [isFollowing, setIsFollowing] = useState(false)
  const session = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [isMoveBookmarkOpen, setIsMoveBookmarkOpen] = useState(false);
  const [postPointsEarned, setPostPointsEarned] = useState<number | null>(null);

  const isAuthor = session?.user?.id === post.user?.id
  const isGreenPost = isGreenEligibleCategory(post.sustainability_category)

  useEffect(() => {
    if (!isAuthor || !isGreenPost || !post.id) return
    const fetchPoints = async () => {
      try {
        const res = await fetch(`/api/posts/${post.id}/points`)
        if (res.ok) {
          const data = await res.json()
          setPostPointsEarned(typeof data.points === 'number' ? data.points : 0)
        }
      } catch {
        setPostPointsEarned(0)
      }
    }
    fetchPoints()
  }, [post.id, isAuthor, isGreenPost, likesCount, post.comments_count, post.reposts_count])

  const handleLike = async () => {
    const newIsLiked = !isLiked
    const newLikesCount = newIsLiked ? likesCount + 1 : likesCount - 1

    setIsLiked(newIsLiked)
    setLikesCount(newLikesCount)

    // Update parent component
    onUpdate?.(post.id, {
      liked_by_user: newIsLiked,
      likes_count: newLikesCount
    })

    toast({
      title: newIsLiked ? "Post liked!" : "Like removed",
      description: newIsLiked ? "Added to your liked posts" : "Removed from liked posts",
    })
  }

  // State for collection selection dialog
  const [isCollectionDialogOpen, setIsCollectionDialogOpen] = useState(false)
  const [collections, setCollections] = useState<Array<{id: string, name: string, color: string}>>([])  
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [isLoadingCollections, setIsLoadingCollections] = useState(false)

  // Fetch user's collections
  const fetchCollections = async () => {
    if (!session?.user?.id) return
    
    setIsLoadingCollections(true)
    try {
      const response = await fetch('/api/collections')
      if (!response.ok) throw new Error('Failed to fetch collections')
      
      const data = await response.json()
      // The API returns the collections array directly, not nested under a 'collections' property
      setCollections(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching collections:', error)
      toast({
        title: "Error",
        description: "Failed to load collections",
        variant: "destructive",
      })
    } finally {
      setIsLoadingCollections(false)
    }
  }

  const handleBookmarkClick = () => {
    if (isBookmarked) {
      // If already bookmarked, remove the bookmark
      handleRemoveBookmark()
    } else {
      // If not bookmarked, show collection selection dialog
      fetchCollections()
      setIsCollectionDialogOpen(true)
    }
  }

  const handleRemoveBookmark = async () => {
    setIsBookmarked(false)

    try {
      const response = await fetch(`/api/posts/${post.id}/bookmark`, { method: 'DELETE' })
      
      if (!response.ok) {
        // Revert the optimistic update if API call fails
        setIsBookmarked(true)
        throw new Error('Failed to remove bookmark')
      }

      // Update parent component
      onUpdate?.(post.id, {
        bookmarked_by_user: false
      })

      toast({
        title: "Bookmark removed",
        description: "Removed from bookmarks",
      })
    } catch (error) {
      console.error('Error removing bookmark:', error)
      toast({
        title: "Error",
        description: "Failed to remove bookmark",
        variant: "destructive",
      })
    }
  }

  const handleBookmark = async (collectionId: string | null = null) => {
    setIsBookmarked(true)
    setIsCollectionDialogOpen(false)

    try {
      const response = await fetch(`/api/posts/${post.id}/bookmark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ collection_id: collectionId }),
      })
      
      if (!response.ok) {
        // Revert the optimistic update if API call fails
        setIsBookmarked(false)
        throw new Error('Failed to bookmark post')
      }

      // Update parent component
      onUpdate?.(post.id, {
        bookmarked_by_user: true
      })

      toast({
        title: "Post bookmarked!",
        description: collectionId 
          ? `Saved to ${collections.find(c => c.id === collectionId)?.name || 'collection'}` 
          : "Saved to your bookmarks",
      })
    } catch (error) {
      console.error('Error bookmarking post:', error)
      toast({
        title: "Error",
        description: "Failed to bookmark post",
        variant: "destructive",
      })
    }
  }

  const handleRepost = async () => {
    if (!session?.user?.id) {
      toast({
        title: "Authentication required",
        description: "Please log in to repost",
        variant: "destructive",
      })
      return
    }

    try {
      const method = post.reposted_by_user ? 'DELETE' : 'POST'
      const response = await fetch(`/api/posts/${post.id}/repost`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update repost')
      }

      const data = await response.json()
      
      // Update parent component
      onUpdate?.(post.id, {
        reposted_by_user: !post.reposted_by_user,
        reposts_count: data.reposts_count || (post.reposted_by_user ? post.reposts_count - 1 : post.reposts_count + 1)
      })

      toast({
        title: post.reposted_by_user ? "Repost removed" : "Post reposted!",
        description: post.reposted_by_user ? "Removed from your reposts" : "Shared with your followers",
      })
    } catch (error) {
      console.error('Error updating repost:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update repost",
        variant: "destructive",
      })
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${post.user.full_name} on Honua`,
          text: post.content,
          url: `${window.location.origin}/post/${post.id}`,
        })
      } catch (error) {
        // User cancelled sharing
      }
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`)
      toast({
        title: "Link copied!",
        description: "Post link copied to clipboard",
      })
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete post')
      }

      toast({
        title: "Post deleted",
        description: "Your post has been successfully deleted.",
      })

      // Notify parent component to remove the post
      onUpdate?.(post.id, { deleted: true })
      onPostDeleted?.()
    } catch (error) {
      console.error('Error deleting post:', error)
      toast({
        title: "Error",
        description: "Failed to delete post. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleFollow = async () => {
    if (!post.user?.id) return

    try {
      const method = isFollowing ? 'DELETE' : 'POST'
      const response = await fetch(`/api/profiles/${post.user.id}/follow`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update follow status')
      }

      // Update local state
      setIsFollowing(!isFollowing)

      toast({
        title: isFollowing ? "Unfollowed" : "Following",
        description: `${isFollowing ? "Unfollowed" : "Now following"} @${post.user?.username || 'Unknown'}`,
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

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return "Just now"
    if (diffInHours < 24) return `${diffInHours}h`
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d`
    return date.toLocaleDateString()
  }

  const getImpactColor = (score: number) => {
    if (score >= 80) return "bg-green-500"
    if (score >= 60) return "bg-yellow-500"
    return "bg-orange-500"
  }

  return (
    <>
      <Card className="w-full max-w-full bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
        <CardContent className="p-2 sm:p-4 md:p-6 max-w-full">
          <div className="flex space-x-2 sm:space-x-3 md:space-x-4 max-w-full overflow-hidden">
            <Link href={`/profile/${post.user?.username || 'unknown'}`}>
              <Avatar className="w-12 h-12 cursor-pointer flex-shrink-0">
                <AvatarImage src={post.user?.avatar_url || "/placeholder.svg"} />
                <AvatarFallback className="bg-green-500 text-white">{post.user?.full_name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
            </Link>

            <div className="flex-1 min-w-0 space-y-1 sm:space-y-2 md:space-y-3 max-w-full overflow-hidden">
              <div className="flex items-start justify-between gap-1 sm:gap-2">
                <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 min-w-0 flex-1">
                  <div className="flex items-center space-x-1 sm:space-x-2 min-w-0">
                    <Link href={`/profile/${post.user?.username || 'unknown'}`} className="flex items-center space-x-1 hover:underline">
                      <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base truncate">{post.user?.full_name || 'Unknown User'}</span>
                      {post.user?.verified && <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500 flex-shrink-0" />}
                    </Link>
                  </div>
                  <div className="flex items-center space-x-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    <span className="truncate">@{post.user?.username || 'unknown'}</span>
                    <span className="hidden sm:inline">·</span>
                    <span className="whitespace-nowrap">{formatTimeAgo(post.created_at)}</span>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 max-w-[90vw]">
                    {post.user?.id === session?.user?.id ? (
                      <>
                        <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete post
                        </DropdownMenuItem>
                        {isBookmarked ? (
                          <>
                            <DropdownMenuItem onClick={handleRemoveBookmark}>
                              <Bookmark className="mr-2 h-4 w-4" />
                              Remove bookmark
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsMoveBookmarkOpen(true)}>
                              <FolderOpen className="mr-2 h-4 w-4" />
                              Move to collection
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem onClick={handleBookmarkClick}>
                            <Bookmark className="mr-2 h-4 w-4" />
                            Bookmark post
                          </DropdownMenuItem>
                        )}
                      </>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={handleFollow}>
                          {isFollowing ? (
                            <>
                              <UserMinus className="mr-2 h-4 w-4" />
                              Unfollow @{post.user?.username || 'unknown'}
                            </>
                          ) : (
                            <>
                              <UserPlus className="mr-2 h-4 w-4" />
                              Follow @{post.user?.username || 'unknown'}
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/report/${post.id}`}>
                            <Flag className="mr-2 h-4 w-4" />
                            Report post
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleBookmarkClick}>
                          <Bookmark className="mr-2 h-4 w-4" />
                          {isBookmarked ? "Remove bookmark" : "Bookmark post"}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-2 sm:space-y-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 -m-1 sm:-m-2 p-1 sm:p-2 rounded-lg transition-colors" onClick={() => router.push(`/post/${post.id}`)}>
                <div className="text-gray-900 dark:text-gray-100 text-sm sm:text-base leading-relaxed break-words overflow-wrap-anywhere hyphens-auto max-w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  {renderContentWithLinksAndMentions(post.content)}
                </div>
                  
                  {/* Link Preview */}
                  {post.link_preview_url && (
                    <div className="mt-2 sm:mt-3 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-w-full">
                      <a 
                        href={post.link_preview_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {post.link_preview_image && (
                          <div className="aspect-video w-full bg-gray-100 dark:bg-gray-800">
                            <img 
                              src={post.link_preview_image} 
                              alt={post.link_preview_title || 'Link preview'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="p-2 sm:p-3">
                          {post.link_preview_title && (
                            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm sm:text-base line-clamp-2 break-words">
                              {post.link_preview_title}
                            </h3>
                          )}
                          {post.link_preview_description && (
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2 break-words">
                              {post.link_preview_description}
                            </p>
                          )}
                          {post.link_preview_domain && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 sm:mt-2 truncate">
                              {post.link_preview_domain}
                            </p>
                          )}
                        </div>
                      </a>
                    </div>
                  )}

                  {post.media_urls && post.media_urls.length > 0 && (
                    <div
                      className={`grid gap-1 sm:gap-2 rounded-lg overflow-hidden max-w-full w-full ${
                        post.media_urls.length === 1
                          ? "grid-cols-1"
                          : post.media_urls.length === 2
                            ? "grid-cols-1 sm:grid-cols-2"
                            : "grid-cols-1 sm:grid-cols-2"
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {post.media_urls.map((url, index) => {
                        const isVideo = url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ogg');
                        return (
                          <div 
                            key={index} 
                            className="relative aspect-video bg-gray-100 dark:bg-gray-700 cursor-pointer w-full max-w-full overflow-hidden"
                            onClick={() => setSelectedMedia(url)}
                          >
                            {isVideo ? (
                              <video 
                                src={url} 
                                className="object-cover w-full h-full rounded max-w-full" 
                                controls={false}
                                muted
                                playsInline
                              />
                            ) : (
                              <Image
                                src={url || "/placeholder.svg"}
                                alt={`Post media ${index + 1}`}
                                fill
                                className="object-cover rounded max-w-full"
                                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center flex-wrap gap-1 sm:gap-2 max-w-full overflow-hidden">
                    {post.sustainability_category && (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs sm:text-sm px-1 sm:px-2 py-1 flex-shrink-0"
                      >
                        <span className="truncate max-w-[100px] sm:max-w-none">{post.sustainability_category}</span>
                      </Badge>
                    )}

                    {post.location && (
                      <div className="flex items-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 min-w-0 flex-shrink-0">
                        <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                        <span className="truncate max-w-[80px] sm:max-w-[120px] md:max-w-none">{post.location}</span>
                      </div>
                    )}

                    {post.impact_score && (
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <TrendingUp className="w-3 h-3 text-green-600 flex-shrink-0" />
                        <span className="text-xs sm:text-sm text-green-600 font-medium whitespace-nowrap">Impact: {post.impact_score}</span>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getImpactColor(post.impact_score)}`} />
                      </div>
                    )}
                  </div>
              </div>

              <div
                className="flex items-center justify-between pt-2 sm:pt-3 border-t border-gray-100 dark:border-gray-700"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center space-x-2 sm:space-x-4 md:space-x-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLike}
                    className={`flex items-center space-x-1 sm:space-x-2 min-w-0 p-1 sm:p-2 ${
                      isLiked ? "text-red-500 hover:text-red-600" : "text-gray-500 hover:text-red-500"
                    }`}
                  >
                    <Heart className={`w-4 h-4 flex-shrink-0 ${isLiked ? "fill-current" : ""}`} />
                    <span className="text-xs sm:text-sm">{likesCount}</span>
                  </Button>

                  <Link href={`/post/${post.id}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center space-x-1 sm:space-x-2 min-w-0 p-1 sm:p-2 text-gray-500 hover:text-blue-500"
                    >
                      <MessageCircle className="w-4 h-4 flex-shrink-0" />
                      <span className="text-xs sm:text-sm">{post.comments_count}</span>
                    </Button>
                  </Link>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRepost}
                    className={`flex items-center space-x-1 sm:space-x-2 min-w-0 p-1 sm:p-2 ${
                      post.reposted_by_user ? "text-green-500 hover:text-green-600" : "text-gray-500 hover:text-green-500"
                    }`}
                  >
                    <Repeat2 className={`w-4 h-4 flex-shrink-0 ${post.reposted_by_user ? "fill-current" : ""}`} />
                    <span className="text-xs sm:text-sm">{post.reposts_count}</span>
                  </Button>
                </div>

                <div className="flex items-center space-x-1 sm:space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBookmarkClick}
                    className={`p-1 sm:p-2 min-w-0 ${
                      isBookmarked ? "text-yellow-500 hover:text-yellow-600" : "text-gray-500 hover:text-yellow-500"
                    }`}
                  >
                    <Bookmark className={`w-4 h-4 flex-shrink-0 ${isBookmarked ? "fill-current" : ""}`} />
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleShare} 
                    className="text-gray-500 hover:text-blue-500 p-1 sm:p-2 min-w-0"
                  >
                    <Share className="w-4 h-4 flex-shrink-0" />
                  </Button>
                </div>
              </div>

              {/* Green points earned (author only, from DB so it matches Points page) */}
              {isAuthor && isGreenPost && (
                <div className="pt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <Leaf className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    This post has earned you <strong>{postPointsEarned !== null ? postPointsEarned : '…'}</strong> green point{postPointsEarned === 1 ? '' : 's'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {selectedMedia && (
        <ImageModal 
          src={selectedMedia} 
          alt="Post media" 
          onClose={() => setSelectedMedia(null)} 
        />
      )}

      {/* Collection Selection Dialog */}
      <Dialog open={isCollectionDialogOpen} onOpenChange={setIsCollectionDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base">Save to Collection</DialogTitle>
            <DialogDescription>Choose a collection to save this post</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <RadioGroup value={selectedCollectionId || ''} onValueChange={setSelectedCollectionId}>
              <div className="space-y-3 p-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="" id="default-collection" />
                  <Label htmlFor="default-collection" className="flex items-center space-x-2 cursor-pointer">
                    <Bookmark className="h-4 w-4" />
                    <span>Default Collection</span>
                  </Label>
                </div>
                
                {isLoadingCollections ? (
                  <div className="py-4 text-center text-gray-500">Loading collections...</div>
                ) : collections.length > 0 ? (
                  collections.map((collection) => (
                    <div key={collection.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={collection.id} id={`collection-${collection.id}`} />
                      <Label 
                        htmlFor={`collection-${collection.id}`} 
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: collection.color || '#10b981' }}
                        />
                        <span>{collection.name}</span>
                      </Label>
                    </div>
                  ))
                ) : (
                  <div className="py-4 text-center text-gray-500">
                    No collections found. Create one below.
                  </div>
                )}
                
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-2 flex items-center justify-center"
                    onClick={() => {
                      setIsCollectionDialogOpen(false);
                      router.push('/bookmarks');
                    }}
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Manage Collections
                  </Button>
              </div>
            </RadioGroup>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCollectionDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => handleBookmark(selectedCollectionId)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Bookmark Dialog */}
      <MoveBookmarkDialog
        open={isMoveBookmarkOpen}
        onOpenChange={setIsMoveBookmarkOpen}
        bookmarkId={post.id}
        currentCollectionId={post.collection_id || null}
        onSuccess={() => {
          // Update parent component to refresh bookmarks
          onUpdate?.(post.id, {
            bookmarked_by_user: true
          })
        }}
      />
    </>
  )
}
