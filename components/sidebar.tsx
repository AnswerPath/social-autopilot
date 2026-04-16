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
              variant={activeTab === item.id ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start border-l-2 transition-all duration-base ease-out",
                activeTab === item.id
                  ? "border-primary bg-sidebar-accent text-sidebar-accent-foreground shadow-xs"
                  : "border-transparent hover:bg-sidebar-accent/70"
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
    <div className="flex w-64 flex-col border-r border-sidebar-border bg-sidebar/95 shadow-sm-soft backdrop-blur-sm">
      <div className="border-b border-sidebar-border p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm-soft">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-heading text-xl font-bold text-sidebar-foreground">Social Autopilot</span>
        </div>
      </div>
      {navContent}
    </div>
  )
}
