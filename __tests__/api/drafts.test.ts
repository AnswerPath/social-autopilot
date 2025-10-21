import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/drafts/route'
import { GET as GET_DRAFT, PUT, DELETE } from '@/app/api/drafts/[id]/route'

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(() => ({
                data: [],
                error: null
              }))
            }))
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {
              id: '1',
              content: 'test content',
              media_urls: ['media-1'],
              status: 'draft',
              user_id: 'demo-user',
              created_at: '2023-01-01T00:00:00Z',
              updated_at: '2023-01-01T00:00:00Z',
              auto_saved: false
            },
            error: null
          }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => ({
                  data: {
                    id: '1',
                    content: 'updated content',
                    media_urls: ['media-1'],
                    status: 'draft',
                    user_id: 'demo-user',
                    created_at: '2023-01-01T00:00:00Z',
                    updated_at: '2023-01-01T00:01:00Z',
                    auto_saved: true
                  },
                  error: null
                }))
              }))
            }))
          }))
        }))
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              error: null
            }))
          }))
        }))
      }))
    }))
  }
}))

describe('/api/drafts', () => {
  describe('GET /api/drafts', () => {
    it('should return drafts with pagination', async () => {
      const request = new NextRequest('http://localhost:3000/api/drafts?limit=10&offset=0')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.drafts).toBeDefined()
      expect(data.pagination).toBeDefined()
    })

    it('should handle errors gracefully', async () => {
      const { supabaseAdmin } = require('@/lib/supabase')
      supabaseAdmin.from.mockImplementationOnce(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                range: jest.fn(() => ({
                  data: null,
                  error: { message: 'Database error' }
                }))
              }))
            }))
          }))
        }))
      }))

      const request = new NextRequest('http://localhost:3000/api/drafts')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Database error')
    })
  })

  describe('POST /api/drafts', () => {
    it('should create a new draft', async () => {
      const request = new NextRequest('http://localhost:3000/api/drafts', {
        method: 'POST',
        body: JSON.stringify({
          content: 'test content',
          mediaUrls: ['media-1'],
          autoSave: false
        }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.draft).toBeDefined()
      expect(data.draft.content).toBe('test content')
      expect(data.draft.media_urls).toEqual(['media-1'])
    })

    it('should reject empty content and media', async () => {
      const request = new NextRequest('http://localhost:3000/api/drafts', {
        method: 'POST',
        body: JSON.stringify({
          content: '',
          mediaUrls: [],
          autoSave: false
        }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Content or media is required')
    })

    it('should handle auto-save flag', async () => {
      const request = new NextRequest('http://localhost:3000/api/drafts', {
        method: 'POST',
        body: JSON.stringify({
          content: 'auto-saved content',
          mediaUrls: [],
          autoSave: true
        }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Draft auto-saved')
    })
  })
})

describe('/api/drafts/[id]', () => {
  describe('GET /api/drafts/[id]', () => {
    it('should return a specific draft', async () => {
      const { supabaseAdmin } = require('@/lib/supabase')
      supabaseAdmin.from.mockImplementationOnce(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({
                  data: {
                    id: '1',
                    content: 'test content',
                    media_urls: ['media-1'],
                    status: 'draft',
                    user_id: 'demo-user',
                    created_at: '2023-01-01T00:00:00Z',
                    updated_at: '2023-01-01T00:00:00Z',
                    auto_saved: false
                  },
                  error: null
                }))
              }))
            }))
          }))
        }))
      }))

      const request = new NextRequest('http://localhost:3000/api/drafts/1')
      const response = await GET_DRAFT(request, { params: Promise.resolve({ id: '1' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.draft).toBeDefined()
      expect(data.draft.id).toBe('1')
    })

    it('should return 404 for non-existent draft', async () => {
      const { supabaseAdmin } = require('@/lib/supabase')
      supabaseAdmin.from.mockImplementationOnce(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({
                  data: null,
                  error: { code: 'PGRST116' }
                }))
              }))
            }))
          }))
        }))
      }))

      const request = new NextRequest('http://localhost:3000/api/drafts/non-existent')
      const response = await GET_DRAFT(request, { params: Promise.resolve({ id: 'non-existent' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Draft not found')
    })
  })

  describe('PUT /api/drafts/[id]', () => {
    it('should update an existing draft', async () => {
      const { supabaseAdmin } = require('@/lib/supabase')
      
      // Mock the fetch check
      supabaseAdmin.from.mockImplementationOnce(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({
                  data: { id: '1', updated_at: '2023-01-01T00:00:00Z' },
                  error: null
                }))
              }))
            }))
          }))
        }))
      }))

      // Mock the update
      supabaseAdmin.from.mockImplementationOnce(() => ({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest.fn(() => ({
                    data: {
                      id: '1',
                      content: 'updated content',
                      media_urls: ['media-1'],
                      status: 'draft',
                      user_id: 'demo-user',
                      created_at: '2023-01-01T00:00:00Z',
                      updated_at: '2023-01-01T00:01:00Z',
                      auto_saved: true
                    },
                    error: null
                  }))
                }))
              }))
            }))
          }))
        }))
      }))

      const request = new NextRequest('http://localhost:3000/api/drafts/1', {
        method: 'PUT',
        body: JSON.stringify({
          content: 'updated content',
          mediaUrls: ['media-1'],
          autoSave: true
        }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.draft.content).toBe('updated content')
      expect(data.message).toBe('Draft auto-saved')
    })

    it('should return 404 for non-existent draft', async () => {
      const { supabaseAdmin } = require('@/lib/supabase')
      supabaseAdmin.from.mockImplementationOnce(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({
                  data: null,
                  error: { code: 'PGRST116' }
                }))
              }))
            }))
          }))
        }))
      }))

      const request = new NextRequest('http://localhost:3000/api/drafts/non-existent', {
        method: 'PUT',
        body: JSON.stringify({
          content: 'updated content',
          mediaUrls: [],
          autoSave: false
        }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(request, { params: Promise.resolve({ id: 'non-existent' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Draft not found')
    })
  })

  describe('DELETE /api/drafts/[id]', () => {
    it('should delete a draft', async () => {
      const { supabaseAdmin } = require('@/lib/supabase')
      supabaseAdmin.from.mockImplementationOnce(() => ({
        delete: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                error: null
              }))
            }))
          }))
        }))
      }))

      const request = new NextRequest('http://localhost:3000/api/drafts/1', {
        method: 'DELETE'
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Draft deleted successfully')
    })

    it('should handle deletion errors', async () => {
      const { supabaseAdmin } = require('@/lib/supabase')
      supabaseAdmin.from.mockImplementationOnce(() => ({
        delete: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                error: { message: 'Deletion failed' }
              }))
            }))
          }))
        }))
      }))

      const request = new NextRequest('http://localhost:3000/api/drafts/1', {
        method: 'DELETE'
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Deletion failed')
    })
  })
})
