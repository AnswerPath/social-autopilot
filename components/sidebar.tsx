"use client"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { BarChart3, Calendar, Home, MessageSquare, Settings, Users, Zap, ShieldCheck } from 'lucide-react'

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  showTooltips?: boolean
}

const SIDEBAR_TOOLTIPS: Record<string, string> = {
  dashboard: 'Overview and quick actions',
  calendar: 'Schedule and manage posts',
  approvals: 'Review and approve posts',
  analytics: 'View performance metrics',
  engagement: 'Auto-replies and mentions',
  team: 'Team members and permissions',
  settings: 'Integrations and preferences',
}

export function Sidebar({ activeTab, onTabChange, showTooltips = true }: SidebarProps) {
  const navigation = [
    { id: "dashboard", name: "Dashboard", icon: Home },
    { id: "calendar", name: "Calendar", icon: Calendar },
    { id: "approvals", name: "Approvals", icon: ShieldCheck },
    { id: "analytics", name: "Analytics", icon: BarChart3 },
    { id: "engagement", name: "Engagement", icon: MessageSquare },
    { id: "team", name: "Team", icon: Users },
    { id: "settings", name: "Settings", icon: Settings },
  ]

  const navContent = (
    <nav className="flex-1 p-4">
      <div className="space-y-2">
        {navigation.map((item) => {
          const btn = (
            <Button
              key={item.id}
              data-tour={item.id}
              variant={activeTab === item.id ? "default" : "ghost"}
              className={cn(
                "w-full justify-start",
                activeTab === item.id && "bg-blue-600 text-white hover:bg-blue-700"
              )}
              onClick={() => onTabChange(item.id)}
            >
              <item.icon className="h-4 w-4 mr-3" />
              {item.name}
            </Button>
          )
          const tip = SIDEBAR_TOOLTIPS[item.id]
          if (showTooltips && tip) {
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>{btn}</TooltipTrigger>
                <TooltipContent side="right">{tip}</TooltipContent>
              </Tooltip>
            )
          }
          return btn
        })}
      </div>
    </nav>
  )

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">Social Autopilot</span>
        </div>
      </div>
      {navContent}
    </div>
  )
}
