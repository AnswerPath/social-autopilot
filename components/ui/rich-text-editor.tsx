"use client"

import React, { useCallback, useEffect, useState } from 'react'
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
  FORMAT_TEXT_COMMAND
} from 'lexical'
import { $isListNode, INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND } from '@lexical/list'
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { Bold, Italic, List, ListOrdered, Link } from 'lucide-react'
import { Toggle } from '@/components/ui/toggle'
import { cn } from '@/lib/utils'

interface RichTextEditorProps {
  placeholder?: string
  onContentChange?: (text: string) => void
  maxCharacters?: number
  initialContent?: string
  className?: string
}

// Custom plugin for character counting
function CharacterCountPlugin({ 
  maxCharacters, 
  onCharacterCountChange 
}: { 
  maxCharacters?: number
  onCharacterCountChange?: (count: number) => void 
}) {
  const [editor] = useLexicalComposerContext()
  
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot()
        const text = root.getTextContent()
        const count = text.length
        onCharacterCountChange?.(count)
      })
    })
  }, [editor, onCharacterCountChange])

  return null
}

// Custom plugin for formatting toolbar
function FormattingToolbar() {
  const [editor] = useLexicalComposerContext()
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isLink, setIsLink] = useState(false)
  const [isList, setIsList] = useState(false)
  const [isOrderedList, setIsOrderedList] = useState(false)

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
    </div>
  )
}

// Custom plugin for X-style mentions and hashtags
function MentionHashtagPlugin() {
  // This plugin will be handled by CSS styling instead of node transformation
  // to avoid complexity and potential issues
  return null
}

// Custom plugin for URL handling  
function UrlPlugin() {
  // This plugin will be handled by CSS styling instead of node transformation
  // to avoid complexity and potential issues
  return null
}

export function RichTextEditor({
  placeholder = "What's happening?",
  onContentChange,
  maxCharacters = 280,
  initialContent = "",
  className
}: RichTextEditorProps) {
  const [characterCount, setCharacterCount] = useState(0)

  const initialConfig = {
    namespace: 'RichTextEditor',
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

  const handleContentChange = useCallback((editorState: EditorState) => {
    editorState.read(() => {
      const root = $getRoot()
      const text = root.getTextContent()
      onContentChange?.(text)
    })
  }, [onContentChange])

  return (
    <div className={cn("border rounded-md", className)}>
      <LexicalComposer initialConfig={initialConfig}>
        <div className="relative">
          <FormattingToolbar />
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
            <MentionHashtagPlugin />
            <UrlPlugin />
            <CharacterCountPlugin 
              maxCharacters={maxCharacters}
              onCharacterCountChange={setCharacterCount}
            />
            <OnChangePlugin onChange={handleContentChange} />
          </div>
        </div>
      </LexicalComposer>
      
      {/* Character counter */}
      <div className="flex justify-end p-2 border-t bg-muted/50">
        <span className={cn(
          "text-sm",
          characterCount > maxCharacters * 0.9 ? "text-destructive" : "text-muted-foreground"
        )}>
          {characterCount}/{maxCharacters}
        </span>
      </div>
    </div>
  )
}
