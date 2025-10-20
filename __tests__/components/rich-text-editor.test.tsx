import React from 'react'
import { render, screen } from '@testing-library/react'
import { RichTextEditor } from '@/components/ui/rich-text-editor'

// Mock all Lexical components to avoid ES module issues
jest.mock('@lexical/react/LexicalComposer', () => ({
  LexicalComposer: ({ children }: { children: React.ReactNode }) => <div data-testid="lexical-composer">{children}</div>
}))

jest.mock('@lexical/react/LexicalRichTextPlugin', () => ({
  RichTextPlugin: ({ contentEditable }: { contentEditable: React.ReactNode }) => (
    <div data-testid="rich-text-plugin">{contentEditable}</div>
  )
}))

jest.mock('@lexical/react/LexicalContentEditable', () => ({
  ContentEditable: ({ className, placeholder }: { className?: string; placeholder?: React.ReactNode }) => (
    <div 
      data-testid="content-editable" 
      className={className}
      contentEditable
      suppressContentEditableWarning
    >
      {placeholder}
    </div>
  )
}))

jest.mock('@lexical/react/LexicalHistoryPlugin', () => ({
  HistoryPlugin: () => <div data-testid="history-plugin" />
}))

jest.mock('@lexical/react/LexicalAutoFocusPlugin', () => ({
  AutoFocusPlugin: () => <div data-testid="auto-focus-plugin" />
}))

jest.mock('@lexical/react/LexicalListPlugin', () => ({
  ListPlugin: () => <div data-testid="list-plugin" />
}))

jest.mock('@lexical/react/LexicalLinkPlugin', () => ({
  LinkPlugin: () => <div data-testid="link-plugin" />
}))

jest.mock('@lexical/react/LexicalHashtagPlugin', () => ({
  HashtagPlugin: () => <div data-testid="hashtag-plugin" />
}))

jest.mock('@lexical/react/LexicalOnChangePlugin', () => ({
  OnChangePlugin: () => <div data-testid="on-change-plugin" />
}))

jest.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => [{
    registerUpdateListener: jest.fn(() => jest.fn()),
    dispatchCommand: jest.fn(),
    getElementByKey: jest.fn()
  }]
}))

// Mock all Lexical core functions
jest.mock('lexical', () => ({
  $getRoot: jest.fn(() => ({ getTextContent: () => 'test content' })),
  $getSelection: jest.fn(() => ({
    hasFormat: jest.fn(() => false),
    anchor: { getNode: jest.fn(() => ({ getParent: jest.fn(() => null) })) }
  })),
  $isRangeSelection: jest.fn(() => true),
  $createTextNode: jest.fn(),
  $createLinkNode: jest.fn(),
  TextNode: {},
  FORMAT_TEXT_COMMAND: 'FORMAT_TEXT_COMMAND',
  INSERT_UNORDERED_LIST_COMMAND: 'INSERT_UNORDERED_LIST_COMMAND',
  INSERT_ORDERED_LIST_COMMAND: 'INSERT_ORDERED_LIST_COMMAND',
  REMOVE_LIST_COMMAND: 'REMOVE_LIST_COMMAND',
  TOGGLE_LINK_COMMAND: 'TOGGLE_LINK_COMMAND'
}))

jest.mock('@lexical/list', () => ({
  $isListNode: jest.fn(() => false)
}))

jest.mock('@lexical/link', () => ({
  $isLinkNode: jest.fn(() => false)
}))

describe('RichTextEditor', () => {
  const defaultProps = {
    placeholder: "What's happening?",
    onContentChange: jest.fn(),
    maxCharacters: 280
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders with default props', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    expect(screen.getByTestId('lexical-composer')).toBeInTheDocument()
    expect(screen.getByTestId('rich-text-plugin')).toBeInTheDocument()
    expect(screen.getByTestId('content-editable')).toBeInTheDocument()
  })

  it('displays placeholder text', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    expect(screen.getByText("What's happening?")).toBeInTheDocument()
  })

  it('shows character counter', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    expect(screen.getByText('0/280')).toBeInTheDocument()
  })

  it('renders formatting toolbar with all buttons', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    expect(screen.getByLabelText('Bold')).toBeInTheDocument()
    expect(screen.getByLabelText('Italic')).toBeInTheDocument()
    expect(screen.getByLabelText('Bullet List')).toBeInTheDocument()
    expect(screen.getByLabelText('Numbered List')).toBeInTheDocument()
    expect(screen.getByLabelText('Link')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const customClass = 'custom-editor-class'
    render(<RichTextEditor {...defaultProps} className={customClass} />)
    
    const editorContainer = screen.getByTestId('lexical-composer').parentElement
    expect(editorContainer).toHaveClass(customClass)
  })

  it('handles initial content', () => {
    const initialContent = 'Initial text content'
    render(<RichTextEditor {...defaultProps} initialContent={initialContent} />)
    
    // The editor should be initialized with the content
    expect(screen.getByTestId('content-editable')).toBeInTheDocument()
  })

  it('renders all required Lexical plugins', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    expect(screen.getByTestId('history-plugin')).toBeInTheDocument()
    expect(screen.getByTestId('auto-focus-plugin')).toBeInTheDocument()
    expect(screen.getByTestId('list-plugin')).toBeInTheDocument()
    expect(screen.getByTestId('link-plugin')).toBeInTheDocument()
    expect(screen.getByTestId('hashtag-plugin')).toBeInTheDocument()
    expect(screen.getByTestId('on-change-plugin')).toBeInTheDocument()
  })

  it('applies proper styling classes', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    const contentEditable = screen.getByTestId('content-editable')
    expect(contentEditable).toHaveClass('min-h-[120px]', 'p-3', 'outline-none', 'resize-none')
  })

  it('handles missing onContentChange prop gracefully', () => {
    const { onContentChange, ...propsWithoutCallback } = defaultProps
    render(<RichTextEditor {...propsWithoutCallback} />)
    
    expect(screen.getByTestId('lexical-composer')).toBeInTheDocument()
  })
})
