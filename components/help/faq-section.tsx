'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FAQ_ITEMS } from '@/lib/faq-content'
import { Search, HelpCircle } from 'lucide-react'

export function FAQSection() {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return FAQ_ITEMS
    return FAQ_ITEMS.filter(
      (item) =>
        item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
    )
  }, [query])

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-2 mb-6">
        <HelpCircle className="h-8 w-8 text-blue-600" />
        <h1 className="text-2xl font-bold">Help &amp; FAQ</h1>
      </div>
      <p className="text-muted-foreground mb-6">
        Search for answers or browse common questions below.
      </p>
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search FAQ..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground">No matching questions.</p>
        ) : (
          filtered.map((item, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{item.q}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm text-foreground">
                  {item.a}
                </CardDescription>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
