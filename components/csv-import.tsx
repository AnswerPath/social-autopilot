"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, Download, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { useToast } from "@/hooks/use-toast"
import { parseCSVFile, generateCSVTemplate, type ParsedScheduledPost } from "@/lib/csv-parser"

interface CSVImportProps {
  onSuccess?: () => void
  onClose?: () => void
}

export function CSVImport({ onSuccess, onClose }: CSVImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedScheduledPost[] | null>(null)
  const [errors, setErrors] = useState<Array<{ row: number; error: string }>>([])
  const [warnings, setWarnings] = useState<Array<{ row: number; warning: string }>>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: "Error",
        description: "Please select a CSV file",
        variant: "destructive",
      })
      return
    }

    setFile(selectedFile)
    setIsUploading(true)
    setErrors([])
    setWarnings([])
    setParsedData(null)

    try {
      const result = await parseCSVFile(selectedFile)

      if (!result.success || !result.posts) {
        setErrors(result.errors || [])
        toast({
          title: "Validation Failed",
          description: `CSV file has ${result.errors?.length || 0} error(s). Please fix them and try again.`,
          variant: "destructive",
        })
        return
      }

      setParsedData(result.posts)
      setErrors([])
      setWarnings(result.warnings || [])

      if (result.warnings && result.warnings.length > 0) {
        toast({
          title: "Warning",
          description: `CSV file parsed with ${result.warnings.length} warning(s)`,
        })
      } else {
        toast({
          title: "Success",
          description: `Successfully parsed ${result.posts.length} post(s)`,
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to parse CSV file",
        variant: "destructive",
      })
      setErrors([{ row: 0, error: error.message || "Failed to parse CSV file" }])
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownloadTemplate = () => {
    const template = generateCSVTemplate()
    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'scheduled-posts-template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: "Downloaded",
      description: "CSV template downloaded successfully",
    })
  }

  const handleImport = async () => {
    if (!parsedData || parsedData.length === 0) return

    setIsImporting(true)
    setErrors([])

    try {
      const response = await fetch('/api/scheduled-posts/csv-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posts: parsedData
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to import posts')
      }

      toast({
        title: "Success",
        description: `Successfully imported ${result.successCount} of ${parsedData.length} post(s)`,
      })

      if (result.failures && result.failures.length > 0) {
        setErrors(result.failures.map((f: any) => ({
          row: f.row || 0,
          error: f.error || 'Failed to import'
        })))
      } else {
        onSuccess?.()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to import posts",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleClear = () => {
    setFile(null)
    setParsedData(null)
    setErrors([])
    setWarnings([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import Scheduled Posts from CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Template Download */}
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Download the CSV template to see the required format, then fill it with your posts.
            </p>
            <Button onClick={handleDownloadTemplate} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <label htmlFor="csv-file" className="text-sm font-medium">
              Select CSV File
            </label>
            <div className="flex items-center gap-2">
              <input
                id="csv-file"
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? 'Parsing...' : file ? 'Change File' : 'Select File'}
              </Button>
              {file && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>{file.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Errors:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {errors.map((error, index) => (
                      <li key={index}>
                        Row {error.row}: {error.error}
                      </li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Warnings:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {warnings.map((warning, index) => (
                      <li key={index}>
                        Row {warning.row}: {warning.warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {parsedData && parsedData.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Preview ({parsedData.length} post(s) ready to import)
              </p>
              <div className="max-h-60 overflow-y-auto border rounded-md p-4 space-y-2">
                {parsedData.map((post, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded text-sm">
                    <span className="flex-1 line-clamp-1">{post.content}</span>
                    <span className="text-gray-600 ml-2">
                      {post.scheduledDate} {post.scheduledTime}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button
              onClick={handleImport}
              disabled={isImporting || !parsedData || parsedData.length === 0 || errors.length > 0}
            >
              {isImporting ? 'Importing...' : `Import ${parsedData?.length || 0} Post(s)`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

