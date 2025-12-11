import { useEffect, useState } from 'react'
import type { SystemStatus } from '../types'

export function StatusBar() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/status')
        if (response.ok) {
          const data = await response.json()
          setStatus(data)
          setError(null)
        } else {
          setError('API not responding')
        }
      } catch {
        setError('Cannot connect to API')
      } finally {
        setLoading(false)
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="card p-4 flex items-center justify-center gap-2 text-zinc-400">
        <div className="w-4 h-4 border-2 border-zinc-600 border-t-teal-500 rounded-full animate-spin" />
        <span className="text-sm">Checking system status...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card bg-rose-500/10 border border-rose-500/30 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-rose-400 text-sm font-medium">{error}</span>
        </div>
        <span className="text-zinc-500 text-xs">
          Make sure the backend is running: <code className="font-mono bg-zinc-800 px-2 py-1 rounded">python run.py</code>
        </span>
      </div>
    )
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* API Status */}
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-zinc-300 text-sm">
            {status?.api.name} <span className="text-zinc-500">v{status?.api.version}</span>
          </span>
        </div>
        
        {/* Ollama Status */}
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${status?.ollama.connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          <span className="text-zinc-300 text-sm">
            Ollama: {status?.ollama.connected ? (
              <span className="text-emerald-400">{status.ollama.model_count} models</span>
            ) : (
              <span className="text-rose-400">disconnected</span>
            )}
          </span>
        </div>
        
        {/* Default Models */}
        {status?.ollama.connected && (
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span>
              Analysis: <code className="font-mono text-teal-400">{status.ollama.default_analysis_model}</code>
            </span>
            <span>
              Embedding: <code className="font-mono text-teal-400">{status.ollama.default_embedding_model}</code>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
