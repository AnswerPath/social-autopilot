"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Database, CheckCircle, AlertCircle, ExternalLink, Copy, Play, Terminal, Wrench, Cloud } from 'lucide-react'
import { getSupabaseConfig } from "@/lib/supabase-auto"
import { SupabaseStatus } from "./supabase-status"

export function DatabaseSetupWizard() {
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [supabaseConfig, setSupabaseConfig] = useState<any>(null)

  useEffect(() => {
    setSupabaseConfig(getSupabaseConfig())
  }, [])

  const sqlScript = `-- Social Autopilot Database Setup Script
-- Execute this in your Supabase SQL Editor

-- Clean up any existing corrupted data
DROP TABLE IF EXISTS user_credentials CASCADE;

-- Create the credentials table with proper security
CREATE TABLE user_credentials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    credential_type TEXT NOT NULL DEFAULT 'twitter',
    encrypted_api_key TEXT NOT NULL,
    encrypted_api_secret TEXT NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    encrypted_access_secret TEXT NOT NULL,
    encrypted_bearer_token TEXT,
    encryption_version INTEGER DEFAULT 1,
    is_valid BOOLEAN DEFAULT FALSE,
    last_validated TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, credential_type)
);

-- Create indexes for faster lookups
CREATE INDEX idx_user_credentials_user_id ON user_credentials(user_id);
CREATE INDEX idx_user_credentials_type ON user_credentials(credential_type);
CREATE INDEX idx_user_credentials_valid ON user_credentials(is_valid);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_user_credentials_updated_at ON user_credentials;
CREATE TRIGGER update_user_credentials_updated_at 
    BEFORE UPDATE ON user_credentials 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

-- Create policy for demo access
DROP POLICY IF EXISTS "Allow all operations for demo" ON user_credentials;
CREATE POLICY "Allow all operations for demo" ON user_credentials
    FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON user_credentials TO authenticated;
GRANT ALL ON user_credentials TO anon;

-- Verify setup
SELECT 'Setup completed successfully!' as status;`

  const runSetup = async () => {
    if (!supabaseConfig?.isConfigured) {
      setError('Supabase is not properly configured. Please check your environment variables.')
      return
    }

    setIsRunning(true)
    setProgress(0)
    setError(null)
    setResult(null)

    try {
      setCurrentStep('Initializing database setup...')
      setProgress(20)

      const response = await fetch('/api/database/setup', {
        method: 'POST'
      })

      setProgress(60)
      setCurrentStep('Verifying database structure...')

      const data = await response.json()

      setProgress(100)
      setCurrentStep('Setup completed!')

      if (response.ok) {
        setResult(data)
      } else {
        setError(data.error || 'Setup failed')
        setResult(data)
      }
    } catch (error: any) {
      setError(`Network error: ${error.message}`)
    } finally {
      setIsRunning(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(sqlScript)
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const openSupabaseDashboard = () => {
    if (supabaseConfig?.supabaseUrl) {
      const dashboardUrl = supabaseConfig.supabaseUrl.replace('/rest/v1', '') + '/project/_/sql'
      window.open(dashboardUrl, '_blank')
    }
  }

  return (
    <div className="space-y-6">
      {/* Supabase Integration Status */}
      <SupabaseStatus />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            Database Setup Wizard
          </CardTitle>
          <CardDescription>
            Set up your database table for encrypted credential storage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configuration Check */}
          {!supabaseConfig?.isConfigured && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>Supabase Not Configured</strong></p>
                  <p>If you're using v0, the Supabase integration should be automatic.</p>
                  <p>If running locally, please add the required environment variables to your .env.local file.</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Automatic Setup */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Automatic Setup</h3>
                <p className="text-sm text-gray-600">
                  {supabaseConfig?.isV0Integrated 
                    ? "Use v0's integrated Supabase to set up the database automatically"
                    : "Try to set up the database automatically"
                  }
                </p>
              </div>
              <Button 
                onClick={runSetup} 
                disabled={isRunning || !supabaseConfig?.isConfigured}
              >
                <Play className="h-4 w-4 mr-2" />
                {isRunning ? 'Running...' : 'Run Setup'}
              </Button>
            </div>

            {isRunning && (
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-gray-600">{currentStep}</p>
              </div>
            )}

            {result && (
              <Alert variant={result.success ? "default" : "destructive"}>
                {result.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {result.message || result.error}
                  {result.details && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Records: {result.details.recordCount}</Badge>
                        <Badge variant={result.details.tableExists ? "default" : "destructive"}>
                          {result.details.tableExists ? "Table Exists" : "Table Missing"}
                        </Badge>
                      </div>
                    </div>
                  )}
                  {result.instructions && (
                    <div className="mt-3">
                      <p className="font-medium">Manual setup required:</p>
                      <ol className="list-decimal list-inside space-y-1 mt-1">
                        {result.instructions.map((instruction: string, index: number) => (
                          <li key={index} className="text-sm">{instruction}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Manual Setup */}
          {supabaseConfig?.isConfigured && (
            <div className="border-t pt-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Manual Setup
                  </h3>
                  <p className="text-sm text-gray-600">
                    If automatic setup fails, run this SQL script manually in Supabase
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">SQL Setup Script</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={copyToClipboard}>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                      <Button size="sm" variant="outline" onClick={openSupabaseDashboard}>
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open SQL Editor
                      </Button>
                    </div>
                  </div>
                  
                  <pre className="text-xs bg-white p-3 rounded border overflow-x-auto max-h-40">
                    <code>{sqlScript}</code>
                  </pre>
                </div>

                <Alert>
                  <Wrench className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Manual Setup Steps:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>Click "Open SQL Editor" to go to your Supabase dashboard</li>
                      <li>Click "Copy" to copy the SQL script above</li>
                      <li>Paste the script into the SQL Editor</li>
                      <li>Click "Run" to execute the script</li>
                      <li>Return here and refresh the page</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
