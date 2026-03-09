"use client"

import { useState, useRef, useEffect } from "react"
import { useSession } from "@supabase/auth-helpers-react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import MentionTextarea from "@/components/mention-textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { ImageIcon, MapPin, Smile, Globe, Users, Lock, X, ExternalLink } from "lucide-react"
import Image from "next/image"
import EmojiPicker from "@/components/emoji-picker"
import { uploadPostMedia, type UploadResult } from "@/lib/storage"
import { GENERAL_CATEGORIES } from "@/lib/categories"


interface CreatePostModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPostCreated?: () => void
  variant?: "modal" | "page"
}

interface LocationSuggestion {
  display_name: string
  lat: string
  lon: string
  address?: {
    city?: string
    town?: string
    village?: string
    state?: string
    country?: string
    country_code?: string
  }
}

interface LinkPreview {
  url: string
  title?: string
  description?: string
  image?: string
  domain?: string
}

export default function CreatePostModal({ open, onOpenChange, onPostCreated, variant = "modal" }: CreatePostModalProps) {
  const [content, setContent] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [location, setLocation] = useState("")
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [privacy, setPrivacy] = useState("public")
  const [loading, setLoading] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const locationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const session = useSession()
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const [showLocationInput, setShowLocationInput] = useState(false)

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
  }, [session?.user?.id, supabase])

  // Fetch location suggestions
  const fetchLocationSuggestions = async (query: string) => {
    if (query.length < 3) {
      setLocationSuggestions([])
      setShowSuggestions(false)
      return
    }

    setLoadingSuggestions(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}&addressdetails=1`
      )
      const data = await response.json()
      setLocationSuggestions(data)
      setShowSuggestions(true)
    } catch (error) {
      console.error('Error fetching location suggestions:', error)
      setLocationSuggestions([])
      setShowSuggestions(false)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  // Handle location input change with debouncing
  const handleLocationChange = (value: string) => {
    setLocation(value)
    
    // Clear existing timeout
    if (locationTimeoutRef.current) {
      clearTimeout(locationTimeoutRef.current)
    }
    
    // Set new timeout for debounced search
    locationTimeoutRef.current = setTimeout(() => {
      fetchLocationSuggestions(value)
    }, 300)
  }

  // Format location to show only city/state and country
  const formatLocationDisplay = (suggestion: LocationSuggestion): string => {
    const { address } = suggestion
    if (!address) {
      // Fallback to parsing display_name if address details are not available
      const parts = suggestion.display_name.split(', ')
      if (parts.length >= 2) {
        return `${parts[0]}, ${parts[parts.length - 1]}`
      }
      return suggestion.display_name
    }

    const city = address.city || address.town || address.village
    const state = address.state
    const country = address.country

    let formatted = ''
    if (city) {
      formatted += city
    }
    if (state && city) {
      formatted += `, ${state}`
    } else if (state && !city) {
      formatted = state
    }
    if (country) {
      formatted += `, ${country}`
    }

    return formatted || suggestion.display_name
  }

  // Handle location suggestion selection
  const handleLocationSelect = (suggestion: LocationSuggestion) => {
    setLocation(formatLocationDisplay(suggestion))
    setShowSuggestions(false)
    setLocationSuggestions([])
  }

  // Extract URLs from text
  const extractUrls = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const matches = text.match(urlRegex)
    return matches || []
  }

  // Fetch link preview
  const fetchLinkPreview = async (url: string) => {
    try {
      setLoadingPreview(true)
      const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      if (response.ok) {
        const preview = await response.json()
        setLinkPreview(preview)
      }
    } catch (error) {
      console.error('Failed to fetch link preview:', error)
    } finally {
      setLoadingPreview(false)
    }
  }

  // Handle content change with URL detection
  const handleContentChange = (value: string) => {
    setContent(value)
    
    // Extract URLs from content
    const urls = extractUrls(value)
    
    // If there's a new URL and no current preview, fetch preview
    if (urls.length > 0 && (!linkPreview || !urls.includes(linkPreview.url))) {
      const newUrl = urls[urls.length - 1] // Get the last URL
      fetchLinkPreview(newUrl)
    } else if (urls.length === 0) {
      // Clear preview if no URLs
      setLinkPreview(null)
    }
  }

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (locationTimeoutRef.current) {
        clearTimeout(locationTimeoutRef.current)
      }
    }
  }, [])

  const handleSubmit = async () => {
    if (!session?.user) {
      toast({
        title: "Authentication required",
        description: "Please log in to create a post",
        variant: "destructive",
      })
      return
    }
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
          content: content.trim(),
          media_urls: selectedImages,
          location: location || null,
                  sustainability_category: selectedCategory || null,
          impact_score: null, // You can calculate this based on category or content
          link_preview: linkPreview
        }),
      })

      const data = await response.json()

      if (response.ok) {
         toast({
           title: "Post created!",
           description: "Your sustainability post has been shared with the community",
         })
         setContent("")
         setSelectedCategory("")
         setLocation("")
         setLocationSuggestions([])
         setShowSuggestions(false)
         setSelectedImages([])
         onOpenChange(false)
         // Refresh the posts list
         if (onPostCreated) {
           onPostCreated()
         }
       } else {
        toast({
          title: "Error creating post",
          description: data.error || "Something went wrong. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error creating post:', error)
      toast({
        title: "Error creating post",
        description: "Network error. Please check your connection and try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setContent("")
    setSelectedCategory("")
    setLocation("")
    setLocationSuggestions([])
    setShowSuggestions(false)
    setSelectedImages([])
    setLinkPreview(null)
    onOpenChange(false)
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

  const handleEmojiSelect = (emoji: string) => {
    setContent((prev) => prev + emoji)
  }

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index))
  }

  const isPage = variant === "page"
  const Composer = (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex space-x-3 sm:space-x-4">
        <Avatar className="w-10 h-10 sm:w-12 sm:h-12">
          <AvatarImage src={profile?.avatar_url || "/placeholder.svg"} />
          <AvatarFallback className="bg-green-500 text-white">
            {(profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email)?.charAt(0)?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={privacy} onValueChange={setPrivacy}>
              <SelectTrigger className="h-9 px-2 text-xs w-20 sm:w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <div className="flex items-center">
                    <Globe className="w-3 h-3 mr-2" />
                    Public
                  </div>
                </SelectItem>
                <SelectItem value="followers">
                  <div className="flex items-center">
                    <Users className="w-3 h-3 mr-2" />
                    Followers
                  </div>
                </SelectItem>
                <SelectItem value="private">
                  <div className="flex items-center">
                    <Lock className="w-3 h-3 mr-2" />
                    Private
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <MentionTextarea
            placeholder="What's on your mind?"
            value={content}
            onChange={handleContentChange}
            unstyled
            className="bg-transparent text-base sm:text-lg placeholder:text-gray-500"
            minHeight={isPage ? "160px" : "100px"}
          />
          {(linkPreview || loadingPreview) && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {loadingPreview ? (
                <div className="p-4 flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                  <span className="text-sm text-gray-500">Loading link preview...</span>
                </div>
              ) : linkPreview ? (
                <div className="relative">
                  <button
                    onClick={() => setLinkPreview(null)}
                    className="absolute top-2 right-2 z-10 w-6 h-6 bg-gray-800 bg-opacity-50 text-white rounded-full flex items-center justify-center text-sm hover:bg-opacity-70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <a
                    href={linkPreview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex">
                      {linkPreview.image && (
                        <div className="w-24 h-24 flex-shrink-0">
                          <Image
                            src={linkPreview.image}
                            alt={linkPreview.title || 'Link preview'}
                            width={96}
                            height={96}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 p-3 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            {linkPreview.title && (
                              <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">
                                {linkPreview.title}
                              </h3>
                            )}
                            {linkPreview.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                                {linkPreview.description}
                              </p>
                            )}
                            <div className="flex items-center text-xs text-gray-500 dark:text-gray-500">
                              <ExternalLink className="w-3 h-3 mr-1" />
                              <span className="truncate">{linkPreview.domain || new URL(linkPreview.url).hostname}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </a>
                </div>
              ) : null}
            </div>
          )}
          {selectedImages.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
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
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
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
          </div>
          {showLocationInput && (
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Add location"
                value={location}
                onChange={(e) => handleLocationChange(e.target.value)}
                onFocus={() => location.length >= 3 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 300)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {showSuggestions && (locationSuggestions.length > 0 || loadingSuggestions) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                  {loadingSuggestions ? (
                    <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                      Searching locations...
                    </div>
                  ) : (
                    locationSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleLocationSelect(suggestion)
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none"
                      >
                        <div className="flex items-center">
                          <MapPin className="w-3 h-3 mr-2 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{formatLocationDisplay(suggestion)}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3 sm:space-y-0">
            {!isPage && (
            <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto">
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
                className="text-green-600 hover:text-green-700 flex-shrink-0 px-2"
                onClick={handleImageUpload}
                disabled={uploadingImages}
              >
                <ImageIcon className="w-4 h-4" />
              </Button>
              <EmojiPicker onEmojiSelect={handleEmojiSelect}>
                <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 flex-shrink-0 px-2">
                  <Smile className="w-4 h-4" />
                </Button>
              </EmojiPicker>
              <Button
                variant="ghost"
                size="sm"
                className="text-green-600 hover:text-green-700 flex-shrink-0 px-2"
                onClick={() => setShowLocationInput((prev) => !prev)}
              >
                <MapPin className="w-4 h-4" />
              </Button>
            </div>
            )}
            <div className={`flex items-center space-x-2 ${isPage ? "hidden sm:flex" : ""}`}>
              <Button
                onClick={handleSubmit}
                disabled={!content.trim() || loading}
                className="bg-green-600 hover:bg-green-700 text-white"
                size="sm"
              >
                {loading ? "Posting..." : "Post"}
              </Button>
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            <div className="text-[10px] text-gray-500 text-center sm:text-left">{content.length}/280 characters</div>
            <div className="flex items-center justify-center sm:justify-end space-x-2">
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (variant === "page") {
    return (
      <div className="max-w-2xl mx-auto p-3 sm:p-6">
        {Composer}
        <div className="sm:hidden fixed bottom-16 left-0 right-0 z-50 px-3">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-1 overflow-x-auto">
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
                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                  onClick={handleImageUpload}
                  disabled={uploadingImages}
                >
                  <ImageIcon className="w-4 h-4" />
                </Button>
                <EmojiPicker onEmojiSelect={handleEmojiSelect}>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-green-600 hover:text-green-700">
                    <Smile className="w-4 h-4" />
                  </Button>
                </EmojiPicker>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                  onClick={() => setShowLocationInput((prev) => !prev)}
                >
                  <MapPin className="w-4 h-4" />
                </Button>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={!content.trim() || loading}
                className="h-9 px-3 bg-green-600 hover:bg-green-700 text-white"
              >
                {loading ? "Posting..." : "Post"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto mx-4 sm:mx-6">
        <DialogHeader>
          <DialogTitle className="sr-only">Create Post</DialogTitle>
          <DialogDescription className="sr-only">Compose a new post</DialogDescription>
        </DialogHeader>
        {Composer}
      </DialogContent>
    </Dialog>
  )
}
