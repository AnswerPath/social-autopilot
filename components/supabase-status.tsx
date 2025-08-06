"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Database, Cloud, Settings } from 'lucide-react'
import { getSupabaseConfig, getSetupInstructions } from "@/lib/supabase-auto"

export function SupabaseStatus() {
  const [config, setConfig] = useState<any>(null)
  const [instructions, setInstructions] = useState<any>(null)

  useEffect(() => {
    const supabaseConfig = getSupabaseConfig()
    const setupInstructions = getSetupInstructions()
    
    setConfig(supabaseConfig)
    setInstructions(setupInstructions)
  }, [])

  if (!config || !instructions) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-blue-600" />
          Supabase Integration Status
          <Badge variant={config.isV0Integrated ? "default" : "secondary"}>
            {config.isV0Integrated ? "v0 Integrated" : "Manual Setup"}
          </Badge>
        </CardTitle>
        <CardDescription>
          {config.isV0Integrated 
            ? "Automatically configured via v0's Supabase integration"
            : "Manual configuration required"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            {config.supabaseUrl ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <span className="text-sm">Database URL</span>
          </div>
          
          <div className="flex items-center gap-2">
            {config.supabaseAnonKey ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <span className="text-sm">Anonymous Key</span>
          </div>
          
          <div className="flex items-center gap-2">
            {config.supabaseServiceKey ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <span className="text-sm">Service Role Key</span>
          </div>
        </div>

        <Alert variant={instructions.status === 'ready' ? 'default' : 'destructive'}>
          {instructions.status === 'ready' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            <div className="space-y-2">
              <p>{instructions.message}</p>
              {instructions.instructions.length > 0 && (
                <div>
                  {instructions.instructions.map((instruction: string, index: number) => (
                    <div key={index} className="text-sm">
                      {instruction.startsWith('  ') ? (
                        <code className="bg-gray-100 px-1 rounded text-xs">{instruction.trim()}</code>
                      ) : (
                        instruction
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>

        {config.isV0Integrated && (
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">Ready to Use</span>
            </div>
            <p className="text-sm text-green-700">
              Your Supabase database is automatically configured and ready for encrypted credential storage.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
