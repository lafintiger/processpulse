/**
 * Submissions Dashboard
 * 
 * Instructor view to see all student submissions,
 * download files, and load them into the analyzer.
 */

import { useState, useEffect } from 'react'

interface Submission {
  id: string
  studentName: string
  studentId?: string
  documentTitle: string
  wordCount: number
  submittedAt: string
  aiRequestCount: number
  hasMarkdown: boolean
  hasJson: boolean
}

interface SubmissionsDashboardProps {
  onAnalyze?: (submissionId: string) => void
  onBack: () => void
}

export function SubmissionsDashboard({ onBack }: SubmissionsDashboardProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  // Fetch submissions on mount
  useEffect(() => {
    fetchSubmissions()
  }, [])

  const fetchSubmissions = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/submissions/list')
      if (!response.ok) {
        throw new Error('Failed to fetch submissions')
      }
      
      const data = await response.json()
      setSubmissions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (submissionId: string, fileType: 'md' | 'json') => {
    try {
      setDownloading(`${submissionId}-${fileType}`)
      
      const response = await fetch(`/api/submissions/${submissionId}/download/${fileType}`)
      if (!response.ok) {
        throw new Error('Download failed')
      }
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${submissionId}.${fileType}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
      alert('Failed to download file')
    } finally {
      setDownloading(null)
    }
  }

  const handleDelete = async (submissionId: string) => {
    if (!confirm('Are you sure you want to delete this submission?')) return
    
    try {
      const response = await fetch(`/api/submissions/${submissionId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Delete failed')
      }
      
      // Refresh list
      fetchSubmissions()
    } catch (err) {
      console.error('Delete failed:', err)
      alert('Failed to delete submission')
    }
  }

  // Filter submissions by search query
  const filteredSubmissions = submissions.filter(s => 
    s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.documentTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.studentId && s.studentId.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-semibold">Student Submissions</h1>
              <p className="text-sm text-zinc-500">{submissions.length} submissions</p>
            </div>
          </div>
          
          <button
            onClick={fetchSubmissions}
            className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Refresh"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, ID, or document title..."
              className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50"
            />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-zinc-500">Loading submissions...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-rose-400 mb-4">{error}</p>
            <button
              onClick={fetchSubmissions}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && submissions.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-zinc-300 mb-2">No Submissions Yet</h3>
            <p className="text-zinc-500">Student submissions will appear here when they click "Submit" in the Writer.</p>
          </div>
        )}

        {/* Submissions List */}
        {!loading && !error && filteredSubmissions.length > 0 && (
          <div className="space-y-3">
            {filteredSubmissions.map((submission) => (
              <div
                key={submission.id}
                className={`bg-zinc-900 border rounded-xl overflow-hidden transition-colors ${
                  selectedSubmission === submission.id 
                    ? 'border-teal-500/50' 
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <button
                  onClick={() => setSelectedSubmission(
                    selectedSubmission === submission.id ? null : submission.id
                  )}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-medium text-zinc-100 truncate">
                          {submission.documentTitle}
                        </h3>
                        <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">
                          {submission.wordCount} words
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-zinc-400">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {submission.studentName}
                          {submission.studentId && (
                            <span className="text-zinc-500">({submission.studentId})</span>
                          )}
                        </span>
                        <span>•</span>
                        <span>{formatDate(submission.submittedAt)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {submission.aiRequestCount} AI requests
                        </span>
                      </div>
                    </div>
                    <svg 
                      className={`w-5 h-5 text-zinc-500 transition-transform ${
                        selectedSubmission === submission.id ? 'rotate-180' : ''
                      }`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                
                {/* Expanded Actions */}
                {selectedSubmission === submission.id && (
                  <div className="px-4 pb-4 pt-2 border-t border-zinc-800 flex flex-wrap gap-2">
                    {/* Download MD */}
                    {submission.hasMarkdown && (
                      <button
                        onClick={() => handleDownload(submission.id, 'md')}
                        disabled={downloading === `${submission.id}-md`}
                        className="px-3 py-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                      >
                        {downloading === `${submission.id}-md` ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        )}
                        Essay (.md)
                      </button>
                    )}
                    
                    {/* Download JSON */}
                    {submission.hasJson && (
                      <button
                        onClick={() => handleDownload(submission.id, 'json')}
                        disabled={downloading === `${submission.id}-json`}
                        className="px-3 py-2 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                      >
                        {downloading === `${submission.id}-json` ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        )}
                        Session Data (.json)
                      </button>
                    )}
                    
                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(submission.id)}
                      className="px-3 py-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ml-auto"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* No Results */}
        {!loading && !error && submissions.length > 0 && filteredSubmissions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500">No submissions match your search.</p>
          </div>
        )}
      </main>
    </div>
  )
}

