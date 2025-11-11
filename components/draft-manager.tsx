"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { 
  FileText, 
  Calendar, 
  Trash2, 
  Edit3, 
  Clock, 
  Cloud,
  Wifi,
  WifiOff,
  MoreHorizontal
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { DraftManager, type Draft } from "@/lib/draft-manager"
import { formatDistanceToNow } from "date-fns"

interface DraftManagerProps {
  onSelectDraft: (draft: Draft) => void
  onClose: () => void
}

export function DraftManagerComponent({ onSelectDraft, onClose }: DraftManagerProps) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [localDrafts, setLocalDrafts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const { toast } = useToast()
  const draftManager = DraftManager.getInstance()

  useEffect(() => {
    const cleanup = checkOnlineStatus()
    loadDrafts(navigator.onLine)
    draftManager.cleanupOldLocalDrafts()

    return cleanup
  }, [])

  useEffect(() => {
    loadDrafts(isOnline)
  }, [isOnline])

  const checkOnlineStatus = () => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }

  const loadDrafts = async (online: boolean) => {
    try {
      setLoading(true)
      
      // Load server drafts if online
      if (online) {
        const { drafts: serverDrafts } = await draftManager.getDrafts()
        setDrafts(serverDrafts)
      } else {
        setDrafts([])
      }
      
      // Always load local drafts
      const localDraftsData = draftManager.getAllLocalDrafts()
      setLocalDrafts(localDraftsData)
    } catch (error) {
      console.error('Failed to load drafts:', error)
      toast({
        title: "Error",
        description: "Failed to load drafts",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteDraft = async (draftId: string) => {
    try {
      await draftManager.deleteDraft(draftId)
      setDrafts(drafts.filter(d => d.id !== draftId))
      setOpenMenuId(null)
      toast({
        title: "Success",
        description: "Draft deleted successfully",
      })
    } catch (error) {
      console.error('Failed to delete draft:', error)
      toast({
        title: "Error",
        description: "Failed to delete draft",
        variant: "destructive",
      })
    }
  }

  const handleDeleteLocalDraft = (key: string) => {
    draftManager.removeFromLocalStorage(key)
    setLocalDrafts(localDrafts.filter(d => d.key !== key))
    setOpenMenuId(null)
    toast({
      title: "Success",
      description: "Local draft deleted successfully",
    })
  }

  const handleSelectDraft = (draft: Draft) => {
    setOpenMenuId(null)
    onSelectDraft(draft)
    onClose()
  }

  const handleSelectLocalDraft = (localDraft: any) => {
    // Convert local draft to server draft format
    const draft: Draft = {
      id: `local_${localDraft.key}`,
      content: localDraft.data.content || '',
      media_urls: localDraft.data.uploadedMediaIds || null,
      created_at: new Date(localDraft.timestamp).toISOString(),
      updated_at: new Date(localDraft.timestamp).toISOString(),
      auto_saved: true,
      user_id: 'local'
    }
    onSelectDraft(draft)
    onClose()
  }

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch {
      return 'Unknown'
    }
  }

  const truncateContent = (content: string, maxLength = 100) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading drafts...</p>
            {!isOnline && (
              <p className="text-gray-500 mt-2">Offline</p>
            )}
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Saved Drafts</h2>
              <Badge variant="outline" className="ml-2">
                {drafts.length + localDrafts.length} total
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Badge variant="default" className="flex items-center gap-1">
                  <Wifi className="h-3 w-3" />
                  Online
                </Badge>
              ) : (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <WifiOff className="h-3 w-3" />
                  Offline
                </Badge>
              )}
            </div>
          </div>

          {/* Server Drafts */}
          {isOnline && drafts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4" />
                <h3 className="font-medium">Cloud Drafts</h3>
                <Badge variant="outline">{drafts.length}</Badge>
              </div>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {drafts.map((draft) => (
                    <Card
                      key={draft.id}
                      className="p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleSelectDraft(draft)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-gray-500" />
                            {draft.auto_saved && (
                              <Badge variant="secondary" className="text-xs">
                                Auto-saved
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-900 mb-2">
                            {truncateContent(draft.content)}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(draft.updated_at)}
                            </div>
                            {draft.media_urls && draft.media_urls.length > 0 && (
                              <div className="flex items-center gap-1">
                                <span>{draft.media_urls.length} media</span>
                              </div>
                            )}
                          </div>
                        </div>
                    <DropdownMenu
                      open={openMenuId === `server-${draft.id}`}
                      onOpenChange={(open) =>
                        setOpenMenuId(open ? `server-${draft.id}` : null)
                      }
                    >
                          <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="More options"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setOpenMenuId(prev =>
                              prev === `server-${draft.id}` ? null : `server-${draft.id}`
                            )
                          }}
                        >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleSelectDraft(draft)}>
                              <Edit3 className="h-4 w-4 mr-2" />
                              Continue Editing
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteDraft(draft.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Local Drafts */}
          {localDrafts.length > 0 && (
            <div className="space-y-3">
              {isOnline && drafts.length > 0 && <Separator />}
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <h3 className="font-medium">Local Drafts</h3>
                <Badge variant="outline">{localDrafts.length}</Badge>
                {!isOnline && (
                  <Badge variant="secondary">Offline Only</Badge>
                )}
              </div>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {localDrafts.map((localDraft) => (
                    <Card
                      key={localDraft.key}
                      className="p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleSelectLocalDraft(localDraft)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <Badge variant="secondary" className="text-xs">
                              Local
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-900 mb-2">
                            {truncateContent(localDraft.data.content || '')}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(new Date(localDraft.timestamp).toISOString())}
                            </div>
                            {localDraft.data.uploadedMediaIds && localDraft.data.uploadedMediaIds.length > 0 && (
                              <div className="flex items-center gap-1">
                                <span>{localDraft.data.uploadedMediaIds.length} media</span>
                              </div>
                            )}
                          </div>
                        </div>
                    <DropdownMenu
                      open={openMenuId === `local-${localDraft.key}`}
                      onOpenChange={(open) =>
                        setOpenMenuId(open ? `local-${localDraft.key}` : null)
                      }
                    >
                          <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="More options"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setOpenMenuId(prev =>
                              prev === `local-${localDraft.key}` ? null : `local-${localDraft.key}`
                            )
                          }}
                        >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleSelectLocalDraft(localDraft)}>
                              <Edit3 className="h-4 w-4 mr-2" />
                              Continue Editing
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteLocalDraft(localDraft.key)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Empty State */}
          {drafts.length === 0 && localDrafts.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No drafts found</h3>
              <p className="text-gray-600">
                Start writing a post to create your first draft. Drafts will be automatically saved as you type.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
