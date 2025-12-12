/**
 * Writer Store
 * 
 * Central state management for the ProcessPulse Writer.
 * Handles document state, AI interactions, and event capture.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { AIProvider, ProviderConfig, PerplexicaSearchResult, PerplexicaSource, PerplexicaFocusMode } from '../lib/ai-providers'
import { createProvider, OllamaProvider, perplexica } from '../lib/ai-providers'

// ============================================
// Event Types for Process Capture
// ============================================

export type EventType =
  | 'session_start'
  | 'session_end'
  | 'text_insert'
  | 'text_delete'
  | 'text_paste'        // Pasting from clipboard
  | 'text_copy'         // Copying to clipboard (potential external AI use)
  | 'text_cut'          // Cutting text
  | 'text_select'
  | 'ai_request'
  | 'ai_response'
  | 'ai_accept'
  | 'ai_reject'
  | 'ai_modify'
  | 'web_search'        // Perplexica web search
  | 'document_save'
  | 'undo'
  | 'redo'
  | 'focus_lost'        // Window/tab lost focus (might be using external tools)
  | 'focus_gained'      // Window/tab regained focus

export interface EditorEvent {
  id: string
  timestamp: number
  sessionId: string
  eventType: EventType
  position?: { from: number; to: number }
  content?: string
  contentLength?: number  // For paste tracking without storing content
  aiProvider?: string
  promptTokens?: number
  metadata?: Record<string, unknown>
}

// Session metrics for academic integrity analysis
export interface SessionMetrics {
  totalCharactersTyped: number      // Characters typed by student
  totalCharactersPasted: number     // Characters pasted from clipboard
  totalCharactersCopied: number     // Characters copied (potential external AI)
  aiRequestCount: number
  aiAcceptCount: number
  aiRejectCount: number
  focusLostCount: number            // Times window lost focus
  totalFocusLostDuration: number    // ms spent outside the app
  lastFocusLostTime: number | null  // For tracking duration
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

export interface StudentInfo {
  name: string
  studentId?: string
  email?: string
}

export interface Document {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  wordCount: number
  assignmentContext?: string
  student?: StudentInfo
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
  
  // Session Metrics (for academic integrity)
  metrics: SessionMetrics
  
  // Web Search (Perplexica)
  searchOpen: boolean
  searchQuery: string
  searchResults: PerplexicaSearchResult | null
  searchSources: PerplexicaSource[]
  isSearching: boolean
  searchError: string | null
  searchFocusMode: PerplexicaFocusMode
  perplexicaAvailable: boolean
  
  // Settings
  settings: WriterSettings
  
  // Provider
  provider: AIProvider | null
  providerStatus: 'checking' | 'connected' | 'disconnected'
  
  // Actions
  startSession: () => void
  endSession: () => void
  
  // Document Actions
  createDocument: (title: string, assignmentContext?: string, student?: StudentInfo) => Document
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
  
  // Backend Sync Actions
  saveSessionToBackend: () => Promise<void>
  saveDraftToServer: () => Promise<void>
  loadDraftFromServer: (studentName: string, documentTitle: string) => Promise<boolean>
  listStudentDrafts: (studentName: string) => Promise<Array<{ id: string; documentTitle: string; wordCount: number; lastSaved: string }>>
  submitForAssessment: () => Promise<{ success: boolean; message: string; submissionId?: string }>
  
  // Reset Actions
  clearCurrentSession: () => void
  
  // Settings Actions
  updateSettings: (settings: Partial<WriterSettings>) => void
  initializeProvider: () => Promise<void>
  
  // Web Search Actions
  openSearch: () => void
  closeSearch: () => void
  setSearchQuery: (query: string) => void
  setSearchFocusMode: (mode: PerplexicaFocusMode) => void
  performSearch: () => Promise<void>
  clearSearchResults: () => void
  insertSearchResultToChat: (result: string, sources: PerplexicaSource[]) => void
  checkPerplexicaAvailable: () => Promise<void>
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
      metrics: {
        totalCharactersTyped: 0,
        totalCharactersPasted: 0,
        totalCharactersCopied: 0,
        aiRequestCount: 0,
        aiAcceptCount: 0,
        aiRejectCount: 0,
        focusLostCount: 0,
        totalFocusLostDuration: 0,
        lastFocusLostTime: null,
      },
      
      // Web Search initial state
      searchOpen: false,
      searchQuery: '',
      searchResults: null,
      searchSources: [],
      isSearching: false,
      searchError: null,
      searchFocusMode: 'webSearch',
      perplexicaAvailable: false,
      
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
        get().saveSessionToBackend()  // Save to backend on session end
      },
      
      // Document Management
      createDocument: (title, assignmentContext, student) => {
        const doc: Document = {
          id: uuidv4(),
          title,
          content: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          wordCount: 0,
          assignmentContext,
          student,
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
          console.error('AI request failed:', error)
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
      
      // Event Capture with Metrics Tracking
      captureEvent: (type, data) => {
        const { sessionId, settings, metrics } = get()
        
        if (!settings.captureEvents) return
        
        const event: EditorEvent = {
          id: uuidv4(),
          timestamp: Date.now(),
          sessionId,
          eventType: type,
          ...data,
        }
        
        // Update metrics based on event type
        const newMetrics = { ...metrics }
        const contentLength = data?.contentLength || data?.content?.length || 0
        
        switch (type) {
          case 'text_insert':
            newMetrics.totalCharactersTyped += contentLength
            break
          case 'text_paste':
            newMetrics.totalCharactersPasted += contentLength
            break
          case 'text_copy':
          case 'text_cut':
            newMetrics.totalCharactersCopied += contentLength
            break
          case 'ai_request':
            newMetrics.aiRequestCount++
            break
          case 'ai_accept':
            newMetrics.aiAcceptCount++
            break
          case 'ai_reject':
            newMetrics.aiRejectCount++
            break
          case 'focus_lost':
            newMetrics.focusLostCount++
            newMetrics.lastFocusLostTime = Date.now()
            break
          case 'focus_gained':
            if (newMetrics.lastFocusLostTime) {
              newMetrics.totalFocusLostDuration += Date.now() - newMetrics.lastFocusLostTime
              newMetrics.lastFocusLostTime = null
            }
            break
        }
        
        set(state => ({
          events: [...state.events, event],
          metrics: newMetrics,
        }))
      },
      
      exportEvents: () => {
        return get().events
      },
      
      // Clear current session (start fresh)
      clearCurrentSession: () => {
        const { document } = get()
        if (!document) return
        
        // Reset metrics
        set({
          events: [],
          chatMessages: [],
          metrics: {
            totalCharactersTyped: 0,
            totalCharactersPasted: 0,
            totalCharactersCopied: 0,
            aiRequestCount: 0,
            aiAcceptCount: 0,
            aiRejectCount: 0,
            focusLostCount: 0,
            totalFocusLostDuration: 0,
            lastFocusLostTime: null,
          },
          pendingSuggestion: null,
          selectedTextForChat: null,
        })
        
        // Start new session
        get().startSession()
      },
      
      // Save session to backend
      saveSessionToBackend: async () => {
        const { sessionId, sessionStartTime, document, events, chatMessages, settings } = get()
        
        if (!document || !sessionId) {
          console.warn('No session to save')
          return
        }
        
        try {
          const response = await fetch('/api/sessions/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              sessionStartTime,
              sessionEndTime: Date.now(),
              document: {
                id: document.id,
                title: document.title,
                content: document.content,
                wordCount: document.wordCount,
                assignmentContext: document.assignmentContext,
                createdAt: document.createdAt,
                updatedAt: document.updatedAt,
              },
              events,
              chatMessages,
              settings: {
                providerType: settings.providerType,
                ollamaModel: settings.ollamaModel,
                openaiModel: settings.openaiModel,
                anthropicModel: settings.anthropicModel,
              },
            }),
          })
          
          if (!response.ok) {
            throw new Error(`Failed to save session: ${response.statusText}`)
          }
          
          const result = await response.json()
          console.log('Session saved:', result)
        } catch (error) {
          console.error('Failed to save session to backend:', error)
        }
      },
      
      // Save draft to server (auto-save for resume capability)
      saveDraftToServer: async () => {
        const { sessionId, sessionStartTime, document, events, chatMessages, settings } = get()
        
        if (!document || !sessionId || !document.student?.name) {
          return
        }
        
        try {
          await fetch('/api/submissions/draft/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              student: document.student,
              sessionId,
              sessionStartTime,
              document: {
                title: document.title,
                content: document.content,
                wordCount: document.wordCount,
                assignmentContext: document.assignmentContext,
              },
              events,
              chatMessages,
              settings: {
                providerType: settings.providerType,
                ollamaModel: settings.ollamaModel,
              },
            }),
          })
        } catch (error) {
          console.error('Failed to save draft to server:', error)
        }
      },
      
      // Load a draft from the server (for resuming work)
      loadDraftFromServer: async (studentName: string, documentTitle: string) => {
        try {
          const response = await fetch(`/api/submissions/draft/${encodeURIComponent(studentName)}/${encodeURIComponent(documentTitle)}`)
          
          if (!response.ok) {
            return false
          }
          
          const draft = await response.json()
          
          // Restore document
          const doc: Document = {
            id: draft.sessionId || uuidv4(),
            title: draft.document.title,
            content: draft.document.content,
            wordCount: draft.document.wordCount,
            assignmentContext: draft.document.assignmentContext,
            createdAt: draft.sessionStartTime,
            updatedAt: Date.now(),
            student: draft.student,
          }
          
          // Restore chat messages
          const chatMessages = (draft.chatMessages || []).map((m: ChatMessage) => ({
            ...m,
            timestamp: m.timestamp || Date.now(),
          }))
          
          // Restore events  
          const events = draft.events || []
          
          set({
            document: doc,
            documents: [...get().documents.filter(d => d.id !== doc.id), doc],
            chatMessages,
            events,
            sessionId: draft.sessionId || uuidv4(),
            sessionStartTime: draft.sessionStartTime || Date.now(),
          })
          
          return true
        } catch (error) {
          console.error('Failed to load draft:', error)
          return false
        }
      },
      
      // List drafts for a student
      listStudentDrafts: async (studentName: string) => {
        try {
          const response = await fetch(`/api/submissions/drafts/${encodeURIComponent(studentName)}`)
          if (!response.ok) return []
          return await response.json()
        } catch {
          return []
        }
      },
      
      // Submit for assessment - saves to server storage
      submitForAssessment: async () => {
        const { sessionId, sessionStartTime, document, events, chatMessages, settings } = get()
        
        if (!document || !sessionId) {
          return { success: false, message: 'No document to submit' }
        }
        
        if (!document.student?.name) {
          return { success: false, message: 'Student name is required' }
        }
        
        try {
          const response = await fetch('/api/submissions/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              student: document.student,
              sessionId,
              sessionStartTime,
              sessionEndTime: Date.now(),
              document: {
                title: document.title,
                content: document.content,
                wordCount: document.wordCount,
                assignmentContext: document.assignmentContext,
              },
              events,
              chatMessages,
              settings: {
                providerType: settings.providerType,
                ollamaModel: settings.ollamaModel,
                openaiModel: settings.openaiModel,
                anthropicModel: settings.anthropicModel,
              },
            }),
          })
          
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || 'Failed to submit')
          }
          
          const result = await response.json()
          
          // Delete the draft after successful submission
          if (document.student?.name && document.title) {
            try {
              await fetch(`/api/submissions/draft/${encodeURIComponent(document.student.name)}/${encodeURIComponent(document.title)}`, {
                method: 'DELETE'
              })
            } catch {
              // Ignore draft deletion errors
            }
          }
          
          return { 
            success: true, 
            message: result.message,
            submissionId: result.submissionId 
          }
        } catch (error) {
          console.error('Failed to submit for assessment:', error)
          return { 
            success: false, 
            message: error instanceof Error ? error.message : 'Submission failed' 
          }
        }
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
          
          // Also check Perplexica availability
          get().checkPerplexicaAvailable()
          
        } catch (error) {
          console.error('Failed to initialize AI provider:', error)
          set({ providerStatus: 'disconnected' })
        }
      },
      
      // ============================================
      // Web Search Actions (Perplexica)
      // ============================================
      
      checkPerplexicaAvailable: async () => {
        try {
          const available = await perplexica.isAvailable()
          set({ perplexicaAvailable: available })
        } catch {
          set({ perplexicaAvailable: false })
        }
      },
      
      openSearch: () => {
        set({ searchOpen: true, searchError: null })
      },
      
      closeSearch: () => {
        set({ searchOpen: false })
      },
      
      setSearchQuery: (query: string) => {
        set({ searchQuery: query })
      },
      
      setSearchFocusMode: (mode) => {
        set({ searchFocusMode: mode })
      },
      
      performSearch: async () => {
        const { searchQuery, searchFocusMode, perplexicaAvailable } = get()
        
        if (!searchQuery.trim()) {
          set({ searchError: 'Please enter a search query' })
          return
        }
        
        if (!perplexicaAvailable) {
          set({ searchError: 'Perplexica is not available. Make sure it is running at http://localhost:3000' })
          return
        }
        
        set({ isSearching: true, searchError: null, searchResults: null, searchSources: [] })
        
        try {
          // Capture search event
          get().captureEvent('web_search', {
            content: searchQuery,
            metadata: { focusMode: searchFocusMode },
          })
          
          const result = await perplexica.search(searchQuery, {
            focusMode: searchFocusMode,
            optimizationMode: 'balanced',
          })
          
          set({
            searchResults: result,
            searchSources: result.sources || [],
            isSearching: false,
          })
          
        } catch (error) {
          console.error('Search failed:', error)
          set({
            searchError: error instanceof Error ? error.message : 'Search failed',
            isSearching: false,
          })
        }
      },
      
      clearSearchResults: () => {
        set({
          searchResults: null,
          searchSources: [],
          searchQuery: '',
          searchError: null,
        })
      },
      
      insertSearchResultToChat: (result: string, sources) => {
        // Format sources as citations
        const citations = sources.length > 0
          ? '\n\n**Sources:**\n' + sources.map((s, i) => `${i + 1}. [${s.metadata.title}](${s.metadata.url})`).join('\n')
          : ''
        
        // Add as assistant message in chat
        const message: ChatMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: `**Search Result:**\n\n${result}${citations}`,
          timestamp: Date.now(),
        }
        
        set(state => ({
          chatMessages: [...state.chatMessages, message],
          searchOpen: false,
        }))
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

