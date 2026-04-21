"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GeneralSettings } from "./general-settings"
import { NotificationSettings } from "./notification-settings"
import { SecuritySettings } from "./security-settings"
import { HybridSettings } from "./hybrid-settings"
import { TokenManagement } from "./token-management"
import { ErrorMonitoring } from "./error-monitoring"
import { ComplianceManagement } from "./compliance-management"
import { Settings, Bell, Shield, User, Bot } from 'lucide-react'
import { useAuth } from "@/hooks/use-auth"

export function SettingsPage() {
  const { user, loading } = useAuth()
  
  // Don't use demo-user fallback - require actual authentication
  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }
  
  if (!user || !user.id) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">Authentication Required</p>
            <p className="text-muted-foreground mt-2">Please log in to access settings.</p>
          </div>
        </div>
      </div>
    )
  }
  
  const userId = user.id

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex animate-fade-up items-center gap-3">
        <Settings className="h-8 w-8 text-muted-foreground" />
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your Social Autopilot preferences and integrations</p>
        </div>
      </div>

      <Tabs defaultValue="integrations" className="animate-fade-up space-y-6 delay-stagger-2">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations">
          <HybridSettings userId={userId} />
        </TabsContent>

        <TabsContent value="general">
          <GeneralSettings />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="security">
          <div className="space-y-6">
            <SecuritySettings />
            <TokenManagement userId={userId} />
            <ErrorMonitoring />
            <ComplianceManagement userId={userId} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
