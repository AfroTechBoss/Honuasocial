"use client"

import ComingSoon from '@/components/coming-soon'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function ComingSoonDemo() {
  const router = useRouter()

  return (
    <div className="relative">
      {/* Back Link */}
      <div className="absolute top-4 left-4 z-10">
        <button 
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </button>
      </div>

      {/* Coming Soon Component */}
      <ComingSoon
        title="Tasks Coming Soon"
        description="We're building something incredible for our community. Get ready for an experience that will transform how you get rewarded for your impact."
      />
    </div>
  )
}
