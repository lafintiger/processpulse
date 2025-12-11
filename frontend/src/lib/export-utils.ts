/**
 * Export Utilities
 * 
 * Functions for exporting documents to various formats.
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { saveAs } from 'file-saver'

/**
 * Convert HTML content to plain text
 */
export function htmlToPlainText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

/**
 * Parse HTML into structured content for DOCX
 */
function parseHtmlToDocxElements(html: string): Paragraph[] {
  const div = document.createElement('div')
  div.innerHTML = html
  const paragraphs: Paragraph[] = []
  
  function processNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim()
      if (text) {
        paragraphs.push(new Paragraph({
          children: [new TextRun(text)]
        }))
      }
      return
    }
    
    if (node.nodeType !== Node.ELEMENT_NODE) return
    
    const element = node as HTMLElement
    const tagName = element.tagName.toLowerCase()
    
    switch (tagName) {
      case 'h1':
        paragraphs.push(new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: element.textContent || '', bold: true })]
        }))
        break
        
      case 'h2':
        paragraphs.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: element.textContent || '', bold: true })]
        }))
        break
        
      case 'h3':
        paragraphs.push(new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun({ text: element.textContent || '', bold: true })]
        }))
        break
        
      case 'p':
        const runs: TextRun[] = []
        processInlineElements(element, runs)
        if (runs.length > 0) {
          paragraphs.push(new Paragraph({ children: runs }))
        }
        break
        
      case 'ul':
      case 'ol':
        element.querySelectorAll('li').forEach((li, index) => {
          const bullet = tagName === 'ul' ? '• ' : `${index + 1}. `
          paragraphs.push(new Paragraph({
            children: [new TextRun(bullet + (li.textContent || ''))]
          }))
        })
        break
        
      case 'blockquote':
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: element.textContent || '', italics: true })],
          indent: { left: 720 } // 0.5 inch indent
        }))
        break
        
      default:
        // Recursively process children
        element.childNodes.forEach(child => processNode(child))
    }
  }
  
  function processInlineElements(element: HTMLElement, runs: TextRun[]): void {
    element.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent || ''
        if (text) {
          runs.push(new TextRun(text))
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement
        const tag = el.tagName.toLowerCase()
        const text = el.textContent || ''
        
        switch (tag) {
          case 'strong':
          case 'b':
            runs.push(new TextRun({ text, bold: true }))
            break
          case 'em':
          case 'i':
            runs.push(new TextRun({ text, italics: true }))
            break
          case 'u':
            runs.push(new TextRun({ text, underline: {} }))
            break
          case 'a':
            runs.push(new TextRun({ text, underline: {}, color: '0000FF' }))
            break
          default:
            runs.push(new TextRun(text))
        }
      }
    })
  }
  
  div.childNodes.forEach(child => processNode(child))
  
  // If no paragraphs were created, create one from the text content
  if (paragraphs.length === 0 && div.textContent) {
    paragraphs.push(new Paragraph({
      children: [new TextRun(div.textContent)]
    }))
  }
  
  return paragraphs
}

/**
 * Export document to DOCX format
 */
export async function exportToDocx(
  title: string,
  htmlContent: string,
  filename?: string
): Promise<void> {
  const paragraphs = parseHtmlToDocxElements(htmlContent)
  
  // Add title
  const allParagraphs = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: title, bold: true, size: 48 })]
    }),
    new Paragraph({ children: [] }), // Empty line after title
    ...paragraphs
  ]
  
  const doc = new Document({
    sections: [{
      properties: {},
      children: allParagraphs
    }]
  })
  
  const blob = await Packer.toBlob(doc)
  const safeFilename = (filename || title).replace(/[^a-z0-9]/gi, '_')
  saveAs(blob, `${safeFilename}.docx`)
}

/**
 * Export document to plain text
 */
export function exportToTxt(
  title: string,
  htmlContent: string,
  filename?: string
): void {
  const text = `${title}\n${'='.repeat(title.length)}\n\n${htmlToPlainText(htmlContent)}`
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const safeFilename = (filename || title).replace(/[^a-z0-9]/gi, '_')
  saveAs(blob, `${safeFilename}.txt`)
}

/**
 * Export document to HTML
 */
export function exportToHtml(
  title: string,
  htmlContent: string,
  filename?: string
): void {
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: Georgia, 'Times New Roman', serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    h1 { font-size: 2em; margin-bottom: 0.5em; }
    h2 { font-size: 1.5em; margin-top: 1.5em; }
    h3 { font-size: 1.25em; margin-top: 1.25em; }
    blockquote {
      border-left: 3px solid #ccc;
      margin-left: 0;
      padding-left: 1em;
      color: #666;
      font-style: italic;
    }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${htmlContent}
</body>
</html>`
  
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' })
  const safeFilename = (filename || title).replace(/[^a-z0-9]/gi, '_')
  saveAs(blob, `${safeFilename}.html`)
}

