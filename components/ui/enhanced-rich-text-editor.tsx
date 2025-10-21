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
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary'
import { 
  $getRoot, 
  $getSelection, 
  EditorState,
  $isRangeSelection,
  $createTextNode,
  TextNode,
  FORMAT_TEXT_COMMAND,
  $insertNodes
} from 'lexical'
import { $isListNode, INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND } from '@lexical/list'
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { Bold, Italic, List, ListOrdered, Link, Smile, Hash, AtSign } from 'lucide-react'
import { Toggle } from '@/components/ui/toggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { calculateXCharacterCount } from '@/lib/x-character-counter'
import { EmojiPicker } from './emoji-picker'
import { HashtagSuggestions } from './hashtag-suggestions'
import { MentionSuggestions } from './mention-suggestions'

interface EnhancedRichTextEditorProps {
  placeholder?: string
  onContentChange?: (text: string) => void
  maxCharacters?: number
  initialContent?: string
  className?: string
  onValidationChange?: (isValid: boolean) => void
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
    editor.update(() => {
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
    <div className="flex items-center gap-1 p-2 border-b">
      <Toggle
        pressed={isBold}
        onPressedChange={formatBold}
        size="sm"
        aria-label="Bold"
      >
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle
        pressed={isItalic}
        onPressedChange={formatItalic}
        size="sm"
        aria-label="Italic"
      >
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle
        pressed={isList}
        onPressedChange={formatBulletList}
        size="sm"
        aria-label="Bullet List"
      >
        <List className="h-4 w-4" />
      </Toggle>
      <Toggle
        pressed={isOrderedList}
        onPressedChange={formatNumberedList}
        size="sm"
        aria-label="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </Toggle>
      <Toggle
        pressed={isLink}
        onPressedChange={formatLink}
        size="sm"
        aria-label="Link"
      >
        <Link className="h-4 w-4" />
      </Toggle>
      
      {/* Emoji picker button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowEmojiPicker(true)}
        className="h-8 w-8 p-0"
        aria-label="Add emoji"
      >
        <Smile className="h-4 w-4" />
      </Button>

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
  onMentionSelect: (user: any) => void
}) {
  const [editor] = useLexicalComposerContext()
  const [showHashtagSuggestions, setShowHashtagSuggestions] = useState(false)
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
  const [currentQuery, setCurrentQuery] = useState('')
  const editorRef = useRef<HTMLDivElement>(null)

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
    editor.update(() => {
      const root = $getRoot()
      root.clear()
      root.append($createTextNode(newContent))
    })
    setShowHashtagSuggestions(false)
    onHashtagSelect(hashtag)
  }

  const handleMentionSelect = (user: any) => {
    // Replace the current mention query with the selected user
    const newContent = content.replace(/@\w*$/, `@${user.username} `)
    editor.update(() => {
      const root = $getRoot()
      root.clear()
      root.append($createTextNode(newContent))
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

  const initialConfig = {
    namespace: 'EnhancedRichTextEditor',
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
    })
  }, [onContentChange])

  const handleEmojiSelect = useCallback((emoji: string) => {
    // Emoji selection is handled by the toolbar
  }, [])

  const handleHashtagSelect = useCallback((hashtag: string) => {
    // Hashtag selection is handled by the suggestion plugin
  }, [])

  const handleMentionSelect = useCallback((user: any) => {
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
                  className="min-h-[120px] p-3 outline-none resize-none"
                  aria-placeholder={placeholder}
                  placeholder={
                    <div className="absolute top-3 left-3 text-muted-foreground pointer-events-none">
                      {placeholder}
                    </div>
                  }
                />
              }
              placeholder={null}
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <AutoFocusPlugin />
            <ListPlugin />
            <LinkPlugin />
            <HashtagPlugin />
            <SuggestionPlugin
              content={initialContent}
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
      <div className="p-2 border-t bg-muted/50">
        <div className="flex items-center justify-between">
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
          <div className="ml-4 text-right">
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
