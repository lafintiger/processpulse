// Types for the Process Analyzer frontend

export interface ChatExchange {
  number: number
  student_prompt: string
  ai_response: string
  timestamp?: string
  model_name?: string
}

export interface ParsedChatHistory {
  platform: string
  format_detected: string
  conversation_name?: string
  total_exchanges: number
  exchanges: ChatExchange[]
  parsing_notes: string[]
}

export interface UploadedFiles {
  essayFile: File | null
  essayText: string
  essayWordCount: number
  chatFile: File | null
  chatHistory: ParsedChatHistory | null
  assignmentContext: string
}

export interface Evidence {
  type: string
  reference: string
  citation: string
  excerpt: string
  analysis: string
}

export interface CriterionAssessment {
  criterion_name: string
  criterion_id: string
  points_possible: number
  points_earned: number
  level: 'exemplary' | 'proficient' | 'developing' | 'inadequate'
  reasoning: string
  evidence: Evidence[]
  feedback: string
  confidence: string
}

export interface AuthenticityFlag {
  type: string
  severity: 'low' | 'medium' | 'high'
  description: string
  evidence: string
  location?: string
  recommendation?: string
}

export interface AuthenticityResult {
  score: number
  confidence: string
  flags: AuthenticityFlag[]
  positive_indicators: string[]
  overall_assessment: string
}

export interface Assessment {
  submission_id?: string
  model_name: string
  timestamp: string
  total_score: number
  total_possible: number
  percentage: number
  criterion_assessments: CriterionAssessment[]
  summary: {
    paragraphs: string[]
    key_strengths: string[]
    areas_for_growth: string[]
    notable_observations: string
    overall_quality: string
    recommended_grade: string
  }
  authenticity?: AuthenticityResult
  processing_time_seconds: number
  errors: string[]
}

export interface SystemStatus {
  api: {
    name: string
    version: string
    debug: boolean
  }
  ollama: {
    base_url: string
    connected: boolean
    model_count: number
    default_analysis_model: string
    default_embedding_model: string
  }
  database: {
    url_masked: string
    type: string
  }
}

export interface Model {
  name: string
  size: number
  size_human: string
  family?: string
  parameter_size?: string
}

export interface ModelsResponse {
  total_count: number
  analysis_models: Model[]
  embedding_models: Model[]
  other_models: Model[]
  defaults: {
    analysis: string
    embedding: string
  }
}

