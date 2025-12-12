import { useState } from 'react'
import type { Assessment, ParsedChatHistory, CriterionAssessment } from '../types'
import { ChatViewer } from './ChatViewer'
import { exportAssessmentToPDF } from '../lib/pdf-export'

interface AssessmentResultsProps {
  assessment: Assessment
  chatHistory?: ParsedChatHistory | null
}

export function AssessmentResults({ assessment, chatHistory }: AssessmentResultsProps) {
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set())
  const [selectedCitation, setSelectedCitation] = useState<number | null>(null)
  const [showChatViewer, setShowChatViewer] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)

  const handleExportPDF = () => {
    setShowExportMenu(false)
    exportAssessmentToPDF(assessment, {
      date: new Date().toLocaleDateString(),
    })
  }

  const toggleCriterion = (id: string) => {
    setExpandedCriteria(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'exemplary': return 'score-exemplary'
      case 'proficient': return 'score-proficient'
      case 'developing': return 'score-developing'
      case 'inadequate': return 'score-inadequate'
      default: return 'text-zinc-400 bg-zinc-800 border-zinc-700'
    }
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'exemplary': return '★'
      case 'proficient': return '●'
      case 'developing': return '◐'
      case 'inadequate': return '○'
      default: return '?'
    }
  }

  const handleCitationClick = (citation: string) => {
    const match = citation.match(/\[CHAT:(\d+)\]/)
    if (match) {
      setSelectedCitation(parseInt(match[1]))
      setShowChatViewer(true)
    }
  }

  // Group criteria by category (with safety check)
  const criteriaList = assessment.criterion_assessments || []
  const categories = [
    { name: 'AI Collaboration Process', weight: 50, criteria: criteriaList.slice(0, 4) },
    { name: 'Metacognitive Awareness & Learning', weight: 20, criteria: criteriaList.slice(4, 6) },
    { name: 'Transparency & Academic Integrity', weight: 10, criteria: criteriaList.slice(6, 8) },
    { name: 'Final Essay Quality', weight: 20, criteria: criteriaList.slice(8, 11) },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Overall Score Card */}
      <div className="card p-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-bold text-zinc-100 mb-2">
              Assessment Complete
            </h2>
            <p className="text-zinc-400">
              Analyzed by <span className="text-teal-400 font-mono">{assessment.model_name || 'AI'}</span>
              {assessment.processing_time_seconds != null && ` in ${assessment.processing_time_seconds.toFixed(1)}s`}
            </p>
          </div>
          
          <div className="text-center">
            <div className="text-5xl font-bold text-zinc-100 mb-1">
              {assessment.total_score ?? 0}<span className="text-2xl text-zinc-500">/{assessment.total_possible ?? 100}</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getLevelStyle(assessment.summary?.overall_quality || 'unknown')}`}>
                {(assessment.summary?.overall_quality || 'Unknown').charAt(0).toUpperCase() + (assessment.summary?.overall_quality || 'unknown').slice(1)}
              </span>
              <span className="text-2xl font-bold text-teal-400">
                {assessment.summary?.recommended_grade || 'N/A'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Score breakdown bar */}
        <div className="mt-8">
          <div className="h-4 rounded-full bg-zinc-800 overflow-hidden flex">
            {categories.map((cat, i) => {
              const catScore = cat.criteria.reduce((sum, c) => sum + (c.points_earned || 0), 0)
              const totalPossible = assessment.total_possible || 100
              const percentage = totalPossible > 0 ? (catScore / totalPossible) * 100 : 0
              const colors = ['bg-teal-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-400']
              return (
                <div 
                  key={i}
                  className={`${colors[i]} transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                  title={`${cat.name}: ${catScore}/${cat.weight}`}
                />
              )
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-zinc-500">
            <span>Process (80%)</span>
            <span>Product (20%)</span>
          </div>
        </div>
      </div>

      {/* Summary */}
      {assessment.summary && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-zinc-100 mb-4">Summary Assessment</h3>
          <div className="space-y-4 text-zinc-300">
            {(assessment.summary.paragraphs || []).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
          
          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div>
              <h4 className="text-sm font-medium text-emerald-400 mb-2">Key Strengths</h4>
              <ul className="space-y-1">
                {(assessment.summary.key_strengths || []).map((s, i) => (
                  <li key={i} className="text-zinc-400 text-sm flex items-start gap-2">
                    <span className="text-emerald-500 mt-1">+</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium text-amber-400 mb-2">Areas for Growth</h4>
              <ul className="space-y-1">
                {(assessment.summary.areas_for_growth || []).map((a, i) => (
                  <li key={i} className="text-zinc-400 text-sm flex items-start gap-2">
                    <span className="text-amber-500 mt-1">-</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Criteria */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-zinc-100">Detailed Scores</h3>
          <div className="flex items-center gap-3">
            {/* Export Menu */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="btn-secondary text-sm py-2 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export Report
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50">
                  <button
                    onClick={handleExportPDF}
                    className="w-full px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-700 flex items-center gap-3 rounded-t-lg"
                  >
                    <svg className="w-5 h-5 text-rose-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13.5l1 1.5H11l-2-3 2-3H9.5l-1 1.5-.5.75-.5-.75-1-1.5H5l2 3-2 3h1.5l1-1.5.5-.75.5.75z"/>
                    </svg>
                    PDF Report
                  </button>
                  <button
                    onClick={() => {
                      setShowExportMenu(false)
                      const json = JSON.stringify(assessment, null, 2)
                      const blob = new Blob([json], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `assessment_${new Date().toISOString().split('T')[0]}.json`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-700 flex items-center gap-3 rounded-b-lg border-t border-zinc-700"
                  >
                    <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8 17h8v-2H8v2zm0-4h8v-2H8v2z"/>
                    </svg>
                    JSON Data
                  </button>
                </div>
              )}
            </div>
            {chatHistory && (
              <button 
                onClick={() => setShowChatViewer(!showChatViewer)}
                className="btn-secondary text-sm py-2"
              >
                {showChatViewer ? 'Hide' : 'View'} Chat History
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {categories.map((category, catIndex) => (
            <div key={catIndex} className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-zinc-200">{category.name}</h4>
                <span className="text-sm text-zinc-500">
                  {category.criteria.reduce((s, c) => s + (c.points_earned || 0), 0)}/{category.weight} pts
                </span>
              </div>
              
              {category.criteria.map((criterion) => (
                <CriterionCard
                  key={criterion.criterion_id}
                  criterion={criterion}
                  isExpanded={expandedCriteria.has(criterion.criterion_id)}
                  onToggle={() => toggleCriterion(criterion.criterion_id)}
                  onCitationClick={handleCitationClick}
                  getLevelStyle={getLevelStyle}
                  getLevelIcon={getLevelIcon}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Authenticity */}
      {assessment.authenticity && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-zinc-100 mb-4">
            Authenticity Analysis
          </h3>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="text-3xl font-bold text-zinc-100">
              {assessment.authenticity.score}<span className="text-lg text-zinc-500">/100</span>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm border ${
              assessment.authenticity.score >= 70 ? 'score-proficient' :
              assessment.authenticity.score >= 40 ? 'score-developing' : 'score-inadequate'
            }`}>
              {assessment.authenticity.confidence} confidence
            </span>
          </div>
          
          <p className="text-zinc-300 mb-4">{assessment.authenticity.overall_assessment}</p>
          
          {assessment.authenticity.flags.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-amber-400">Flags for Review</h4>
              {assessment.authenticity.flags.map((flag, i) => (
                <div key={i} className={`p-3 rounded-lg border ${
                  flag.severity === 'high' ? 'bg-rose-500/10 border-rose-500/30' :
                  flag.severity === 'medium' ? 'bg-amber-500/10 border-amber-500/30' :
                  'bg-zinc-800/50 border-zinc-700'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium uppercase ${
                      flag.severity === 'high' ? 'text-rose-400' :
                      flag.severity === 'medium' ? 'text-amber-400' : 'text-zinc-400'
                    }`}>
                      {flag.severity}
                    </span>
                    <span className="text-zinc-300 text-sm">{flag.description}</span>
                  </div>
                  <p className="text-zinc-500 text-xs">{flag.evidence}</p>
                </div>
              ))}
            </div>
          )}
          
          {assessment.authenticity.positive_indicators.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-emerald-400 mb-2">Positive Indicators</h4>
              <ul className="space-y-1">
                {assessment.authenticity.positive_indicators.map((ind, i) => (
                  <li key={i} className="text-zinc-400 text-sm flex items-start gap-2">
                    <span className="text-emerald-500">+</span>
                    {ind}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Chat Viewer Modal */}
      {showChatViewer && chatHistory && (
        <ChatViewer
          chatHistory={chatHistory}
          highlightedExchange={selectedCitation}
          onClose={() => setShowChatViewer(false)}
        />
      )}
    </div>
  )
}

// Criterion Card Component
interface CriterionCardProps {
  criterion: CriterionAssessment
  isExpanded: boolean
  onToggle: () => void
  onCitationClick: (citation: string) => void
  getLevelStyle: (level: string) => string
  getLevelIcon: (level: string) => string
}

function CriterionCard({ 
  criterion, 
  isExpanded, 
  onToggle, 
  onCitationClick,
  getLevelStyle,
  getLevelIcon
}: CriterionCardProps) {
  return (
    <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg border ${getLevelStyle(criterion.level)}`}>
            {getLevelIcon(criterion.level)}
          </span>
          <div className="text-left">
            <div className="font-medium text-zinc-200">{criterion.criterion_name}</div>
            <div className="text-xs text-zinc-500">{criterion.level}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold text-zinc-100">
            {criterion.points_earned}<span className="text-zinc-500">/{criterion.points_possible}</span>
          </span>
          <svg 
            className={`w-5 h-5 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      
      {isExpanded && (
        <div className="p-4 pt-0 border-t border-zinc-700/50 space-y-4 animate-fade-in">
          <div>
            <h5 className="text-xs font-medium text-zinc-500 uppercase mb-1">Reasoning</h5>
            <p className="text-zinc-300 text-sm">{criterion.reasoning}</p>
          </div>
          
          {criterion.evidence.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-zinc-500 uppercase mb-2">Evidence</h5>
              <div className="space-y-2">
                {criterion.evidence.map((ev, i) => (
                  <div key={i} className="p-3 bg-zinc-900/50 rounded-lg">
                    <button
                      onClick={() => onCitationClick(ev.citation)}
                      className="text-teal-400 text-sm font-mono hover:underline"
                    >
                      {ev.citation}
                    </button>
                    <p className="text-zinc-400 text-sm mt-1 italic">"{ev.excerpt}"</p>
                    <p className="text-zinc-500 text-xs mt-1">{ev.analysis}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div>
            <h5 className="text-xs font-medium text-zinc-500 uppercase mb-1">Feedback</h5>
            <p className="text-zinc-300 text-sm">{criterion.feedback}</p>
          </div>
          
          <div className="flex items-center gap-2 pt-2">
            <span className="text-xs text-zinc-500">Confidence:</span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              criterion.confidence === 'high' ? 'bg-emerald-500/10 text-emerald-400' :
              criterion.confidence === 'medium' ? 'bg-amber-500/10 text-amber-400' :
              'bg-zinc-700 text-zinc-400'
            }`}>
              {criterion.confidence}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
