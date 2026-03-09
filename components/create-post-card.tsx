"use client"

import { useState, useRef } from "react"
import { useSession } from "@supabase/auth-helpers-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { ImageIcon, MapPin, Smile, Calendar, Globe, Users, Lock, X } from "lucide-react"
import Image from "next/image"
import { uploadPostMedia, type UploadResult } from "@/lib/storage"
import { GENERAL_CATEGORIES } from "@/lib/categories"


export default function CreatePostCard() {
  const [content, setContent] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [location, setLocation] = useState("")
  const [privacy, setPrivacy] = useState("public")
  const [isExpanded, setIsExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const session = useSession()
  const { toast } = useToast()

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast({
        title: "Content required",
        description: "Please write something before posting",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          media_urls: selectedImages,
          location,
          sustainability_category: selectedCategory,
          impact_score: selectedCategory ? Math.floor(Math.random() * 100) + 1 : null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create post')
      }

      toast({
        title: "Post created!",
        description: "Your post has been shared with the community.",
      })

      // Reset form
      setContent("")
      setSelectedCategory("")
      setLocation("")
      setSelectedImages([])
      setIsExpanded(false)

      // Note: If this component is used in a context where posts need to be refreshed,
      // consider adding an onPostCreated prop similar to CreatePostModal
    } catch (error) {
      console.error('Error creating post:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create post",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFocus = () => {
    setIsExpanded(true)
  }

  const handleCancel = () => {
    setContent("")
    setSelectedCategory("")
    setLocation("")
    setSelectedImages([])
    setIsExpanded(false)
  }

  const handleImageUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    if (!session?.user?.id) {
      toast({
        title: "Authentication required",
        description: "Please log in to upload images",
        variant: "destructive",
      })
      return
    }

    // Check if adding these files would exceed the limit (e.g., 4 images max)
    if (selectedImages.length + files.length > 4) {
      toast({
        title: "Too many images",
        description: "You can upload a maximum of 4 images per post",
        variant: "destructive",
      })
      return
    }

    setUploadingImages(true)

    try {
      const uploadPromises = Array.from(files).map(file => 
        uploadPostMedia(file, session.user.id)
      )
      
      const results = await Promise.all(uploadPromises)
      
      const successfulUploads: string[] = []
      const errors: string[] = []
      
      results.forEach((result: UploadResult) => {
        if (result.error) {
          errors.push(result.error)
        } else {
          successfulUploads.push(result.url)
        }
      })
      
      if (successfulUploads.length > 0) {
        setSelectedImages(prev => [...prev, ...successfulUploads])
        toast({
          title: "Images uploaded",
          description: `Successfully uploaded ${successfulUploads.length} image(s)`,
        })
      }
      
      if (errors.length > 0) {
        toast({
          title: "Upload errors",
          description: `Failed to upload ${errors.length} image(s): ${errors[0]}`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: "Upload failed",
        description: "Failed to upload images. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploadingImages(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <Card className="bg-white dark:bg-gray-800 shadow-sm">
      <CardContent className="p-6">
        <div className="flex space-x-4">
          <Avatar className="w-12 h-12">
            <AvatarImage src="https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face" />
            <AvatarFallback className="bg-green-500 text-white">
              {session?.user?.user_metadata?.full_name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-4">
            <Textarea
              placeholder="What's your latest sustainability action? Share your impact..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={handleFocus}
              className="min-h-[80px] resize-none border-none shadow-none text-lg placeholder:text-gray-500 focus-visible:ring-0"
            />

            {/* Image Preview */}
            {selectedImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {selectedImages.map((image, index) => (
                  <div
                    key={index}
                    className="relative aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden"
                  >
                    <Image
                      src={image || "/placeholder.svg"}
                      alt={`Selected image ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isExpanded && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENERAL_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                  </Select>

                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Add location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-green-600 hover:text-green-700"
                      onClick={handleImageUpload}
                      disabled={uploadingImages}
                    >
                      <ImageIcon className="w-4 h-4 mr-2" />
                      {uploadingImages ? "Uploading..." : "Media"}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700">
                      <Smile className="w-4 h-4 mr-2" />
                      Emoji
                    </Button>
                    <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700">
                      <Calendar className="w-4 h-4 mr-2" />
                      Schedule
                    </Button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Select value={privacy} onValueChange={setPrivacy}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">
                          <div className="flex items-center">
                            <Globe className="w-4 h-4 mr-2" />
                            Public
                          </div>
                        </SelectItem>
                        <SelectItem value="followers">
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-2" />
                            Followers
                          </div>
                        </SelectItem>
                        <SelectItem value="private">
                          <div className="flex items-center">
                            <Lock className="w-4 h-4 mr-2" />
                            Private
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedCategory && (
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    >
                      {selectedCategory}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => setSelectedCategory("")}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">{content.length}/280 characters</div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" onClick={handleCancel}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={!content.trim() || loading}
                      className="sustainability-gradient"
                    >
                      {loading ? "Posting..." : "Post"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
