import { useState, useCallback } from 'react'
import type { UploadedFiles, ParsedChatHistory } from '../types'

interface FileUploadProps {
  onFilesUploaded: (files: UploadedFiles) => void
  uploadedFiles: UploadedFiles | null
}

export function FileUpload({ onFilesUploaded, uploadedFiles }: FileUploadProps) {
  const [essayFile, setEssayFile] = useState<File | null>(null)
  const [chatFile, setChatFile] = useState<File | null>(null)
  const [essayText, setEssayText] = useState('')
  const [chatHistory, setChatHistory] = useState<ParsedChatHistory | null>(null)
  const [assignmentContext, setAssignmentContext] = useState('')
  const [parseErrors, setParseErrors] = useState<{ essay?: string; chat?: string }>({})

  const handleEssayUpload = useCallback(async (file: File) => {
    setEssayFile(file)
    setParseErrors(prev => ({ ...prev, essay: undefined }))
    
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const response = await fetch('/api/upload/essay', {
        method: 'POST',
        body: formData,
      })
      
      if (response.ok) {
        const data = await response.json()
        setEssayText(data.parsed.text)
      } else {
        const error = await response.json()
        setParseErrors(prev => ({ ...prev, essay: error.detail || 'Failed to parse essay' }))
      }
    } catch {
      setParseErrors(prev => ({ ...prev, essay: 'Failed to upload essay' }))
    }
  }, [])

  const handleChatUpload = useCallback(async (file: File) => {
    setChatFile(file)
    setParseErrors(prev => ({ ...prev, chat: undefined }))
    
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const response = await fetch('/api/upload/chat-history', {
        method: 'POST',
        body: formData,
      })
      
      if (response.ok) {
        const data = await response.json()
        setChatHistory(data.parsed)
      } else {
        const error = await response.json()
        setParseErrors(prev => ({ ...prev, chat: error.detail || 'Failed to parse chat history' }))
      }
    } catch {
      setParseErrors(prev => ({ ...prev, chat: 'Failed to upload chat history' }))
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, type: 'essay' | 'chat') => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      if (type === 'essay') {
        handleEssayUpload(file)
      } else {
        handleChatUpload(file)
      }
    }
  }, [handleEssayUpload, handleChatUpload])

  const handleSubmit = () => {
    if (essayText && chatHistory) {
      onFilesUploaded({
        essayFile,
        essayText,
        essayWordCount: essayText.split(/\s+/).length,
        chatFile,
        chatHistory,
        assignmentContext,
      })
    }
  }

  const isReady = essayText && chatHistory && !parseErrors.essay && !parseErrors.chat

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-zinc-100 mb-3">
          Upload Submission
        </h2>
        <p className="text-zinc-400 text-sm">
          Upload the student's final essay and their complete AI chat history for assessment.
          The system will analyze both to evaluate the thinking process (80%) and final product (20%).
        </p>
      </div>

      {/* File Upload Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Essay Upload */}
        <div 
          className={`card card-hover p-6 ${essayText ? 'border-emerald-500/30' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, 'essay')}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-zinc-100">Essay</h3>
              <p className="text-xs text-zinc-500">TXT, DOCX, PDF, or MD</p>
            </div>
          </div>

          {!essayFile ? (
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center hover:border-teal-500/50 transition-colors">
                <svg className="w-10 h-10 text-zinc-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-zinc-400 text-sm">
                  Drag & drop or <span className="text-teal-400">browse</span>
                </p>
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept=".txt,.docx,.pdf,.md"
                onChange={(e) => e.target.files?.[0] && handleEssayUpload(e.target.files[0])}
              />
            </label>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-zinc-300 text-sm truncate max-w-[150px]">{essayFile.name}</span>
                </div>
                <button 
                  onClick={() => { setEssayFile(null); setEssayText('') }}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {essayText && (
                <p className="text-xs text-zinc-500">
                  {essayText.split(/\s+/).length} words extracted
                </p>
              )}
            </div>
          )}
          
          {parseErrors.essay && (
            <p className="text-rose-400 text-sm mt-2">{parseErrors.essay}</p>
          )}
        </div>

        {/* Chat History Upload */}
        <div 
          className={`card card-hover p-6 ${chatHistory ? 'border-emerald-500/30' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, 'chat')}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-zinc-100">Chat History</h3>
              <p className="text-xs text-zinc-500">JSON, TXT, or MD</p>
            </div>
          </div>

          {!chatFile ? (
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center hover:border-amber-500/50 transition-colors">
                <svg className="w-10 h-10 text-zinc-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-zinc-400 text-sm">
                  Drag & drop or <span className="text-amber-400">browse</span>
                </p>
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept=".json,.txt,.md"
                onChange={(e) => e.target.files?.[0] && handleChatUpload(e.target.files[0])}
              />
            </label>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-zinc-300 text-sm truncate max-w-[150px]">{chatFile.name}</span>
                </div>
                <button 
                  onClick={() => { setChatFile(null); setChatHistory(null) }}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {chatHistory && (
                <p className="text-xs text-zinc-500">
                  {chatHistory.total_exchanges} exchanges from {chatHistory.platform}
                </p>
              )}
            </div>
          )}
          
          {parseErrors.chat && (
            <p className="text-rose-400 text-sm mt-2">{parseErrors.chat}</p>
          )}
        </div>
      </div>

      {/* Assignment Context (Optional) */}
      <div className="card p-6">
        <h3 className="font-medium text-zinc-100 mb-3">
          Assignment Context <span className="text-zinc-500 font-normal">(optional)</span>
        </h3>
        <textarea
          value={assignmentContext}
          onChange={(e) => setAssignmentContext(e.target.value)}
          placeholder="Paste the assignment prompt or description here. This helps the AI understand what the student was asked to do."
          className="input-field min-h-[100px] resize-y"
        />
      </div>

      {/* Submit Button */}
      {essayText && chatHistory && (
        <div className="flex justify-center">
          <button
            onClick={handleSubmit}
            disabled={!isReady}
            className="btn-primary"
          >
            Files Ready - Continue to Analysis
          </button>
        </div>
      )}
    </div>
  )
}
