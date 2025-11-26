"use client"

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface DashboardRow {
  post_id: string
  status: string
  user_id: string
  scheduled_at?: string | null
  submitted_for_approval_at?: string | null
  requires_approval: boolean
  step_name?: string | null
  step_order?: number | null
  assignment_status?: string | null
  open_comments: number
  total_comments: number
  approval_dashboard_metadata?: {
    decision?: string
    actorId?: string
    updatedAt?: string
  }
}

interface ApprovalStatistics {
  user_id: string
  total_posts: number
  draft_count: number
  pending_count: number
  approved_count: number
  rejected_count: number
  published_count: number
  avg_approval_hours: number | null
}

export function ManagerApprovalDashboard() {
  const [rows, setRows] = useState<DashboardRow[]>([])
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [bulkLoading, setBulkLoading] = useState<'approve' | 'reject' | null>(null)
  const [statistics, setStatistics] = useState<ApprovalStatistics | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchAll()
  }, [])

  const stats = useMemo(() => {
    return [
      { label: 'Awaiting Review', value: statistics?.pending_count ?? 0, badge: 'secondary' as const },
      { label: 'Approved', value: statistics?.approved_count ?? 0, badge: 'default' as const },
      { label: 'Rejected', value: statistics?.rejected_count ?? 0, badge: 'destructive' as const }
    ]
  }, [statistics])

  async function fetchAll() {
    await Promise.all([fetchRows(), fetchStatistics()])
  }

  async function fetchRows() {
    setLoading(true)
    try {
      const response = await fetch('/api/approval?type=dashboard')
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load approvals')
      }
      setRows(result.rows || [])
      setSelectedRows({})
    } catch (error) {
      console.error('Failed to fetch approval dashboard', error)
      toast({
        title: 'Approval dashboard error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  async function fetchStatistics() {
    try {
      const response = await fetch('/api/approval?type=statistics')
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load statistics')
      }
      setStatistics(result.statistics || null)
    } catch (error) {
      console.error('Failed to fetch approval statistics', error)
      // Do not toast destructively; keep UI usable even if stats fail
    }
  }

  const selectedIds = Object.entries(selectedRows)
    .filter(([, checked]) => checked)
    .map(([id]) => id)

  async function handleBulk(decision: 'approve' | 'reject') {
    if (!selectedIds.length) {
      toast({
        title: 'Select posts first',
        description: 'Choose at least one post to continue.'
      })
      return
    }

    setBulkLoading(decision)
    try {
      const response = await fetch('/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-approve',
          postIds: selectedIds,
          decision
        })
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Bulk action failed')
      }

      const updatedCount: number =
        typeof result.updatedCount === 'number'
          ? result.updatedCount
          : Array.isArray(result.result?.success)
            ? result.result.success.length
            : 0

      toast({
        title: 'Bulk action complete',
        description: `${updatedCount} posts updated`
      })
      await fetchAll()
    } catch (error) {
      toast({
        title: 'Bulk action failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBulkLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Approval Workflow</h2>
          <p className="text-sm text-muted-foreground">Monitor pending submissions and take action</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchRows} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulk('reject')}
            disabled={bulkLoading !== null || loading}
          >
            {bulkLoading === 'reject' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
            Reject Selected
          </Button>
          <Button
            size="sm"
            onClick={() => handleBulk('approve')}
            disabled={bulkLoading !== null || loading}
          >
            {bulkLoading === 'approve' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Approve Selected
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={stat.badge} className="text-lg px-3 py-1">
                {stat.value}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Items</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              Nothing needs your review right now.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={rows.length > 0 && selectedIds.length === rows.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          const allSelected: Record<string, boolean> = {}
                          rows.forEach((row) => {
                            allSelected[row.post_id] = true
                          })
                          setSelectedRows(allSelected)
                        } else {
                          setSelectedRows({})
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Current Step</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Comments</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.post_id}>
                    <TableCell>
                      <Checkbox
                        checked={!!selectedRows[row.post_id]}
                        onCheckedChange={(checked) =>
                          setSelectedRows((prev) => ({
                            ...prev,
                            [row.post_id]: !!checked
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm font-medium">#{row.post_id.slice(0, 6)}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.step_name || 'Pending routing'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{row.step_name ?? 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">
                          Step {row.step_order ?? '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.submitted_for_approval_at
                        ? formatDistanceToNow(new Date(row.submitted_for_approval_at), { addSuffix: true })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.open_comments > 0 ? 'destructive' : 'outline'}>
                        {row.open_comments} open / {row.total_comments} total
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadge(row.assignment_status)}>
                        {row.assignment_status ?? 'pending'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function statusBadge(status?: string | null) {
  switch (status) {
    case 'approved':
      return 'default'
    case 'rejected':
      return 'destructive'
    case 'changes_requested':
      return 'outline'
    default:
      return 'secondary'
  }
}

