"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TwitterApiSettings } from "./twitter-api-settings"
import { GeneralSettings } from "./general-settings"
import { NotificationSettings } from "./notification-settings"
import { SecuritySettings } from "./security-settings"
import { HybridSettings } from "./hybrid-settings"
import { TokenManagement } from "./token-management"
import { ErrorMonitoring } from "./error-monitoring"
import { Settings, Twitter, Bell, Shield, User, Bot } from 'lucide-react'

export function SettingsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-gray-600" />
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600">Manage your Social Autopilot preferences and integrations</p>
        </div>
      </div>

      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="twitter" className="flex items-center gap-2">
            <Twitter className="h-4 w-4" />
            Twitter API
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
          <HybridSettings userId="demo-user" />
        </TabsContent>

        <TabsContent value="twitter">
          <TwitterApiSettings />
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
            <TokenManagement userId="demo-user" />
            <ErrorMonitoring />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
