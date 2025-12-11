/**
 * TipTap Editor Component
 * 
 * Rich text editor with AI integration features:
 * - Inline editing (Cmd+K)
 * - Event capture for process analysis
 * - Real-time word count
 */

import { useEditor, EditorContent, Editor as TipTapEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import CharacterCount from '@tiptap/extension-character-count'
import Link from '@tiptap/extension-link'
import { useEffect, useCallback, useRef, useState } from 'react'
import { useWriterStore } from '../../stores/writer-store'
import { InlineEditPopup } from './InlineEditPopup'

interface EditorProps {
  className?: string
}

export function Editor({ className }: EditorProps) {
  const {
    document: writerDocument,
    updateContent,
    captureEvent,
    openInlineEdit,
    inlineEditOpen,
    settings,
    setSelectedTextForChat,
    selectedTextForChat,
    pendingSuggestion,
    acceptPendingSuggestion,
    rejectPendingSuggestion,
    metrics,
    sessionStartTime,
  } = useWriterStore()
  
  const lastContent = useRef('')
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing your essay here...',
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Typography,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      CharacterCount,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-teal-400 underline hover:text-teal-300',
        },
      }),
    ],
    content: writerDocument?.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[400px] px-8 py-6',
        spellcheck: 'true',  // Enable browser spell check
      },
    },
    onUpdate: ({ editor }) => {
      const content = editor.getHTML()
      updateContent(content)
      
      // Capture text changes
      const text = editor.getText()
      if (text.length > lastContent.current.length) {
        captureEvent('text_insert', {
          content: text.slice(lastContent.current.length),
        })
      } else if (text.length < lastContent.current.length) {
        captureEvent('text_delete', {
          content: lastContent.current.slice(text.length),
        })
      }
      lastContent.current = text
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      if (from !== to) {
        const selectedText = editor.state.doc.textBetween(from, to)
        // Only capture selection events, but don't auto-update chat selection
        // This prevents re-renders from interfering with text selection
        captureEvent('text_select', {
          position: { from, to },
          content: selectedText,
        })
      }
    },
  })
  
  // Sync editor content with document
  useEffect(() => {
    if (editor && writerDocument?.content !== editor.getHTML()) {
      editor.commands.setContent(writerDocument?.content || '')
      lastContent.current = editor.getText()
    }
  }, [editor, writerDocument?.id])
  
  // Apply inline edit suggestion (for Ctrl+K popup)
  const applyInlineSuggestion = useCallback((suggestion: string, from: number, to: number) => {
    if (!editor) return
    
    editor
      .chain()
      .focus()
      .setTextSelection({ from, to })
      .deleteSelection()
      .insertContent(suggestion)
      .run()
  }, [editor])
  
  // Apply pending suggestion from chat (Cursor-like)
  const handleAcceptPendingSuggestion = useCallback(() => {
    if (!editor || !pendingSuggestion) return
    
    const { text, position } = pendingSuggestion
    
    editor
      .chain()
      .focus()
      .setTextSelection({ from: position.from, to: position.to })
      .deleteSelection()
      .insertContent(text)
      .run()
    
    acceptPendingSuggestion()
  }, [editor, pendingSuggestion, acceptPendingSuggestion])
  
  // Keyboard shortcuts
  useEffect(() => {
    if (!editor) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle pending suggestion shortcuts
      if (pendingSuggestion) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          handleAcceptPendingSuggestion()
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          rejectPendingSuggestion()
          return
        }
      }
      
      // Cmd+K for inline edit popup
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        
        const { from, to } = editor.state.selection
        if (from !== to) {
          const selectedText = editor.state.doc.textBetween(from, to)
          openInlineEdit(from, to, selectedText)
        }
      }
    }
    
    window.document.addEventListener('keydown', handleKeyDown)
    return () => window.document.removeEventListener('keydown', handleKeyDown)
  }, [editor, openInlineEdit, pendingSuggestion, handleAcceptPendingSuggestion, rejectPendingSuggestion])
  
  // Handle paste events for capture (with content length)
  useEffect(() => {
    if (!editor) return
    
    const handlePaste = (e: ClipboardEvent) => {
      const pastedText = e.clipboardData?.getData('text') || ''
      captureEvent('text_paste', {
        contentLength: pastedText.length,
        metadata: {
          // Don't store actual content for privacy, just metrics
          wordCount: pastedText.trim().split(/\s+/).filter(Boolean).length,
          hasFormatting: e.clipboardData?.types.includes('text/html'),
        }
      })
    }
    
    editor.view.dom.addEventListener('paste', handlePaste)
    return () => editor.view.dom.removeEventListener('paste', handlePaste)
  }, [editor, captureEvent])
  
  // Handle copy events (track potential external AI use)
  useEffect(() => {
    if (!editor) return
    
    const handleCopy = () => {
      const { from, to } = editor.state.selection
      const selectedText = editor.state.doc.textBetween(from, to)
      if (selectedText.length > 0) {
        captureEvent('text_copy', {
          contentLength: selectedText.length,
          metadata: {
            wordCount: selectedText.trim().split(/\s+/).filter(Boolean).length,
          }
        })
      }
    }
    
    editor.view.dom.addEventListener('copy', handleCopy)
    return () => editor.view.dom.removeEventListener('copy', handleCopy)
  }, [editor, captureEvent])
  
  // Handle focus/blur events (track time spent outside app)
  useEffect(() => {
    const handleFocusLost = () => {
      captureEvent('focus_lost')
    }
    
    const handleFocusGained = () => {
      captureEvent('focus_gained')
    }
    
    window.addEventListener('blur', handleFocusLost)
    window.addEventListener('focus', handleFocusGained)
    
    return () => {
      window.removeEventListener('blur', handleFocusLost)
      window.removeEventListener('focus', handleFocusGained)
    }
  }, [captureEvent])
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    text: string
    from: number
    to: number
  } | null>(null)
  
  // Find & Replace state
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [replaceTerm, setReplaceTerm] = useState('')
  const [searchResults, setSearchResults] = useState<{ from: number; to: number }[]>([])
  const [currentResultIndex, setCurrentResultIndex] = useState(0)
  const findInputRef = useRef<HTMLInputElement>(null)
  
  // Ctrl+F to open find, Ctrl+H to open find & replace
  useEffect(() => {
    const handleFindShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setShowFindReplace(true)
        setTimeout(() => findInputRef.current?.focus(), 50)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault()
        setShowFindReplace(true)
        setTimeout(() => findInputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape' && showFindReplace) {
        setShowFindReplace(false)
        setSearchTerm('')
        setReplaceTerm('')
        setSearchResults([])
      }
    }
    
    window.document.addEventListener('keydown', handleFindShortcut)
    return () => window.document.removeEventListener('keydown', handleFindShortcut)
  }, [showFindReplace])
  
  // Search for text when searchTerm changes
  useEffect(() => {
    if (!editor || !searchTerm) {
      setSearchResults([])
      setCurrentResultIndex(0)
      return
    }
    
    const doc = editor.state.doc
    const results: { from: number; to: number }[] = []
    const searchLower = searchTerm.toLowerCase()
    
    doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        const textLower = node.text.toLowerCase()
        let index = 0
        while ((index = textLower.indexOf(searchLower, index)) !== -1) {
          results.push({
            from: pos + index,
            to: pos + index + searchTerm.length
          })
          index += 1
        }
      }
    })
    
    setSearchResults(results)
    setCurrentResultIndex(0)
    
    // Highlight first result
    if (results.length > 0) {
      editor.chain().focus().setTextSelection(results[0]).run()
    }
  }, [searchTerm, editor])
  
  const findNext = () => {
    if (searchResults.length === 0) return
    const nextIndex = (currentResultIndex + 1) % searchResults.length
    setCurrentResultIndex(nextIndex)
    editor?.chain().focus().setTextSelection(searchResults[nextIndex]).run()
  }
  
  const findPrev = () => {
    if (searchResults.length === 0) return
    const prevIndex = currentResultIndex === 0 ? searchResults.length - 1 : currentResultIndex - 1
    setCurrentResultIndex(prevIndex)
    editor?.chain().focus().setTextSelection(searchResults[prevIndex]).run()
  }
  
  const replaceOne = () => {
    if (!editor || searchResults.length === 0) return
    const result = searchResults[currentResultIndex]
    editor.chain()
      .focus()
      .setTextSelection(result)
      .deleteSelection()
      .insertContent(replaceTerm)
      .run()
    // Re-trigger search
    setSearchTerm(prev => prev + ' ')
    setTimeout(() => setSearchTerm(searchTerm), 10)
  }
  
  const replaceAll = () => {
    if (!editor || searchResults.length === 0) return
    // Replace from end to start to preserve positions
    const sortedResults = [...searchResults].sort((a, b) => b.from - a.from)
    
    editor.chain().focus()
    for (const result of sortedResults) {
      editor.chain()
        .setTextSelection(result)
        .deleteSelection()
        .insertContent(replaceTerm)
        .run()
    }
    setSearchTerm('')
    setSearchResults([])
  }
  
  // Show context menu on right-click when text is selected
  useEffect(() => {
    if (!editor) return
    
    const handleContextMenu = (e: MouseEvent) => {
      const { from, to } = editor.state.selection
      const selectedText = editor.state.doc.textBetween(from, to)
      
      // Only show custom menu if text is selected (at least 2 chars)
      if (selectedText.length >= 2) {
        e.preventDefault()
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          text: selectedText,
          from,
          to
        })
      }
    }
    
    // Close context menu on click elsewhere
    const handleClickOutside = () => {
      setContextMenu(null)
    }
    
    editor.view.dom.addEventListener('contextmenu', handleContextMenu)
    window.document.addEventListener('click', handleClickOutside)
    
    return () => {
      editor.view.dom.removeEventListener('contextmenu', handleContextMenu)
      window.document.removeEventListener('click', handleClickOutside)
    }
  }, [editor])
  
  // Context menu actions
  const handleEditWithAI = () => {
    if (contextMenu) {
      setSelectedTextForChat(contextMenu.text, contextMenu.from, contextMenu.to)
      setContextMenu(null)
    }
  }
  
  const handleCopyFromMenu = () => {
    if (contextMenu) {
      navigator.clipboard.writeText(contextMenu.text)
      captureEvent('text_copy', {
        contentLength: contextMenu.text.length,
        metadata: { source: 'context_menu' }
      })
      setContextMenu(null)
    }
  }
  
  const handleCutFromMenu = () => {
    if (contextMenu && editor) {
      navigator.clipboard.writeText(contextMenu.text)
      captureEvent('text_cut', {
        contentLength: contextMenu.text.length,
        metadata: { source: 'context_menu' }
      })
      editor.chain().focus().deleteSelection().run()
      setContextMenu(null)
    }
  }
  
  if (!editor) {
    return (
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-700/50 p-8">
        <div className="flex items-center justify-center h-64 text-zinc-400">
          <div className="flex flex-col items-center gap-3">
            <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading editor...</span>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className={`relative ${className || ''}`}>
      {/* Find & Replace Panel */}
      {showFindReplace && (
        <div className="bg-zinc-800 border-b border-zinc-700 p-3 flex items-center gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <input
              ref={findInputRef}
              type="text"
              placeholder="Find..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') findNext()
              }}
              className="px-3 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-sm w-48 focus:outline-none focus:border-teal-500"
            />
            <input
              type="text"
              placeholder="Replace..."
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              className="px-3 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-sm w-48 focus:outline-none focus:border-teal-500"
            />
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={findPrev}
              className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200"
              title="Previous (Shift+Enter)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={findNext}
              className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200"
              title="Next (Enter)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          
          <span className="text-xs text-zinc-500">
            {searchResults.length > 0 
              ? `${currentResultIndex + 1} of ${searchResults.length}`
              : searchTerm ? 'No results' : ''}
          </span>
          
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={replaceOne}
              disabled={searchResults.length === 0}
              className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Replace
            </button>
            <button
              onClick={replaceAll}
              disabled={searchResults.length === 0}
              className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Replace All
            </button>
          </div>
          
          <button
            onClick={() => {
              setShowFindReplace(false)
              setSearchTerm('')
              setReplaceTerm('')
              setSearchResults([])
            }}
            className="ml-auto p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      
      {/* Toolbar */}
      <EditorToolbar editor={editor} />
      
      {/* Pending Suggestion Bar */}
      {pendingSuggestion && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg mx-2 mt-2 overflow-hidden animate-fade-in">
          <div className="px-4 py-2 border-b border-amber-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="text-sm font-medium text-amber-300">AI Suggestion</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={rejectPendingSuggestion}
                className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={handleAcceptPendingSuggestion}
                className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Accept
              </button>
            </div>
          </div>
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-xs text-rose-400 font-medium w-16 flex-shrink-0 pt-0.5">Original:</span>
              <div className="text-sm text-rose-300/70 line-through">{pendingSuggestion.originalText}</div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs text-emerald-400 font-medium w-16 flex-shrink-0 pt-0.5">Replace:</span>
              <div className="text-sm text-emerald-300">{pendingSuggestion.text}</div>
            </div>
          </div>
          <div className="px-4 py-2 bg-zinc-800/50 text-xs text-zinc-500">
            <kbd className="px-1 bg-zinc-700 rounded">Enter</kbd> to accept · <kbd className="px-1 bg-zinc-700 rounded">Esc</kbd> to reject
          </div>
        </div>
      )}
      
      {/* Editor Content */}
      <div className="bg-zinc-900/50 rounded-b-xl border border-t-0 border-zinc-700/50 min-h-[500px]">
        <EditorContent editor={editor} />
      </div>
      
      {/* Context Menu (right-click on selected text) */}
      {contextMenu && (
        <div 
          className="fixed bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl py-1 z-50 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleEditWithAI}
            className="w-full px-4 py-2.5 text-left text-sm hover:bg-amber-600/20 text-amber-400 flex items-center gap-3 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit with AI
          </button>
          <div className="h-px bg-zinc-700 my-1" />
          <button
            onClick={handleCopyFromMenu}
            className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-700 text-zinc-300 flex items-center gap-3"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy
          </button>
          <button
            onClick={handleCutFromMenu}
            className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-700 text-zinc-300 flex items-center gap-3"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
            </svg>
            Cut
          </button>
        </div>
      )}
      
      {/* Writing Stats */}
      {settings.showWordCount && (
        <div className="absolute bottom-4 right-4 flex items-center gap-4 text-xs text-zinc-500">
          {/* Word count */}
          <span>
            {editor.storage.characterCount.words()} words
          </span>
          
          {/* Time elapsed */}
          {sessionStartTime > 0 && (
            <span className="text-zinc-600">
              {Math.floor((Date.now() - sessionStartTime) / 60000)}m
            </span>
          )}
          
          {/* Paste ratio indicator (shows if significant paste) */}
          {metrics.totalCharactersPasted > 50 && (
            <span 
              className="text-amber-500/70"
              title={`${metrics.totalCharactersPasted} characters pasted, ${metrics.totalCharactersTyped} typed`}
            >
              {Math.round((metrics.totalCharactersPasted / (metrics.totalCharactersPasted + metrics.totalCharactersTyped + 1)) * 100)}% pasted
            </span>
          )}
          
          {/* AI usage */}
          {metrics.aiRequestCount > 0 && (
            <span 
              className="text-teal-500/70"
              title={`${metrics.aiAcceptCount}/${metrics.aiRequestCount} AI suggestions accepted`}
            >
              AI: {metrics.aiAcceptCount}/{metrics.aiRequestCount}
            </span>
          )}
        </div>
      )}
      
      {/* Inline Edit Popup */}
      {inlineEditOpen && editor && (
        <InlineEditPopup 
          editor={editor}
          onApply={applyInlineSuggestion}
        />
      )}
    </div>
  )
}

// ============================================
// Editor Toolbar
// ============================================

interface ToolbarProps {
  editor: TipTapEditor
}

function EditorToolbar({ editor }: ToolbarProps) {
  const ToolbarButton = ({ 
    onClick, 
    isActive, 
    children, 
    title 
  }: { 
    onClick: () => void
    isActive?: boolean
    children: React.ReactNode
    title: string
  }) => (
    <button
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg transition-colors ${
        isActive 
          ? 'bg-teal-500/20 text-teal-400' 
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
      }`}
    >
      {children}
    </button>
  )
  
  return (
    <div className="flex items-center gap-1 p-2 bg-zinc-800/80 rounded-t-xl border border-zinc-700/50">
      {/* Text Style */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold (Cmd+B)"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      </ToolbarButton>
      
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic (Cmd+I)"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <line x1="19" y1="4" x2="10" y2="4" stroke="currentColor" strokeWidth="2"/>
          <line x1="14" y1="20" x2="5" y2="20" stroke="currentColor" strokeWidth="2"/>
          <line x1="15" y1="4" x2="9" y2="20" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </ToolbarButton>
      
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Underline (Cmd+U)"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/>
          <line x1="4" y1="21" x2="20" y2="21"/>
        </svg>
      </ToolbarButton>
      
      <div className="w-px h-6 bg-zinc-700 mx-1" />
      
      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <span className="text-sm font-bold">H1</span>
      </ToolbarButton>
      
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <span className="text-sm font-bold">H2</span>
      </ToolbarButton>
      
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <span className="text-sm font-bold">H3</span>
      </ToolbarButton>
      
      <div className="w-px h-6 bg-zinc-700 mx-1" />
      
      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="9" y1="6" x2="20" y2="6"/>
          <line x1="9" y1="12" x2="20" y2="12"/>
          <line x1="9" y1="18" x2="20" y2="18"/>
          <circle cx="4" cy="6" r="1" fill="currentColor"/>
          <circle cx="4" cy="12" r="1" fill="currentColor"/>
          <circle cx="4" cy="18" r="1" fill="currentColor"/>
        </svg>
      </ToolbarButton>
      
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="10" y1="6" x2="20" y2="6"/>
          <line x1="10" y1="12" x2="20" y2="12"/>
          <line x1="10" y1="18" x2="20" y2="18"/>
          <text x="3" y="8" fontSize="8" fill="currentColor" stroke="none">1</text>
          <text x="3" y="14" fontSize="8" fill="currentColor" stroke="none">2</text>
          <text x="3" y="20" fontSize="8" fill="currentColor" stroke="none">3</text>
        </svg>
      </ToolbarButton>
      
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Quote"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>
        </svg>
      </ToolbarButton>
      
      <ToolbarButton
        onClick={() => {
          const url = window.prompt('Enter URL:')
          if (url) {
            editor.chain().focus().setLink({ href: url }).run()
          }
        }}
        isActive={editor.isActive('link')}
        title="Insert Link (Cmd+K on selected text)"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      </ToolbarButton>
      
      <div className="w-px h-6 bg-zinc-700 mx-1" />
      
      {/* Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title="Align Left"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="15" y2="12"/>
          <line x1="3" y1="18" x2="18" y2="18"/>
        </svg>
      </ToolbarButton>
      
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title="Align Center"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="6" y1="12" x2="18" y2="12"/>
          <line x1="4" y1="18" x2="20" y2="18"/>
        </svg>
      </ToolbarButton>
      
      <div className="flex-1" />
      
      {/* Shortcut Hints */}
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-zinc-700 rounded text-zinc-400">⌘F</kbd>
          <span>Find</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-zinc-700 rounded text-zinc-400">⌘K</kbd>
          <span>AI Edit</span>
        </span>
      </div>
    </div>
  )
}

