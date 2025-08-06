"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Database, CheckCircle, AlertCircle, RefreshCw, Shield, Plus, Wrench, Activity, AlertTriangle, Trash2 } from 'lucide-react'

interface DatabaseHealth {
  success: boolean
  tableExists: boolean
  canRead: boolean
  canWrite: boolean
  recordCount: number
  error?: string
}

export function DatabaseStatus() {
  const [credentials, setCredentials] = useState<any[]>([])
  const [health, setHealth] = useState<DatabaseHealth | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingDemo, setIsCreatingDemo] = useState(false)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)
  const [isCleaningUp, setIsCleaningUp] = useState(false)

  useEffect(() => {
    fetchDatabaseStatus()
  }, [])

  const fetchDatabaseStatus = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Fetch credentials list
      const credentialsResponse = await fetch('/api/settings/credentials-list')
      const credentialsData = await credentialsResponse.json()
      
      if (credentialsResponse.ok) {
        setCredentials(credentialsData.credentials || [])
      } else {
        setError(credentialsData.error || 'Failed to fetch credentials')
      }

      // Fetch database health
      const healthResponse = await fetch('/api/settings/database-health')
      const healthData = await healthResponse.json()
      
      if (healthResponse.ok) {
        setHealth(healthData)
      }
    } catch (error: any) {
      setError('Network error occurred')
      console.error('Error fetching database status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const checkDatabaseHealth = async () => {
    setIsCheckingHealth(true)
    
    try {
      const response = await fetch('/api/settings/database-health')
      const data = await response.json()
      
      if (response.ok) {
        setHealth(data)
      } else {
        setError(data.error || 'Failed to check database health')
      }
    } catch (error: any) {
      setError('Failed to check database health')
      console.error('Error checking database health:', error)
    } finally {
      setIsCheckingHealth(false)
    }
  }

  const createDemoCredentials = async () => {
    setIsCreatingDemo(true)
    setError(null)
    
    try {
      const response = await fetch('/api/settings/create-demo', {
        method: 'POST'
      })
      const data = await response.json()
      
      if (response.ok) {
        await fetchDatabaseStatus() // Refresh the status
      } else {
        setError(data.error || 'Failed to create demo credentials')
      }
    } catch (error: any) {
      setError('Failed to create demo credentials')
      console.error('Error creating demo credentials:', error)
    } finally {
      setIsCreatingDemo(false)
    }
  }

  const cleanupInvalidCredentials = async () => {
    if (!confirm('This will delete any corrupted credentials that cannot be decrypted. Continue?')) {
      return
    }

    setIsCleaningUp(true)
    setError(null)
    
    try {
      const response = await fetch('/api/settings/cleanup-credentials', {
        method: 'POST'
      })
      const data = await response.json()
      
      if (response.ok) {
        await fetchDatabaseStatus() // Refresh the status
      } else {
        setError(data.error || 'Failed to cleanup credentials')
      }
    } catch (error: any) {
      setError('Failed to cleanup credentials')
      console.error('Error cleaning up credentials:', error)
    } finally {
      setIsCleaningUp(false)
    }
  }

  const getHealthStatus = () => {
    if (!health) return { color: 'gray', text: 'Unknown' }
    
    if (!health.success || !health.tableExists) {
      return { color: 'red', text: 'Critical' }
    }
    
    if (!health.canRead || !health.canWrite) {
      return { color: 'yellow', text: 'Limited' }
    }
    
    return { color: 'green', text: 'Healthy' }
  }

  const healthStatus = getHealthStatus()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-blue-600" />
          Database Storage Status
          <Badge 
            variant={healthStatus.color === 'green' ? 'default' : 
                    healthStatus.color === 'yellow' ? 'secondary' : 'destructive'}
          >
            {healthStatus.text}
          </Badge>
        </CardTitle>
        <CardDescription>
          Overview of your encrypted credentials stored in the Supabase database
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              {error.includes('table') && (
                <div className="mt-2">
                  <p className="text-sm">The database table may not exist yet. Please run the setup script:</p>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-1 block">
                    scripts/setup-database.sql
                  </code>
                </div>
              )}
              {error.includes('decrypt') && (
                <div className="mt-2">
                  <p className="text-sm">Some credentials may be corrupted. Try cleaning them up.</p>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Database Health Status */}
        {health && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                {health.tableExists ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
              <p className="text-xs font-medium">Table Exists</p>
              <p className="text-xs text-gray-600">{health.tableExists ? 'Yes' : 'No'}</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                {health.canRead ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
              <p className="text-xs font-medium">Read Access</p>
              <p className="text-xs text-gray-600">{health.canRead ? 'Yes' : 'No'}</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                {health.canWrite ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
              <p className="text-xs font-medium">Write Access</p>
              <p className="text-xs text-gray-600">{health.canWrite ? 'Yes' : 'No'}</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Activity className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-xs font-medium">Records</p>
              <p className="text-xs text-gray-600">{health.recordCount}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium">Encryption Status</span>
          </div>
          <Badge variant="default">AES-256-GCM Active</Badge>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Total Stored Credentials</span>
            <Badge variant="secondary">{credentials.length}</Badge>
          </div>
          
          {credentials.map((cred, index) => (
            <div key={cred.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <div>
                  <p className="text-sm font-medium capitalize">{cred.credential_type}</p>
                  <p className="text-xs text-gray-500">
                    Created: {new Date(cred.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={cred.is_valid ? "default" : "secondary"}>
                  {cred.is_valid ? "Valid" : "Unvalidated"}
                </Badge>
                {cred.last_validated && (
                  <span className="text-xs text-gray-500">
                    Validated: {new Date(cred.last_validated).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}
          
          {credentials.length === 0 && !isLoading && !error && (
            <div className="text-center py-4 text-gray-500">
              <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm mb-3">No credentials stored in database</p>
              {health?.tableExists && health?.canWrite && (
                <Button 
                  onClick={createDemoCredentials}
                  disabled={isCreatingDemo}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {isCreatingDemo ? 'Creating...' : 'Create Demo Credentials'}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchDatabaseStatus}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
          
          <div className="flex gap-2">
            <Button 
              variant="outline"
              size="sm"
              onClick={checkDatabaseHealth}
              disabled={isCheckingHealth}
            >
              <Activity className={`h-4 w-4 mr-2 ${isCheckingHealth ? 'animate-spin' : ''}`} />
              {isCheckingHealth ? 'Checking...' : 'Health Check'}
            </Button>
            
            {error?.includes('decrypt') && (
              <Button 
                onClick={cleanupInvalidCredentials}
                disabled={isCleaningUp}
                size="sm"
                variant="destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isCleaningUp ? 'Cleaning...' : 'Cleanup'}
              </Button>
            )}
            
            {(!health?.tableExists || credentials.length === 0) && (
              <Button 
                onClick={createDemoCredentials}
                disabled={isCreatingDemo}
                size="sm"
              >
                <Wrench className="h-4 w-4 mr-2" />
                {isCreatingDemo ? 'Creating...' : 'Setup Demo'}
              </Button>
            )}
          </div>
        </div>

        {/* Setup Instructions */}
        {health && !health.tableExists && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Database Setup Required:</strong> The user_credentials table doesn't exist. 
              Please run the setup script in your Supabase SQL editor:
              <code className="block mt-1 text-xs bg-gray-100 px-2 py-1 rounded">
                scripts/setup-database.sql
              </code>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
