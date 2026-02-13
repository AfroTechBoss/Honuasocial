"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useSession } from "@supabase/auth-helpers-react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useTheme } from "next-themes"
import {
  Home,
  Compass,
  Bookmark,
  Bell,
  MessageCircle,
  Users,
  CheckSquare,
  Settings,
  User,
  LogOut,
  Menu,
  Sun,
  Moon,
  Shield,
} from "lucide-react"
import Link from "next/link"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import Image from "next/image"
import SearchModal from "@/components/search-modal"

interface MainLayoutProps {
  children: React.ReactNode
}

// Move navigationItems inside component to access state
// const navigationItems will be defined inside the component

export default function MainLayout({ children }: MainLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const session = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const supabase = createClientComponentClient()

  // Define navigation items with dynamic badges
  const navigationItems = [
    { icon: Home, label: "Home", href: "/", badge: null },
    { icon: Compass, label: "Explore", href: "/explore", badge: null },
    { icon: Bookmark, label: "Bookmarks", href: "/bookmarks", badge: null },
    { icon: Bell, label: "Notifications", href: "/notifications", badge: unreadNotifications > 0 ? unreadNotifications : null },
    { icon: MessageCircle, label: "Messages", href: "/messages", badge: unreadMessages > 0 ? unreadMessages : null },
    { icon: Users, label: "Forum", href: "/forum", badge: null },
    { icon: CheckSquare, label: "Tasks", href: "/tasks", badge: null },
    { icon: User, label: "Profile", href: "/profile", badge: null },
    { icon: Settings, label: "Settings", href: "/settings", badge: null },
  ]

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch profile data
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

  // Fetch unread notifications count with improved error handling
  const fetchUnreadNotifications = async (retryCount = 0) => {
    if (!session?.user?.id) return
    
    const maxRetries = 3
    const retryDelay = 1000 * Math.pow(2, retryCount) // Exponential backoff
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      const response = await fetch(`/api/notifications?recipient_id=${session.user.id}&read=false&count_only=true`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const data = await response.json()
        setUnreadNotifications(data.count || 0)
      } else if (response.status === 401) {
        // Authentication error - redirect to login
        console.warn('Authentication failed, redirecting to login')
        await supabase.auth.signOut()
        router.push('/auth/login')
      } else if (response.status >= 500 && retryCount < maxRetries) {
        // Server error - retry with exponential backoff
        console.warn(`Server error (${response.status}), retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries + 1})`)
        setTimeout(() => fetchUnreadNotifications(retryCount + 1), retryDelay)
      } else {
        console.error('Failed to fetch unread notifications:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url
        })
        // Set to 0 to prevent showing stale data
        setUnreadNotifications(0)
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.warn('Notification fetch request timed out')
        } else if (error.message.includes('fetch')) {
          // Network error - retry if we haven't exceeded max retries
          if (retryCount < maxRetries) {
            console.warn(`Network error fetching notifications, retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries + 1})`)
            setTimeout(() => fetchUnreadNotifications(retryCount + 1), retryDelay)
          } else {
            console.error('Max retries exceeded for notification fetch:', error.message)
            setUnreadNotifications(0)
          }
        } else {
          console.error('Unexpected error fetching notifications:', error.message)
          setUnreadNotifications(0)
        }
      } else {
        console.error('Unknown error fetching notifications:', error)
        setUnreadNotifications(0)
      }
    }
  }

  // Fetch unread messages count with improved error handling
  const fetchUnreadMessages = async (retryCount = 0) => {
    if (!session?.user?.id) return
    
    const maxRetries = 3
    const retryDelay = 1000 * Math.pow(2, retryCount) // Exponential backoff
    
    try {
      // Get conversations where user is a participant
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id, updated_at')
        .or(`participant_one_id.eq.${session.user.id},participant_two_id.eq.${session.user.id}`)
      
      if (convError) {
        if (convError.code === 'PGRST116' && retryCount < maxRetries) {
          // Table doesn't exist or permission denied - retry
          console.warn(`Error fetching conversations (${convError.code}), retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries + 1})`)
          setTimeout(() => fetchUnreadMessages(retryCount + 1), retryDelay)
          return
        } else {
          console.error('Error fetching conversations:', convError)
          setUnreadMessages(0)
          return
        }
      }
      
      if (conversations) {
        // For now, just count conversations that have been updated recently
        // In a real app, you'd track last_read_at per user per conversation
        const recentConversations = conversations.filter(conv => {
          const updatedAt = new Date(conv.updated_at)
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
          return updatedAt > oneHourAgo
        })
        
        setUnreadMessages(recentConversations.length)
      } else {
        setUnreadMessages(0)
      }
    } catch (error) {
      if (retryCount < maxRetries) {
        console.warn(`Unexpected error fetching messages, retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries + 1})`, error)
        setTimeout(() => fetchUnreadMessages(retryCount + 1), retryDelay)
      } else {
        console.error('Max retries exceeded for message fetch:', error)
        setUnreadMessages(0)
      }
    }
  }

  // Set up real-time subscriptions for notifications and messages
  useEffect(() => {
    if (session?.user?.id) {
      fetchUnreadNotifications()
      fetchUnreadMessages()

      // Subscribe to notifications changes
      const notificationsChannel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${session.user.id}`
          },
          () => {
            fetchUnreadNotifications()
          }
        )
        .subscribe()

      // Subscribe to messages changes
      const messagesChannel = supabase
        .channel('messages')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages'
          },
          () => {
            fetchUnreadMessages()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(notificationsChannel)
        supabase.removeChannel(messagesChannel)
      }
    }
  }, [session?.user?.id])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input field
      const target = e.target as HTMLElement
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true'
      
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !isInputField) {
        e.preventDefault()
        setIsSearchModalOpen(true)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])




  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 flex items-center justify-center">
            <Image src="/images/honua-logo.svg" alt="Honua Logo" width={40} height={40} className="w-full h-full" />
          </div>
          <span className="text-xl font-bold text-green-700 dark:text-green-300">Honua</span>
        </Link>
      </div>

      <nav className="flex-1 px-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                  {item.badge && (
                    <Badge variant="secondary" className="ml-auto">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              </li>
            )
          })}
          
        </ul>
      </nav>

      <div className="p-4 border-t">
        <div className="flex items-center space-x-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
          <Avatar className="w-10 h-10">
            <AvatarImage src={profile?.avatar_url || "/placeholder-user.jpg"} />
            <AvatarFallback className="bg-green-500 text-white">
              {profile?.full_name?.charAt(0) || session?.user?.user_metadata?.full_name?.charAt(0) || "S"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {profile?.full_name || session?.user?.user_metadata?.full_name || "User"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              @{profile?.username || session?.user?.user_metadata?.username || "username"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900">
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <SidebarContent />
            </SheetContent>
          </Sheet>

          <Link href="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 flex items-center justify-center">
              <Image src="/images/honua-logo.svg" alt="Honua Logo" width={32} height={32} className="w-full h-full" />
            </div>
            <span className="text-xl font-bold text-green-700 dark:text-green-300">Honua</span>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={profile?.avatar_url || "/placeholder-user.jpg"} />
                  <AvatarFallback className="bg-green-500 text-white text-xs">
                    {profile?.full_name?.charAt(0) || session?.user?.user_metadata?.full_name?.charAt(0) || "S"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {mounted && theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                Toggle theme
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:pl-64 h-full flex flex-col">
        {/* Desktop Header */}
        <div className="hidden lg:flex items-center justify-end p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            
            
            <Button variant="ghost" size="sm" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {mounted && theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={profile?.avatar_url || "/placeholder-user.jpg"} />
                    <AvatarFallback className="bg-green-500 text-white text-xs">
                      {profile?.full_name?.charAt(0) || session?.user?.user_metadata?.full_name?.charAt(0) || "S"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{profile?.full_name || session?.user?.user_metadata?.full_name || "User"}</p>
                    <p className="text-xs text-muted-foreground">@{profile?.username || session?.user?.user_metadata?.username || "username"}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                {session?.user?.user_metadata?.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <Shield className="mr-2 h-4 w-4" />
                      Admin Panel
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 h-full overflow-auto">
          <div className="sticky top-0 z-40 bg-secondary text-secondary-foreground">
            <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center bg-white rounded-md">
              <a href="https://www.f6s.com/honua.green" target="_blank" rel="noopener noreferrer" aria-label="Honua on F6S">
                <Image
                  src="/images/F6S_Top_Company_Climate Tech_13.png"
                  alt="F6S Top Company Climate Tech"
                  width={160}
                  height={48}
                  className="h-10 sm:h-12 w-auto"
                />
              </a>
            </div>
          </div>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-around py-2">
          {navigationItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center sm:space-y-1 p-2 rounded-lg transition-colors ${
                  isActive ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-400"
                }`}
              >
                <div className="relative">
                  <item.icon className="w-5 h-5" />
                  {item.badge && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-2 -right-2 w-4 h-4 p-0 flex items-center justify-center text-xs"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </div>
                <span className="text-xs font-medium hidden sm:block">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Search Modal */}
      <SearchModal 
        isOpen={isSearchModalOpen} 
        onClose={() => setIsSearchModalOpen(false)} 
      />
      
      {/* Invite Modal */}
      
    </div>
  )
}
