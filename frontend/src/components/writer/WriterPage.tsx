/**
 * Writer Page
 * 
 * Main writing interface that combines:
 * - TipTap editor
 * - AI chat sidebar
 * - Document management
 * - Process capture
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useWriterStore } from '../../stores/writer-store'
import { Editor } from './Editor'
import { ChatSidebar } from './ChatSidebar'
import { SettingsPanel } from './SettingsPanel'
import { SearchPanel } from './SearchPanel'
import { exportToDocx, exportToTxt, exportToHtml, exportToMarkdown } from '../../lib/export-utils'

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
    saveDraftToServer,
    loadDraftFromServer,
    listStudentDrafts,
    submitForAssessment,
    searchOpen,
    openSearch,
    closeSearch,
    perplexicaAvailable,
    checkPerplexicaAvailable,
  } = useWriterStore()
  
  const [showSettings, setShowSettings] = useState(false)
  const [showDocList, setShowDocList] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocContext, setNewDocContext] = useState('')
  const [newDocStudentName, setNewDocStudentName] = useState('')
  const [newDocStudentId, setNewDocStudentId] = useState('')
  const [showNewDocModal, setShowNewDocModal] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null)
  const [studentDrafts, setStudentDrafts] = useState<Array<{ id: string; documentTitle: string; wordCount: number; lastSaved: string }>>([])
  const [checkingDrafts, setCheckingDrafts] = useState(false)
  const [serverSaveStatus, setServerSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showWelcome, setShowWelcome] = useState(() => {
    return !localStorage.getItem('processpulse_welcomed')
  })
  
  // Resizable sidebar
  const [sidebarWidth, setSidebarWidth] = useState(384) // Default w-96 = 384px
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return
    
    const containerRect = containerRef.current.getBoundingClientRect()
    const newWidth = containerRect.right - e.clientX
    
    // Constrain between 280px and 600px
    const clampedWidth = Math.min(Math.max(newWidth, 280), 600)
    setSidebarWidth(clampedWidth)
  }, [isResizing])
  
  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])
  
  // Add/remove resize event listeners
  useEffect(() => {
    if (isResizing) {
      window.document.addEventListener('mousemove', handleMouseMove)
      window.document.addEventListener('mouseup', handleMouseUp)
      window.document.body.style.cursor = 'col-resize'
      window.document.body.style.userSelect = 'none'
    }
    
    return () => {
      window.document.removeEventListener('mousemove', handleMouseMove)
      window.document.removeEventListener('mouseup', handleMouseUp)
      window.document.body.style.cursor = ''
      window.document.body.style.userSelect = ''
    }
  }, [isResizing, handleMouseMove, handleMouseUp])
  
  // Initialize AI provider and check Perplexica on mount
  useEffect(() => {
    initializeProvider()
    checkPerplexicaAvailable()
  }, [])
  
  // Auto-save (local + server)
  useEffect(() => {
    if (!settings.autoSave || !document) return
    
    const interval = setInterval(async () => {
      saveDocument()
      setLastSaved(new Date())
      
      // Also save to server if student has name
      if (document.student?.name) {
        setServerSaveStatus('saving')
        try {
          await saveDraftToServer()
          setServerSaveStatus('saved')
        } catch {
          setServerSaveStatus('error')
        }
      }
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
  
  // Check for existing drafts when student enters their name
  const handleCheckDrafts = async () => {
    const studentName = newDocStudentName.trim()
    if (!studentName) return
    
    setCheckingDrafts(true)
    const drafts = await listStudentDrafts(studentName)
    setStudentDrafts(drafts)
    setCheckingDrafts(false)
  }
  
  // Load a draft to continue working
  const handleLoadDraft = async (documentTitle: string) => {
    const studentName = newDocStudentName.trim()
    if (!studentName) return
    
    const success = await loadDraftFromServer(studentName, documentTitle)
    if (success) {
      setShowNewDocModal(false)
      setNewDocStudentName('')
      setNewDocStudentId('')
      setStudentDrafts([])
    } else {
      alert('Failed to load draft')
    }
  }
  
  const handleCreateDocument = () => {
    const title = newDocTitle.trim() || 'Untitled Document'
    const studentName = newDocStudentName.trim()
    
    if (!studentName) {
      alert('Please enter your name')
      return
    }
    
    const student = {
      name: studentName,
      studentId: newDocStudentId.trim() || undefined,
    }
    
    createDocument(title, newDocContext.trim() || undefined, student)
    setNewDocTitle('')
    setNewDocContext('')
    setNewDocStudentName('')
    setNewDocStudentId('')
    setStudentDrafts([])
    setShowNewDocModal(false)
  }
  
  const handleSubmitForAssessment = async () => {
    if (!document?.student?.name) {
      setSubmitResult({ success: false, message: 'Student name is required. Please add your name in settings.' })
      setShowSubmitModal(true)
      return
    }
    
    setIsSubmitting(true)
    setSubmitResult(null)
    setShowSubmitModal(true)
    
    try {
      // Save document first
      saveDocument()
      
      // Submit to server
      const result = await submitForAssessment()
      setSubmitResult(result)
    } catch {
      setSubmitResult({ success: false, message: 'Submission failed. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
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
  
  const handleExportMarkdown = () => {
    if (!document) return
    setShowExportMenu(false)
    exportToMarkdown(document.title, document.content)
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
              <div className="w-full max-w-lg bg-zinc-900 rounded-xl border border-zinc-700 p-6">
                <h2 className="text-lg font-semibold text-zinc-100 mb-4">Start Writing</h2>
                
                <div className="space-y-4">
                  {/* Student Info Section */}
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="text-xs text-amber-400 mb-2 font-medium">Student Information (Required)</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm text-zinc-400 mb-1 block">Your Name *</label>
                        <input
                          type="text"
                          value={newDocStudentName}
                          onChange={(e) => {
                            setNewDocStudentName(e.target.value)
                            setStudentDrafts([]) // Clear drafts when name changes
                          }}
                          onBlur={handleCheckDrafts}
                          placeholder="John Doe"
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="text-sm text-zinc-400 mb-1 block">Student ID</label>
                        <input
                          type="text"
                          value={newDocStudentId}
                          onChange={(e) => setNewDocStudentId(e.target.value)}
                          placeholder="Optional"
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        />
                      </div>
                    </div>
                    
                    {/* Check for existing drafts */}
                    {newDocStudentName.trim() && (
                      <button
                        onClick={handleCheckDrafts}
                        disabled={checkingDrafts}
                        className="mt-3 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                      >
                        {checkingDrafts ? (
                          <>
                            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Checking...
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Check for saved drafts
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  
                  {/* Existing Drafts - Continue Writing */}
                  {studentDrafts.length > 0 && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                      <div className="text-xs text-emerald-400 mb-2 font-medium flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        You have saved work! Continue where you left off:
                      </div>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {studentDrafts.map((draft) => (
                          <button
                            key={draft.id}
                            onClick={() => handleLoadDraft(draft.documentTitle)}
                            className="w-full p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-left flex items-center justify-between group transition-colors"
                          >
                            <div>
                              <div className="text-sm text-zinc-200 font-medium">{draft.documentTitle}</div>
                              <div className="text-xs text-zinc-500">
                                {draft.wordCount} words · Saved {new Date(draft.lastSaved).toLocaleString()}
                              </div>
                            </div>
                            <span className="text-emerald-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
                              Continue →
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Divider when drafts exist */}
                  {studentDrafts.length > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 border-t border-zinc-700"></div>
                      <span className="text-xs text-zinc-500">or start new</span>
                      <div className="flex-1 border-t border-zinc-700"></div>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Document Title</label>
                    <input
                      type="text"
                      value={newDocTitle}
                      onChange={(e) => setNewDocTitle(e.target.value)}
                      placeholder="My Essay"
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
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
                    onClick={() => {
                      setShowNewDocModal(false)
                      setStudentDrafts([])
                      setNewDocStudentName('')
                      setNewDocStudentId('')
                    }}
                    className="px-4 py-2 text-zinc-400 hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateDocument}
                    disabled={!newDocStudentName.trim()}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium"
                  >
                    Create New
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
    <div className="h-screen flex flex-col" style={{ backgroundColor: '#09090b', color: '#e4e4e7', overflow: 'hidden' }}>
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
              {document.student?.name && serverSaveStatus !== 'idle' && (
                <>
                  <span>·</span>
                  <span className={`flex items-center gap-1 ${
                    serverSaveStatus === 'saving' ? 'text-amber-400' :
                    serverSaveStatus === 'saved' ? 'text-teal-400' : 'text-rose-400'
                  }`}>
                    {serverSaveStatus === 'saving' && (
                      <>
                        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Syncing...
                      </>
                    )}
                    {serverSaveStatus === 'saved' && (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                        </svg>
                        Synced to server
                      </>
                    )}
                    {serverSaveStatus === 'error' && 'Sync failed'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Student Badge */}
          {document.student && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {document.student.name}
              {document.student.studentId && <span className="text-amber-500/70">({document.student.studentId})</span>}
            </div>
          )}
          
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
                <button
                  onClick={handleExportMarkdown}
                  className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM6 13h2v4H7v-2.5L6 16l-1-1.5V17H4v-4h2l1 1.5 1-1.5zm6 0h1.5v4H12v-2l-1 2h-.5l-1-2v2H8v-4h1.5l1 2 1-2z"/>
                  </svg>
                  Markdown (.md)
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
          
          {/* Submit Button */}
          <button
            onClick={handleSubmitForAssessment}
            className="ml-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
            title="Submit for assessment"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Submit
          </button>
        </div>
      </header>
      
      {/* Main Content - NO SCROLLING HERE */}
      <div ref={containerRef} className="flex-1 flex min-h-0" style={{ overflow: 'hidden', height: 'calc(100vh - 52px)' }}>
        {/* Editor */}
        <div className={`flex-1 min-w-0 overflow-y-auto p-6 ${sidebarOpen ? 'pr-0' : ''}`}>
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
        
        {/* Resize Handle */}
        {sidebarOpen && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize chat panel"
            tabIndex={0}
            onMouseDown={handleMouseDown}
            className={`w-2 flex-shrink-0 cursor-col-resize group transition-colors ${
              isResizing ? 'bg-teal-500/70' : 'bg-zinc-700 hover:bg-teal-500/50'
            }`}
          >
            <div className="w-full h-full flex items-center justify-center">
              <div className={`w-1 h-12 rounded-full transition-colors ${
                isResizing ? 'bg-teal-400' : 'bg-zinc-500 group-hover:bg-teal-400'
              }`} />
            </div>
          </div>
        )}
        
        {/* Chat Sidebar */}
        {sidebarOpen && (
          <div 
            className="h-full flex-shrink-0 overflow-hidden"
            style={{ width: sidebarWidth }}
          >
            <ChatSidebar />
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
      
      {/* Submission Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden">
            <div className="p-6 text-center">
              {isSubmitting ? (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-emerald-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-zinc-100 mb-2">Submitting...</h2>
                  <p className="text-zinc-400">Please wait while we save your work.</p>
                </>
              ) : submitResult?.success ? (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-zinc-100 mb-2">Submitted Successfully!</h2>
                  <p className="text-zinc-400 mb-4">{submitResult.message}</p>
                  <div className="p-3 bg-zinc-800 rounded-lg text-left">
                    <div className="text-xs text-zinc-500 mb-1">Your essay and writing process have been saved.</div>
                    <div className="text-sm text-zinc-300">Your instructor can now review your work.</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-500/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-zinc-100 mb-2">Submission Failed</h2>
                  <p className="text-zinc-400 mb-4">{submitResult?.message || 'An error occurred'}</p>
                </>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-zinc-800">
              <button
                onClick={() => {
                  setShowSubmitModal(false)
                  setSubmitResult(null)
                }}
                className="w-full py-2.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-medium transition-colors"
              >
                {submitResult?.success ? 'Continue Writing' : 'Close'}
              </button>
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

