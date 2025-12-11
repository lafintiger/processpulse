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
import { useEffect, useCallback, useRef } from 'react'
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
    ],
    content: writerDocument?.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[400px] px-8 py-6',
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
        captureEvent('text_select', {
          position: { from, to },
          content: editor.state.doc.textBetween(from, to),
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
  
  // Keyboard shortcuts
  useEffect(() => {
    if (!editor) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K for inline edit
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
  }, [editor, openInlineEdit])
  
  // Handle paste events for capture
  useEffect(() => {
    if (!editor) return
    
    const handlePaste = () => {
      captureEvent('text_paste')
    }
    
    editor.view.dom.addEventListener('paste', handlePaste)
    return () => editor.view.dom.removeEventListener('paste', handlePaste)
  }, [editor, captureEvent])
  
  // Apply inline edit suggestion
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
      {/* Toolbar */}
      <EditorToolbar editor={editor} />
      
      {/* Editor Content */}
      <div className="bg-zinc-900/50 rounded-b-xl border border-t-0 border-zinc-700/50 min-h-[500px]">
        <EditorContent editor={editor} />
      </div>
      
      {/* Word Count */}
      {settings.showWordCount && (
        <div className="absolute bottom-4 right-4 text-xs text-zinc-500">
          {editor.storage.characterCount.words()} words
          {' · '}
          {editor.storage.characterCount.characters()} characters
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
      
      {/* AI Shortcut Hint */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span>Select text +</span>
        <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-zinc-400">⌘K</kbd>
        <span>for AI edit</span>
      </div>
    </div>
  )
}

