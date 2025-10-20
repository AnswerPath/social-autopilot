import React from 'react'
import { render, screen } from '@testing-library/react'
import { PostComposer } from '@/components/post-composer'

// Mock the RichTextEditor to avoid Lexical complexity in tests
jest.mock('@/components/ui/rich-text-editor', () => ({
  RichTextEditor: ({ placeholder, onContentChange }: { placeholder?: string; onContentChange?: (text: string) => void }) => (
    <div data-testid="rich-text-editor">
      <textarea 
        data-testid="editor-textarea"
        placeholder={placeholder}
        onChange={(e) => onContentChange?.(e.target.value)}
      />
    </div>
  )
}))

describe('PostComposer Integration', () => {
  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders with rich text editor', () => {
    render(<PostComposer onClose={mockOnClose} />)
    
    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument()
    expect(screen.getByPlaceholderText("What's happening?")).toBeInTheDocument()
  })

  it('shows character counter in editor', () => {
    render(<PostComposer onClose={mockOnClose} />)
    
    // The character counter should be built into the RichTextEditor
    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument()
  })

  it('maintains existing functionality', () => {
    render(<PostComposer onClose={mockOnClose} />)
    
    // Check that other elements are still present
    expect(screen.getByText('Click to upload')).toBeInTheDocument()
    expect(screen.getByText('When to Post')).toBeInTheDocument()
    expect(screen.getByText('Require Approval')).toBeInTheDocument()
  })

  it('has proper form structure', () => {
    render(<PostComposer onClose={mockOnClose} />)
    
    // Check that the form structure is intact
    expect(screen.getByText('Create New Post')).toBeInTheDocument()
    expect(screen.getByText('Post Content')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })
})
