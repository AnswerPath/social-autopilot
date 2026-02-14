"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"

export function GeneralSettings() {
  const [showTooltips, setShowTooltips] = useState(true)
  const [tooltipsLoading, setTooltipsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/onboarding')
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => {
        if (typeof d.showContextualTooltips === 'boolean') setShowTooltips(d.showContextualTooltips)
      })
      .finally(() => setTooltipsLoading(false))
  }, [])

  const onTooltipsChange = (checked: boolean) => {
    setShowTooltips(checked)
    fetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showContextualTooltips: checked }),
    }).catch(() => {})
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Help &amp; Tutorial</CardTitle>
          <CardDescription>Control contextual help and tooltips</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Show contextual tooltips</Label>
              <p className="text-sm text-gray-600">Show short tooltips on sidebar and key buttons when you hover</p>
            </div>
            <Switch
              checked={showTooltips}
              onCheckedChange={onTooltipsChange}
              disabled={tooltipsLoading}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>Manage your account information and preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" placeholder="Enter your first name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" placeholder="Enter your last name" />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" placeholder="Enter your email" />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select your timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utc">UTC</SelectItem>
                <SelectItem value="est">Eastern Time</SelectItem>
                <SelectItem value="pst">Pacific Time</SelectItem>
                <SelectItem value="cst">Central Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Posting Preferences</CardTitle>
          <CardDescription>Configure default settings for your posts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Auto-save drafts</Label>
              <p className="text-sm text-gray-600">Automatically save posts as drafts while typing</p>
            </div>
            <Switch defaultChecked />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Smart scheduling</Label>
              <p className="text-sm text-gray-600">Suggest optimal posting times based on audience activity</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
