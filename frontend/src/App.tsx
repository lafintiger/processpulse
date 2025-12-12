import { useState } from 'react'
import { FileUpload } from './components/FileUpload'
import { AssessmentResults } from './components/AssessmentResults'
import { Header } from './components/Header'
import { StatusBar } from './components/StatusBar'
import { WriterPage } from './components/writer'
import { ErrorBoundary } from './components/ErrorBoundary'
import type { Assessment, UploadedFiles } from './types'

type AppMode = 'home' | 'analyzer' | 'writer'

function AppContent() {
  const [mode, setMode] = useState<AppMode>('home')
  const [files, setFiles] = useState<UploadedFiles | null>(null)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  // Show Writer page
  if (mode === 'writer') {
    return <WriterPage />
  }

  const handleFilesUploaded = (uploadedFiles: UploadedFiles) => {
    setFiles(uploadedFiles)
    setAssessment(null)
    setError(null)
  }

  const handleStartAnalysis = async () => {
    if (!files) return
    
    setIsAnalyzing(true)
    setError(null)
    setAnalysisProgress('Starting assessment... (watch backend console for progress)')
    
    try {
      const response = await fetch('/api/assessment/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          essay_text: files.essayText,
          chat_history_json: JSON.stringify(files.chatHistory),
          assignment_context: files.assignmentContext,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Assessment failed')
      }
      
      const result = await response.json()
      setAssessment(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsAnalyzing(false)
      setAnalysisProgress('')
    }
  }

  const handleReset = () => {
    setFiles(null)
    setAssessment(null)
    setError(null)
  }

  // Home page - choose mode
  if (mode === 'home') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-4xl w-full">
          {/* Logo */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-xl shadow-teal-500/20">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-zinc-100 mb-3">ProcessPulse</h1>
            <p className="text-xl text-zinc-400">AI-Assisted Writing Assessment</p>
            <p className="text-zinc-500 mt-2">Evaluating thinking, not just writing</p>
          </div>
          
          {/* Mode Selection */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Writer Mode */}
            <button
              onClick={() => setMode('writer')}
              className="group p-8 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-teal-500/50 transition-all text-left hover:shadow-xl hover:shadow-teal-500/5"
            >
              <div className="w-14 h-14 rounded-xl bg-teal-500/10 flex items-center justify-center mb-4 group-hover:bg-teal-500/20 transition-colors">
                <svg className="w-7 h-7 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-zinc-100 mb-2">Writer</h2>
              <p className="text-zinc-400 mb-4">
                AI-assisted writing with full process capture. For students.
              </p>
              <ul className="text-sm text-zinc-500 space-y-1">
                <li>• Rich text editor with AI assistance</li>
                <li>• Inline editing with Cmd+K</li>
                <li>• Chat sidebar for brainstorming</li>
                <li>• Automatic process capture</li>
              </ul>
              <div className="mt-6 text-teal-400 font-medium group-hover:translate-x-1 transition-transform">
                Start Writing →
              </div>
            </button>
            
            {/* Analyzer Mode */}
            <button
              onClick={() => setMode('analyzer')}
              className="group p-8 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-amber-500/50 transition-all text-left hover:shadow-xl hover:shadow-amber-500/5"
            >
              <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4 group-hover:bg-amber-500/20 transition-colors">
                <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-zinc-100 mb-2">Analyzer</h2>
              <p className="text-zinc-400 mb-4">
                Assess submitted essays and chat histories. For educators.
              </p>
              <ul className="text-sm text-zinc-500 space-y-1">
                <li>• Upload essay + chat history</li>
                <li>• 11-criterion rubric assessment</li>
                <li>• Evidence-based scoring</li>
                <li>• Authenticity analysis</li>
              </ul>
              <div className="mt-6 text-amber-400 font-medium group-hover:translate-x-1 transition-transform">
                Analyze Submission →
              </div>
            </button>
          </div>
          
          {/* Footer */}
          <div className="mt-12 text-center text-zinc-600 text-sm">
            <p>80% process, 20% product • Making thinking visible</p>
          </div>
        </div>
      </div>
    )
  }

  // Analyzer mode
  return (
    <div className="min-h-screen">
      <Header />
      
      {/* Back to Home */}
      <div className="container mx-auto px-6 pt-4">
        <button
          onClick={() => setMode('home')}
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </button>
      </div>
      
      <main className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Status Bar */}
        <StatusBar />
        
        {/* Main Content */}
        <div className="mt-8">
          {!assessment ? (
            <div className="space-y-8">
              {/* File Upload Section */}
              <FileUpload 
                onFilesUploaded={handleFilesUploaded}
                uploadedFiles={files}
              />
              
              {/* Analysis Button */}
              {files && (
                <div className="space-y-4 animate-fade-in">
                  {isAnalyzing && (
                    <div className="card p-6 bg-teal-500/10 border border-teal-500/30">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <svg className="animate-spin h-8 w-8 text-teal-400" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-teal-300">Analysis in Progress</h3>
                          <p className="text-teal-400 font-mono text-sm mt-1">
                            {analysisProgress || 'Starting assessment...'}
                          </p>
                          <p className="text-zinc-500 text-xs mt-2">
                            This takes 3-5 minutes with the 32B model. Watch the backend terminal for detailed progress.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-center">
                    <button
                      onClick={handleStartAnalysis}
                      disabled={isAnalyzing}
                      className="btn-primary text-lg px-8 py-4 flex items-center gap-3"
                    >
                      {isAnalyzing ? (
                        <>
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <span>Analyze Submission</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
              
              {/* Error Message */}
              {error && (
                <div className="card bg-rose-500/10 border border-rose-500/30 p-4 text-center animate-fade-in">
                  <p className="text-rose-400">{error}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Results */}
              <AssessmentResults 
                assessment={assessment}
                chatHistory={files?.chatHistory}
              />
              
              {/* Reset Button */}
              <div className="flex justify-center">
                <button onClick={handleReset} className="btn-secondary">
                  Assess Another Submission
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-16 py-8">
        <div className="container mx-auto px-6 text-center text-zinc-500 text-sm">
          <p>ProcessPulse - AI-Assisted Writing Process Assessment</p>
          <p className="mt-1">Evaluating thinking, not just writing.</p>
        </div>
      </footer>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}

export default App
