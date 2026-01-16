#!/usr/bin/env node

/**
 * Check scheduled posts status and errors
 * Usage: node scripts/check-scheduled-posts.js
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })
config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkPosts() {
  console.log('🔍 Checking scheduled posts...\n')
  
  const userId = 'demo-user' // Update if using different user
  
  // Get all posts for the user
  const { data: posts, error } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('user_id', userId)
    .order('scheduled_at', { ascending: false })
    .limit(20)
  
  if (error) {
    console.error('❌ Error fetching posts:', error.message)
    process.exit(1)
  }
  
  if (!posts || posts.length === 0) {
    console.log('ℹ️  No scheduled posts found')
    return
  }
  
  console.log(`📊 Found ${posts.length} post(s):\n`)
  
  posts.forEach((post, index) => {
    const scheduledAt = new Date(post.scheduled_at)
    const now = new Date()
    const isOverdue = scheduledAt < now
    const timeUntil = scheduledAt > now 
      ? `${Math.round((scheduledAt - now) / 1000 / 60)} minutes`
      : `${Math.round((now - scheduledAt) / 1000 / 60)} minutes ago`
    
    console.log(`${index + 1}. Post ID: ${post.id}`)
    console.log(`   Status: ${post.status}`)
    console.log(`   Scheduled: ${scheduledAt.toLocaleString()} (${timeUntil})`)
    console.log(`   Retry Count: ${post.retry_count || 0}/${post.max_retries || 3}`)
    
    if (post.error) {
      console.log(`   ❌ Error: ${post.error}`)
    }
    
    if (post.posted_tweet_id) {
      console.log(`   ✅ Posted Tweet ID: ${post.posted_tweet_id}`)
    }
    
    if (post.last_retry_at) {
      console.log(`   🔄 Last Retry: ${new Date(post.last_retry_at).toLocaleString()}`)
    }
    
    console.log(`   Content: ${post.content.substring(0, 50)}${post.content.length > 50 ? '...' : ''}`)
    console.log('')
  })
  
  // Summary
  const statusCounts = posts.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {})
  
  console.log('📈 Status Summary:')
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`)
  })
  
  // Check for posts that are being retried
  const now = new Date()
  const retryingPosts = posts.filter(p => {
    const scheduledAt = new Date(p.scheduled_at)
    return p.status === 'approved' && 
           p.retry_count > 0 && 
           scheduledAt > now
  })
  
  if (retryingPosts.length > 0) {
    console.log(`\n⚠️  ${retryingPosts.length} post(s) are being automatically retried:`)
    retryingPosts.forEach(p => {
      console.log(`   - ${p.id}: ${p.error || 'Unknown error'} (Retry ${p.retry_count}/${p.max_retries || 3})`)
    })
  }
}

checkPosts().catch(error => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})

