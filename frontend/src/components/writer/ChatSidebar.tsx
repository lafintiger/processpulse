/**
 * Chat Sidebar
 * 
 * AI chat interface for broader writing assistance.
 * Students can ask questions, get feedback, and brainstorm.
 */

import { useState, useRef, useEffect } from 'react'
import { useWriterStore } from '../../stores/writer-store'

interface ChatSidebarProps {
  className?: string
}

export function ChatSidebar({ className }: ChatSidebarProps) {
  const {
    chatMessages,
    isAiThinking,
    aiError,
    sendMessage,
    clearChat,
    providerStatus,
    selectedTextForChat,
    clearSelectedTextForChat,
    pendingSuggestion,
  } = useWriterStore()
  
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  // Focus input when selected text changes
  useEffect(() => {
    if (selectedTextForChat) {
      inputRef.current?.focus()
    }
  }, [selectedTextForChat])
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isAiThinking) return
    
    sendMessage(input.trim())
    setInput('')
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }
  
  // Quick prompts
  const quickPrompts = [
    { label: 'Strengthen argument', prompt: 'How can I make my argument stronger?' },
    { label: 'Check clarity', prompt: 'Is my writing clear and easy to understand?' },
    { label: 'Counter arguments', prompt: 'What are the main counter-arguments to my position?' },
    { label: 'Improve intro', prompt: 'How can I make my introduction more engaging?' },
  ]
  
  return (
    <div className={`flex flex-col h-full bg-zinc-900/80 ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            providerStatus === 'connected' ? 'bg-emerald-500' : 
            providerStatus === 'checking' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
          }`} />
          <span className="font-medium text-zinc-100">AI Assistant</span>
        </div>
        {chatMessages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear chat
          </button>
        )}
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-teal-500/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-zinc-400 text-sm mb-4">
              Ask me anything about your writing!
            </p>
            
            {/* Quick Prompts */}
            <div className="space-y-2">
              {quickPrompts.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(qp.prompt)}
                  className="block w-full px-3 py-2 text-left text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-lg transition-colors"
                >
                  {qp.label} →
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${
                  msg.role === 'user' 
                    ? 'bg-amber-500/20' 
                    : 'bg-teal-500/20'
                }`}>
                  {msg.role === 'user' ? (
                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  )}
                </div>
                
                <div className={`flex-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                  {msg.selectedText && (
                    <div className="text-xs text-zinc-500 mb-1 italic">
                      Re: "{msg.selectedText.slice(0, 50)}..."
                    </div>
                  )}
                  <div className={`inline-block px-3 py-2 rounded-xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-amber-500/20 text-amber-100'
                      : 'bg-zinc-800 text-zinc-200'
                  }`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            
            {isAiThinking && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-teal-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="flex items-center gap-1 px-3 py-2 bg-zinc-800 rounded-xl">
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      {/* Error */}
      {aiError && (
        <div className="px-4 py-2 bg-rose-500/10 text-rose-400 text-sm">
          {aiError}
        </div>
      )}
      
      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-zinc-800">
        {/* Selected text indicator */}
        {selectedTextForChat && (
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-amber-400 font-medium mb-1">Editing selected text:</div>
                <div className="text-sm text-amber-200/80 italic line-clamp-2">
                  "{selectedTextForChat.text.slice(0, 100)}{selectedTextForChat.text.length > 100 ? '...' : ''}"
                </div>
              </div>
              <button
                type="button"
                onClick={clearSelectedTextForChat}
                className="p-1 text-amber-400/60 hover:text-amber-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        
        <div className="p-4 pt-2">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedTextForChat ? "What change would you like? (e.g., 'make it more formal')" : "Ask about your writing..."}
              rows={2}
              className={`flex-1 px-3 py-2 border rounded-lg text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/50 ${
                selectedTextForChat 
                  ? 'bg-amber-500/5 border-amber-500/30 focus:border-amber-500' 
                  : 'bg-zinc-800 border-zinc-700 focus:border-teal-500'
              }`}
              disabled={isAiThinking || providerStatus !== 'connected'}
            />
            <button
              type="submit"
              disabled={!input.trim() || isAiThinking || providerStatus !== 'connected'}
              className={`px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                selectedTextForChat
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-teal-600 hover:bg-teal-500 text-white'
              }`}
            >
              {selectedTextForChat ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
          <div className="text-xs text-zinc-500 mt-2">
            {selectedTextForChat 
              ? 'Enter to apply edit • Esc to cancel'
              : 'Enter to send • Select text in editor to edit it'
            }
          </div>
        </div>
      </form>
    </div>
  )
}

