/**
 * Search Panel Component
 * 
 * Perplexica-powered web search for research while writing.
 * Students can search the web and insert results into their document/chat.
 */

import { useState } from 'react'
import { useWriterStore } from '../../stores/writer-store'
import type { PerplexicaFocusMode, PerplexicaSource } from '../../lib/ai-providers'

const focusModes: { id: PerplexicaFocusMode; label: string; icon: string }[] = [
  { id: 'webSearch', label: 'Web', icon: '🌐' },
  { id: 'academicSearch', label: 'Academic', icon: '📚' },
  { id: 'youtubeSearch', label: 'YouTube', icon: '▶️' },
  { id: 'redditSearch', label: 'Reddit', icon: '💬' },
  { id: 'wolframAlphaSearch', label: 'Wolfram', icon: '🔢' },
]

interface SearchPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function SearchPanel({ isOpen, onClose }: SearchPanelProps) {
  const {
    searchQuery,
    setSearchQuery,
    searchFocusMode,
    setSearchFocusMode,
    searchResults,
    searchSources,
    isSearching,
    searchError,
    perplexicaAvailable,
    performSearch,
    clearSearchResults,
    insertSearchResultToChat,
  } = useWriterStore()
  
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set())
  
  if (!isOpen) return null
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    performSearch()
  }
  
  const toggleSource = (index: number) => {
    setExpandedSources(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }
  
  const handleInsertToChat = () => {
    if (searchResults) {
      insertSearchResultToChat(searchResults.message, searchSources)
    }
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Web Search</h2>
              <p className="text-xs text-zinc-500">Powered by Perplexica</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Connection Status */}
        {!perplexicaAvailable && (
          <div className="px-6 py-3 bg-rose-500/10 border-b border-rose-500/20">
            <div className="flex items-center gap-2 text-sm text-rose-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Perplexica not connected. Make sure it's running at localhost:3000</span>
            </div>
          </div>
        )}
        
        {/* Search Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 border-b border-zinc-800">
          {/* Focus Mode Tabs */}
          <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
            {focusModes.map(mode => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setSearchFocusMode(mode.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  searchFocusMode === mode.id
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <span className="mr-1.5">{mode.icon}</span>
                {mode.label}
              </button>
            ))}
          </div>
          
          {/* Search Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search the web for information..."
              className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={isSearching || !perplexicaAvailable}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {isSearching ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Searching...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search
                </>
              )}
            </button>
          </div>
        </form>
        
        {/* Error Message */}
        {searchError && (
          <div className="px-6 py-3 bg-rose-500/10">
            <p className="text-sm text-rose-400">{searchError}</p>
          </div>
        )}
        
        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {searchResults ? (
            <div className="space-y-4">
              {/* Answer */}
              <div className="prose prose-invert prose-sm max-w-none">
                <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                  <div className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI Summary
                  </div>
                  <div className="text-zinc-200 whitespace-pre-wrap leading-relaxed">
                    {searchResults.message}
                  </div>
                </div>
              </div>
              
              {/* Sources */}
              {searchSources.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Sources ({searchSources.length})
                  </h3>
                  <div className="space-y-2">
                    {searchSources.map((source, index) => (
                      <SourceCard
                        key={index}
                        source={source}
                        index={index}
                        isExpanded={expandedSources.has(index)}
                        onToggle={() => toggleSource(index)}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t border-zinc-800">
                <button
                  onClick={handleInsertToChat}
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Add to Chat
                </button>
                <button
                  onClick={clearSearchResults}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : !isSearching && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-zinc-800 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-zinc-500 mb-2">Search the web for information</p>
              <p className="text-sm text-zinc-600">Results will be shown here with sources</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Source Card Component
function SourceCard({ 
  source, 
  index, 
  isExpanded, 
  onToggle 
}: { 
  source: PerplexicaSource
  index: number
  isExpanded: boolean
  onToggle: () => void 
}) {
  return (
    <div className="bg-zinc-800/50 rounded-lg border border-zinc-700/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-start gap-3 text-left hover:bg-zinc-700/30 transition-colors"
      >
        <span className="flex-shrink-0 w-5 h-5 bg-zinc-700 rounded text-xs flex items-center justify-center text-zinc-400">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-zinc-300 font-medium truncate">
            {source.metadata.title || 'Untitled'}
          </div>
          <div className="text-xs text-zinc-500 truncate">
            {source.metadata.url}
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-zinc-700/50">
          <p className="text-sm text-zinc-400 leading-relaxed">
            {source.pageContent}
          </p>
          <a
            href={source.metadata.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs text-indigo-400 hover:text-indigo-300"
          >
            Open link
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}
    </div>
  )
}



