/**
 * Content-Aware Chunking Library
 * 
 * Intelligent document chunking for RAG systems with automatic fallback
 * between hierarchical content-aware chunking and fixed-length chunking.
 */

import type { ChunkResult, ChunkingOptions, Section, ChunkingConfig, FallbackCriteria, ChunkingStats } from './types.js';

/**
 * Main chunking function with intelligent method selection
 * 
 * @param text - The document text to chunk
 * @param maxChunkSize - Maximum chunk size in characters (default: 1000)
 * @param overlapSize - Overlap size for fixed-length chunking (default: 100)
 * @returns ChunkResult with chunks and method used
 */
export function chunkText(text: string, maxChunkSize: number = 1000, overlapSize: number = 100): ChunkResult {
  if (!text || text.trim() === '') {
    return { chunks: [], method: 'content_aware_hierarchical' };
  }

  // Try hierarchical chunking first
  const hierarchicalChunks = createHierarchicalChunks(text, maxChunkSize);
  
  // Check if hierarchical chunking produced good results
  if (shouldUseFixedLengthFallback(text, hierarchicalChunks, maxChunkSize)) {
    return { chunks: createFixedLengthChunks(text, maxChunkSize, overlapSize), method: 'fixed_length' };
  }
  
  return { chunks: hierarchicalChunks, method: 'content_aware_hierarchical' };
}

/**
 * Create hierarchical chunks with content-aware boundaries
 * 
 * @param text - The document text to chunk
 * @param targetMax - Target maximum chunk size (default: 1000)
 * @returns Array of hierarchical chunks with context
 */
export function createHierarchicalChunks(text: string, targetMax: number = 1000): string[] {
  const chunks: string[] = [];
  // Reduce target size to respect 512 token limit (~2000 characters max)
  const adjustedTargetMax = Math.min(targetMax, 1800); // Leave room for Title/Section headers
  const targetMin = Math.floor(adjustedTargetMax * 0.6); // 60% of target max as minimum
  
  // First, split by major headings (##, ###)
  const sections = splitByHeadings(text);
  
  // If no headings found, treat entire text as one section
  if (sections.length === 0) {
    sections.push({ title: 'Document', content: text });
  }
  
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex];
    const sectionTitle = section.title || `Section ${sectionIndex + 1}`;
    
    // Clean the section content
    const cleanedContent = cleanMarkdown(section.content);
    
    // Split large sections into smaller chunks while respecting paragraph boundaries
    const sectionChunks = splitSectionIntoChunks(cleanedContent, targetMin, adjustedTargetMax);
    
    // Add context to each chunk
    sectionChunks.forEach((chunkContent, chunkIndex) => {
      const fullChunk = `Title: ${extractDocumentTitle(text)}\nSection: ${sectionTitle}\nContent: ${chunkContent}`;
      chunks.push(fullChunk);
    });
  }
  
  return chunks;
}

/**
 * Create fixed-length chunks with sentence boundary awareness
 * 
 * @param text - The document text to chunk
 * @param maxChunkSize - Maximum chunk size in characters
 * @param overlapSize - Overlap size between chunks
 * @returns Array of fixed-length chunks
 */
export function createFixedLengthChunks(text: string, maxChunkSize: number, overlapSize: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + maxChunkSize;
    
    // Try to break at sentence boundary
    if (end < text.length) {
      const lastSentence = text.lastIndexOf('.', end);
      const lastParagraph = text.lastIndexOf('\n\n', end);
      const breakPoint = Math.max(lastSentence, lastParagraph);
      
      if (breakPoint > start + maxChunkSize * 0.5) {
        end = breakPoint + 1;
      }
    }
    
    const chunk = text.substring(start, end).trim();
    if (chunk.length > 0) {
      // For fixed-length chunking, just use the raw content without any structure
      chunks.push(chunk);
    }
    
    start = end - overlapSize;
    if (start >= text.length) break;
  }
  
  return chunks;
}

/**
 * Check if hierarchical chunking produced poor results and should fall back to fixed-length
 * 
 * @param originalText - The original document text
 * @param chunks - The chunks produced by hierarchical chunking
 * @param maxChunkSize - The maximum chunk size
 * @returns True if should fall back to fixed-length chunking
 */
export function shouldUseFixedLengthFallback(originalText: string, chunks: string[], maxChunkSize: number): boolean {
  // If no chunks were created, definitely fall back
  if (chunks.length === 0) {
    return true;
  }
  
  // If only one chunk and it's extremely large (over 3x max size), fall back
  if (chunks.length === 1 && chunks[0].length > maxChunkSize * 3) {
    return true;
  }
  
  // Check if all chunks have the same generic section (no real headings found)
  const allSameSection = chunks.every(chunk => 
    chunk.includes('Section: Section 1') || chunk.includes('Section: Document')
  );
  if (allSameSection) {
    return true;
  }
  
  // Check if chunks don't end with sentence boundaries (broken sentences)
  const chunksWithBrokenSentences = chunks.filter(chunk => {
    const contentMatch = chunk.match(/Content: (.+)$/s);
    if (!contentMatch) return false;
    const content = contentMatch[1];
    return !content.trim().match(/[.!?]$/);
  });
  
  if (chunksWithBrokenSentences.length > chunks.length * 0.5) {
    return true;
  }
  
  // If chunks are extremely few relative to text size (less than 1 chunk per 3000 chars), fall back
  const expectedMinChunks = Math.ceil(originalText.length / 3000);
  if (chunks.length < expectedMinChunks) {
    return true;
  }
  
  // If most chunks are extremely large (over 2x max size), fall back
  const largeChunks = chunks.filter(chunk => chunk.length > maxChunkSize * 2);
  if (largeChunks.length > chunks.length * 0.6) {
    return true;
  }
  
  // If average chunk size is extremely large (over 1.8x max size), fall back
  const avgChunkSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length;
  if (avgChunkSize > maxChunkSize * 1.8) {
    return true;
  }
  
  return false;
}

/**
 * Split text by headings (#, ##, ###)
 * 
 * @param text - The document text to split
 * @returns Array of sections with title and content
 */
export function splitByHeadings(text: string): Section[] {
  const sections: Section[] = [];
  const lines = text.split('\n');
  let currentSection = { title: '', content: '' };
  let hasHeadings = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check if it's a heading (#, ##, or ###)
    if (trimmedLine.match(/^#{1,3}\s+/)) {
      hasHeadings = true;
      
      // Save previous section if it has content
      if (currentSection.content.trim()) {
        sections.push({ ...currentSection });
      }
      
      // Start new section
      currentSection = {
        title: trimmedLine.replace(/^#{1,3}\s+/, '').trim(),
        content: ''
      };
    } else {
      // Add line to current section
      currentSection.content += (currentSection.content ? '\n' : '') + line;
    }
  }
  
  // Add final section only if we found headings
  if (hasHeadings && currentSection.content.trim()) {
    sections.push(currentSection);
  }
  
  return sections;
}

/**
 * Split a section into smaller chunks while respecting paragraph boundaries
 * 
 * @param content - The section content to split
 * @param targetMin - Minimum chunk size
 * @param targetMax - Maximum chunk size
 * @returns Array of chunk strings
 */
export function splitSectionIntoChunks(content: string, targetMin: number, targetMax: number): string[] {
  const chunks: string[] = [];
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    const testChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph.trim();
    
    if (testChunk.length <= targetMax) {
      currentChunk = testChunk;
    } else {
      // If current chunk is large enough, save it
      if (currentChunk.length >= targetMin) {
        chunks.push(currentChunk);
        currentChunk = paragraph.trim();
      } else {
        // If current chunk is too small, try to split the paragraph
        if (paragraph.length > targetMax) {
          // Split long paragraph by sentences
          const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim());
          let sentenceChunk = '';
          
          for (const sentence of sentences) {
            const testSentenceChunk = sentenceChunk + (sentenceChunk ? '. ' : '') + sentence.trim();
            
            if (testSentenceChunk.length <= targetMax) {
              sentenceChunk = testSentenceChunk;
            } else {
              if (sentenceChunk.length >= targetMin) {
                chunks.push(sentenceChunk);
                sentenceChunk = sentence.trim();
              } else {
                // Force add if it's the only content
                chunks.push(sentence.trim());
              }
            }
          }
            
            if (sentenceChunk.length >= targetMin) {
              currentChunk = sentenceChunk;
            } else {
              currentChunk = '';
            }
          } else {
            // Add small paragraph to current chunk
            currentChunk = testChunk;
          }
        }
      }
    }
    
    // Add final chunk - be more lenient with minimum size for final chunks
    if (currentChunk.length >= Math.floor(targetMin * 0.5)) {
      chunks.push(currentChunk);
    } else if (currentChunk.length > 0) {
      // If it's very small, add it to the last chunk or create a new one
      if (chunks.length > 0) {
        chunks[chunks.length - 1] += '\n\n' + currentChunk;
      } else {
        chunks.push(currentChunk);
      }
    }
    
    return chunks;
}

/**
 * Extract document title from text
 * 
 * @param text - The document text
 * @returns The document title or 'Document' if not found
 */
export function extractDocumentTitle(text: string): string {
  const titleMatch = text.match(/^#\s+(.+)$/m);
  return titleMatch ? titleMatch[1].trim() : 'Document';
}

/**
 * Enhanced markdown cleaning function
 * 
 * @param content - The content to clean
 * @returns Cleaned content without markdown artifacts
 */
export function cleanMarkdown(content: string): string {
  let cleaned = content;
  
  // Remove markdown structure
  cleaned = cleaned
    .replace(/^#{1,6}\s+/gm, '') // Remove heading symbols
    .replace(/\|/g, ' ') // Remove table dividers
    .replace(/^[-*+]\s+/gm, '') // Remove list markers
    .replace(/```[\s\S]*?```/g, ' ') // Remove code blocks
    .replace(/`[^`]+`/g, ' ') // Remove inline code
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold markers
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Convert links to plain text
  
  // Remove citations
  cleaned = cleaned
    .replace(/\([^)]*\d{4}[^)]*\)/g, '') // Remove (Author, 2025) patterns
    .replace(/\([^)]*Research[^)]*\)/gi, '') // Remove (Research Nester, 2025)
    .replace(/\([^)]*Source[^)]*\)/gi, '') // Remove (Source: XYZ)
    .replace(/\([^)]*Figure[^)]*\)/gi, '') // Remove (Figure 1.2)
    .replace(/\([^)]*Table[^)]*\)/gi, ''); // Remove (Table 1.2)
  
  // Normalize whitespace
  cleaned = cleaned
    .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
  
  return cleaned;
}

/**
 * Analyze chunking quality and provide statistics
 * 
 * @param chunks - Array of chunks to analyze
 * @param method - The chunking method used
 * @returns Chunking statistics
 */
export function analyzeChunkingQuality(chunks: string[], method: 'content_aware_hierarchical' | 'fixed_length'): ChunkingStats {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      method,
      averageChunkSize: 0,
      minChunkSize: 0,
      maxChunkSize: 0,
      sentenceBoundaryPreservation: 0,
      fallbackTriggered: method === 'fixed_length',
      fallbackReasons: []
    };
  }

  const chunkSizes = chunks.map(chunk => chunk.length);
  const averageChunkSize = chunkSizes.reduce((sum, size) => sum + size, 0) / chunkSizes.length;
  const minChunkSize = Math.min(...chunkSizes);
  const maxChunkSize = Math.max(...chunkSizes);

  // Calculate sentence boundary preservation
  let sentencesEndingProperly = 0;
  for (const chunk of chunks) {
    const content = method === 'content_aware_hierarchical' 
      ? chunk.match(/Content: (.+)$/s)?.[1] || chunk
      : chunk;
    
    if (content.trim().match(/[.!?]$/)) {
      sentencesEndingProperly++;
    }
  }
  const sentenceBoundaryPreservation = (sentencesEndingProperly / chunks.length) * 100;

  return {
    totalChunks: chunks.length,
    method,
    averageChunkSize: Math.round(averageChunkSize),
    minChunkSize,
    maxChunkSize,
    sentenceBoundaryPreservation: Math.round(sentenceBoundaryPreservation * 100) / 100,
    fallbackTriggered: method === 'fixed_length',
    fallbackReasons: []
  };
}
