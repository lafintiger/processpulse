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
  } = useWriterStore()
  
  const [showSettings, setShowSettings] = useState(false)
  const [showDocList, setShowDocList] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocContext, setNewDocContext] = useState('')
  const [showNewDocModal, setShowNewDocModal] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  
  // Initialize AI provider on mount
  useEffect(() => {
    initializeProvider()
  }, [])
  
  // Auto-save
  useEffect(() => {
    if (!settings.autoSave || !document) return
    
    const interval = setInterval(() => {
      saveDocument()
    }, settings.autoSaveInterval * 1000)
    
    return () => clearInterval(interval)
  }, [settings.autoSave, settings.autoSaveInterval, document])
  
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
  
  const handleExportSession = async () => {
    if (!document) return
    
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
            <div className="text-xs text-zinc-500">
              {document.wordCount} words · Auto-saved
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
          
          {/* Export */}
          <button
            onClick={handleExportSession}
            className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Export session"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          
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
    </div>
  )
}

