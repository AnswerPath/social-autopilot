"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Twitter, Eye, EyeOff, CheckCircle, AlertCircle, ExternalLink, Shield, Key, Trash2, RefreshCw, Info, Database, AlertTriangle, Zap, Cloud } from 'lucide-react'
import { TwitterApiInstructions } from "./twitter-api-instructions"
import { DatabaseStatus } from "./database-status"
import { DatabaseSetupWizard } from "./database-setup-wizard"

interface CredentialStatus {
  hasCredentials: boolean
  encryptedAt?: string
  lastValidated?: string
  isValid?: boolean
  apiKey?: string
  accessToken?: string
  encryptionVersion?: number
}

export function TwitterApiSettings() {
  const [credentials, setCredentials] = useState({
    apiKey: '',
    apiSecret: '',
    accessToken: '',
    accessSecret: '',
    bearerToken: ''
  })
  
  const [showSecrets, setShowSecrets] = useState({
    apiSecret: false,
    accessSecret: false,
    bearerToken: false
  })
  
  const [status, setStatus] = useState<CredentialStatus>({ hasCredentials: false })
  const [isLoading, setIsLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [validationDetails, setValidationDetails] = useState<any>(null)
  const [showSetupWizard, setShowSetupWizard] = useState(false)

  useEffect(() => {
    fetchCredentialStatus()
  }, [])

  const fetchCredentialStatus = async () => {
    try {
      const response = await fetch('/api/settings/twitter-credentials')
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
        setShowSetupWizard(false)
      } else {
        // If we get an error, it might be because the table doesn't exist
        const errorData = await response.json()
        if (errorData.error?.includes('table') || errorData.error?.includes('does not exist')) {
          setShowSetupWizard(true)
        }
      }
    } catch (error) {
      console.error('Error fetching credential status:', error)
      setShowSetupWizard(true)
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    setMessage(null)
    
    try {
      const response = await fetch('/api/settings/twitter-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: `${data.message} (Stored with ID: ${data.id})` 
        })
        setValidationDetails(data)
        await fetchCredentialStatus()
        
        // Clear form
        setCredentials({
          apiKey: '',
          apiSecret: '',
          accessToken: '',
          accessSecret: '',
          bearerToken: ''
        })
      } else {
        setMessage({ type: 'error', text: data.error })
        
        // If error suggests database issues, show setup wizard
        if (data.error?.includes('table') || data.error?.includes('does not exist')) {
          setShowSetupWizard(true)
        }
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Failed to save credentials. Please try again.' })
      console.error('Save error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setMessage(null)
    
    try {
      const response = await fetch('/api/settings/test-connection', {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setMessage({ type: 'success', text: data.message })
        setValidationDetails(data.details)
        await fetchCredentialStatus()
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Connection test failed. Please try again.' })
      console.error('Test error:', error)
    } finally {
      setIsTesting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete your Twitter API credentials? This action cannot be undone and will permanently remove them from the database.')) {
      return
    }
    
    setIsDeleting(true)
    setMessage(null)
    
    try {
      const response = await fetch('/api/settings/twitter-credentials', {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setMessage({ type: 'success', text: data.message })
        setValidationDetails(null)
        await fetchCredentialStatus()
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Failed to delete credentials. Please try again.' })
      console.error('Delete error:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleSecretVisibility = (field: keyof typeof showSecrets) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const isFormValid = credentials.apiKey && credentials.apiSecret && 
                     credentials.accessToken && credentials.accessSecret

  // Show setup wizard if database needs to be set up
  if (showSetupWizard) {
    return (
      <div className="space-y-6">
        <DatabaseSetupWizard />
        <Button onClick={fetchCredentialStatus} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Check Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Database Status */}
      <DatabaseStatus />

      {/* Current Status */}
      {status.hasCredentials && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-600" />
              Current Twitter Integration
            </CardTitle>
            <CardDescription>
              Your Twitter API credentials are securely stored in encrypted database storage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">API Key</Label>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">{status.apiKey}</code>
                  <Badge variant={status.isValid ? "default" : "secondary"}>
                    {status.isValid ? "Valid" : "Stored"}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Access Token</Label>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">{status.accessToken}</code>
                  {status.encryptionVersion && (
                    <Badge variant="outline">v{status.encryptionVersion}</Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Database className="h-3 w-3" />
                <span>Stored in database</span>
              </div>
              {status.encryptedAt && (
                <span>Created: {new Date(status.encryptedAt).toLocaleString()}</span>
              )}
              {status.lastValidated && (
                <span>Last validated: {new Date(status.lastValidated).toLocaleString()}</span>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button onClick={handleTestConnection} disabled={isTesting} variant="outline">
                <RefreshCw className={`h-4 w-4 mr-2 ${isTesting ? 'animate-spin' : ''}`} />
                {isTesting ? 'Testing...' : 'Test Connection'}
              </Button>
              <Button onClick={handleDelete} disabled={isDeleting} variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? 'Deleting...' : 'Delete from Database'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Details */}
      {validationDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Connection Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {validationDetails.user && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Connected Account</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Twitter className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">{validationDetails.user.name}</span>
                    <span className="text-gray-600">@{validationDetails.user.username}</span>
                    {validationDetails.user.verified && (
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {validationDetails.user.followers_count.toLocaleString()} followers
                  </div>
                </div>
                
                {validationDetails.permissions && (
                  <div>
                    <Label className="text-sm font-medium">Permissions</Label>
                    <div className="space-y-1 mt-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span className="text-sm">Read tweets and user data</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {validationDetails.permissions.canWrite ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-orange-500" />
                        )}
                        <span className="text-sm">Post tweets and replies</span>
                        {!validationDetails.permissions.canWrite && (
                          <Badge variant="outline" className="text-xs">Requires Node.js</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {validationDetails.permissions.canUploadMedia ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-orange-500" />
                        )}
                        <span className="text-sm">Upload media files</span>
                        {!validationDetails.permissions.canUploadMedia && (
                          <Badge variant="outline" className="text-xs">Requires Node.js</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {validationDetails.note && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>{validationDetails.note}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add/Update Credentials Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {status.hasCredentials ? 'Update' : 'Add'} Twitter API Credentials
          </CardTitle>
          <CardDescription>
            {status.hasCredentials 
              ? 'Update your existing Twitter API credentials in the database'
              : 'Connect your Twitter account by securely storing your API credentials'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Security Notice */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Your API credentials are encrypted using AES-256-GCM encryption and stored securely in the database. 
              All sensitive data is encrypted at rest and in transit.
            </AlertDescription>
          </Alert>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key *</Label>
              <Input
                id="apiKey"
                type="text"
                placeholder="Enter your Twitter API Key"
                value={credentials.apiKey}
                onChange={(e) => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiSecret">API Secret *</Label>
              <div className="relative">
                <Input
                  id="apiSecret"
                  type={showSecrets.apiSecret ? "text" : "password"}
                  placeholder="Enter your Twitter API Secret"
                  value={credentials.apiSecret}
                  onChange={(e) => setCredentials(prev => ({ ...prev, apiSecret: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => toggleSecretVisibility('apiSecret')}
                >
                  {showSecrets.apiSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accessToken">Access Token *</Label>
              <Input
                id="accessToken"
                type="text"
                placeholder="Enter your Access Token"
                value={credentials.accessToken}
                onChange={(e) => setCredentials(prev => ({ ...prev, accessToken: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accessSecret">Access Token Secret *</Label>
              <div className="relative">
                <Input
                  id="accessSecret"
                  type={showSecrets.accessSecret ? "text" : "password"}
                  placeholder="Enter your Access Token Secret"
                  value={credentials.accessSecret}
                  onChange={(e) => setCredentials(prev => ({ ...prev, accessSecret: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => toggleSecretVisibility('accessSecret')}
                >
                  {showSecrets.accessSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="bearerToken">Bearer Token (Recommended)</Label>
              <div className="relative">
                <Input
                  id="bearerToken"
                  type={showSecrets.bearerToken ? "text" : "password"}
                  placeholder="Enter your Bearer Token (recommended for better compatibility)"
                  value={credentials.bearerToken}
                  onChange={(e) => setCredentials(prev => ({ ...prev, bearerToken: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => toggleSecretVisibility('bearerToken')}
                >
                  {showSecrets.bearerToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-gray-600">
                Bearer token enables limited read access in the current environment and full access when deployed to production
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button
              onClick={handleSave}
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Encrypting & Storing...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Save to Database
                </>
              )}
            </Button>
          </div>

          {/* Status Messages */}
          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              {message.type === 'success' ? (
                <CheckCircle className="h-4 w-4" />
              ) : message.type === 'error' ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <Info className="h-4 w-4" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Instructions */}
      <TwitterApiInstructions />
    </div>
  )
}
