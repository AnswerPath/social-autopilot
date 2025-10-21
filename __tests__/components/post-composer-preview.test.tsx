import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PostComposer } from '@/components/post-composer'

// Mock the RichTextEditor component
jest.mock('@/components/ui/rich-text-editor', () => ({
  RichTextEditor: ({ onContentChange, placeholder, initialContent }: any) => (
    <textarea
      data-testid="rich-text-editor"
      placeholder={placeholder}
      defaultValue={initialContent}
      onChange={(e) => onContentChange?.(e.target.value)}
    />
  )
}))

// Mock the MediaUpload component
jest.mock('@/components/ui/media-upload', () => ({
  MediaUpload: ({ onAttachmentsChange, attachments }: any) => (
    <div data-testid="media-upload">
      <button onClick={() => onAttachmentsChange([{ id: 'test', name: 'test.jpg', type: 'image', size: 1000, thumbnail: 'test.jpg', file: new File(['test'], 'test.jpg') }])}>
        Upload Media
      </button>
    </div>
  )
}))

// Mock the PostPreview component
jest.mock('@/components/ui/post-preview', () => ({
  PostPreview: ({ content, deviceView, theme }: any) => (
    <div data-testid="post-preview" data-device={deviceView} data-theme={theme}>
      Preview: {content}
    </div>
  )
}))

// Mock the DraftManagerComponent
jest.mock('@/components/draft-manager', () => ({
  DraftManagerComponent: ({ onSelectDraft }: any) => (
    <div data-testid="draft-manager">
      <button onClick={() => onSelectDraft({ id: 'draft-1', content: 'Draft content' })}>
        Select Draft
      </button>
    </div>
  )
}))

// Mock the DraftManager
jest.mock('@/lib/draft-manager', () => ({
  DraftManager: {
    getInstance: () => ({
      triggerAutoSave: jest.fn(),
      stopAutoSave: jest.fn(),
      saveToLocalStorage: jest.fn(),
      removeFromLocalStorage: jest.fn(),
      createDraft: jest.fn().mockResolvedValue({ id: 'new-draft', content: 'test' }),
      updateDraft: jest.fn().mockResolvedValue({ id: 'updated-draft', content: 'test' }),
      deleteDraft: jest.fn().mockResolvedValue(true),
      resolveConflict: jest.fn().mockResolvedValue({ id: 'resolved-draft', content: 'test' })
    })
  }
}))

// Mock the toast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}))

// Mock fetch
global.fetch = jest.fn()

describe('PostComposer Preview Functionality', () => {
  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    })
  })

  describe('Preview Mode Toggle', () => {
    it('renders preview button by default', () => {
      render(<PostComposer onClose={mockOnClose} />)
      
      expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument()
    })

    it('toggles to preview mode when preview button is clicked', () => {
      render(<PostComposer onClose={mockOnClose} />)
      
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)
      
      expect(screen.getByText('Post Preview')).toBeInTheDocument()
      expect(screen.getByTestId('post-preview')).toBeInTheDocument()
    })

    it('shows edit button when in preview mode', () => {
      render(<PostComposer onClose={mockOnClose} />)
      
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)
      
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    })

    it('toggles back to edit mode when edit button is clicked', () => {
      render(<PostComposer onClose={mockOnClose} />)
      
      // Go to preview mode
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)
      
      // Go back to edit mode
      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)
      
      expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument()
      expect(screen.queryByTestId('post-preview')).not.toBeInTheDocument()
    })
  })

  describe('Preview Controls', () => {
    it('shows device view controls when in preview mode', () => {
      render(<PostComposer onClose={mockOnClose} />)
      
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)
      
      expect(screen.getByRole('button', { name: /mobile view/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /desktop view/i })).toBeInTheDocument()
    })

    it('shows theme toggle when in preview mode', () => {
      render(<PostComposer onClose={mockOnClose} />)
      
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)
      
      expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument()
    })

    it('toggles device view to mobile', () => {
      render(<PostComposer onClose={mockOnClose} />)
      
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)
      
      const mobileButton = screen.getByRole('button', { name: /mobile view/i })
      fireEvent.click(mobileButton)
      
      const preview = screen.getByTestId('post-preview')
      expect(preview).toHaveAttribute('data-device', 'mobile')
    })

    it('toggles device view to desktop', () => {
      render(<PostComposer onClose={mockOnClose} />)
      
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)
      
      const desktopButton = screen.getByRole('button', { name: /desktop view/i })
      fireEvent.click(desktopButton)
      
      const preview = screen.getByTestId('post-preview')
      expect(preview).toHaveAttribute('data-device', 'desktop')
    })

    it('toggles theme to dark mode', () => {
      render(<PostComposer onClose={mockOnClose} />)
      
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)
      
      const darkButton = screen.getByRole('button', { name: /switch to dark mode/i })
      fireEvent.click(darkButton)
      
      const preview = screen.getByTestId('post-preview')
      expect(preview).toHaveAttribute('data-theme', 'dark')
    })

    it('toggles theme back to light mode', () => {
      render(<PostComposer onClose={mockOnClose} />)
      
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)
      
      // Toggle to dark
      const darkButton = screen.getByRole('button', { name: /switch to dark mode/i })
      fireEvent.click(darkButton)
      
      // Toggle back to light
      const lightButton = screen.getByRole('button', { name: /switch to light mode/i })
      fireEvent.click(lightButton)
      
      const preview = screen.getByTestId('post-preview')
      expect(preview).toHaveAttribute('data-theme', 'light')
    })
  })

  describe('Preview Content', () => {
    it('passes content to preview component', () => {
      render(<PostComposer onClose={mockOnClose} />)
      
      const textEditor = screen.getByTestId('rich-text-editor')
      fireEvent.change(textEditor, { target: { value: 'Test content' } })
      
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)
      
      expect(screen.getByText('Preview: Test content')).toBeInTheDocument()
    })

    it('passes media attachments to preview component', () => {
      render(<PostComposer onClose={mockOnClose} />)
      
      const uploadButton = screen.getByText('Upload Media')
      fireEvent.click(uploadButton)
      
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)
      
      const preview = screen.getByTestId('post-preview')
      expect(preview).toBeInTheDocument()
    })
  })

  describe('Actions in Preview Mode', () => {
    it('hides save draft button in preview mode', () => {
      render(<PostComposer onClose={mockOnClose} />)
      
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)
      
      expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument()
    })

    it('hides post/schedule buttons in preview mode', () => {
      render(<PostComposer onClose={mockOnClose} />)
      
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)
      
      expect(screen.queryByRole('button', { name: /post now/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /schedule post/i })).not.toBeInTheDocument()
    })

    it('shows cancel button in preview mode', () => {
      render(<PostComposer onClose={mockOnClose} />)
      
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)
      
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  describe('Preview Mode State Management', () => {
    it('maintains preview state when switching between modes', () => {
      render(<PostComposer onClose={mockOnClose} />)
      
      // Go to preview mode
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)
      
      // Change device view
      const mobileButton = screen.getByRole('button', { name: /mobile view/i })
      fireEvent.click(mobileButton)
      
      // Go back to edit mode
      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)
      
      // Go back to preview mode
      fireEvent.click(previewButton)
      
      const preview = screen.getByTestId('post-preview')
      expect(preview).toHaveAttribute('data-device', 'mobile')
    })

    it('resets to default device view and theme when opening preview', () => {
      render(<PostComposer onClose={mockOnClose} />)
      
      // Go to preview mode
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)
      
      const preview = screen.getByTestId('post-preview')
      expect(preview).toHaveAttribute('data-device', 'desktop')
      expect(preview).toHaveAttribute('data-theme', 'light')
    })
  })

  describe('Integration with Existing Features', () => {
    it('maintains draft functionality when switching to preview', () => {
      render(<PostComposer onClose={mockOnClose} />)
      
      const textEditor = screen.getByTestId('rich-text-editor')
      fireEvent.change(textEditor, { target: { value: 'Draft content' } })
      
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)
      
      // Go back to edit mode
      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)
      
      expect(textEditor).toHaveValue('Draft content')
    })

    it('maintains media attachments when switching to preview', () => {
      render(<PostComposer onClose={mockOnClose} />)
      
      const uploadButton = screen.getByText('Upload Media')
      fireEvent.click(uploadButton)
      
      const previewButton = screen.getByRole('button', { name: /preview/i })
      fireEvent.click(previewButton)
      
      // Go back to edit mode
      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)
      
      expect(screen.getByTestId('media-upload')).toBeInTheDocument()
    })
  })
})
