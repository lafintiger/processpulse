/**
 * Writer Page
 * 
 * Main writing interface that combines:
 * - TipTap editor
 * - AI chat sidebar
 * - Document management
 * - Process capture
 */

import { useState, useEffect } from 'react'
import { useWriterStore } from '../../stores/writer-store'
import { Editor } from './Editor'
import { ChatSidebar } from './ChatSidebar'
import { SettingsPanel } from './SettingsPanel'
import { SearchPanel } from './SearchPanel'
import { exportToDocx, exportToTxt, exportToHtml } from '../../lib/export-utils'

export function WriterPage() {
  const {
    document,
    documents,
    createDocument,
    loadDocument,
    deleteDocument,
    saveDocument,
    endSession,
    initializeProvider,
    providerStatus,
    settings,
    events,
    saveSessionToBackend,
    searchOpen,
    openSearch,
    closeSearch,
    perplexicaAvailable,
  } = useWriterStore()
  
  const [showSettings, setShowSettings] = useState(false)
  const [showDocList, setShowDocList] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocContext, setNewDocContext] = useState('')
  const [showNewDocModal, setShowNewDocModal] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showWelcome, setShowWelcome] = useState(() => {
    return !localStorage.getItem('processpulse_welcomed')
  })
  
  // Initialize AI provider on mount
  useEffect(() => {
    initializeProvider()
  }, [])
  
  // Auto-save
  useEffect(() => {
    if (!settings.autoSave || !document) return
    
    const interval = setInterval(() => {
      saveDocument()
      setLastSaved(new Date())
    }, settings.autoSaveInterval * 1000)
    
    return () => clearInterval(interval)
  }, [settings.autoSave, settings.autoSaveInterval, document])
  
  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowExportMenu(false)
    if (showExportMenu) {
      window.document.addEventListener('click', handleClickOutside)
      return () => window.document.removeEventListener('click', handleClickOutside)
    }
  }, [showExportMenu])
  
  // Keyboard shortcut for help (Ctrl+/)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        setShowShortcuts(prev => !prev)
      }
    }
    window.document.addEventListener('keydown', handleKeyDown)
    return () => window.document.removeEventListener('keydown', handleKeyDown)
  }, [])
  
  // Save on unmount
  useEffect(() => {
    return () => {
      endSession()
    }
  }, [])
  
  const handleCreateDocument = () => {
    const title = newDocTitle.trim() || 'Untitled Document'
    createDocument(title, newDocContext.trim() || undefined)
    setNewDocTitle('')
    setNewDocContext('')
    setShowNewDocModal(false)
  }
  
  // Export handlers
  const handleExportDocx = async () => {
    if (!document) return
    setShowExportMenu(false)
    await exportToDocx(document.title, document.content)
  }
  
  const handleExportTxt = () => {
    if (!document) return
    setShowExportMenu(false)
    exportToTxt(document.title, document.content)
  }
  
  const handleExportHtml = () => {
    if (!document) return
    setShowExportMenu(false)
    exportToHtml(document.title, document.content)
  }
  
  const handleExportSession = async () => {
    if (!document) return
    setShowExportMenu(false)
    
    // Save to backend first
    await saveSessionToBackend()
    
    // Then export locally as backup
    const exportData = {
      document: {
        id: document.id,
        title: document.title,
        content: document.content,
        wordCount: document.wordCount,
        assignmentContext: document.assignmentContext,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      },
      events: events.filter(e => e.sessionId === useWriterStore.getState().sessionId),
      exportedAt: new Date().toISOString(),
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = window.document.createElement('a')
    a.href = url
    a.download = `${document.title.replace(/\s+/g, '_')}_session.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  // Show welcome screen if no document
  if (!document) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-zinc-100 mb-2">ProcessPulse Writer</h1>
            <p className="text-zinc-400">AI-assisted writing with full process capture</p>
          </div>
          
          {/* Actions */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* New Document */}
            <button
              onClick={() => setShowNewDocModal(true)}
              className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-teal-500/50 transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center mb-3 group-hover:bg-teal-500/20 transition-colors">
                <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 className="font-medium text-zinc-100 mb-1">New Document</h3>
              <p className="text-sm text-zinc-500">Start a new writing project</p>
            </button>
            
            {/* Recent Documents */}
            <button
              onClick={() => setShowDocList(true)}
              className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center mb-3 group-hover:bg-zinc-700 transition-colors">
                <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-medium text-zinc-100 mb-1">Recent Documents</h3>
              <p className="text-sm text-zinc-500">{documents.length} saved documents</p>
            </button>
          </div>
          
          {/* Settings */}
          <div className="mt-8 text-center">
            <button
              onClick={() => setShowSettings(true)}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Configure AI Settings →
            </button>
          </div>
          
          {/* New Document Modal */}
          {showNewDocModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
              <div className="w-full max-w-md bg-zinc-900 rounded-xl border border-zinc-700 p-6">
                <h2 className="text-lg font-semibold text-zinc-100 mb-4">New Document</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Title</label>
                    <input
                      type="text"
                      value={newDocTitle}
                      onChange={(e) => setNewDocTitle(e.target.value)}
                      placeholder="My Essay"
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                      autoFocus
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Assignment Context (optional)</label>
                    <textarea
                      value={newDocContext}
                      onChange={(e) => setNewDocContext(e.target.value)}
                      placeholder="Paste the assignment prompt or describe what you're writing..."
                      rows={3}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={() => setShowNewDocModal(false)}
                    className="px-4 py-2 text-zinc-400 hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateDocument}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Document List Modal */}
          {showDocList && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
              <div className="w-full max-w-md bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                  <h2 className="text-lg font-semibold text-zinc-100">Documents</h2>
                  <button onClick={() => setShowDocList(false)} className="text-zinc-500 hover:text-zinc-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="max-h-80 overflow-y-auto">
                  {documents.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500">
                      No documents yet
                    </div>
                  ) : (
                    documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between px-6 py-3 hover:bg-zinc-800/50 border-b border-zinc-800 last:border-0"
                      >
                        <button
                          onClick={() => { loadDocument(doc.id); setShowDocList(false) }}
                          className="flex-1 text-left"
                        >
                          <div className="font-medium text-zinc-200">{doc.title}</div>
                          <div className="text-xs text-zinc-500">
                            {doc.wordCount} words · {new Date(doc.updatedAt).toLocaleDateString()}
                          </div>
                        </button>
                        <button
                          onClick={() => deleteDocument(doc.id)}
                          className="p-2 text-zinc-600 hover:text-rose-400"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        
        <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
      </div>
    )
  }
  
  // Main editor view
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#09090b', color: '#e4e4e7' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          {/* Back Button */}
          <button
            onClick={() => { saveDocument(); useWriterStore.setState({ document: null }) }}
            className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Back to documents"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          
          {/* Document Title */}
          <div>
            <h1 className="font-medium text-zinc-100">{document.title}</h1>
            <div className="text-xs text-zinc-500 flex items-center gap-2">
              <span>{document.wordCount} words</span>
              <span>·</span>
              {lastSaved ? (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : (
                <span>Auto-save enabled</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Provider Status */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
            providerStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400' :
            providerStatus === 'checking' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              providerStatus === 'connected' ? 'bg-emerald-500' :
              providerStatus === 'checking' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
            }`} />
            {settings.providerType === 'ollama' ? 'Local AI' :
             settings.providerType === 'openai' ? 'OpenAI' : 'Claude'}
          </div>
          
          {/* Web Search Button */}
          <button
            onClick={openSearch}
            className={`p-2 transition-colors flex items-center gap-1 ${
              perplexicaAvailable 
                ? 'text-zinc-500 hover:text-indigo-400' 
                : 'text-zinc-700 cursor-not-allowed'
            }`}
            title={perplexicaAvailable ? 'Web Search (Perplexica)' : 'Perplexica not available'}
            disabled={!perplexicaAvailable}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          
          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu) }}
              className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
              title="Export document"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 z-50">
                <div className="px-3 py-1.5 text-xs text-zinc-500 border-b border-zinc-700">
                  Export Document
                </div>
                <button
                  onClick={handleExportDocx}
                  className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8 17v-2h8v2H8zm0-4v-2h8v2H8z"/>
                  </svg>
                  Word Document (.docx)
                </button>
                <button
                  onClick={handleExportTxt}
                  className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8 17v-2h8v2H8zm0-4v-2h8v2H8z"/>
                  </svg>
                  Plain Text (.txt)
                </button>
                <button
                  onClick={handleExportHtml}
                  className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4z"/>
                  </svg>
                  HTML File (.html)
                </button>
                <div className="border-t border-zinc-700 my-1"></div>
                <div className="px-3 py-1.5 text-xs text-zinc-500">
                  For Assessment
                </div>
                <button
                  onClick={handleExportSession}
                  className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8 17v-1h2v1H8zm0-3v-1h4v1H8zm0-3V9h6v2H8z"/>
                  </svg>
                  Session + Events (.json)
                </button>
              </div>
            )}
          </div>
          
          {/* Toggle Sidebar */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2 transition-colors ${sidebarOpen ? 'text-teal-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            title={sidebarOpen ? 'Hide chat' : 'Show chat'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          
          {/* Help / Shortcuts */}
          <button
            onClick={() => setShowShortcuts(true)}
            className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Keyboard shortcuts (Ctrl+/)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          
          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className={`flex-1 overflow-y-auto p-6 ${sidebarOpen ? 'pr-0' : ''}`}>
          <div className="max-w-4xl mx-auto">
            {/* Assignment Context */}
            {document.assignmentContext && (
              <div className="mb-4 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                <div className="text-xs text-zinc-500 mb-1">Assignment:</div>
                <div className="text-sm text-zinc-300">{document.assignmentContext}</div>
              </div>
            )}
            
            <Editor />
          </div>
        </div>
        
        {/* Chat Sidebar */}
        {sidebarOpen && (
          <div className="w-96 border-l border-zinc-800 flex-shrink-0">
            <ChatSidebar className="h-full" />
          </div>
        )}
      </div>
      
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
      
      {/* Search Panel (Perplexica) */}
      <SearchPanel isOpen={searchOpen} onClose={closeSearch} />
      
      {/* Welcome Modal (first time) */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-teal-500 to-amber-500 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-zinc-100 mb-2">Welcome to ProcessPulse!</h2>
              <p className="text-zinc-400 mb-6">
                Write with AI assistance while we capture your thinking process.
              </p>
            </div>
            
            <div className="px-6 pb-6 space-y-3">
              <div className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg">
                <div className="w-8 h-8 flex-shrink-0 bg-teal-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="text-sm">
                  <div className="font-medium text-zinc-200">Chat with AI</div>
                  <div className="text-zinc-500">Use the sidebar to brainstorm and get feedback</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg">
                <div className="w-8 h-8 flex-shrink-0 bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <div className="text-sm">
                  <div className="font-medium text-zinc-200">Edit with AI</div>
                  <div className="text-zinc-500">Select text → Right-click → "Edit with AI"</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg">
                <div className="w-8 h-8 flex-shrink-0 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="text-sm">
                  <div className="font-medium text-zinc-200">Web Search</div>
                  <div className="text-zinc-500">Click the search icon to research online</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg">
                <div className="w-8 h-8 flex-shrink-0 bg-rose-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-sm">
                  <div className="font-medium text-zinc-200">Process is Captured</div>
                  <div className="text-zinc-500">Your thinking process is recorded for assessment</div>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-zinc-800">
              <button
                onClick={() => {
                  localStorage.setItem('processpulse_welcomed', 'true')
                  setShowWelcome(false)
                }}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 rounded-lg font-medium transition-colors"
              >
                Got it, let's write!
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-100">Keyboard Shortcuts</h2>
              <button onClick={() => setShowShortcuts(false)} className="text-zinc-500 hover:text-zinc-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-96 overflow-y-auto">
              {/* Formatting */}
              <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-3">Formatting</h3>
                <div className="space-y-2">
                  <ShortcutRow keys={['Ctrl', 'B']} description="Bold" />
                  <ShortcutRow keys={['Ctrl', 'I']} description="Italic" />
                  <ShortcutRow keys={['Ctrl', 'U']} description="Underline" />
                </div>
              </div>
              
              {/* Editing */}
              <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-3">Editing</h3>
                <div className="space-y-2">
                  <ShortcutRow keys={['Ctrl', 'Z']} description="Undo" />
                  <ShortcutRow keys={['Ctrl', 'Shift', 'Z']} description="Redo" />
                  <ShortcutRow keys={['Ctrl', 'F']} description="Find" />
                  <ShortcutRow keys={['Ctrl', 'H']} description="Find & Replace" />
                </div>
              </div>
              
              {/* AI Features */}
              <div>
                <h3 className="text-sm font-medium text-amber-400 mb-3">AI Features</h3>
                <div className="space-y-2">
                  <ShortcutRow keys={['Ctrl', 'K']} description="Edit selection with AI" highlight />
                  <ShortcutRow keys={['Right-click']} description="Context menu (Edit with AI)" />
                </div>
              </div>
              
              {/* Navigation */}
              <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-3">Other</h3>
                <div className="space-y-2">
                  <ShortcutRow keys={['Ctrl', '/']} description="Show this help" />
                  <ShortcutRow keys={['Esc']} description="Close dialogs" />
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-zinc-800 text-center">
              <p className="text-xs text-zinc-500">
                Use <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">Cmd</kbd> instead of <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">Ctrl</kbd> on Mac
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper component for shortcut rows
function ShortcutRow({ keys, description, highlight }: { keys: string[], description: string, highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={highlight ? 'text-amber-300' : 'text-zinc-300'}>{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <span key={i}>
            <kbd className={`px-2 py-1 text-xs rounded ${highlight ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
              {key}
            </kbd>
            {i < keys.length - 1 && <span className="text-zinc-600 mx-0.5">+</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

