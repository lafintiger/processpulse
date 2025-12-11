import { useEffect, useRef } from 'react'
import type { ParsedChatHistory } from '../types'

interface ChatViewerProps {
  chatHistory: ParsedChatHistory
  highlightedExchange: number | null
  onClose: () => void
}

export function ChatViewer({ chatHistory, highlightedExchange, onClose }: ChatViewerProps) {
  const highlightedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightedExchange])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div>
            <h3 className="font-semibold text-zinc-100">Chat History</h3>
            <p className="text-sm text-zinc-500">
              {chatHistory.total_exchanges} exchanges from {chatHistory.platform}
              {chatHistory.conversation_name && ` - "${chatHistory.conversation_name}"`}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Chat Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatHistory.exchanges.map((exchange) => (
            <div
              key={exchange.number}
              ref={exchange.number === highlightedExchange ? highlightedRef : null}
              className={`space-y-3 p-4 rounded-xl transition-all ${
                exchange.number === highlightedExchange 
                  ? 'bg-teal-500/10 border-2 border-teal-500/50 ring-4 ring-teal-500/20' 
                  : 'bg-zinc-800/30'
              }`}
            >
              {/* Exchange Number Badge */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                  exchange.number === highlightedExchange 
                    ? 'bg-teal-500 text-white' 
                    : 'bg-zinc-700 text-zinc-400'
                }`}>
                  [CHAT:{exchange.number}]
                </span>
                {exchange.timestamp && (
                  <span className="text-xs text-zinc-500">{exchange.timestamp}</span>
                )}
              </div>
              
              {/* Student Prompt */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-amber-400 mb-1">Student</div>
                  <div className="text-zinc-200 text-sm whitespace-pre-wrap">{exchange.student_prompt}</div>
                </div>
              </div>
              
              {/* AI Response */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-teal-400 mb-1">
                    AI {exchange.model_name && <span className="text-zinc-500">({exchange.model_name})</span>}
                  </div>
                  <div className="text-zinc-300 text-sm whitespace-pre-wrap">{exchange.ai_response}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-between">
          <div className="text-sm text-zinc-500">
            {chatHistory.parsing_notes.length > 0 && (
              <span>Note: {chatHistory.parsing_notes[0]}</span>
            )}
          </div>
          <button onClick={onClose} className="btn-secondary py-2">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
