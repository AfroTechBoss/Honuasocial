"use client"

import React from "react"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "@supabase/auth-helpers-react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import MainLayout from "@/components/main-layout"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share,
  ArrowLeft,
  Send,
  MapPin,
  TrendingUp,
  CheckCircle,
  Leaf,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import ImageModal from "@/components/image-modal"
import { isGreenEligibleCategory } from "@/lib/categories"

// TypeScript interfaces
interface User {
  id: string
  username: string
  full_name: string
  avatar_url: string
  verified?: boolean
}

interface Post {
  id: string
  user: User
  content: string
  media_urls?: string[]
  location?: string
  sustainability_category?: string
  impact_score?: number
  likes_count: number
  comments_count: number
  reposts_count: number
  created_at: string
  liked_by_user: boolean
  bookmarked_by_user: boolean
}

interface Comment {
  id: string
  user: User
  content: string
  likes_count: number
  replies_count: number
  created_at: string
  liked_by_user: boolean
  parent_id?: string | null
}

// Real data will be fetched from the API

export default function PostDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const session = useSession()
  const supabase = createClientComponentClient()
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isLiked, setIsLiked] = useState(post?.liked_by_user ?? false)
  const [likesCount, setLikesCount] = useState(post?.likes_count ?? 0)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [loading, setLoading] = useState(true)
  const [collapsedReplies, setCollapsedReplies] = useState<Set<string>>(new Set())
  const [profile, setProfile] = useState<any>(null)
  const [postPointsEarned, setPostPointsEarned] = useState<number | null>(null)

  const isAuthor = session?.user?.id === post?.user?.id
  const isGreenPost = post ? isGreenEligibleCategory(post.sustainability_category) : false

  useEffect(() => {
    if (!post?.id || !isAuthor || !isGreenPost) return
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
  }, [post?.id, isAuthor, isGreenPost, likesCount, comments.length, post?.reposts_count])

  // Fetch current user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (session?.user?.id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('avatar_url, full_name, username')
          .eq('id', session.user.id)
          .single()
        if (!error) setProfile(data)
      }
    }
    fetchProfile()
  }, [session?.user?.id])

  // Fetch post data and comments
  useEffect(() => {
    const fetchPostData = async () => {
      if (!params.id) return

      try {
        // Fetch post details from API
        try {
          const postResponse = await fetch(`/api/posts/${params.id}`)
          if (postResponse.ok) {
            const postData = await postResponse.json()
            setPost(postData.post)
            setIsLiked(postData.post.liked_by_user)
            setLikesCount(postData.post.likes_count)
          } else {
            console.error('Failed to fetch post:', postResponse.status)
            setPost(null)
          }
        } catch (apiError) {
          console.error('Post API error:', apiError)
          setPost(null)
        }

        // Fetch comments from API
        try {
          const commentsResponse = await fetch(`/api/posts/${params.id}/comments`)
          if (commentsResponse.ok) {
            const commentsData = await commentsResponse.json()
            setComments(commentsData.comments || [])
          } else {
            console.error('Failed to fetch comments:', commentsResponse.status)
            setComments([])
          }
        } catch (apiError) {
          console.error('Comments API error:', apiError)
          setComments([])
        }
      } catch (error) {
        // Handle errors gracefully
        console.error('Error fetching post data:', error)
        setPost(null)
        setComments([])
      } finally {
        setLoading(false)
      }
    }

    fetchPostData()
  }, [params.id, toast, router])

  const handleLike = async () => {
    const newIsLiked = !isLiked
    setIsLiked(newIsLiked)
    setLikesCount(newIsLiked ? likesCount + 1 : likesCount - 1)

    try {
      const method = newIsLiked ? 'POST' : 'DELETE'
      if (!post) return;
      const response = await fetch(`/api/posts/${post.id}/like`, { method })
      
      if (!response.ok) {
        // Revert the optimistic update if API call fails
        setIsLiked(!newIsLiked)
        setLikesCount(!newIsLiked ? likesCount + 1 : likesCount - 1)
        throw new Error('Failed to update like')
      }

      const data = await response.json()
      setLikesCount(data.likes_count)

      toast({
        title: newIsLiked ? "Post liked!" : "Like removed",
        description: newIsLiked ? "Added to your liked posts" : "Removed from liked posts",
      })
    } catch (error) {
      console.error('Error updating like:', error)
      toast({
        title: "Error",
        description: "Failed to update like",
        variant: "destructive",
      })
    }
  }

  const handleCommentLike = async (commentId: string) => {
    // Find the comment to get current state
    const comment = comments.find(c => c.id === commentId)
    if (!comment) return

    const newIsLiked = !comment.liked_by_user
    const newLikesCount = newIsLiked ? comment.likes_count + 1 : comment.likes_count - 1

    // Optimistic update
    setComments(
      comments.map((c) =>
        c.id === commentId
          ? {
              ...c,
              liked_by_user: newIsLiked,
              likes_count: newLikesCount,
            }
          : c,
      ),
    )

    try {
      const method = newIsLiked ? 'POST' : 'DELETE'
      const response = await fetch(`/api/comments/${commentId}/like`, { method })
      
      if (!response.ok) {
        // Revert the optimistic update if API call fails
        setComments(
          comments.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  liked_by_user: !newIsLiked,
                  likes_count: !newIsLiked ? comment.likes_count + 1 : comment.likes_count - 1,
                }
              : c,
          ),
        )
        throw new Error('Failed to update comment like')
      }

      const data = await response.json()
      // Update with actual count from server
      setComments(
        comments.map((c) =>
          c.id === commentId
            ? {
                ...c,
                likes_count: data.likes_count,
              }
            : c,
        ),
      )
    } catch (error) {
      console.error('Error updating comment like:', error)
      toast({
        title: "Error",
        description: "Failed to update comment like",
        variant: "destructive",
      })
    }
  }

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return

    try {
      if (!post) return;
      const response = await fetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newComment
        })
      })

      let data
      try {
        data = await response.json()
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError)
        throw new Error(`Server returned invalid response (${response.status})`)
      }

      console.log('API Response:', { status: response.status, data })

      if (!response.ok) {
        console.error('API Error:', data)
        throw new Error(data.error || `Failed to post comment (${response.status})`)
      }

      setComments([data.comment, ...comments])
      setNewComment("")
      toast({
        title: "Comment posted!",
        description: "Your comment has been added to the discussion.",
      })
    } catch (error) {
      console.error('Error posting comment:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to post comment",
        variant: "destructive",
      })
    }
  }

  const handleReplyToComment = async (commentId: string) => {
    if (!replyContent.trim()) return
    if (!post) return;
    try {
      const response = await fetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: replyContent,
          parent_id: commentId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to post reply')
      }

      setComments([data.comment, ...comments])
      setReplyContent("")
      setReplyingTo(null)
      toast({
        title: "Reply posted!",
        description: "Your reply has been added to the discussion.",
      })
    } catch (error) {
      console.error('Error posting reply:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to post reply",
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

  const getReplyCount = (commentId: string) => {
    return comments.filter(comment => comment.parent_id === commentId).length
  }

  const toggleRepliesCollapse = (commentId: string) => {
    const newCollapsed = new Set(collapsedReplies)
    if (newCollapsed.has(commentId)) {
      newCollapsed.delete(commentId)
    } else {
      newCollapsed.add(commentId)
    }
    setCollapsedReplies(newCollapsed)
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto p-4 pb-20 lg:pb-4">
          <div className="text-center text-gray-500 font-semibold mt-10">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  if (!post) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto p-4 pb-20 lg:pb-4">
          <div className="text-center text-red-500 font-semibold mt-10">Post not found or could not be loaded.</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto p-4 pb-20 lg:pb-4">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Post</h1>
        </div>

        {/* Main Post */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex space-x-4">
              <Link href={`/profile/${post.user.username}`}>
                <Avatar className="w-12 h-12 cursor-pointer">
                  <AvatarImage src={post.user.avatar_url || "/placeholder.svg"} />
                  <AvatarFallback className="bg-green-500 text-white">{post.user.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
              </Link>

              <div className="flex-1 space-y-3">
                <div className="flex items-center space-x-2">
                  <Link href={`/profile/${post.user.username}`} className="flex items-center space-x-2 hover:underline">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{post.user.full_name}</span>
                    {post.user.verified && <CheckCircle className="w-4 h-4 text-blue-500" />}
                  </Link>
                  <span className="text-gray-500 dark:text-gray-400">@{post.user.username}</span>
                  <span className="text-gray-500 dark:text-gray-400">·</span>
                  <span className="text-gray-500 dark:text-gray-400">{formatTimeAgo(post.created_at)}</span>
                </div>

                <p className="text-gray-900 dark:text-gray-100 leading-relaxed text-lg">{post.content}</p>

                {post.media_urls && post.media_urls.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 rounded-lg overflow-hidden">
                    {post.media_urls.map((url, index) => (
                      <div
                        key={index}
                        className="relative aspect-video bg-gray-100 dark:bg-gray-700 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setSelectedImage(url)}
                      >
                        <Image
                          src={url || "/placeholder.svg"}
                          alt={`Post media ${index + 1}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center flex-wrap gap-2">
                  {post.sustainability_category && (
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    >
                      {post.sustainability_category}
                    </Badge>
                  )}

                  {post.location && (
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <MapPin className="w-3 h-3 mr-1" />
                      {post.location}
                    </div>
                  )}

                  {post.impact_score && (
                    <div className="flex items-center space-x-1">
                      <TrendingUp className="w-3 h-3 text-green-600" />
                      <span className="text-sm text-green-600 font-medium">Impact: {post.impact_score}</span>
                      <div className={`w-2 h-2 rounded-full ${getImpactColor(post.impact_score)}`} />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center space-x-6">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLike}
                      className={`flex items-center space-x-2 ${
                        isLiked ? "text-red-500 hover:text-red-600" : "text-gray-500 hover:text-red-500"
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} />
                      <span>{likesCount}</span>
                    </Button>

                    <div className="flex items-center space-x-2 text-gray-500">
                      <MessageCircle className="w-5 h-5" />
                      <span>{comments.length}</span>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center space-x-2 text-gray-500 hover:text-green-500"
                    >
                      <Repeat2 className="w-5 h-5" />
                      <span>{post.reposts_count}</span>
                    </Button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm" className="text-gray-500 hover:text-yellow-500">
                      <Bookmark className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-gray-500 hover:text-blue-500">
                      <Share className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                {isAuthor && isGreenPost && (
                  <div className="pt-3 flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                    <Leaf className="w-4 h-4 flex-shrink-0" />
                    <span>
                      This post has earned you <strong>{postPointsEarned !== null ? postPointsEarned : '…'}</strong> green point{postPointsEarned === 1 ? '' : 's'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comment Input */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex space-x-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={profile?.avatar_url || "/placeholder-user.jpg"} />
                <AvatarFallback className="bg-green-500 text-white">
                  {profile?.full_name?.charAt(0) || session?.user?.user_metadata?.full_name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-3">
                <Textarea
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim()}
                    className="sustainability-gradient"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Comment
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comments */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Comments ({comments.filter(comment => !comment.parent_id).length})</h2>

          {comments
            .filter(comment => !comment.parent_id) // Only show top-level comments
            .map((comment) => (
            <div key={comment.id} className="space-y-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex space-x-3">
                    <Link href={`/profile/${comment.user.username}`}>
                      <Avatar className="w-10 h-10 cursor-pointer">
                        <AvatarImage src={comment.user.avatar_url || "/placeholder.svg"} />
                        <AvatarFallback className="bg-green-500 text-white">
                          {comment.user.full_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    </Link>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/profile/${comment.user.username}`}
                          className="flex items-center space-x-2 hover:underline"
                        >
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{comment.user.full_name}</span>
                          {comment.user.verified && <CheckCircle className="w-4 h-4 text-blue-500" />}
                        </Link>
                        <span className="text-gray-500 dark:text-gray-400">@{comment.user.username}</span>
                        <span className="text-gray-500 dark:text-gray-400">·</span>
                        <span className="text-gray-500 dark:text-gray-400">{formatTimeAgo(comment.created_at)}</span>
                      </div>

                      <p className="text-gray-900 dark:text-gray-100">{comment.content}</p>

                      <div className="flex items-center space-x-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCommentLike(comment.id)}
                          className={`flex items-center space-x-1 ${
                            comment.liked_by_user ? "text-red-500 hover:text-red-600" : "text-gray-500 hover:text-red-500"
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${comment.liked_by_user ? "fill-current" : ""}`} />
                          <span>{comment.likes_count}</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex items-center space-x-1 text-gray-500 hover:text-blue-500"
                          onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Reply</span>
                        </Button>

                        {getReplyCount(comment.id) > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex items-center space-x-1 text-gray-500 hover:text-gray-700"
                            onClick={() => toggleRepliesCollapse(comment.id)}
                          >
                            <span className="text-sm">
                              {collapsedReplies.has(comment.id) ? 'Show' : 'Hide'} {getReplyCount(comment.id)} {getReplyCount(comment.id) === 1 ? 'reply' : 'replies'}
                            </span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Reply Input */}
              {replyingTo === comment.id && (
                <div className="ml-12 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                  <div className="flex space-x-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={profile?.avatar_url || "/placeholder-user.jpg"} />
                      <AvatarFallback className="bg-green-500 text-white">
                        {profile?.full_name?.charAt(0) || session?.user?.user_metadata?.full_name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Textarea
                        placeholder={`Reply to ${comment.user.full_name}...`}
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        className="min-h-[60px] resize-none text-sm"
                      />
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setReplyingTo(null)
                            setReplyContent("")
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleReplyToComment(comment.id)}
                          disabled={!replyContent.trim()}
                          className="sustainability-gradient"
                        >
                          Reply
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Replies */}
              {!collapsedReplies.has(comment.id) && comments
                .filter(reply => reply.parent_id === comment.id)
                .map((reply) => (
                <div key={reply.id} className="ml-12 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex space-x-3">
                        <Link href={`/profile/${reply.user.username}`}>
                          <Avatar className="w-8 h-8 cursor-pointer">
                            <AvatarImage src={reply.user.avatar_url || "/placeholder.svg"} />
                            <AvatarFallback className="bg-green-500 text-white">
                              {reply.user.full_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        </Link>

                        <div className="flex-1 space-y-2">
                          <div className="flex items-center space-x-2">
                            <Link
                              href={`/profile/${reply.user.username}`}
                              className="flex items-center space-x-2 hover:underline"
                            >
                              <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{reply.user.full_name}</span>
                              {reply.user.verified && <CheckCircle className="w-3 h-3 text-blue-500" />}
                            </Link>
                            <span className="text-gray-500 dark:text-gray-400 text-sm">@{reply.user.username}</span>
                            <span className="text-gray-500 dark:text-gray-400 text-sm">·</span>
                            <span className="text-gray-500 dark:text-gray-400 text-sm">{formatTimeAgo(reply.created_at)}</span>
                          </div>

                          <p className="text-gray-900 dark:text-gray-100 text-sm">{reply.content}</p>

                          <div className="flex items-center space-x-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCommentLike(reply.id)}
                              className={`flex items-center space-x-1 text-xs ${
                                reply.liked_by_user ? "text-red-500 hover:text-red-600" : "text-gray-500 hover:text-red-500"
                              }`}
                            >
                              <Heart className={`w-3 h-3 ${reply.liked_by_user ? "fill-current" : ""}`} />
                              <span>{reply.likes_count}</span>
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex items-center space-x-1 text-gray-500 hover:text-blue-500 text-xs"
                              onClick={() => setReplyingTo(replyingTo === reply.id ? null : reply.id)}
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>Reply</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Nested Reply Input */}
                  {replyingTo === reply.id && (
                    <div className="ml-8 mt-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                      <div className="flex space-x-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={profile?.avatar_url || "/placeholder-user.jpg"} />
                          <AvatarFallback className="bg-green-500 text-white text-xs">
                            {profile?.full_name?.charAt(0) || session?.user?.user_metadata?.full_name?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-2">
                          <Textarea
                            placeholder={`Reply to ${reply.user.full_name}...`}
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            className="min-h-[50px] resize-none text-xs"
                          />
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReplyingTo(null)
                                setReplyContent("")
                              }}
                              className="text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleReplyToComment(reply.id)}
                              disabled={!replyContent.trim()}
                              className="sustainability-gradient text-xs"
                            >
                              Reply
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <ImageModal src={selectedImage || "/placeholder.svg"} alt="Post image" onClose={() => setSelectedImage(null)} />
      )}
    </MainLayout>
  )
}
