"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Twitter, CheckCircle, AlertCircle } from 'lucide-react'

interface TwitterAuthProps {
  onAuthSuccess?: () => void
}

export function TwitterAuth({ onAuthSuccess }: TwitterAuthProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/twitter/profile')
      if (response.ok) {
        const data = await response.json()
        setProfile(data.profile)
        setIsConnected(true)
        onAuthSuccess?.()
      } else {
        setIsConnected(false)
      }
    } catch (error) {
      setIsConnected(false)
    }
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    setError(null)
    
    try {
      // In a real implementation, this would redirect to Twitter OAuth
      // For now, we'll simulate the connection
      window.location.href = `/api/auth/twitter`
    } catch (error: any) {
      setError(error.message || 'Failed to connect to Twitter')
    } finally {
      setIsConnecting(false)
    }
  }

  if (isConnected && profile) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-green-600">Connected to Twitter</CardTitle>
          <CardDescription>Your account is successfully connected</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold">
                {profile.name?.[0] || profile.username?.[0] || 'U'}
              </span>
            </div>
            <div className="text-left">
              <p className="font-medium">{profile.name}</p>
              <p className="text-sm text-gray-600">@{profile.username}</p>
              <p className="text-xs text-gray-500">
                {profile.public_metrics?.followers_count?.toLocaleString()} followers
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={checkConnection} className="w-full">
            Refresh Connection
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <Twitter className="h-6 w-6 text-blue-600" />
        </div>
        <CardTitle>Connect Your Twitter Account</CardTitle>
        <CardDescription>
          Connect your Twitter account to start automating your social media presence
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Post and schedule tweets</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Monitor mentions and replies</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Access analytics and insights</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Automate engagement</span>
          </div>
        </div>

        <Button 
          onClick={handleConnect} 
          disabled={isConnecting}
          className="w-full bg-blue-500 hover:bg-blue-600"
        >
          <Twitter className="h-4 w-4 mr-2" />
          {isConnecting ? 'Connecting...' : 'Connect Twitter Account'}
        </Button>
        
        <p className="text-xs text-gray-500 text-center">
          We'll redirect you to Twitter to authorize the connection. 
          Your credentials are never stored on our servers.
        </p>
      </CardContent>
    </Card>
  )
}
