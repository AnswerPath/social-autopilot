"use client"

import React, { useCallback, useEffect, useState, useRef } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { HashtagPlugin } from '@lexical/react/LexicalHashtagPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { 
  $getRoot, 
  $getSelection, 
  EditorState,
  $isRangeSelection,
  $createTextNode,
  $createParagraphNode,
  TextNode,
  FORMAT_TEXT_COMMAND,
  $insertNodes
} from 'lexical'
import { $isListNode, INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND, ListNode, ListItemNode } from '@lexical/list'
import { $isLinkNode, TOGGLE_LINK_COMMAND, LinkNode } from '@lexical/link'
import { HashtagNode } from '@lexical/hashtag'
import { Bold, Italic, List, ListOrdered, Link, Smile } from 'lucide-react'
import { Toggle } from '@/components/ui/toggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { calculateXCharacterCount } from '@/lib/x-character-counter'
import { EmojiPicker } from './emoji-picker'
import { HashtagSuggestions } from './hashtag-suggestions'
import { MentionSuggestions, type User as MentionUser } from './mention-suggestions'
import type { LexicalEditor } from 'lexical'
type MaybeLexicalEditor = Pick<LexicalEditor, 'update' | 'dispatchCommand'> | { update?: (...args: any[]) => void; dispatchCommand?: (...args: any[]) => void }

const runEditorUpdate = (editor: MaybeLexicalEditor, updateFn: () => void, options?: Record<string, unknown>) => {
  if (typeof editor?.update === 'function') {
    editor.update(updateFn, options)
  }
}

interface EnhancedRichTextEditorProps {
  placeholder?: string
  onContentChange?: (text: string) => void
  maxCharacters?: number
  initialContent?: string
  className?: string
  onValidationChange?: (isValid: boolean) => void
}

// Plugin to set initial content
function InitialContentPlugin({ initialContent }: { initialContent: string }) {
  const [editor] = useLexicalComposerContext()
  const lastContentRef = useRef<string | null>(null)
  const isInitializedRef = useRef(false)
  
  useEffect(() => {
    // Always set initial content on first mount or when it changes
    if (initialContent !== undefined && initialContent !== null) {
      // On first mount, always set the content
      // On subsequent updates, only set if it changed and editor is empty or different
      const shouldUpdate = !isInitializedRef.current || 
                          (initialContent !== lastContentRef.current)
      
      if (shouldUpdate) {
        runEditorUpdate(editor, () => {
          const root = $getRoot()
          const currentText = root.getTextContent()
          
          // Set content if editor is empty or content is different
          // Allow setting even if empty string (for editing cleared content)
          if (!isInitializedRef.current || currentText !== initialContent) {
            if (typeof (root as any).clear === 'function') {
              ;(root as any).clear()
            }
            if (initialContent) {
              // Create a paragraph node and append the text to it
              // Root nodes can only contain element nodes (like paragraphs), not text nodes directly
              const paragraph = $createParagraphNode()
              const textNode = $createTextNode(initialContent)
              if (typeof paragraph.append === 'function') {
                paragraph.append(textNode)
              }
              if (typeof (root as any).append === 'function') {
                ;(root as any).append(paragraph)
              }
            } else {
              // Even for empty content, create an empty paragraph
              const paragraph = $createParagraphNode()
              if (typeof (root as any).append === 'function') {
                ;(root as any).append(paragraph)
              }
            }
            lastContentRef.current = initialContent
            isInitializedRef.current = true
          }
        }, { tag: 'initial-content' })
      }
    }
  }, [editor, initialContent])
  
  return null
}

// Custom plugin for character counting
function CharacterCountPlugin({ 
  maxCharacters, 
  onCharacterCountChange,
  onValidationChange
}: { 
  maxCharacters?: number
  onCharacterCountChange?: (count: number) => void
  onValidationChange?: (isValid: boolean) => void
}) {
  const [editor] = useLexicalComposerContext()
  
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot()
        const text = root.getTextContent()
        const count = calculateXCharacterCount(text)
        onCharacterCountChange?.(count)
        
        // Check if text is valid (within character limit)
        const isValid = count <= (maxCharacters || 280)
        onValidationChange?.(isValid)
      })
    })
  }, [editor, onCharacterCountChange, onValidationChange, maxCharacters])

  return null
}

// Custom plugin for formatting toolbar with emoji picker
function EnhancedFormattingToolbar({ onEmojiSelect }: { onEmojiSelect: (emoji: string) => void }) {
  const [editor] = useLexicalComposerContext()
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isLink, setIsLink] = useState(false)
  const [isList, setIsList] = useState(false)
  const [isOrderedList, setIsOrderedList] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const updateToolbar = useCallback(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      // Update text format
      setIsBold(selection.hasFormat('bold'))
      setIsItalic(selection.hasFormat('italic'))
      
      // Update link format
      const node = selection.anchor.getNode()
      const parent = node.getParent()
      if ($isLinkNode(parent) || $isLinkNode(node)) {
        setIsLink(true)
      } else {
        setIsLink(false)
      }
      
      // Update list format
      const anchorNode = selection.anchor.getNode()
      const element = anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow()
      
      if (element) {
        setIsList($isListNode(element))
        setIsOrderedList(false) // Simplified for now
      }
    }
  }, [editor])

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar()
      })
    })
  }, [editor, updateToolbar])

  const formatBold = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')
  }

  const formatItalic = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')
  }

  const formatBulletList = () => {
    if (isList) {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
    } else {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
    }
  }

  const formatNumberedList = () => {
    if (isOrderedList) {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
    } else {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
    }
  }

  const formatLink = () => {
    if (!isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, 'https://')
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
    }
  }

  const handleEmojiSelect = (emoji: string) => {
    runEditorUpdate(editor, () => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        const textNode = $createTextNode(emoji)
        $insertNodes([textNode])
      }
    })
    setShowEmojiPicker(false)
    onEmojiSelect(emoji)
  }

  return (
    <div className="flex items-center gap-1 p-2 border-b overflow-x-auto">
      <div className="flex items-center gap-1 min-w-0">
        <Toggle
          pressed={isBold}
          onPressedChange={formatBold}
          size="sm"
          aria-label="Bold"
          className="min-h-[36px] min-w-[36px]"
        >
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle
          pressed={isItalic}
          onPressedChange={formatItalic}
          size="sm"
          aria-label="Italic"
          className="min-h-[36px] min-w-[36px]"
        >
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle
          pressed={isList}
          onPressedChange={formatBulletList}
          size="sm"
          aria-label="Bullet List"
          className="min-h-[36px] min-w-[36px]"
        >
          <List className="h-4 w-4" />
        </Toggle>
        <Toggle
          pressed={isOrderedList}
          onPressedChange={formatNumberedList}
          size="sm"
          aria-label="Numbered List"
          className="min-h-[36px] min-w-[36px]"
        >
          <ListOrdered className="h-4 w-4" />
        </Toggle>
        <Toggle
          pressed={isLink}
          onPressedChange={formatLink}
          size="sm"
          aria-label="Link"
          className="min-h-[36px] min-w-[36px]"
        >
          <Link className="h-4 w-4" />
        </Toggle>
        
        {/* Emoji picker button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowEmojiPicker(true)}
          className="h-9 w-9 p-0 min-h-[36px] min-w-[36px]"
          aria-label="Add emoji"
        >
          <Smile className="h-4 w-4" />
        </Button>
      </div>

      <EmojiPicker
        isOpen={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmojiSelect={handleEmojiSelect}
      />
    </div>
  )
}

// Custom plugin for hashtag and mention detection
function SuggestionPlugin({ 
  content, 
  onHashtagSelect, 
  onMentionSelect 
}: { 
  content: string
  onHashtagSelect: (hashtag: string) => void
  onMentionSelect: (user: MentionUser) => void
}) {
  const [editor] = useLexicalComposerContext()
  const [showHashtagSuggestions, setShowHashtagSuggestions] = useState(false)
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
  const [currentQuery, setCurrentQuery] = useState('')

  // Detect hashtag and mention patterns
  useEffect(() => {
    const hashtagMatch = content.match(/#(\w*)$/)
    const mentionMatch = content.match(/@(\w*)$/)
    
    if (hashtagMatch) {
      setShowHashtagSuggestions(true)
      setShowMentionSuggestions(false)
      setCurrentQuery(hashtagMatch[1])
    } else if (mentionMatch) {
      setShowMentionSuggestions(true)
      setShowHashtagSuggestions(false)
      setCurrentQuery(mentionMatch[1])
    } else {
      setShowHashtagSuggestions(false)
      setShowMentionSuggestions(false)
      setCurrentQuery('')
    }
  }, [content])

  const handleHashtagSelect = (hashtag: string) => {
    // Replace the current hashtag query with the selected hashtag
    const newContent = content.replace(/#\w*$/, `#${hashtag} `)
    runEditorUpdate(editor, () => {
      const root = $getRoot()
      if (typeof (root as any).clear === 'function') {
        ;(root as any).clear()
      }
      const paragraph = $createParagraphNode()
      const textNode = $createTextNode(newContent)
      if (typeof paragraph.append === 'function') {
        paragraph.append(textNode)
      }
      if (typeof (root as any).append === 'function') {
        ;(root as any).append(paragraph)
      }
    })
    setShowHashtagSuggestions(false)
    onHashtagSelect(hashtag)
  }

  const handleMentionSelect = (user: MentionUser) => {
    // Replace the current mention query with the selected user
    const newContent = content.replace(/@\w*$/, `@${user.username} `)
    runEditorUpdate(editor, () => {
      const root = $getRoot()
      if (typeof (root as any).clear === 'function') {
        ;(root as any).clear()
      }
      const paragraph = $createParagraphNode()
      const textNode = $createTextNode(newContent)
      if (typeof paragraph.append === 'function') {
        paragraph.append(textNode)
      }
      if (typeof (root as any).append === 'function') {
        ;(root as any).append(paragraph)
      }
    })
    setShowMentionSuggestions(false)
    onMentionSelect(user)
  }

  return (
    <div className="relative">
      <HashtagSuggestions
        content={content}
        isVisible={showHashtagSuggestions}
        onSelect={handleHashtagSelect}
        className="absolute top-full left-0 right-0 z-50"
      />
      <MentionSuggestions
        query={currentQuery}
        isVisible={showMentionSuggestions}
        onSelect={handleMentionSelect}
        className="absolute top-full left-0 right-0 z-50"
      />
    </div>
  )
}

export function EnhancedRichTextEditor({
  placeholder = "What's happening?",
  onContentChange,
  maxCharacters = 280,
  initialContent = "",
  className,
  onValidationChange
}: EnhancedRichTextEditorProps) {
  const [characterCount, setCharacterCount] = useState(0)
  const [isValid, setIsValid] = useState(true)
  const [editorContent, setEditorContent] = useState(initialContent ?? "")

  useEffect(() => {
    setEditorContent(initialContent ?? "")
  }, [initialContent])

  const initialConfig = {
    namespace: 'EnhancedRichTextEditor',
    nodes: [
      TextNode,
      ListNode,
      ListItemNode,
      LinkNode,
      HashtagNode
    ],
    theme: {
      root: 'p-0',
      paragraph: 'mb-0',
      text: {
        bold: 'font-bold',
        italic: 'italic',
        hashtag: 'text-blue-500 font-medium',
        mention: 'text-blue-500 font-medium',
        link: 'text-blue-500 underline'
      },
      list: {
        nested: {
          listitem: 'list-none'
        },
        ol: 'list-decimal list-inside',
        ul: 'list-disc list-inside',
        listitem: 'mb-1'
      }
    },
    onError: (error: Error) => {
      console.error('Lexical error:', error)
    }
  }

  const handleValidationChange = useCallback((valid: boolean) => {
    setIsValid(valid)
    onValidationChange?.(valid)
  }, [onValidationChange])

  const handleContentChange = useCallback((editorState: EditorState) => {
    editorState.read(() => {
      const root = $getRoot()
      const text = root.getTextContent()
      onContentChange?.(text)
      setEditorContent(text)
    })
  }, [onContentChange, setEditorContent])

  const handleEmojiSelect = useCallback((emoji: string) => {
    // Emoji selection is handled by the toolbar
  }, [])

  const handleHashtagSelect = useCallback((hashtag: string) => {
    // Hashtag selection is handled by the suggestion plugin
  }, [])

  const handleMentionSelect = useCallback((user: MentionUser) => {
    // Mention selection is handled by the suggestion plugin
  }, [])

  return (
    <div className={cn("border rounded-md", className)}>
      <LexicalComposer initialConfig={initialConfig}>
        <div className="relative">
          <EnhancedFormattingToolbar onEmojiSelect={handleEmojiSelect} />
          <div className="relative">
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className="min-h-[120px] sm:min-h-[140px] p-3 outline-none resize-none text-base sm:text-sm"
                  aria-placeholder={placeholder}
                  placeholder={
                    <div className="absolute top-3 left-3 text-muted-foreground pointer-events-none text-base sm:text-sm">
                      {placeholder}
                    </div>
                  }
                />
              }
              placeholder={null}
              ErrorBoundary={LexicalErrorBoundary}
            />
            <InitialContentPlugin initialContent={initialContent} />
            <HistoryPlugin />
            <AutoFocusPlugin />
            <ListPlugin />
            <LinkPlugin />
            <HashtagPlugin />
            <SuggestionPlugin
              content={editorContent}
              onHashtagSelect={handleHashtagSelect}
              onMentionSelect={handleMentionSelect}
            />
            <CharacterCountPlugin 
              maxCharacters={maxCharacters}
              onCharacterCountChange={setCharacterCount}
              onValidationChange={handleValidationChange}
            />
            <OnChangePlugin onChange={handleContentChange} />
          </div>
        </div>
      </LexicalComposer>
      
      {/* Character counter with enhanced visual feedback */}
      <div className="p-2 sm:p-3 border-t bg-muted/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
          <div className="flex-1">
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
              <div 
                className={cn(
                  "h-2 rounded-full transition-all duration-200",
                  characterCount <= maxCharacters * 0.7 ? "bg-green-500" :
                  characterCount <= maxCharacters * 0.9 ? "bg-yellow-500" :
                  characterCount <= maxCharacters ? "bg-orange-500" : "bg-red-500"
                )}
                style={{ width: `${Math.min((characterCount / maxCharacters) * 100, 100)}%` }}
              />
            </div>
            
            {/* Validation message */}
            {!isValid && (
              <p className="text-xs text-red-600 mt-1">
                Character limit exceeded. URLs count as 23 characters each.
              </p>
            )}
          </div>
          
          {/* Character count */}
          <div className="text-right sm:text-right">
            <span className={cn(
              "text-sm font-medium",
              characterCount <= maxCharacters * 0.7 ? "text-muted-foreground" :
              characterCount <= maxCharacters * 0.9 ? "text-yellow-600" :
              characterCount <= maxCharacters ? "text-orange-600" : "text-red-600 font-bold"
            )}>
              {characterCount}/{maxCharacters}
            </span>
            {characterCount > maxCharacters && (
              <div className="text-xs text-red-600">
                -{characterCount - maxCharacters}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
