"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useSession } from "@supabase/auth-helpers-react"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from "@/lib/supabase/client"
import { uploadAvatar } from "@/lib/storage"
import MainLayout from "@/components/main-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import {
  Settings,
  User,
  Shield,
  Bell,
  Download,
  Trash2,
  Camera,
  MapPin,
  LinkIcon,
  Globe,
  Lock,
  Eye,
  EyeOff,
  Save,
  AlertTriangle,
  Building2,
  FileText,
  Upload,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react"
import { DeleteAccountModal, ConfirmDeleteModal } from "@/components/delete-account-modals"

export default function SettingsPage() {
  const session = useSession()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("profile")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")

  // Profile settings state
  const [profileData, setProfileData] = useState({
    full_name: session?.user?.user_metadata?.full_name || "",
    username: session?.user?.user_metadata?.username || "",
    bio: "Environmental scientist passionate about renewable energy and climate action. Leading community solar initiatives across the Pacific Northwest. 🌱",
    location: "Portland, Oregon",
    website: "https://sarahgreen.eco",
    avatar_url: "/images/profiles/sarah-green-avatar.png",
    cover_url: "/images/covers/sarah-green-cover.png",
  })
  
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load current user profile data
  useEffect(() => {
    const loadProfileData = async () => {
      if (session?.user?.id) {
        try {
          const supabase = createClient()
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          
          if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
            console.error('Error loading profile:', error)
            toast({
              title: "Error",
              description: "Failed to load profile data",
              variant: "destructive",
            })
            return
          }

          if (profile) {
            setProfileData({
              full_name: profile.full_name || '',
              username: profile.username || '',
              bio: profile.bio || '',
              location: profile.location || '',
              website: profile.website || '',
              avatar_url: profile.avatar_url || '',
              cover_url: profile.cover_url || '',
            })
          } else {
            // No profile exists, set defaults from user metadata
            const userMetadata = session.user.user_metadata || {}
            setProfileData({
              full_name: userMetadata.full_name || userMetadata.name || '',
              username: userMetadata.username || '',
              bio: '',
              location: '',
              website: '',
              avatar_url: userMetadata.avatar_url || userMetadata.picture || '',
              cover_url: '',
            })
          }
        } catch (error) {
          console.error('Error loading profile data:', error)
          toast({
            title: "Error",
            description: "Failed to load profile data",
            variant: "destructive",
          })
        }
      }
    }
    
    loadProfileData()
  }, [session, toast])

  // Account settings state
  const [accountData, setAccountData] = useState({
    email: session?.user?.email || "",
    current_password: "",
    new_password: "",
    confirm_password: "",
  })

  // Privacy settings state
  const [privacySettings, setPrivacySettings] = useState({
    profile_visibility: "public",
    show_email: false,
    show_location: true,
    allow_messages: true,
    allow_mentions: true,
    show_activity: true,
  })

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState({
    email_notifications: true,
    push_notifications: true,
    likes: true,
    comments: true,
    follows: true,
    mentions: true,
    reposts: true,
    sustainability_updates: true,
    weekly_digest: true,
    community_events: true,
  })

  // Theme settings state
  const [themeSettings, setThemeSettings] = useState({
    theme: "system",
    compact_mode: false,
    reduce_motion: false,
    high_contrast: false,
  })

  // Organization upgrade state
  const [organizationData, setOrganizationData] = useState({
    request_type: "organization",
    organization_name: "",
    organization_type: "",
    business_registration_number: "",
    tax_id: "",
    industry: "",
    company_size: "",
    founded_year: new Date().getFullYear(),
    headquarters_address: "",
    contact_phone: "",
    contact_email: "",
    organization_description: "",
    organization_mission: "",
    sustainability_goals: "",
    certifications: [],
    website_url: "",
    linkedin_url: "",
  })

  const [upgradeRequest, setUpgradeRequest] = useState<{
    id: string;
    status: string;
    admin_notes?: string;
    organization_name: string;
    industry: string;
    request_type: string;
    submitted_at: string;
  } | null>(null)
  const [uploadingDocuments, setUploadingDocuments] = useState(false)
  const [submittingUpgrade, setSubmittingUpgrade] = useState(false)
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 })

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check authentication
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    if (!authUser) {
      toast({
        title: "Authentication required",
        description: "Please log in to upload an avatar.",
        variant: "destructive",
      })
      return
    }

    setUploadingAvatar(true)

    try {
      const result = await uploadAvatar(file, authUser.id)
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      setProfileData(prev => ({
        ...prev,
        avatar_url: result.url
      }))
      
      toast({
        title: "Avatar uploaded!",
        description: "Your profile picture has been updated successfully.",
      })
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast({
        title: "Upload failed",
        description: "Failed to upload avatar. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploadingAvatar(false)
      // Reset the file input
      event.target.value = ''
    }
  }

  const handleSaveProfile = async () => {
    // Validate required fields
    if (!profileData.full_name.trim() || !profileData.username.trim()) {
      toast({
        title: "Error",
        description: "Full name and username are required",
        variant: "destructive",
      })
      return
    }

    try {
      const supabase = createClient()
      
      // Check if profile exists first
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session?.user?.id)
        .single()

      const baseProfilePayload = {
        id: session?.user?.id,
        full_name: profileData.full_name,
        username: profileData.username,
        bio: profileData.bio || null,
        location: profileData.location || null,
        website: profileData.website || null,
        avatar_url: profileData.avatar_url || null,
        cover_url: profileData.cover_url || null,
        updated_at: new Date().toISOString()
      }

      let result
      if (existingProfile) {
        // Update existing profile
        result = await supabase
          .from('profiles')
          .update(baseProfilePayload)
          .eq('id', session?.user?.id)
      } else {
        // Create new profile
        const createProfilePayload = {
          ...baseProfilePayload,
          created_at: new Date().toISOString()
        }
        result = await supabase
          .from('profiles')
          .insert([createProfilePayload])
      }

      if (result.error) {
        throw new Error(result.error.message)
      }

      // Update user metadata
      await supabase.auth.updateUser({
        data: {
          full_name: profileData.full_name,
          username: profileData.username,
          avatar_url: profileData.avatar_url
        }
      })

      toast({
        title: "Success",
        description: existingProfile ? "Profile updated successfully" : "Profile created successfully",
      })
    } catch (error) {
      console.error('Error saving profile:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save profile",
        variant: "destructive",
      })
    }
  }

  const handleSaveAccount = async () => {
    if (accountData.new_password && accountData.new_password !== accountData.confirm_password) {
      toast({
        title: "Password mismatch",
        description: "New passwords do not match.",
        variant: "destructive",
      })
      return
    }

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast({
        title: "Account updated!",
        description: "Your account settings have been saved successfully.",
      })
      setAccountData((prev) => ({
        ...prev,
        current_password: "",
        new_password: "",
        confirm_password: "",
      }))
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update account. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSavePrivacy = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast({
        title: "Privacy settings updated!",
        description: "Your privacy preferences have been saved.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update privacy settings.",
        variant: "destructive",
      })
    }
  }

  const handleSaveNotifications = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast({
        title: "Notification settings updated!",
        description: "Your notification preferences have been saved.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update notification settings.",
        variant: "destructive",
      })
    }
  }

  const handleExportData = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      toast({
        title: "Data export started!",
        description: "You'll receive an email with your data export within 24 hours.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start data export.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteAccount = async () => {
    setShowDeleteModal(true)
  }

  // Load existing upgrade request
  useEffect(() => {
    const loadUpgradeRequest = async () => {
      if (session?.user?.id) {
        try {
          const supabase = createClient()
          const { data: request, error } = await supabase
            .from('organization_upgrade_requests')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
          
          if (error && error.code !== 'PGRST116') {
            console.error('Error loading upgrade request:', error)
            return
          }

          if (request) {
            setUpgradeRequest(request)
          }
        } catch (error) {
          console.error('Error loading upgrade request:', error)
        }
      }
    }
    
    loadUpgradeRequest()
  }, [session])

  const handleSubmitUpgrade = async () => {
    if (!session?.user?.id) {
      toast({
        title: "Authentication required",
        description: "Please log in to submit an upgrade request.",
        variant: "destructive",
      })
      return
    }

    // Validate required fields
    if (!organizationData.organization_name || !organizationData.industry || 
        !organizationData.headquarters_address || !organizationData.contact_phone || 
        !organizationData.contact_email || !organizationData.organization_description) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields marked with *",
        variant: "destructive",
      })
      return
    }

    setSubmittingUpgrade(true)

    try {
      const supabase = createClient()
      
      const upgradePayload = {
        user_id: session.user.id,
        request_type: organizationData.request_type,
        organization_name: organizationData.organization_name,
        organization_type: organizationData.organization_type || null,
        business_registration_number: organizationData.business_registration_number || null,
        tax_id: organizationData.tax_id || null,
        industry: organizationData.industry,
        company_size: organizationData.company_size || null,
        founded_year: organizationData.founded_year || null,
        headquarters_address: organizationData.headquarters_address,
        contact_phone: organizationData.contact_phone,
        contact_email: organizationData.contact_email,
        organization_description: organizationData.organization_description,
        organization_mission: organizationData.organization_mission || null,
        sustainability_goals: organizationData.sustainability_goals || null,
        website_url: organizationData.website_url || null,
        linkedin_url: organizationData.linkedin_url || null,
        status: 'pending'
      }

      const { data: request, error } = await supabase
        .from('organization_upgrade_requests')
        .insert([upgradePayload])
        .select()
        .single()

      if (error) {
        throw new Error(error.message)
      }

      setUpgradeRequest(request)
      
      toast({
        title: "Upgrade request submitted!",
        description: "Your organization upgrade request has been submitted for review. We'll notify you within 3-5 business days.",
      })

      // Reset form
      setOrganizationData({
        request_type: "organization",
        organization_name: "",
        organization_type: "",
        business_registration_number: "",
        tax_id: "",
        industry: "",
        company_size: "",
        founded_year: new Date().getFullYear(),
        headquarters_address: "",
        contact_phone: "",
        contact_email: "",
        organization_description: "",
        organization_mission: "",
        sustainability_goals: "",
        certifications: [],
        website_url: "",
        linkedin_url: "",
      })
    } catch (error) {
      console.error('Error submitting upgrade request:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit upgrade request",
        variant: "destructive",
      })
    } finally {
      setSubmittingUpgrade(false)
    }
  }

  useEffect(() => {
    const loadStats = async () => {
      if (!session?.user?.id) return
      try {
        const supabase = createClient()
        const { data: profile } = await supabase
          .from('profiles')
          .select('followers_count, following_count')
          .eq('id', session.user.id)
          .single()
        const { count: postsCount } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session.user.id)
        setStats({
          posts: postsCount || 0,
          followers: profile?.followers_count || 0,
          following: profile?.following_count || 0
        })
      } catch (error) {
        console.error('Error loading stats:', error)
      }
    }
    loadStats()
  }, [session])

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto p-3 sm:p-4 pb-20 lg:pb-4">
        <div className="flex items-center space-x-3 mb-4 sm:mb-6">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Manage your account and preferences</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          {/* Mobile: Horizontal scrollable tabs */}
          <div className="sm:hidden">
            <div className="flex space-x-1 overflow-x-auto pb-2 scrollbar-hide">
              {[
                { value: 'profile', icon: User, label: 'Profile' },
                { value: 'account', icon: Shield, label: 'Account' },
                { value: 'organization', icon: Building2, label: 'Org' },
                { value: 'privacy', icon: Lock, label: 'Privacy' },
                { value: 'notifications', icon: Bell, label: 'Notify' },
                { value: 'data', icon: Download, label: 'Data' },
              ].map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs transition-colors min-w-[3.5rem] ${
                      activeTab === tab.value
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium leading-tight">{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
          
          {/* Desktop: Standard tabs */}
          <TabsList className="hidden sm:grid w-full grid-cols-6">
            <TabsTrigger value="profile" className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>Profile</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center space-x-2">
              <Shield className="w-4 h-4" />
              <span>Account</span>
            </TabsTrigger>
            <TabsTrigger value="organization" className="flex items-center space-x-2">
              <Building2 className="w-4 h-4" />
              <span>Organization</span>
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center space-x-2">
              <Lock className="w-4 h-4" />
              <span>Privacy</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center space-x-2">
              <Bell className="w-4 h-4" />
              <span>Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="data" className="flex items-center space-x-2">
              <Download className="w-4 h-4" />
              <span>Data</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Settings */}
          <TabsContent value="profile" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="pb-4 sm:pb-6">
                <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                  <User className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Profile Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
                {/* Avatar Section */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
                  <div className="relative">
                    <Avatar className="w-20 h-20 sm:w-24 sm:h-24">
                      <AvatarImage src={profileData.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback className="bg-green-500 text-white text-lg sm:text-xl">
                        {profileData.full_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <Button
                      size="sm"
                      className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 rounded-full w-7 h-7 sm:w-8 sm:h-8 p-0"
                      variant="secondary"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                    >
                      <Camera className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                  </div>
                  <div className="space-y-2 text-center sm:text-left">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">Profile Photo</h3>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      Upload a new profile photo. JPG, PNG or GIF. Max size 10MB.
                    </p>
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                        disabled={uploadingAvatar}
                      />
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="h-9 sm:h-auto text-xs sm:text-sm"
                      >
                        {uploadingAvatar ? "Uploading..." : "Upload Photo"}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600 h-9 sm:h-auto text-xs sm:text-sm">
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Basic Information */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="full_name" className="text-sm sm:text-base">Full Name</Label>
                    <Input
                      id="full_name"
                      value={profileData.full_name}
                      onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                      placeholder="Enter your full name"
                      className="h-10 sm:h-auto"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm sm:text-base">Username</Label>
                    <Input
                      id="username"
                      value={profileData.username}
                      onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                      placeholder="Enter your username"
                      className="h-10 sm:h-auto"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={profileData.bio}
                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                    placeholder="Tell us about yourself and your sustainability journey..."
                    className="min-h-[100px]"
                  />
                  <p className="text-sm text-gray-500">{profileData.bio.length}/280 characters</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="location"
                        value={profileData.location}
                        onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                        placeholder="Your location"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="website"
                        value={profileData.website}
                        onChange={(e) => setProfileData({ ...profileData, website: e.target.value })}
                        placeholder="https://yourwebsite.com"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>



                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} className="sustainability-gradient">
                    <Save className="w-4 h-4 mr-2" />
                    Save Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Settings */}
          <TabsContent value="account" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="pb-4 sm:pb-6">
                <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Account Security</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm sm:text-base">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={accountData.email}
                    onChange={(e) => setAccountData({ ...accountData, email: e.target.value })}
                    placeholder="your@email.com"
                    className="h-10 sm:h-auto"
                  />
                </div>

                <Separator />

                <div className="space-y-3 sm:space-y-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">Change Password</h3>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current_password" className="text-sm sm:text-base">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="current_password"
                          type={showCurrentPassword ? "text" : "password"}
                          value={accountData.current_password}
                          onChange={(e) => setAccountData({ ...accountData, current_password: e.target.value })}
                          placeholder="Enter current password"
                          className="pr-10 h-10 sm:h-auto"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new_password" className="text-sm sm:text-base">New Password</Label>
                      <div className="relative">
                        <Input
                          id="new_password"
                          type={showNewPassword ? "text" : "password"}
                          value={accountData.new_password}
                          onChange={(e) => setAccountData({ ...accountData, new_password: e.target.value })}
                          placeholder="Enter new password"
                          className="pr-10 h-10 sm:h-auto"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          {showNewPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm_password" className="text-sm sm:text-base">Confirm New Password</Label>
                      <div className="relative">
                        <Input
                          id="confirm_password"
                          type={showConfirmPassword ? "text" : "password"}
                          value={accountData.confirm_password}
                          onChange={(e) => setAccountData({ ...accountData, confirm_password: e.target.value })}
                          placeholder="Confirm new password"
                          className="pr-10 h-10 sm:h-auto"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveAccount} className="sustainability-gradient h-10 sm:h-auto text-sm sm:text-base">
                    <Save className="w-4 h-4 mr-2" />
                    Update Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Organization Upgrade */}
          <TabsContent value="organization" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="pb-4 sm:pb-6">
                <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Organization Account Upgrade</span>
                </CardTitle>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Upgrade your account to access organization features, marketplace access, and business tools.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
                {upgradeRequest ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      {upgradeRequest.status === 'pending' && (
                        <>
                          <Clock className="w-5 h-5 text-blue-600" />
                          <div>
                            <h3 className="font-semibold text-blue-900 dark:text-blue-100">Request Submitted</h3>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              Your organization upgrade request is pending review. We'll notify you within 3-5 business days.
                            </p>
                          </div>
                        </>
                      )}
                      {upgradeRequest.status === 'under_review' && (
                        <>
                          <FileText className="w-5 h-5 text-yellow-600" />
                          <div>
                            <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">Under Review</h3>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                              Our team is currently reviewing your application. You'll hear from us soon.
                            </p>
                          </div>
                        </>
                      )}
                      {upgradeRequest.status === 'approved' && (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <div>
                            <h3 className="font-semibold text-green-900 dark:text-green-100">Approved!</h3>
                            <p className="text-sm text-green-700 dark:text-green-300">
                              Congratulations! Your organization account has been approved and activated.
                            </p>
                          </div>
                        </>
                      )}
                      {upgradeRequest.status === 'rejected' && (
                        <>
                          <XCircle className="w-5 h-5 text-red-600" />
                          <div>
                            <h3 className="font-semibold text-red-900 dark:text-red-100">Request Declined</h3>
                            <p className="text-sm text-red-700 dark:text-red-300">
                              {upgradeRequest.admin_notes || 'Your request was declined. Please contact support for more information.'}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-1 sm:space-y-2">
                        <Label className="text-sm sm:text-base">Organization Name</Label>
                        <p className="text-xs sm:text-sm text-gray-900 dark:text-gray-100">{upgradeRequest.organization_name}</p>
                      </div>
                      <div className="space-y-1 sm:space-y-2">
                        <Label className="text-sm sm:text-base">Industry</Label>
                        <p className="text-xs sm:text-sm text-gray-900 dark:text-gray-100">{upgradeRequest.industry}</p>
                      </div>
                      <div className="space-y-1 sm:space-y-2">
                        <Label className="text-sm sm:text-base">Request Type</Label>
                        <p className="text-xs sm:text-sm text-gray-900 dark:text-gray-100 capitalize">{upgradeRequest.request_type}</p>
                      </div>
                      <div className="space-y-1 sm:space-y-2">
                        <Label className="text-sm sm:text-base">Submitted</Label>
                        <p className="text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                          {new Date(upgradeRequest.submitted_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 sm:space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="request_type" className="text-sm sm:text-base">Account Type</Label>
                        <Select
                          value={organizationData.request_type}
                          onValueChange={(value) => setOrganizationData({ ...organizationData, request_type: value })}
                        >
                          <SelectTrigger className="h-10 sm:h-auto">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="organization">Non-Profit Organization</SelectItem>
                            <SelectItem value="business">Business/Company</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="organization_name" className="text-sm sm:text-base">Organization Name *</Label>
                        <Input
                          id="organization_name"
                          value={organizationData.organization_name}
                          onChange={(e) => setOrganizationData({ ...organizationData, organization_name: e.target.value })}
                          placeholder="Enter your organization name"
                          className="h-10 sm:h-auto"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="organization_type" className="text-sm sm:text-base">Organization Type</Label>
                        <Input
                          id="organization_type"
                          value={organizationData.organization_type}
                          onChange={(e) => setOrganizationData({ ...organizationData, organization_type: e.target.value })}
                          placeholder="e.g., Non-Profit, LLC, Corporation"
                          className="h-10 sm:h-auto"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="industry" className="text-sm sm:text-base">Industry *</Label>
                        <Select
                          value={organizationData.industry}
                          onValueChange={(value) => setOrganizationData({ ...organizationData, industry: value })}
                        >
                          <SelectTrigger className="h-10 sm:h-auto">
                            <SelectValue placeholder="Select industry" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Environmental Conservation">Environmental Conservation</SelectItem>
                            <SelectItem value="Renewable Energy">Renewable Energy</SelectItem>
                            <SelectItem value="Sustainable Agriculture">Sustainable Agriculture</SelectItem>
                            <SelectItem value="Green Technology">Green Technology</SelectItem>
                            <SelectItem value="Waste Management">Waste Management</SelectItem>
                            <SelectItem value="Water Conservation">Water Conservation</SelectItem>
                            <SelectItem value="Climate Action">Climate Action</SelectItem>
                            <SelectItem value="Sustainable Fashion">Sustainable Fashion</SelectItem>
                            <SelectItem value="Eco-Tourism">Eco-Tourism</SelectItem>
                            <SelectItem value="Green Building">Green Building</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="business_registration_number">Business Registration Number</Label>
                        <Input
                          id="business_registration_number"
                          value={organizationData.business_registration_number}
                          onChange={(e) => setOrganizationData({ ...organizationData, business_registration_number: e.target.value })}
                          placeholder="Enter registration number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tax_id">Tax ID/EIN</Label>
                        <Input
                          id="tax_id"
                          value={organizationData.tax_id}
                          onChange={(e) => setOrganizationData({ ...organizationData, tax_id: e.target.value })}
                          placeholder="Enter tax identification number"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="company_size">Company Size</Label>
                        <Select
                          value={organizationData.company_size}
                          onValueChange={(value) => setOrganizationData({ ...organizationData, company_size: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select company size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1-10">1-10 employees</SelectItem>
                            <SelectItem value="11-50">11-50 employees</SelectItem>
                            <SelectItem value="51-200">51-200 employees</SelectItem>
                            <SelectItem value="201-500">201-500 employees</SelectItem>
                            <SelectItem value="501-1000">501-1000 employees</SelectItem>
                            <SelectItem value="1000+">1000+ employees</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="founded_year">Founded Year</Label>
                        <Input
                          id="founded_year"
                          type="number"
                          min="1800"
                          max={new Date().getFullYear()}
                          value={organizationData.founded_year}
                          onChange={(e) => setOrganizationData({ ...organizationData, founded_year: parseInt(e.target.value) })}
                          placeholder="Enter founding year"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="headquarters_address">Headquarters Address *</Label>
                      <Textarea
                        id="headquarters_address"
                        value={organizationData.headquarters_address}
                        onChange={(e) => setOrganizationData({ ...organizationData, headquarters_address: e.target.value })}
                        placeholder="Enter your organization's headquarters address"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="contact_phone">Contact Phone *</Label>
                        <Input
                          id="contact_phone"
                          value={organizationData.contact_phone}
                          onChange={(e) => setOrganizationData({ ...organizationData, contact_phone: e.target.value })}
                          placeholder="Enter contact phone number"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contact_email">Contact Email *</Label>
                        <Input
                          id="contact_email"
                          type="email"
                          value={organizationData.contact_email}
                          onChange={(e) => setOrganizationData({ ...organizationData, contact_email: e.target.value })}
                          placeholder="Enter contact email address"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="organization_description">Organization Description *</Label>
                      <Textarea
                        id="organization_description"
                        value={organizationData.organization_description}
                        onChange={(e) => setOrganizationData({ ...organizationData, organization_description: e.target.value })}
                        placeholder="Describe your organization, its mission, and activities..."
                        className="min-h-[100px]"
                        required
                      />
                      <p className="text-sm text-gray-500">{organizationData.organization_description.length}/500 characters</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sustainability_goals">Sustainability Goals</Label>
                      <Textarea
                        id="sustainability_goals"
                        value={organizationData.sustainability_goals}
                        onChange={(e) => setOrganizationData({ ...organizationData, sustainability_goals: e.target.value })}
                        placeholder="Describe your organization's sustainability goals and initiatives..."
                        className="min-h-[80px]"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="website_url">Website URL</Label>
                        <Input
                          id="website_url"
                          type="url"
                          value={organizationData.website_url}
                          onChange={(e) => setOrganizationData({ ...organizationData, website_url: e.target.value })}
                          placeholder="https://yourorganization.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                        <Input
                          id="linkedin_url"
                          type="url"
                          value={organizationData.linkedin_url}
                          onChange={(e) => setOrganizationData({ ...organizationData, linkedin_url: e.target.value })}
                          placeholder="https://linkedin.com/company/yourorg"
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">Organization Benefits</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-start space-x-3">
                          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">Verified Badge</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Display a verified organization badge on your profile</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3">
                          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">Marketplace Access</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">List and sell sustainable products in our marketplace</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3">
                          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">Enhanced Profile</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Centered profile layout with organization details</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3">
                          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">Business Tools</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Access to organization-specific features and analytics</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button 
                        onClick={handleSubmitUpgrade} 
                        className="sustainability-gradient"
                        disabled={submittingUpgrade || !organizationData.organization_name || !organizationData.industry || !organizationData.headquarters_address || !organizationData.contact_phone || !organizationData.contact_email || !organizationData.organization_description}
                      >
                        {submittingUpgrade ? (
                          <>
                            <Clock className="w-4 h-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4 mr-2" />
                            Submit Upgrade Request
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Privacy Settings */}
          <TabsContent value="privacy" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="pb-4 sm:pb-6">
                <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                  <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Privacy & Visibility</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-0 rounded-lg sm:rounded-none bg-gray-50 sm:bg-transparent dark:bg-gray-800 sm:dark:bg-transparent">
                    <div className="space-y-1">
                      <Label className="text-sm sm:text-base">Profile Visibility</Label>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Control who can see your profile</p>
                    </div>
                    <Select
                      value={privacySettings.profile_visibility}
                      onValueChange={(value) => setPrivacySettings({ ...privacySettings, profile_visibility: value })}
                    >
                      <SelectTrigger className="w-full sm:w-32 h-10 sm:h-auto">
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
                            <User className="w-4 h-4 mr-2" />
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

                  <Separator />

                  <div className="space-y-3 sm:space-y-4">
                    {[
                      {
                        key: "show_email",
                        label: "Show Email Address",
                        description: "Display your email on your public profile",
                      },
                      {
                        key: "show_location",
                        label: "Show Location",
                        description: "Display your location on your profile",
                      },
                      {
                        key: "allow_messages",
                        label: "Allow Direct Messages",
                        description: "Let other users send you direct messages",
                      },
                      {
                        key: "allow_mentions",
                        label: "Allow Mentions",
                        description: "Let other users mention you in posts",
                      },
                      {
                        key: "show_activity",
                        label: "Show Activity Status",
                        description: "Show when you're online or recently active",
                      },
                    ].map((setting) => (
                      <div key={setting.key} className="flex items-start sm:items-center justify-between gap-3 p-3 sm:p-0 rounded-lg sm:rounded-none bg-gray-50 sm:bg-transparent dark:bg-gray-800 sm:dark:bg-transparent">
                        <div className="space-y-1 flex-1 min-w-0">
                          <Label className="text-sm sm:text-base">{setting.label}</Label>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">{setting.description}</p>
                        </div>
                        <Switch
                          checked={privacySettings[setting.key as keyof typeof privacySettings] as boolean}
                          onCheckedChange={(checked) =>
                            setPrivacySettings({ ...privacySettings, [setting.key]: checked })
                          }
                          className="shrink-0"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleSavePrivacy} className="sustainability-gradient w-full sm:w-auto h-10 sm:h-auto">
                    <Save className="w-4 h-4 mr-2" />
                    Save Privacy Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="pb-4 sm:pb-6">
                <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Notification Preferences</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-start sm:items-center justify-between gap-3 p-3 sm:p-0 rounded-lg sm:rounded-none bg-gray-50 sm:bg-transparent dark:bg-gray-800 sm:dark:bg-transparent">
                    <div className="space-y-1 flex-1 min-w-0">
                      <Label className="text-sm sm:text-base">Email Notifications</Label>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Receive notifications via email</p>
                    </div>
                    <Switch
                      checked={notificationSettings.email_notifications}
                      onCheckedChange={(checked) =>
                        setNotificationSettings({ ...notificationSettings, email_notifications: checked })
                      }
                      className="shrink-0"
                    />
                  </div>

                  <div className="flex items-start sm:items-center justify-between gap-3 p-3 sm:p-0 rounded-lg sm:rounded-none bg-gray-50 sm:bg-transparent dark:bg-gray-800 sm:dark:bg-transparent">
                    <div className="space-y-1 flex-1 min-w-0">
                      <Label className="text-sm sm:text-base">Push Notifications</Label>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        Receive push notifications in your browser
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.push_notifications}
                      onCheckedChange={(checked) =>
                        setNotificationSettings({ ...notificationSettings, push_notifications: checked })
                      }
                      className="shrink-0"
                    />
                  </div>

                  <Separator />

                  <div className="space-y-3 sm:space-y-4">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">Activity Notifications</h3>
                    {[
                      { key: "likes", label: "Likes", description: "When someone likes your posts" },
                      { key: "comments", label: "Comments", description: "When someone comments on your posts" },
                      { key: "follows", label: "New Followers", description: "When someone follows you" },
                      { key: "mentions", label: "Mentions", description: "When someone mentions you" },
                      { key: "reposts", label: "Reposts", description: "When someone reposts your content" },
                    ].map((setting) => (
                      <div key={setting.key} className="flex items-start sm:items-center justify-between gap-3 p-3 sm:p-0 rounded-lg sm:rounded-none bg-gray-50 sm:bg-transparent dark:bg-gray-800 sm:dark:bg-transparent">
                        <div className="space-y-1 flex-1 min-w-0">
                          <Label className="text-sm sm:text-base">{setting.label}</Label>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{setting.description}</p>
                        </div>
                        <Switch
                          checked={notificationSettings[setting.key as keyof typeof notificationSettings] as boolean}
                          onCheckedChange={(checked) =>
                            setNotificationSettings({ ...notificationSettings, [setting.key]: checked })
                          }
                          className="shrink-0"
                        />
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-3 sm:space-y-4">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">Sustainability Updates</h3>
                    {[
                      {
                        key: "sustainability_updates",
                        label: "Sustainability News",
                        description: "Latest news and updates about sustainability",
                      },
                      {
                        key: "weekly_digest",
                        label: "Weekly Digest",
                        description: "Weekly summary of sustainability content",
                      },
                      {
                        key: "community_events",
                        label: "Community Events",
                        description: "Notifications about local sustainability events",
                      },
                    ].map((setting) => (
                      <div key={setting.key} className="flex items-start sm:items-center justify-between gap-3 p-3 sm:p-0 rounded-lg sm:rounded-none bg-gray-50 sm:bg-transparent dark:bg-gray-800 sm:dark:bg-transparent">
                        <div className="space-y-1 flex-1 min-w-0">
                          <Label className="text-sm sm:text-base">{setting.label}</Label>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{setting.description}</p>
                        </div>
                        <Switch
                          checked={notificationSettings[setting.key as keyof typeof notificationSettings] as boolean}
                          onCheckedChange={(checked) =>
                            setNotificationSettings({ ...notificationSettings, [setting.key]: checked })
                          }
                          className="shrink-0"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveNotifications} className="sustainability-gradient w-full sm:w-auto h-10 sm:h-9 text-sm sm:text-base">
                    <Save className="w-4 h-4 mr-2" />
                    Save Notification Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data & Export */}
          <TabsContent value="data" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="pb-4 sm:pb-6">
                <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Data Management</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
                <div className="space-y-4 sm:space-y-6">
                  <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 text-sm sm:text-base">Export Your Data</h3>
                    <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 mb-3 sm:mb-4">
                      Download a copy of all your data including posts, comments, likes, and profile information.
                    </p>
                    <Button onClick={handleExportData} variant="outline" className="border-blue-300 text-blue-700 w-full sm:w-auto h-10 sm:h-9">
                      <Download className="w-4 h-4 mr-2" />
                      Request Data Export
                    </Button>
                  </div>

                  <Separator />

                  <div className="p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="flex items-start space-x-2 sm:space-x-3">
                      <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2 text-sm sm:text-base">Delete Account</h3>
                        <p className="text-xs sm:text-sm text-red-800 dark:text-red-200 mb-3 sm:mb-4">
                          Permanently delete your account and all associated data. This action cannot be undone.
                        </p>
                        <Button onClick={handleDeleteAccount} variant="destructive" className="w-full sm:w-auto h-10 sm:h-9">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Account
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Delete Account Modals */}
                  <DeleteAccountModal
                    isOpen={showDeleteModal}
                    onClose={() => setShowDeleteModal(false)}
                    onConfirm={() => {
                      setShowDeleteModal(false)
                      setShowConfirmDeleteModal(true)
                    }}
                  />

                  <ConfirmDeleteModal
                    isOpen={showConfirmDeleteModal}
                    onClose={() => {
                      setShowConfirmDeleteModal(false)
                      setDeleteConfirmText("")
                    }}
                    confirmText={deleteConfirmText}
                    onConfirmTextChange={setDeleteConfirmText}
                    onConfirm={async () => {
                      try {
                        await new Promise((resolve) => setTimeout(resolve, 2000))
                        toast({
                          title: "Account deletion initiated",
                          description: "You will receive a confirmation email with your data export within 24 hours.",
                        })
                        setShowConfirmDeleteModal(false)
                        setDeleteConfirmText("")
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: "Failed to delete account. Please try again.",
                          variant: "destructive",
                        })
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4 sm:pb-6">
                <CardTitle className="text-lg sm:text-xl">Account Statistics</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <div className="text-center p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.posts}</div>
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Posts</div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.followers}</div>
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Followers</div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.following}</div>
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Following</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}
