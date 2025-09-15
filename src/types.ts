/**
 * TypeScript interfaces for content-aware chunking
 */

export interface ChunkResult {
  chunks: string[];
  method: 'content_aware_hierarchical' | 'fixed_length';
}

export interface ChunkingOptions {
  maxChunkSize?: number;
  overlapSize?: number;
  targetMax?: number;
  targetMin?: number;
}

export interface Section {
  title: string;
  content: string;
}

export interface ChunkMetadata {
  chunk_index: number;
  total_chunks: number;
  chunking_method: 'content_aware_hierarchical' | 'fixed_length';
  queued_for_embedding?: boolean;
  queued_at?: string;
}

export interface DocumentChunk {
  id?: string;
  document_id?: string;
  chunk_text: string;
  embedding?: number[] | null;
  chunk_order: number;
  metadata: ChunkMetadata;
}

export interface ChunkingConfig {
  maxChunkSize: number;
  overlapSize: number;
  adjustedTargetMax: number;
  targetMin: number;
}

export interface FallbackCriteria {
  noChunks: boolean;
  singleOversizedChunk: boolean;
  allGenericSections: boolean;
  brokenSentences: boolean;
  tooFewChunks: boolean;
  tooManyLargeChunks: boolean;
  averageTooLarge: boolean;
}

export interface ChunkingStats {
  totalChunks: number;
  method: 'content_aware_hierarchical' | 'fixed_length';
  averageChunkSize: number;
  minChunkSize: number;
  maxChunkSize: number;
  sentenceBoundaryPreservation: number;
  fallbackTriggered: boolean;
  fallbackReasons: string[];
}
