"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ExternalLink, Info, CheckCircle, AlertTriangle, Copy, Eye } from 'lucide-react'
import { useState } from "react"

export function TwitterApiInstructions() {
  const [copiedStep, setCopiedStep] = useState<number | null>(null)

  const copyToClipboard = (text: string, step: number) => {
    navigator.clipboard.writeText(text)
    setCopiedStep(step)
    setTimeout(() => setCopiedStep(null), 2000)
  }

  const steps = [
    {
      title: "Create a Twitter Developer Account",
      description: "Sign up for a Twitter Developer account if you don't have one",
      action: "Visit Twitter Developer Portal",
      url: "https://developer.twitter.com/en/portal/dashboard",
      details: [
        "Go to developer.twitter.com",
        "Sign in with your Twitter account",
        "Apply for a developer account",
        "Wait for approval (usually instant for basic access)"
      ]
    },
    {
      title: "Create a New App",
      description: "Create a new application in your developer dashboard",
      details: [
        "Click 'Create App' or '+ Create App'",
        "Fill in your app details:",
        "• App name: 'Social Autopilot' (or your preferred name)",
        "• Description: Describe your social media automation use case",
        "• Website URL: Your website or app URL",
        "• Terms of Service: Link to your terms (if applicable)"
      ]
    },
    {
      title: "Configure App Permissions",
      description: "Set the correct permissions for your app",
      details: [
        "Go to your app's 'Settings' tab",
        "Under 'App permissions', select:",
        "• Read and Write (to post tweets and read data)",
        "• Request email address (optional)",
        "Save your changes"
      ]
    },
    {
      title: "Generate API Keys",
      description: "Create your API keys and tokens",
      details: [
        "Go to the 'Keys and Tokens' tab",
        "Under 'Consumer Keys', click 'Generate' if not already generated",
        "Copy your API Key and API Secret Key",
        "Under 'Access Token and Secret', click 'Generate'",
        "Copy your Access Token and Access Token Secret"
      ]
    },
    {
      title: "Optional: Generate Bearer Token",
      description: "Create a Bearer Token for additional API access",
      details: [
        "In the 'Keys and Tokens' tab",
        "Under 'Bearer Token', click 'Generate' if available",
        "Copy the Bearer Token",
        "This provides read-only access to public data"
      ]
    }
  ]

  const securityTips = [
    "Never share your API keys publicly or commit them to version control",
    "Regenerate your keys immediately if you suspect they've been compromised",
    "Use environment variables to store keys in production applications",
    "Regularly review your app's usage in the Twitter Developer dashboard",
    "Enable two-factor authentication on your Twitter Developer account"
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            How to Get Your Twitter API Keys
          </CardTitle>
          <CardDescription>
            Follow these steps to obtain your Twitter API credentials from the Twitter Developer Portal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {steps.map((step, index) => (
            <div key={index} className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{step.title}</h3>
                  <p className="text-gray-600 mb-3">{step.description}</p>
                  
                  {step.url && (
                    <Button variant="outline" size="sm" asChild className="mb-3">
                      <a href={step.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {step.action}
                      </a>
                    </Button>
                  )}
                  
                  <ul className="space-y-1 text-sm">
                    {step.details.map((detail, detailIndex) => (
                      <li key={detailIndex} className="flex items-start gap-2">
                        <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {index < steps.length - 1 && <Separator className="my-4" />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* API Key Types Explanation */}
      <Card>
        <CardHeader>
          <CardTitle>Understanding Your API Keys</CardTitle>
          <CardDescription>What each credential is used for</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="default">Required</Badge>
                <h4 className="font-medium">API Key & Secret</h4>
              </div>
              <p className="text-sm text-gray-600">
                Identifies your application to Twitter. Think of this as your app's username and password.
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="default">Required</Badge>
                <h4 className="font-medium">Access Token & Secret</h4>
              </div>
              <p className="text-sm text-gray-600">
                Allows your app to act on behalf of your Twitter account. Required for posting tweets.
              </p>
            </div>
            
            <div className="p-4 border rounded-lg md:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">Optional</Badge>
                <h4 className="font-medium">Bearer Token</h4>
              </div>
              <p className="text-sm text-gray-600">
                Provides read-only access to public Twitter data. Useful for searching tweets and accessing public metrics.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Security Best Practices
          </CardTitle>
          <CardDescription>Keep your API credentials safe and secure</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {securityTips.map((tip, index) => (
              <li key={index} className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{tip}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle>Common Issues & Solutions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error 401 - Unauthorized:</strong> Check that your API keys are correct and that your app has the right permissions.
            </AlertDescription>
          </Alert>
          
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error 403 - Forbidden:</strong> Your app may not have write permissions. Check your app settings in the Twitter Developer Portal.
            </AlertDescription>
          </Alert>
          
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error 429 - Rate Limited:</strong> You've exceeded Twitter's rate limits. Wait a few minutes before trying again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
