/**
 * Settings Panel
 * 
 * Configure AI providers, editor preferences, and process capture.
 */

import { useState, useEffect } from 'react'
import { useWriterStore } from '../../stores/writer-store'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, updateSettings, initializeProvider, providerStatus } = useWriterStore()
  const [localSettings, setLocalSettings] = useState(settings)
  const [showApiKeys, setShowApiKeys] = useState(false)
  
  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])
  
  const handleSave = async () => {
    updateSettings(localSettings)
    await initializeProvider()
    onClose()
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-zinc-900 rounded-xl border border-zinc-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* AI Provider */}
          <section>
            <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI Provider
            </h3>
            
            <div className="space-y-3">
              <div className="flex gap-2">
                {(['ollama', 'openai', 'anthropic'] as const).map((provider) => (
                  <button
                    key={provider}
                    onClick={() => setLocalSettings(s => ({ ...s, providerType: provider }))}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      localSettings.providerType === provider
                        ? 'bg-teal-500/20 border-teal-500/50 text-teal-400'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    {provider === 'ollama' ? 'Local (Ollama)' :
                     provider === 'openai' ? 'OpenAI' : 'Claude'}
                  </button>
                ))}
              </div>
              
              {/* Ollama Settings */}
              {localSettings.providerType === 'ollama' && (
                <div className="space-y-3 p-3 bg-zinc-800/50 rounded-lg">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Server URL</label>
                    <input
                      type="text"
                      value={localSettings.ollamaBaseUrl}
                      onChange={(e) => setLocalSettings(s => ({ ...s, ollamaBaseUrl: e.target.value }))}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Model</label>
                    <input
                      type="text"
                      value={localSettings.ollamaModel}
                      onChange={(e) => setLocalSettings(s => ({ ...s, ollamaModel: e.target.value }))}
                      placeholder="e.g., qwen3:32b, llama3.1:8b"
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    />
                  </div>
                </div>
              )}
              
              {/* OpenAI Settings */}
              {localSettings.providerType === 'openai' && (
                <div className="space-y-3 p-3 bg-zinc-800/50 rounded-lg">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">API Key</label>
                    <div className="relative">
                      <input
                        type={showApiKeys ? 'text' : 'password'}
                        value={localSettings.openaiKey}
                        onChange={(e) => setLocalSettings(s => ({ ...s, openaiKey: e.target.value }))}
                        placeholder="sk-..."
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKeys(!showApiKeys)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                      >
                        {showApiKeys ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Model</label>
                    <select
                      value={localSettings.openaiModel}
                      onChange={(e) => setLocalSettings(s => ({ ...s, openaiModel: e.target.value }))}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    >
                      <option value="gpt-4o">GPT-4o (recommended)</option>
                      <option value="gpt-4o-mini">GPT-4o Mini (faster)</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    </select>
                  </div>
                </div>
              )}
              
              {/* Anthropic Settings */}
              {localSettings.providerType === 'anthropic' && (
                <div className="space-y-3 p-3 bg-zinc-800/50 rounded-lg">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">API Key</label>
                    <div className="relative">
                      <input
                        type={showApiKeys ? 'text' : 'password'}
                        value={localSettings.anthropicKey}
                        onChange={(e) => setLocalSettings(s => ({ ...s, anthropicKey: e.target.value }))}
                        placeholder="sk-ant-..."
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKeys(!showApiKeys)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                      >
                        {showApiKeys ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Model</label>
                    <select
                      value={localSettings.anthropicModel}
                      onChange={(e) => setLocalSettings(s => ({ ...s, anthropicModel: e.target.value }))}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    >
                      <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (recommended)</option>
                      <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                      <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (faster)</option>
                    </select>
                  </div>
                </div>
              )}
              
              {/* Connection Status */}
              <div className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${
                  providerStatus === 'connected' ? 'bg-emerald-500' :
                  providerStatus === 'checking' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
                }`} />
                <span className="text-zinc-400">
                  {providerStatus === 'connected' ? 'Connected' :
                   providerStatus === 'checking' ? 'Checking...' : 'Disconnected'}
                </span>
              </div>
            </div>
          </section>
          
          {/* Editor Settings */}
          <section>
            <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editor
            </h3>
            
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Show word count</span>
                <input
                  type="checkbox"
                  checked={localSettings.showWordCount}
                  onChange={(e) => setLocalSettings(s => ({ ...s, showWordCount: e.target.checked }))}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-teal-500 focus:ring-teal-500/50"
                />
              </label>
              
              <label className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Auto-save</span>
                <input
                  type="checkbox"
                  checked={localSettings.autoSave}
                  onChange={(e) => setLocalSettings(s => ({ ...s, autoSave: e.target.checked }))}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-teal-500 focus:ring-teal-500/50"
                />
              </label>
            </div>
          </section>
          
          {/* Process Capture */}
          <section>
            <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Process Capture
            </h3>
            
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-zinc-400 block">Capture writing events</span>
                  <span className="text-xs text-zinc-600">Records keystrokes, AI interactions, and edits</span>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.captureEvents}
                  onChange={(e) => setLocalSettings(s => ({ ...s, captureEvents: e.target.checked }))}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-teal-500 focus:ring-teal-500/50"
                />
              </label>
            </div>
          </section>
        </div>
        
        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}

