/**
 * Comprehensive tests for the content-aware chunking library
 */

import { describe, it, expect } from 'vitest';
import { 
  chunkText, 
  createHierarchicalChunks, 
  createFixedLengthChunks,
  analyzeChunkingQuality,
  splitByHeadings,
  extractDocumentTitle,
  cleanMarkdown
} from '../src/index.js';

describe('Content-Aware Chunking', () => {
  const structuredDocument = `
# AI Technology Overview

## Machine Learning
Machine learning algorithms enable computers to learn and improve from experience without being explicitly programmed. Key techniques include supervised learning, unsupervised learning, and reinforcement learning.

Supervised learning uses labeled training data to learn a mapping function from inputs to outputs. This is the most common type of machine learning.

## Deep Learning
Deep learning is a subset of machine learning that uses neural networks with multiple layers to model and understand complex patterns in data.

Deep learning has revolutionized many fields including computer vision, natural language processing, and speech recognition.
`;

  const unstructuredDocument = `
This is a long paragraph without any clear headings or structure. It contains multiple sentences that discuss various topics related to artificial intelligence and machine learning. The content flows from one idea to the next without clear section breaks or hierarchical organization. This type of document would typically benefit from fixed-length chunking rather than hierarchical chunking because there are no clear semantic boundaries to respect. The text continues with more information about AI applications, challenges, and future prospects.
`;

  describe('chunkText', () => {
    it('should return empty chunks for empty input', () => {
      const result = chunkText('');
      expect(result.chunks).toEqual([]);
      expect(result.method).toBe('content_aware_hierarchical');
    });

    it('should use hierarchical chunking for structured documents', () => {
      const result = chunkText(structuredDocument, 1000, 80);
      expect(result.method).toBe('content_aware_hierarchical');
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks[0]).toContain('Title: AI Technology Overview');
    });

    it('should use fixed-length chunking for unstructured documents', () => {
      const result = chunkText(unstructuredDocument, 1000, 80);
      expect(result.method).toBe('fixed_length');
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks[0]).not.toContain('Title:');
    });

    it('should respect maxChunkSize parameter', () => {
      const result = chunkText(structuredDocument, 500, 80);
      expect(result.chunks.every(chunk => chunk.length <= 500)).toBe(true);
    });
  });

  describe('createHierarchicalChunks', () => {
    it('should create chunks with proper structure', () => {
      const chunks = createHierarchicalChunks(structuredDocument, 1000);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toContain('Title: AI Technology Overview');
      expect(chunks[0]).toContain('Section: Machine Learning');
      expect(chunks[0]).toContain('Content:');
    });

    it('should handle documents without headings', () => {
      const chunks = createHierarchicalChunks(unstructuredDocument, 1000);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toContain('Title: Document');
      expect(chunks[0]).toContain('Section: Document');
    });
  });

  describe('createFixedLengthChunks', () => {
    it('should create chunks without metadata prefixes', () => {
      const chunks = createFixedLengthChunks(unstructuredDocument, 800, 80);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).not.toContain('Title:');
      expect(chunks[0]).not.toContain('Section:');
    });

    it('should respect maxChunkSize parameter', () => {
      const chunks = createFixedLengthChunks(unstructuredDocument, 500, 80);
      expect(chunks.every(chunk => chunk.length <= 500)).toBe(true);
    });

    it('should include overlap between chunks', () => {
      const chunks = createFixedLengthChunks(unstructuredDocument, 800, 80);
      if (chunks.length > 1) {
        // Check that there's some overlap between consecutive chunks
        const overlap = chunks[0].length + chunks[1].length - unstructuredDocument.length;
        expect(overlap).toBeGreaterThan(0);
      }
    });
  });

  describe('analyzeChunkingQuality', () => {
    it('should analyze hierarchical chunks correctly', () => {
      const result = chunkText(structuredDocument, 1000, 80);
      const stats = analyzeChunkingQuality(result.chunks, result.method);
      
      expect(stats.totalChunks).toBe(result.chunks.length);
      expect(stats.method).toBe('content_aware_hierarchical');
      expect(stats.averageChunkSize).toBeGreaterThan(0);
      expect(stats.sentenceBoundaryPreservation).toBeGreaterThanOrEqual(0);
      expect(stats.sentenceBoundaryPreservation).toBeLessThanOrEqual(100);
    });

    it('should analyze fixed-length chunks correctly', () => {
      const result = chunkText(unstructuredDocument, 800, 80);
      const stats = analyzeChunkingQuality(result.chunks, result.method);
      
      expect(stats.totalChunks).toBe(result.chunks.length);
      expect(stats.method).toBe('fixed_length');
      expect(stats.averageChunkSize).toBeGreaterThan(0);
    });
  });

  describe('Utility Functions', () => {
    it('splitByHeadings should extract sections correctly', () => {
      const sections = splitByHeadings(structuredDocument);
      expect(sections.length).toBeGreaterThan(0);
      expect(sections[0].title).toBe('Machine Learning');
      expect(sections[0].content).toContain('Machine learning algorithms');
    });

    it('extractDocumentTitle should extract main title', () => {
      const title = extractDocumentTitle(structuredDocument);
      expect(title).toBe('AI Technology Overview');
    });

    it('cleanMarkdown should remove markdown artifacts', () => {
      const dirtyText = '## Heading\n**Bold** and *italic* text with [links](url)';
      const cleaned = cleanMarkdown(dirtyText);
      expect(cleaned).not.toContain('##');
      expect(cleaned).not.toContain('**');
      expect(cleaned).not.toContain('*');
      expect(cleaned).not.toContain('[links](url)');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very short documents', () => {
      const result = chunkText('Short text.', 1000, 80);
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should handle documents with only headings', () => {
      const headingOnly = '# Title\n## Section 1\n### Subsection';
      const result = chunkText(headingOnly, 1000, 80);
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should handle documents with special characters', () => {
      const specialChars = 'Text with émojis 🚀 and spëcial chars.';
      const result = chunkText(specialChars, 1000, 80);
      expect(result.chunks.length).toBeGreaterThan(0);
    });
  });
});
