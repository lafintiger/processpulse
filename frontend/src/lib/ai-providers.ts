/**
 * AI Provider Abstraction Layer
 * 
 * Unified interface for multiple AI backends:
 * - Local Ollama
 * - OpenAI API
 * - Anthropic Claude API
 * - Custom endpoints (BYOK)
 */

export interface CompletionOptions {
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
  stopSequences?: string[]
}

export interface AIProvider {
  id: string
  name: string
  maxContextTokens: number
  supportsStreaming: boolean
  
  complete(prompt: string, options?: CompletionOptions): Promise<string>
  stream(prompt: string, options?: CompletionOptions): AsyncGenerator<string, void, unknown>
  isAvailable(): Promise<boolean>
}

// ============================================
// Ollama Provider (Local)
// ============================================

export class OllamaProvider implements AIProvider {
  id = 'ollama'
  name = 'Local AI (Ollama)'
  maxContextTokens = 32000
  supportsStreaming = true
  
  private baseUrl: string
  private model: string
  
  constructor(baseUrl = 'http://localhost:11434', model = 'gpt-oss:latest') {
    this.baseUrl = baseUrl
    this.model = model
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      return response.ok
    } catch {
      return false
    }
  }
  
  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: options?.systemPrompt ? `${options.systemPrompt}\n\n${prompt}` : prompt,
        stream: false,
        options: {
          num_predict: options?.maxTokens || 2000,
          temperature: options?.temperature || 0.7,
          stop: options?.stopSequences,
        },
      }),
    })
    
    const data = await response.json()
    return data.response || ''
  }
  
  async *stream(prompt: string, options?: CompletionOptions): AsyncGenerator<string, void, unknown> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: options?.systemPrompt ? `${options.systemPrompt}\n\n${prompt}` : prompt,
        stream: true,
        options: {
          num_predict: options?.maxTokens || 2000,
          temperature: options?.temperature || 0.7,
          stop: options?.stopSequences,
        },
      }),
    })
    
    const reader = response.body?.getReader()
    if (!reader) return
    
    const decoder = new TextDecoder()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(Boolean)
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line)
          if (data.response) {
            yield data.response
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }
}

// ============================================
// OpenAI Provider
// ============================================

export class OpenAIProvider implements AIProvider {
  id = 'openai'
  name = 'OpenAI (ChatGPT)'
  maxContextTokens = 128000
  supportsStreaming = true
  
  private apiKey: string
  private model: string
  
  constructor(apiKey: string, model = 'gpt-4o') {
    this.apiKey = apiKey
    this.model = model
  }
  
  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      })
      return response.ok
    } catch {
      return false
    }
  }
  
  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const messages = []
    
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: options?.maxTokens || 2000,
        temperature: options?.temperature || 0.7,
        stop: options?.stopSequences,
      }),
    })
    
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }
  
  async *stream(prompt: string, options?: CompletionOptions): AsyncGenerator<string, void, unknown> {
    const messages = []
    
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: options?.maxTokens || 2000,
        temperature: options?.temperature || 0.7,
        stop: options?.stopSequences,
        stream: true,
      }),
    })
    
    const reader = response.body?.getReader()
    if (!reader) return
    
    const decoder = new TextDecoder()
    let buffer = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') return
          
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) yield content
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

// ============================================
// Anthropic Claude Provider
// ============================================

export class AnthropicProvider implements AIProvider {
  id = 'anthropic'
  name = 'Anthropic (Claude)'
  maxContextTokens = 200000
  supportsStreaming = true
  
  private apiKey: string
  private model: string
  
  constructor(apiKey: string, model = 'claude-sonnet-4-20250514') {
    this.apiKey = apiKey
    this.model = model
  }
  
  async isAvailable(): Promise<boolean> {
    return !!this.apiKey
  }
  
  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.maxTokens || 2000,
        system: options?.systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    
    const data = await response.json()
    return data.content?.[0]?.text || ''
  }
  
  async *stream(prompt: string, options?: CompletionOptions): AsyncGenerator<string, void, unknown> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.maxTokens || 2000,
        system: options?.systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
    })
    
    const reader = response.body?.getReader()
    if (!reader) return
    
    const decoder = new TextDecoder()
    let buffer = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'content_block_delta') {
              yield data.delta?.text || ''
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

// ============================================
// Provider Factory
// ============================================

export type ProviderType = 'ollama' | 'openai' | 'anthropic'

export interface ProviderConfig {
  type: ProviderType
  apiKey?: string
  baseUrl?: string
  model?: string
}

export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.type) {
    case 'ollama':
      return new OllamaProvider(config.baseUrl, config.model)
    case 'openai':
      if (!config.apiKey) throw new Error('OpenAI API key required')
      return new OpenAIProvider(config.apiKey, config.model)
    case 'anthropic':
      if (!config.apiKey) throw new Error('Anthropic API key required')
      return new AnthropicProvider(config.apiKey, config.model)
    default:
      throw new Error(`Unknown provider type: ${config.type}`)
  }
}

// Default system prompts for writing assistance
export const WRITING_SYSTEM_PROMPT = `You are a helpful writing assistant. Your role is to help students improve their writing while encouraging them to think critically and develop their own voice.

Guidelines:
- Suggest improvements, don't rewrite entirely
- Explain your reasoning so students learn
- Encourage original thinking
- Point out both strengths and areas for improvement
- Be encouraging but honest`

export const INLINE_EDIT_SYSTEM_PROMPT = `You are a writing assistant helping with inline edits. When given text and an instruction:
1. Make the requested change
2. Keep the same tone and style
3. Preserve the student's voice
4. Only output the revised text, nothing else`

