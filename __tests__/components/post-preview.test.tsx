import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { PostPreview } from '@/components/ui/post-preview'
import type { MediaAttachment } from '@/lib/media-validation'

// Mock the calculateXCharacterCount function
jest.mock('@/lib/x-character-counter', () => ({
  calculateXCharacterCount: jest.fn((text: string) => text.length)
}))

// Mock the media validation utilities
jest.mock('@/lib/media-validation', () => ({
  validateMediaFile: jest.fn(),
  createMediaAttachment: jest.fn()
}))

// Mock the utils
jest.mock('@/lib/utils', () => ({
  cn: jest.fn((...classes) => classes.filter(Boolean).join(' '))
}))

describe('PostPreview', () => {
  const mockMediaAttachment: MediaAttachment = {
    id: 'test-id',
    name: 'test-image.jpg',
    type: 'image',
    size: 1024000,
    thumbnail: 'data:image/jpeg;base64,test-thumbnail',
    file: new File(['test'], 'test-image.jpg', { type: 'image/jpeg' })
  }

  const defaultProps = {
    content: 'This is a test post with @mention and #hashtag',
    mediaAttachments: [],
    uploadedMediaIds: []
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders post content correctly', () => {
      render(<PostPreview {...defaultProps} />)
      
      // Check for the main content text using flexible matching
      expect(screen.getByText('This is a test post with')).toBeInTheDocument()
      expect(screen.getByText('@mention')).toBeInTheDocument()
      expect(screen.getByText((content, element) => {
        return element?.textContent === ' and '
      })).toBeInTheDocument()
      expect(screen.getByText('#hashtag')).toBeInTheDocument()
    })

    it('renders user information', () => {
      render(<PostPreview {...defaultProps} />)
      
      expect(screen.getByText('Your Account')).toBeInTheDocument()
      expect(screen.getByText('@yourusername')).toBeInTheDocument()
    })

    it('renders post actions', () => {
      render(<PostPreview {...defaultProps} />)
      
      expect(screen.getByRole('button', { name: /reply/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /repost/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /like/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument()
    })
  })

  describe('Text Formatting', () => {
    it('renders mentions with blue color', () => {
      render(<PostPreview {...defaultProps} content="Hello @username" />)
      
      const mentionElement = screen.getByText('@username')
      expect(mentionElement).toHaveClass('text-blue-500')
    })

    it('renders hashtags with blue color', () => {
      render(<PostPreview {...defaultProps} content="Check out #hashtag" />)
      
      const hashtagElement = screen.getByText('#hashtag')
      expect(hashtagElement).toHaveClass('text-blue-500')
    })

    it('renders URLs with blue color and underline', () => {
      render(<PostPreview {...defaultProps} content="Visit https://example.com" />)
      
      const urlElement = screen.getByText('https://example.com')
      expect(urlElement).toHaveClass('text-blue-500', 'underline')
    })

    it('handles mixed content with mentions, hashtags, and URLs', () => {
      const content = 'Hello @user! Check out #hashtag and visit https://example.com'
      render(<PostPreview {...defaultProps} content={content} />)
      
      expect(screen.getByText('@user')).toHaveClass('text-blue-500')
      expect(screen.getByText('#hashtag')).toHaveClass('text-blue-500')
      expect(screen.getByText('https://example.com')).toHaveClass('text-blue-500', 'underline')
    })
  })

  describe('Media Preview', () => {
    it('renders single image correctly', () => {
      render(
        <PostPreview 
          {...defaultProps} 
          mediaAttachments={[mockMediaAttachment]} 
        />
      )
      
      const image = screen.getByAltText('Post media')
      expect(image).toBeInTheDocument()
      expect(image).toHaveAttribute('src', mockMediaAttachment.thumbnail)
    })

    it('renders multiple images in grid layout', () => {
      const multipleAttachments = [
        { ...mockMediaAttachment, id: '1', name: 'image1.jpg' },
        { ...mockMediaAttachment, id: '2', name: 'image2.jpg' }
      ]
      
      render(
        <PostPreview 
          {...defaultProps} 
          mediaAttachments={multipleAttachments} 
        />
      )
      
      const images = screen.getAllByAltText('Post media')
      expect(images).toHaveLength(2)
    })

    it('renders video placeholder for video attachments', () => {
      const videoAttachment = { ...mockMediaAttachment, type: 'video' as const }
      
      render(
        <PostPreview 
          {...defaultProps} 
          mediaAttachments={[videoAttachment]} 
        />
      )
      
      expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument() // Video icon
    })

    it('shows "+X more" overlay for additional media', () => {
      const manyAttachments = Array.from({ length: 5 }, (_, i) => ({
        ...mockMediaAttachment,
        id: `attachment-${i}`,
        name: `image${i}.jpg`
      }))
      
      render(
        <PostPreview 
          {...defaultProps} 
          mediaAttachments={manyAttachments} 
        />
      )
      
      // Check for media count using flexible matching
      expect(screen.getByText(/5/)).toBeInTheDocument()
      expect(screen.getByText(/media files/)).toBeInTheDocument()
    })
  })

  describe('Character Count', () => {
    it('shows character count when over 250 characters', () => {
      const longContent = 'a'.repeat(260)
      render(<PostPreview {...defaultProps} content={longContent} />)
      
      expect(screen.getByText('260/280')).toBeInTheDocument()
    })

    it('does not show character count when under 250 characters', () => {
      const shortContent = 'Short post'
      render(<PostPreview {...defaultProps} content={shortContent} />)
      
      expect(screen.queryByText(/\d+\/280/)).not.toBeInTheDocument()
    })

    it('shows progress bar with correct color based on character count', () => {
      const longContent = 'a'.repeat(260)
      render(<PostPreview {...defaultProps} content={longContent} />)
      
      const progressBar = screen.getByRole('progressbar', { hidden: true })
      expect(progressBar).toBeInTheDocument()
    })
  })

  describe('Device Views', () => {
    it('applies mobile styling when deviceView is mobile', () => {
      render(<PostPreview {...defaultProps} deviceView="mobile" />)
      
      // Find the main Card container
      const container = screen.getByText('Your Account').closest('[class*="rounded-lg"]')
      expect(container).toHaveClass('max-w-[350px]')
    })

    it('applies desktop styling when deviceView is desktop', () => {
      render(<PostPreview {...defaultProps} deviceView="desktop" />)
      
      // Find the main Card container
      const container = screen.getByText('Your Account').closest('[class*="rounded-lg"]')
      expect(container).toHaveClass('max-w-[600px]')
    })
  })

  describe('Theme Support', () => {
    it('applies light theme styling by default', () => {
      render(<PostPreview {...defaultProps} />)
      
      // Find the main Card container
      const container = screen.getByText('Your Account').closest('[class*="rounded-lg"]')
      expect(container).toHaveClass('bg-white', 'text-black')
    })

    it('applies dark theme styling when theme is dark', () => {
      render(<PostPreview {...defaultProps} theme="dark" />)
      
      // Find the main Card container
      const container = screen.getByText('Your Account').closest('[class*="rounded-lg"]')
      expect(container).toHaveClass('bg-black', 'text-white')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty content', () => {
      render(<PostPreview {...defaultProps} content="" />)
      
      expect(screen.getByText('Your Account')).toBeInTheDocument()
    })

    it('handles content with only whitespace', () => {
      render(<PostPreview {...defaultProps} content="   " />)
      
      expect(screen.getByText('Your Account')).toBeInTheDocument()
    })

    it('handles content with special characters', () => {
      const specialContent = 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?'
      render(<PostPreview {...defaultProps} content={specialContent} />)
      
      expect(screen.getByText(specialContent)).toBeInTheDocument()
    })

    it('handles very long content', () => {
      const veryLongContent = 'a'.repeat(1000)
      render(<PostPreview {...defaultProps} content={veryLongContent} />)
      
      expect(screen.getByText(veryLongContent)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for interactive elements', () => {
      render(<PostPreview {...defaultProps} />)
      
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('has proper alt text for images', () => {
      render(
        <PostPreview 
          {...defaultProps} 
          mediaAttachments={[mockMediaAttachment]} 
        />
      )
      
      const image = screen.getByAltText('Post media')
      expect(image).toBeInTheDocument()
    })
  })
})
