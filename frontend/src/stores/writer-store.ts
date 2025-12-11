/**
 * Writer Store
 * 
 * Central state management for the ProcessPulse Writer.
 * Handles document state, AI interactions, and event capture.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { AIProvider, ProviderConfig } from '../lib/ai-providers'
import { createProvider, OllamaProvider } from '../lib/ai-providers'

// ============================================
// Event Types for Process Capture
// ============================================

export type EventType =
  | 'session_start'
  | 'session_end'
  | 'text_insert'
  | 'text_delete'
  | 'text_paste'
  | 'text_select'
  | 'ai_request'
  | 'ai_response'
  | 'ai_accept'
  | 'ai_reject'
  | 'ai_modify'
  | 'document_save'
  | 'undo'
  | 'redo'

export interface EditorEvent {
  id: string
  timestamp: number
  sessionId: string
  eventType: EventType
  position?: { from: number; to: number }
  content?: string
  aiProvider?: string
  promptTokens?: number
  metadata?: Record<string, unknown>
}

// ============================================
// Chat Message Types
// ============================================

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  selectedText?: string
}

// ============================================
// Document Types
// ============================================

export interface Document {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  wordCount: number
  assignmentContext?: string
}

// ============================================
// Settings Types
// ============================================

export interface WriterSettings {
  // AI Provider
  providerType: 'ollama' | 'openai' | 'anthropic'
  ollamaBaseUrl: string
  ollamaModel: string
  openaiKey: string
  openaiModel: string
  anthropicKey: string
  anthropicModel: string
  
  // Editor
  autoSave: boolean
  autoSaveInterval: number
  showWordCount: boolean
  
  // Process Capture
  captureEvents: boolean
}

// ============================================
// Store State
// ============================================

interface WriterState {
  // Session
  sessionId: string
  sessionStartTime: number
  
  // Document
  document: Document | null
  documents: Document[]
  
  // AI Chat
  chatMessages: ChatMessage[]
  isAiThinking: boolean
  aiError: string | null
  
  // Inline Edit (Ctrl+K popup)
  inlineEditOpen: boolean
  inlineEditPosition: { from: number; to: number } | null
  inlineEditSelectedText: string
  inlineEditInstruction: string
  inlineEditSuggestion: string
  
  // Cursor-like inline suggestion (from chat)
  pendingSuggestion: {
    text: string
    position: { from: number; to: number }
    originalText: string
  } | null
  selectedTextForChat: {
    text: string
    position: { from: number; to: number }
  } | null
  
  // Events
  events: EditorEvent[]
  
  // Settings
  settings: WriterSettings
  
  // Provider
  provider: AIProvider | null
  providerStatus: 'checking' | 'connected' | 'disconnected'
  
  // Actions
  startSession: () => void
  endSession: () => void
  
  // Document Actions
  createDocument: (title: string, assignmentContext?: string) => Document
  loadDocument: (id: string) => void
  saveDocument: () => void
  updateContent: (content: string) => void
  deleteDocument: (id: string) => void
  
  // Chat Actions
  sendMessage: (message: string) => Promise<void>
  clearChat: () => void
  
  // Selection for chat
  setSelectedTextForChat: (text: string, from: number, to: number) => void
  clearSelectedTextForChat: () => void
  
  // Inline suggestion actions (Cursor-like)
  acceptPendingSuggestion: () => void
  rejectPendingSuggestion: () => void
  
  // Inline Edit Actions (Ctrl+K popup)
  openInlineEdit: (from: number, to: number, selectedText: string) => void
  closeInlineEdit: () => void
  setInlineInstruction: (instruction: string) => void
  generateInlineSuggestion: () => Promise<void>
  acceptInlineSuggestion: () => string
  rejectInlineSuggestion: () => void
  
  // Event Capture Actions
  captureEvent: (type: EventType, data?: Partial<EditorEvent>) => void
  exportEvents: () => EditorEvent[]
  
  // Settings Actions
  updateSettings: (settings: Partial<WriterSettings>) => void
  initializeProvider: () => Promise<void>
}

// Default settings
const defaultSettings: WriterSettings = {
  providerType: 'ollama',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'gpt-oss:latest',
  openaiKey: '',
  openaiModel: 'gpt-4o',
  anthropicKey: '',
  anthropicModel: 'claude-sonnet-4-20250514',
  autoSave: true,
  autoSaveInterval: 30,
  showWordCount: true,
  captureEvents: true,
}

// ============================================
// Store Implementation
// ============================================

export const useWriterStore = create<WriterState>()(
  persist(
    (set, get) => ({
      // Initial State
      sessionId: '',
      sessionStartTime: 0,
      document: null,
      documents: [],
      chatMessages: [],
      isAiThinking: false,
      aiError: null,
      inlineEditOpen: false,
      inlineEditPosition: null,
      inlineEditSelectedText: '',
      inlineEditInstruction: '',
      inlineEditSuggestion: '',
      pendingSuggestion: null,
      selectedTextForChat: null,
      events: [],
      settings: defaultSettings,
      provider: null,
      providerStatus: 'checking',
      
      // Session Management
      startSession: () => {
        const sessionId = uuidv4()
        const sessionStartTime = Date.now()
        
        set({ sessionId, sessionStartTime })
        get().captureEvent('session_start')
      },
      
      endSession: () => {
        get().captureEvent('session_end')
        get().saveDocument()
      },
      
      // Document Management
      createDocument: (title, assignmentContext) => {
        const doc: Document = {
          id: uuidv4(),
          title,
          content: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          wordCount: 0,
          assignmentContext,
        }
        
        set(state => ({
          document: doc,
          documents: [...state.documents, doc],
        }))
        
        get().startSession()
        return doc
      },
      
      loadDocument: (id) => {
        const doc = get().documents.find(d => d.id === id)
        if (doc) {
          set({ document: doc })
          get().startSession()
        }
      },
      
      saveDocument: () => {
        const { document, documents } = get()
        if (!document) return
        
        const updated = {
          ...document,
          updatedAt: Date.now(),
        }
        
        set({
          document: updated,
          documents: documents.map(d => d.id === updated.id ? updated : d),
        })
        
        get().captureEvent('document_save')
      },
      
      updateContent: (content) => {
        const { document } = get()
        if (!document) return
        
        const wordCount = content.trim().split(/\s+/).filter(Boolean).length
        
        set({
          document: {
            ...document,
            content,
            wordCount,
            updatedAt: Date.now(),
          },
        })
      },
      
      deleteDocument: (id) => {
        set(state => ({
          documents: state.documents.filter(d => d.id !== id),
          document: state.document?.id === id ? null : state.document,
        }))
      },
      
      // Chat Management
      sendMessage: async (message) => {
        const { provider, chatMessages, document, settings, selectedTextForChat } = get()
        
        if (!provider) {
          set({ aiError: 'AI provider not available' })
          return
        }
        
        const isEditRequest = selectedTextForChat !== null
        
        // Add user message
        const userMessage: ChatMessage = {
          id: uuidv4(),
          role: 'user',
          content: message,
          timestamp: Date.now(),
          selectedText: selectedTextForChat?.text,
        }
        
        set({
          chatMessages: [...chatMessages, userMessage],
          isAiThinking: true,
          aiError: null,
        })
        
        get().captureEvent('ai_request', {
          content: message,
          metadata: { selectedText: selectedTextForChat?.text, provider: settings.providerType, isEdit: isEditRequest },
        })
        
        try {
          let prompt: string
          let systemPrompt: string
          
          if (isEditRequest) {
            // Edit mode: Ask AI to provide a replacement
            prompt = `Selected text to edit: "${selectedTextForChat.text}"

User's instruction: ${message}

Provide ONLY the replacement text. Do not include explanations, quotes, or any other text. Just the revised version of the selected text.`
            
            systemPrompt = `You are a writing assistant. When given text to edit and an instruction, provide ONLY the revised text. Keep the same style and voice unless asked to change it. Never add explanations or quotes around your response.`
          } else {
            // Regular chat mode
            prompt = message
            if (document?.content) {
              const preview = document.content.slice(0, 2000)
              prompt = `Current document:\n---\n${preview}${document.content.length > 2000 ? '...' : ''}\n---\n\n${prompt}`
            }
            systemPrompt = `You are a helpful writing assistant. Help the student improve their writing while encouraging critical thinking. Current assignment: ${document?.assignmentContext || 'General writing'}`
          }
          
          // Stream response
          let fullResponse = ''
          const assistantMessageId = uuidv4()
          
          for await (const chunk of provider.stream(prompt, {
            systemPrompt,
            temperature: isEditRequest ? 0.5 : 0.7,
            maxTokens: isEditRequest ? 500 : 1500,
          })) {
            fullResponse += chunk
            
            set(state => ({
              chatMessages: [
                ...state.chatMessages.filter(m => m.id !== assistantMessageId),
                {
                  id: assistantMessageId,
                  role: 'assistant',
                  content: fullResponse,
                  timestamp: Date.now(),
                },
              ],
            }))
          }
          
          // If this was an edit request, create a pending suggestion
          if (isEditRequest && selectedTextForChat) {
            // Clean up the response (remove quotes if AI added them)
            let cleanedResponse = fullResponse.trim()
            if (cleanedResponse.startsWith('"') && cleanedResponse.endsWith('"')) {
              cleanedResponse = cleanedResponse.slice(1, -1)
            }
            if (cleanedResponse.startsWith("'") && cleanedResponse.endsWith("'")) {
              cleanedResponse = cleanedResponse.slice(1, -1)
            }
            
            set({
              pendingSuggestion: {
                text: cleanedResponse,
                position: selectedTextForChat.position,
                originalText: selectedTextForChat.text,
              },
              selectedTextForChat: null, // Clear selection after generating suggestion
            })
          }
          
          get().captureEvent('ai_response', {
            content: fullResponse,
            metadata: { provider: settings.providerType, isEdit: isEditRequest },
          })
          
        } catch (error) {
          set({ aiError: error instanceof Error ? error.message : 'AI request failed' })
        } finally {
          set({ isAiThinking: false })
        }
      },
      
      clearChat: () => {
        set({ chatMessages: [], pendingSuggestion: null, selectedTextForChat: null })
      },
      
      // Selection for chat-based editing
      setSelectedTextForChat: (text, from, to) => {
        set({
          selectedTextForChat: { text, position: { from, to } }
        })
      },
      
      clearSelectedTextForChat: () => {
        set({ selectedTextForChat: null })
      },
      
      // Accept/reject pending suggestion (Cursor-like)
      acceptPendingSuggestion: () => {
        const { pendingSuggestion } = get()
        if (pendingSuggestion) {
          get().captureEvent('ai_accept', {
            content: pendingSuggestion.text,
            metadata: { originalText: pendingSuggestion.originalText, type: 'chat_edit' },
          })
        }
        set({ pendingSuggestion: null })
      },
      
      rejectPendingSuggestion: () => {
        get().captureEvent('ai_reject', {
          metadata: { type: 'chat_edit' },
        })
        set({ pendingSuggestion: null })
      },
      
      // Inline Edit
      openInlineEdit: (from, to, selectedText) => {
        set({
          inlineEditOpen: true,
          inlineEditPosition: { from, to },
          inlineEditSelectedText: selectedText,
          inlineEditInstruction: '',
          inlineEditSuggestion: '',
        })
      },
      
      closeInlineEdit: () => {
        set({
          inlineEditOpen: false,
          inlineEditPosition: null,
          inlineEditSelectedText: '',
          inlineEditInstruction: '',
          inlineEditSuggestion: '',
        })
      },
      
      setInlineInstruction: (instruction) => {
        set({ inlineEditInstruction: instruction })
      },
      
      generateInlineSuggestion: async () => {
        const { provider, inlineEditSelectedText, inlineEditInstruction, settings } = get()
        
        if (!provider || !inlineEditSelectedText || !inlineEditInstruction) return
        
        set({ isAiThinking: true, aiError: null })
        
        get().captureEvent('ai_request', {
          content: inlineEditInstruction,
          metadata: { 
            selectedText: inlineEditSelectedText,
            type: 'inline_edit',
            provider: settings.providerType,
          },
        })
        
        try {
          const prompt = `Original text: "${inlineEditSelectedText}"
          
Instruction: ${inlineEditInstruction}

Provide ONLY the revised text. Do not include explanations or quotes around the text.`
          
          let suggestion = ''
          
          for await (const chunk of provider.stream(prompt, {
            systemPrompt: 'You are a writing assistant. When given text and an instruction, provide only the revised text. Keep the same style and voice. Do not add quotes or explanations.',
            temperature: 0.7,
            maxTokens: 500,
          })) {
            suggestion += chunk
            set({ inlineEditSuggestion: suggestion })
          }
          
          get().captureEvent('ai_response', {
            content: suggestion,
            metadata: { type: 'inline_edit', provider: settings.providerType },
          })
          
        } catch (error) {
          set({ aiError: error instanceof Error ? error.message : 'Failed to generate suggestion' })
        } finally {
          set({ isAiThinking: false })
        }
      },
      
      acceptInlineSuggestion: () => {
        const { inlineEditSuggestion } = get()
        get().captureEvent('ai_accept', {
          content: inlineEditSuggestion,
          metadata: { type: 'inline_edit' },
        })
        get().closeInlineEdit()
        return inlineEditSuggestion
      },
      
      rejectInlineSuggestion: () => {
        get().captureEvent('ai_reject', {
          metadata: { type: 'inline_edit' },
        })
        get().closeInlineEdit()
      },
      
      // Event Capture
      captureEvent: (type, data) => {
        const { sessionId, settings } = get()
        
        if (!settings.captureEvents) return
        
        const event: EditorEvent = {
          id: uuidv4(),
          timestamp: Date.now(),
          sessionId,
          eventType: type,
          ...data,
        }
        
        set(state => ({
          events: [...state.events, event],
        }))
      },
      
      exportEvents: () => {
        return get().events
      },
      
      // Settings
      updateSettings: (newSettings) => {
        set(state => ({
          settings: { ...state.settings, ...newSettings },
        }))
        
        // Re-initialize provider if provider settings changed
        if (newSettings.providerType || newSettings.ollamaModel || newSettings.openaiKey || newSettings.anthropicKey) {
          get().initializeProvider()
        }
      },
      
      initializeProvider: async () => {
        const { settings } = get()
        
        set({ providerStatus: 'checking' })
        
        try {
          let config: ProviderConfig
          
          switch (settings.providerType) {
            case 'openai':
              config = {
                type: 'openai',
                apiKey: settings.openaiKey,
                model: settings.openaiModel,
              }
              break
            case 'anthropic':
              config = {
                type: 'anthropic',
                apiKey: settings.anthropicKey,
                model: settings.anthropicModel,
              }
              break
            default:
              config = {
                type: 'ollama',
                baseUrl: settings.ollamaBaseUrl,
                model: settings.ollamaModel,
              }
          }
          
          const provider = createProvider(config)
          const available = await provider.isAvailable()
          
          set({
            provider,
            providerStatus: available ? 'connected' : 'disconnected',
          })
          
        } catch (error) {
          console.error('Failed to initialize provider:', error)
          set({ providerStatus: 'disconnected' })
        }
      },
    }),
    {
      name: 'processpulse-writer',
      partialize: (state) => ({
        documents: state.documents,
        settings: state.settings,
        // Don't persist events - they go to server
      }),
    }
  )
)

