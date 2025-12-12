/**
 * Inline Edit Popup
 * 
 * Cursor-style Cmd+K interface for inline AI editing.
 * Shows selected text, allows instruction input, displays suggestion.
 */

import { useState, useEffect, useRef } from 'react'
import { Editor } from '@tiptap/react'
import { useWriterStore } from '../../stores/writer-store'

interface InlineEditPopupProps {
  editor: Editor
  onApply: (suggestion: string, from: number, to: number) => void
}

export function InlineEditPopup({ editor, onApply }: InlineEditPopupProps) {
  const {
    inlineEditPosition,
    inlineEditSelectedText,
    inlineEditInstruction,
    inlineEditSuggestion,
    isAiThinking,
    aiError,
    setInlineInstruction,
    generateInlineSuggestion,
    acceptInlineSuggestion,
    rejectInlineSuggestion,
    closeInlineEdit,
  } = useWriterStore()
  
  const inputRef = useRef<HTMLInputElement>(null)
  const [showDiff, setShowDiff] = useState(false)
  
  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeInlineEdit()
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (inlineEditSuggestion && inlineEditPosition) {
          const suggestion = acceptInlineSuggestion()
          onApply(suggestion, inlineEditPosition.from, inlineEditPosition.to)
        } else if (inlineEditInstruction) {
          generateInlineSuggestion()
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [inlineEditSuggestion, inlineEditInstruction, inlineEditPosition])
  
  const handleGenerate = () => {
    if (inlineEditInstruction) {
      generateInlineSuggestion()
    }
  }
  
  const handleAccept = () => {
    if (inlineEditSuggestion && inlineEditPosition) {
      const suggestion = acceptInlineSuggestion()
      onApply(suggestion, inlineEditPosition.from, inlineEditPosition.to)
    }
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-zinc-900 rounded-xl border border-zinc-700 shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <span className="font-medium text-zinc-100">AI Edit</span>
          </div>
          <button
            onClick={closeInlineEdit}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Selected Text */}
        <div className="px-4 py-3 bg-zinc-800/50">
          <div className="text-xs text-zinc-500 mb-1">Selected text:</div>
          <div className="text-sm text-zinc-300 italic max-h-24 overflow-y-auto">
            "{inlineEditSelectedText}"
          </div>
        </div>
        
        {/* Instruction Input */}
        <div className="px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inlineEditInstruction}
              onChange={(e) => setInlineInstruction(e.target.value)}
              placeholder="What would you like to change? (e.g., 'make it more formal', 'add more detail')"
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
              disabled={isAiThinking}
            />
            <button
              onClick={handleGenerate}
              disabled={!inlineEditInstruction || isAiThinking}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isAiThinking ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Generate</span>
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Suggestion */}
        {(inlineEditSuggestion || isAiThinking) && (
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-zinc-500">AI Suggestion:</div>
              {inlineEditSuggestion && (
                <button
                  onClick={() => setShowDiff(!showDiff)}
                  className="text-xs text-teal-400 hover:text-teal-300"
                >
                  {showDiff ? 'Hide diff' : 'Show diff'}
                </button>
              )}
            </div>
            
            {showDiff ? (
              <div className="space-y-2">
                <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded text-sm text-rose-300 line-through">
                  {inlineEditSelectedText}
                </div>
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded text-sm text-emerald-300">
                  {inlineEditSuggestion}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-zinc-800/50 rounded-lg text-sm text-zinc-200 min-h-[60px]">
                {inlineEditSuggestion || (
                  <span className="text-zinc-500">Waiting for AI...</span>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Error */}
        {aiError && (
          <div className="px-4 py-2 bg-rose-500/10 text-rose-400 text-sm">
            {aiError}
          </div>
        )}
        
        {/* Actions */}
        {inlineEditSuggestion && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
            <button
              onClick={rejectInlineSuggestion}
              className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={() => {
                setInlineInstruction('')
                useWriterStore.setState({ inlineEditSuggestion: '' })
              }}
              className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={handleAccept}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Accept
            </button>
          </div>
        )}
        
        {/* Keyboard shortcuts hint */}
        <div className="px-4 py-2 bg-zinc-800/30 text-xs text-zinc-500 flex items-center justify-center gap-4">
          <span><kbd className="px-1 bg-zinc-700 rounded">Enter</kbd> to generate/accept</span>
          <span><kbd className="px-1 bg-zinc-700 rounded">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  )
}




