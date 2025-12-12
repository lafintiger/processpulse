/**
 * PDF Export Utility for Assessment Reports
 * Generates comprehensive PDF reports of student assessments
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Assessment } from '../types'

interface PDFExportOptions {
  studentName?: string
  assignmentTitle?: string
  instructorName?: string
  date?: string
}

/**
 * Export assessment results to a professional PDF report
 */
export function exportAssessmentToPDF(
  assessment: Assessment,
  options: PDFExportOptions = {}
): void {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  let yPos = 20

  // Helper to check page overflow and add new page
  const checkPageOverflow = (neededSpace: number) => {
    if (yPos + neededSpace > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage()
      yPos = 20
    }
  }

  // === HEADER ===
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 128, 128) // Teal
  doc.text('ProcessPulse', margin, yPos)
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(128, 128, 128)
  doc.text('AI-Assisted Writing Assessment Report', margin, yPos + 8)
  
  yPos += 20

  // === DOCUMENT INFO ===
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 10

  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  
  const infoLines = [
    `Date: ${options.date || new Date().toLocaleDateString()}`,
    options.studentName ? `Student: ${options.studentName}` : null,
    options.assignmentTitle ? `Assignment: ${options.assignmentTitle}` : null,
    options.instructorName ? `Instructor: ${options.instructorName}` : null,
    `Model: ${assessment.model_name || 'AI Assessment'}`,
    assessment.processing_time_seconds ? `Processing Time: ${assessment.processing_time_seconds.toFixed(1)}s` : null,
  ].filter(Boolean) as string[]

  infoLines.forEach(line => {
    doc.text(line, margin, yPos)
    yPos += 6
  })

  yPos += 10

  // === OVERALL SCORE ===
  checkPageOverflow(50)
  
  doc.setFillColor(240, 240, 240)
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 40, 3, 3, 'F')
  
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40, 40, 40)
  doc.text('Overall Assessment', margin + 10, yPos + 12)
  
  // Score
  doc.setFontSize(32)
  doc.setTextColor(0, 128, 128)
  const scoreText = `${assessment.total_score ?? 0}/${assessment.total_possible ?? 100}`
  doc.text(scoreText, pageWidth - margin - 60, yPos + 25)
  
  // Grade and Quality
  doc.setFontSize(12)
  doc.setTextColor(60, 60, 60)
  const quality = assessment.summary?.overall_quality || 'N/A'
  const grade = assessment.summary?.recommended_grade || 'N/A'
  doc.text(`Quality: ${quality.charAt(0).toUpperCase() + quality.slice(1)}`, margin + 10, yPos + 25)
  doc.text(`Grade: ${grade}`, margin + 10, yPos + 35)
  
  yPos += 50

  // === SUMMARY ASSESSMENT ===
  if (assessment.summary) {
    checkPageOverflow(60)
    
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 40, 40)
    doc.text('Summary Assessment', margin, yPos)
    yPos += 10
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    
    const paragraphs = assessment.summary.paragraphs || []
    paragraphs.forEach(para => {
      checkPageOverflow(30)
      const lines = doc.splitTextToSize(para, pageWidth - 2 * margin)
      doc.text(lines, margin, yPos)
      yPos += lines.length * 5 + 8
    })
    
    yPos += 5

    // Key Strengths
    const strengths = assessment.summary.key_strengths || []
    if (strengths.length > 0) {
      checkPageOverflow(30)
      
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 150, 100)
      doc.text('Key Strengths:', margin, yPos)
      yPos += 7
      
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      strengths.forEach(s => {
        checkPageOverflow(10)
        const lines = doc.splitTextToSize(`+ ${s}`, pageWidth - 2 * margin - 5)
        doc.text(lines, margin + 5, yPos)
        yPos += lines.length * 5 + 3
      })
      yPos += 5
    }

    // Areas for Growth
    const growth = assessment.summary.areas_for_growth || []
    if (growth.length > 0) {
      checkPageOverflow(30)
      
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(200, 150, 0)
      doc.text('Areas for Growth:', margin, yPos)
      yPos += 7
      
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      growth.forEach(a => {
        checkPageOverflow(10)
        const lines = doc.splitTextToSize(`- ${a}`, pageWidth - 2 * margin - 5)
        doc.text(lines, margin + 5, yPos)
        yPos += lines.length * 5 + 3
      })
      yPos += 5
    }
  }

  // === DETAILED SCORES TABLE ===
  checkPageOverflow(60)
  
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40, 40, 40)
  doc.text('Detailed Criterion Scores', margin, yPos)
  yPos += 10

  const criteriaList = assessment.criterion_assessments || []
  const tableData = criteriaList.map(c => [
    c.criterion_name,
    c.level.charAt(0).toUpperCase() + c.level.slice(1),
    `${c.points_earned}/${c.points_possible}`,
    c.confidence,
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['Criterion', 'Level', 'Score', 'Confidence']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [0, 128, 128],
      textColor: 255,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 30 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
    },
    margin: { left: margin, right: margin },
  })

  // Get Y position after table
  yPos = (doc as any).lastAutoTable.finalY + 15

  // === DETAILED CRITERION BREAKDOWN ===
  criteriaList.forEach((criterion, index) => {
    checkPageOverflow(80)
    
    // Criterion header
    doc.setFillColor(245, 245, 245)
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 12, 2, 2, 'F')
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 40, 40)
    doc.text(`${index + 1}. ${criterion.criterion_name}`, margin + 5, yPos + 8)
    
    // Score on right
    doc.setFontSize(11)
    doc.setTextColor(0, 128, 128)
    doc.text(
      `${criterion.points_earned}/${criterion.points_possible} (${criterion.level})`,
      pageWidth - margin - 40,
      yPos + 8
    )
    
    yPos += 18
    
    // Reasoning
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(80, 80, 80)
    doc.text('Reasoning:', margin, yPos)
    yPos += 5
    
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    const reasoningLines = doc.splitTextToSize(criterion.reasoning || 'N/A', pageWidth - 2 * margin)
    doc.text(reasoningLines, margin, yPos)
    yPos += reasoningLines.length * 4 + 5
    
    // Evidence
    if (criterion.evidence && criterion.evidence.length > 0) {
      checkPageOverflow(20)
      
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(80, 80, 80)
      doc.text('Evidence:', margin, yPos)
      yPos += 5
      
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(80, 80, 80)
      
      criterion.evidence.forEach(ev => {
        checkPageOverflow(15)
        
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 128, 128)
        doc.text(ev.citation, margin, yPos)
        yPos += 4
        
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(60, 60, 60)
        const excerptLines = doc.splitTextToSize(`"${ev.excerpt}"`, pageWidth - 2 * margin - 10)
        doc.text(excerptLines, margin + 5, yPos)
        yPos += excerptLines.length * 4 + 2
        
        doc.setFont('helvetica', 'normal')
        const analysisLines = doc.splitTextToSize(ev.analysis || '', pageWidth - 2 * margin - 10)
        doc.text(analysisLines, margin + 5, yPos)
        yPos += analysisLines.length * 4 + 5
      })
    }
    
    // Feedback
    checkPageOverflow(20)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(80, 80, 80)
    doc.text('Feedback:', margin, yPos)
    yPos += 5
    
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    const feedbackLines = doc.splitTextToSize(criterion.feedback || 'N/A', pageWidth - 2 * margin)
    doc.text(feedbackLines, margin, yPos)
    yPos += feedbackLines.length * 4 + 15
  })

  // === AUTHENTICITY ANALYSIS ===
  if (assessment.authenticity) {
    checkPageOverflow(60)
    
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 40, 40)
    doc.text('Authenticity Analysis', margin, yPos)
    yPos += 10
    
    doc.setFontSize(12)
    doc.setTextColor(0, 128, 128)
    doc.text(`Score: ${assessment.authenticity.score}/100 (${assessment.authenticity.confidence} confidence)`, margin, yPos)
    yPos += 8
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    const authLines = doc.splitTextToSize(assessment.authenticity.overall_assessment || '', pageWidth - 2 * margin)
    doc.text(authLines, margin, yPos)
    yPos += authLines.length * 5 + 8
    
    // Flags
    if (assessment.authenticity.flags && assessment.authenticity.flags.length > 0) {
      checkPageOverflow(30)
      
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(200, 100, 0)
      doc.text('Flags for Instructor Review:', margin, yPos)
      yPos += 7
      
      doc.setFont('helvetica', 'normal')
      assessment.authenticity.flags.forEach(flag => {
        checkPageOverflow(15)
        
        const severityColor = flag.severity === 'high' ? [200, 50, 50] : 
                             flag.severity === 'medium' ? [200, 150, 0] : [100, 100, 100]
        doc.setTextColor(...severityColor as [number, number, number])
        doc.text(`[${flag.severity.toUpperCase()}] ${flag.description}`, margin + 5, yPos)
        yPos += 5
        
        doc.setTextColor(80, 80, 80)
        const evidenceLines = doc.splitTextToSize(`Evidence: ${flag.evidence}`, pageWidth - 2 * margin - 10)
        doc.text(evidenceLines, margin + 10, yPos)
        yPos += evidenceLines.length * 4 + 5
      })
    }
    
    // Positive indicators
    if (assessment.authenticity.positive_indicators && assessment.authenticity.positive_indicators.length > 0) {
      checkPageOverflow(30)
      
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 150, 100)
      doc.text('Positive Indicators:', margin, yPos)
      yPos += 7
      
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      assessment.authenticity.positive_indicators.forEach(ind => {
        checkPageOverflow(10)
        doc.text(`+ ${ind}`, margin + 5, yPos)
        yPos += 5
      })
    }
  }

  // === FOOTER ===
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `ProcessPulse Assessment Report - Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }

  // Save the PDF
  const filename = options.studentName 
    ? `ProcessPulse_Assessment_${options.studentName.replace(/\s+/g, '_')}.pdf`
    : `ProcessPulse_Assessment_${new Date().toISOString().split('T')[0]}.pdf`
  
  doc.save(filename)
}

