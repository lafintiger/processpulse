import { useState } from 'react'
import { FileUpload } from './components/FileUpload'
import { AssessmentResults } from './components/AssessmentResults'
import { Header } from './components/Header'
import { StatusBar } from './components/StatusBar'
import type { Assessment, UploadedFiles } from './types'

function App() {
  const [files, setFiles] = useState<UploadedFiles | null>(null)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const handleFilesUploaded = (uploadedFiles: UploadedFiles) => {
    setFiles(uploadedFiles)
    setAssessment(null)
    setError(null)
  }

  const handleStartAnalysis = async () => {
    if (!files) return
    
    setIsAnalyzing(true)
    setError(null)
    setAnalysisProgress('Preparing submission...')
    
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
        throw new Error('Assessment failed')
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

  return (
    <div className="min-h-screen">
      <Header />
      
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
                <div className="flex justify-center animate-fade-in">
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
                        <span>{analysisProgress || 'Analyzing...'}</span>
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
          <p>Process Analyzer - AI-Assisted Writing Process Assessment</p>
          <p className="mt-1">Evaluating thinking, not just writing.</p>
        </div>
      </footer>
    </div>
  )
}

export default App
