"use client"

import { useState, useEffect } from "react"
import { useSession } from "@supabase/auth-helpers-react"
import { useRouter } from "next/navigation"
import MainLayout from "@/components/main-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Leaf, TrendingUp, History, Info } from "lucide-react"
import { GREEN_ELIGIBLE_CATEGORIES } from "@/lib/categories"

type Transaction = {
  id: string
  transaction_type: string
  points: number
  balance_after: number
  source: string
  reference_id: string | null
  reference_type: string | null
  description: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

function formatSource(source: string): string {
  const labels: Record<string, string> = {
    green_post_create: "Green post",
    green_post_like: "Like on your post",
    green_post_comment: "Comment on your post",
    green_post_share: "Share of your post",
  }
  return labels[source] || source.replace(/_/g, " ")
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

export default function PointsPage() {
  const session = useSession()
  const router = useRouter()
  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user) {
      router.push("/auth/login")
      return
    }

    const fetchPoints = async () => {
      try {
        const res = await fetch("/api/green-points?include_history=true&limit=50")
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || "Failed to load points")
        }
        const data = await res.json()
        setBalance(data.balance ?? 0)
        setTransactions(data.transactions ?? [])
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong")
      } finally {
        setLoading(false)
      }
    }

    fetchPoints()
  }, [session?.user, router])

  if (!session?.user) return null

  return (
    <MainLayout>
      <div className="container max-w-2xl mx-auto py-6 px-4">
        <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2">
          <Leaf className="h-7 w-7 text-emerald-600" />
          Green Points
        </h1>
        <p className="text-muted-foreground mb-6">
          Earn points by posting eco-friendly content and getting engagement. Use categories like &quot;Environment & Sustainability&quot; or &quot;Community & Volunteering&quot; to qualify.
        </p>

        {loading && (
          <div className="animate-pulse space-y-4">
            <div className="h-28 rounded-lg bg-muted" />
            <div className="h-64 rounded-lg bg-muted" />
          </div>
        )}

        {error && (
          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && (
          <>
            <Card className="mb-6 border-emerald-500/30 bg-emerald-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  Your balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                  {balance ?? 0} <span className="text-lg font-normal text-muted-foreground">points</span>
                </p>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  How to earn
                </CardTitle>
                <CardDescription>
                  Posts in these categories earn points:{" "}
                  {GREEN_ELIGIBLE_CATEGORIES.join(", ")}. Base points for each green post, plus more for likes, comments, and shares. Photos/videos earn a higher multiplier.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Recent activity
                </CardTitle>
                <CardDescription>Points earned or spent</CardDescription>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4">No transactions yet. Create a green post to start earning.</p>
                ) : (
                  <ul className="space-y-3">
                    {transactions.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between py-2 border-b border-border/60 last:border-0"
                      >
                        <div>
                          <p className="font-medium text-sm">{formatSource(t.source)}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(t.created_at)}</p>
                        </div>
                        <Badge variant={t.points > 0 ? "default" : "secondary"} className={t.points > 0 ? "bg-emerald-600" : ""}>
                          {t.points > 0 ? "+" : ""}{t.points}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  )
}
