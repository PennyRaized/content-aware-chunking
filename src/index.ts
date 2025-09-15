/**
 * Content-Aware Chunking Library
 * 
 * Main exports for the content-aware chunking library
 */

// Main chunking functions
export { 
  chunkText,
  createHierarchicalChunks,
  createFixedLengthChunks,
  shouldUseFixedLengthFallback
} from './chunking.js';

// Utility functions
export {
  splitByHeadings,
  splitSectionIntoChunks,
  extractDocumentTitle,
  cleanMarkdown,
  analyzeChunkingQuality
} from './chunking.js';

// Type definitions
export type {
  ChunkResult,
  ChunkingOptions,
  Section,
  ChunkingConfig,
  FallbackCriteria,
  ChunkingStats,
  ChunkMetadata,
  DocumentChunk
} from './types.js';

// Default export for convenience
export { chunkText as default } from './chunking.js';
