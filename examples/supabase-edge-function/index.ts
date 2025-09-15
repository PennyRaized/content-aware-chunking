import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Declare Supabase AI namespace
declare global {
  namespace Supabase {
    namespace ai {
      class Session {
        constructor(model: string);
        run(text: string, options?: { mean_pool?: boolean; normalize?: boolean }): Promise<number[]>;
      }
    }
  }
}

// Environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ProcessDocumentRequest {
  source_type: 'pdf' | 'market_report' | 'vc_knowledge' | 'startup_knowledge' | 'innovation_knowledge' | 'admin_knowledge';
  source_id: string;
  user_id: string;
  is_public?: boolean;
  title?: string;
  metadata?: Record<string, any>;
  existing_document_id?: string; // If provided, use this specific document instead of creating new one
}

// Safe document creation function with race condition handling
async function getOrCreateDocument(
  sourceType: string,
  sourceId: string,
  userId: string,
  title: string,
  isPublic: boolean = false,
  metadata: Record<string, any> = {}
): Promise<any> {
  const invocationTime = new Date().toISOString();
  console.log(`[process-document-for-rag] getOrCreateDocument invoked at ${invocationTime} with:`, {
    type: sourceType,
    source_id: sourceId,
    user_id: userId,
    title,
    is_public: isPublic,
    metadata
  });

  // Defensive: Check that sourceId is a non-empty string
  console.log('[process-document-for-rag] Defensive check: sourceId value and type:', sourceId, typeof sourceId);
  if (!sourceId || typeof sourceId !== 'string' || sourceId.trim() === '') {
    console.error('[process-document-for-rag] ERROR: sourceId is missing, null, or not a string before upsert. Aborting document creation.');
    throw new Error('sourceId is required and must be a non-empty string for document creation');
  }
  
  // First, try to find existing document with same source_type and source_id
  const { data: existingDocument, error: findError } = await supabase
    .from('documents')
    .select('*')
    .eq('type', sourceType)
    .eq('source_id', sourceId)
    .single();
  
  if (existingDocument && !findError) {
    if (!existingDocument.source_id) {
      console.warn(`[process-document-for-rag] WARNING: Found existing document with NULL source_id (ID: ${existingDocument.id}). This is a data integrity issue. Will NOT update this document. Returning as-is.`);
      return existingDocument;
    }
    console.log(`[process-document-for-rag] Found existing document with ID ${existingDocument.id}, source_id: ${existingDocument.source_id}`);
    // Build the update payload conditionally
    const updatePayload: { [key: string]: any } = {
      status: 'processing',
      metadata: {
        ...existingDocument.metadata,
        ...metadata,
        last_processing_attempt: new Date().toISOString(),
        reprocessing_count: (existingDocument.metadata?.reprocessing_count || 0) + 1
      }
    };
    // Only update the title if a new, non-empty title is provided
    if (title && typeof title === 'string' && title.trim() !== '') {
      updatePayload.title = title;
    }
    // Never update source_id here (preserve it)
    const { data: updatedDoc, error: updateError } = await supabase
      .from('documents')
      .update(updatePayload)
      .eq('id', existingDocument.id)
      .select()
      .single();
    if (updateError) {
      console.warn(`[process-document-for-rag] Error updating existing document:`, updateError);
      // Return the original document if update fails
      return existingDocument;
    }
    if (!updatedDoc.source_id) {
      console.error(`[process-document-for-rag] ERROR: Updated document still has NULL source_id (ID: ${updatedDoc.id}). Data integrity issue.`);
    }
    console.log(`[process-document-for-rag] Updated existing document status to processing, source_id: ${updatedDoc.source_id}`);
    return updatedDoc;
  }
  
  // No existing document found, create new one
  console.log(`[process-document-for-rag] No existing document found, creating new one`);
  // Before upsert, log the values being used
  console.log('[process-document-for-rag] Upserting document with:', {
    title, type: sourceType, source_id: sourceId, user_id: userId, is_public: isPublic
  });
  // Use upsert to handle race conditions
  const { data: newDocument, error: createError } = await supabase
    .from('documents')
    .upsert({
      title: title,
      type: sourceType,
      source_id: sourceId,
      user_id: userId,
      is_public: isPublic,
      status: 'processing',
      metadata: {
        ...metadata,
        created_at: new Date().toISOString(),
        first_processing_attempt: new Date().toISOString()
      }
    }, {
      onConflict: 'type,source_id', // Use the unique constraint
      ignoreDuplicates: false
    })
    .select()
    .single();
  if (createError) {
    // If upsert failed due to race condition, try to fetch the document that was created by another process
    if (createError.message.includes('duplicate key') || createError.message.includes('violates unique constraint')) {
      console.log(`[process-document-for-rag] Race condition detected, fetching existing document`);
      const { data: raceDocument, error: raceError } = await supabase
        .from('documents')
        .select('*')
        .eq('type', sourceType)
        .eq('source_id', sourceId)
        .single();
      if (raceDocument && !raceError) {
        if (!raceDocument.source_id) {
          console.error(`[process-document-for-rag] ERROR: Race document has NULL source_id (ID: ${raceDocument.id}). Data integrity issue.`);
        }
        console.log(`[process-document-for-rag] Successfully retrieved document from race condition: ${raceDocument.id}, source_id: ${raceDocument.source_id}`);
        return raceDocument;
      }
    }
    throw new Error(`Failed to create document record: ${createError.message}`);
  }
  if (!newDocument.source_id) {
    console.error(`[process-document-for-rag] ERROR: Upserted document has NULL source_id (ID: ${newDocument.id}). Data integrity issue.`);
  }
  console.log(`[process-document-for-rag] Created new document record with ID ${newDocument.id}, source_id: ${newDocument.source_id}`);
  return newDocument;
}

// Enhanced hierarchical chunking function with content-aware boundaries and fallback
function chunkText(text: string, maxChunkSize: number = 1000, overlapSize: number = 100): { chunks: string[], method: string } {
  if (!text || text.trim() === '') {
    return { chunks: [], method: 'content_aware_hierarchical' };
  }

  // Try hierarchical chunking first
  const hierarchicalChunks = createHierarchicalChunks(text, maxChunkSize);
  
  // Check if hierarchical chunking produced good results
  if (shouldUseFixedLengthFallback(text, hierarchicalChunks, maxChunkSize)) {
    console.log('[process-document-for-rag] Hierarchical chunking produced poor results, falling back to fixed-length chunking');
    return { chunks: createFixedLengthChunks(text, maxChunkSize, overlapSize), method: 'fixed_length' };
  }
  
  return { chunks: hierarchicalChunks, method: 'content_aware_hierarchical' };
}

// Create hierarchical chunks with content-aware boundaries
function createHierarchicalChunks(text: string, targetMax: number = 1000): string[] {
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

// Check if hierarchical chunking produced poor results and should fall back to fixed-length
function shouldUseFixedLengthFallback(originalText: string, chunks: string[], maxChunkSize: number): boolean {
  // If no chunks were created, definitely fall back
  if (chunks.length === 0) {
    return true;
  }
  
  // If only one chunk and it's extremely large (over 3x max size), fall back
  if (chunks.length === 1 && chunks[0].length > maxChunkSize * 3) {
    return true;
  }
  
  // NEW: Check if all chunks have the same generic section (no real headings found)
  const allSameSection = chunks.every(chunk => 
    chunk.includes('Section: Section 1') || chunk.includes('Section: Document')
  );
  if (allSameSection) {
    console.log('[process-document-for-rag] All chunks have generic section - no real headings found, falling back to fixed-length');
    return true;
  }
  
  // NEW: Check if chunks don't end with sentence boundaries (broken sentences)
  const chunksWithBrokenSentences = chunks.filter(chunk => {
    const contentMatch = chunk.match(/Content: (.+)$/s);
    if (!contentMatch) return false;
    const content = contentMatch[1];
    return !content.trim().match(/[.!?]$/);
  });
  
  if (chunksWithBrokenSentences.length > chunks.length * 0.5) {
    console.log('[process-document-for-rag] Most chunks have broken sentences, falling back to fixed-length');
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

// Create fixed-length chunks with sentence boundary awareness
function createFixedLengthChunks(text: string, maxChunkSize: number, overlapSize: number): string[] {
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
      // No Title: or Section: prefixes since they're not meaningful for fixed-length chunks
      chunks.push(chunk);
    }
    
    start = end - overlapSize;
    if (start >= text.length) break;
  }
  
  return chunks;
}

// Split text by headings (##, ###)
function splitByHeadings(text: string): Array<{ title: string; content: string }> {
  const sections: Array<{ title: string; content: string }> = [];
  const lines = text.split('\n');
  let currentSection = { title: '', content: '' };
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check if it's a heading (## or ###)
    if (trimmedLine.match(/^#{2,3}\s+/)) {
      // Save previous section if it has content
      if (currentSection.content.trim()) {
        sections.push({ ...currentSection });
      }
      
      // Start new section
      currentSection = {
        title: trimmedLine.replace(/^#{2,3}\s+/, '').trim(),
        content: ''
      };
    } else {
      // Add line to current section
      currentSection.content += (currentSection.content ? '\n' : '') + line;
    }
  }
  
  // Add final section
  if (currentSection.content.trim()) {
    sections.push(currentSection);
  }
  
  return sections;
}

// Split a section into smaller chunks while respecting paragraph boundaries
function splitSectionIntoChunks(content: string, targetMin: number, targetMax: number): string[] {
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

// Extract document title from text
function extractDocumentTitle(text: string): string {
  const titleMatch = text.match(/^#\s+(.+)$/m);
  return titleMatch ? titleMatch[1].trim() : 'Document';
}

// Enhanced markdown cleaning function
function cleanMarkdown(content: string): string {
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

// Function to extract metadata from report content (same as poll-cloud-run-status)
function extractReportMetadata(reportContent: string, requestPayload: {
  mode?: string;
  patent_query?: string;
  startup_name?: string;
  market?: string;
  topic?: string;
}): {
  title: string;
  type: string;
  description: string;
} {
  let title = 'Market Report';
  let type = 'Unknown Type';
  let description = 'No description available';

  // Extract title from the first heading in the report
  const titleMatch = reportContent.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  // Determine report type based on mode
  switch (requestPayload.mode) {
    case 'patent':
      type = 'Patent Analysis Report';
      // Extract description from patent query
      if (requestPayload.patent_query) {
        description = requestPayload.patent_query.split(':')[0] || requestPayload.patent_query;
      }
      break;
    case 'report':
      type = 'Competitor Analysis Report';
      if (requestPayload.startup_name) {
        description = `Analysis of ${requestPayload.startup_name}`;
      }
      break;
    case 'search':
      type = 'Quick Search Report';
      if (requestPayload.topic) {
        description = requestPayload.topic;
      }
      break;
    case 'sector-deep-dive':
      type = 'Sector Deep Dive Report';
      if (requestPayload.market) {
        description = `Comprehensive analysis of ${requestPayload.market} sector`;
      }
      break;
    default:
      type = 'Market Report';
  }

  // If we couldn't extract a title from the report, use the request payload
  if (title === 'Market Report') {
    if (requestPayload.patent_query) {
      title = requestPayload.patent_query.split(':')[0] || title;
    } else if (requestPayload.startup_name) {
      title = `${requestPayload.startup_name} - Competitor Analysis`;
    } else if (requestPayload.market) {
      title = `${requestPayload.market} - Market Analysis`;
    }
  }

  return { title, type, description };
}

// Function to fetch document content based on source type
async function fetchDocumentContent(sourceType: string, sourceId: string): Promise<{ text: string; title?: string; metadata?: any }> {
  console.log(`[process-document-for-rag] Fetching content for ${sourceType} with ID ${sourceId}`);
  
  if (sourceType === 'pdf') {
    // Try by id first
    let { data, error } = await supabase
      .from('pdf_extracted_texts')
      .select('content, original_filename, file_size, created_at')
      .eq('id', sourceId)
      .single();

    if (error || !data) {
      // Fallback: try by file_path
      const { data: dataByPath, error: errorByPath } = await supabase
        .from('pdf_extracted_texts')
        .select('content, original_filename, file_size, created_at')
        .eq('file_path', sourceId)
        .single();

      if (errorByPath || !dataByPath) {
        console.error(`[process-document-for-rag] ERROR: No extraction row found for id "${sourceId}" or file_path "${sourceId}". Aborting document creation.`);
        throw new Error(
          `Failed to fetch PDF content: No row found for id "${sourceId}" or file_path "${sourceId}".`
        );
      }
      data = dataByPath;
    }

    if (!data.content) {
      console.error(`[process-document-for-rag] ERROR: Extraction row found but content is empty for id "${sourceId}". Aborting document creation.`);
      throw new Error('PDF content not found or empty');
    }

    return {
      text: data.content,
      title: data.original_filename,
      metadata: {
        file_size: data.file_size,
        extracted_at: data.created_at
      }
    };
  } else if (sourceType === 'market_report') {
    // Fetch from report_jobs table - only process completed reports
    const { data, error } = await supabase
      .from('report_jobs')
      .select('result_data, request_payload, created_at, status')
      .eq('id', sourceId)
      .single();
    
    if (error) {
      throw new Error(`Failed to fetch market report: ${error.message}`);
    }
    
    // Check if the report job is completed
    if (!data || data.status !== 'completed') {
      throw new Error(`Market report job is not completed (status: ${data?.status || 'unknown'})`);
    }
    
    if (!data.result_data || !data.result_data.finalReport) {
      throw new Error('Market report content not found or empty');
    }
    
    // Use the same title extraction logic as poll-cloud-run-status
    const extractedMetadata = extractReportMetadata(data.result_data.finalReport, data.request_payload);
    
    return {
      text: data.result_data.finalReport,
      title: extractedMetadata.title, // Use extracted title as source of truth
      metadata: {
        report_type: data.result_data.report_type || 'unknown',
        generated_at: data.created_at,
        request_payload: data.request_payload,
        job_status: data.status,
        extracted_metadata: extractedMetadata // Include full metadata for consistency
      }
    };
  } else {
    // For other knowledge types, we'll implement custom handling later
    throw new Error(`Unsupported source type: ${sourceType}`);
  }
}

// Function to process chunks in batches - QUEUE-BASED APPROACH
async function processChunksBatch(
  chunks: string[], 
  document: any, 
  startIndex: number = 0, 
  batchSize: number = 5,
  globalChunkOffset: number = 0,
  chunkingMethod: string = 'content_aware_hierarchical'
): Promise<{ successfulChunks: number; failedChunks: number; chunkResults: Array<{ index: number; success: boolean; error?: string; id?: string }> }> {
  const chunkResults: Array<{ index: number; success: boolean; error?: string; id?: string }> = [];
  let successfulChunks = 0;
  let failedChunks = 0;
  
  console.log(`[process-document-for-rag] Processing batch starting at chunk ${startIndex}, batch size: ${batchSize}`);
  
  const endIndex = Math.min(startIndex + batchSize, chunks.length);
  
  // Process chunks sequentially to avoid CPU overload - QUEUE THEM INSTEAD
  for (let i = startIndex; i < endIndex; i++) {
    const chunk = chunks[i];
    const globalChunkIndex = globalChunkOffset + i;
    
    try {
      // Insert chunk WITHOUT embedding - let the queue system handle embedding generation
      const { data: chunkData, error: chunkError } = await supabase
        .from('document_chunks')
        .insert({
          document_id: document.id,
          chunk_text: chunk,
          embedding: null, // No embedding yet - will be generated by queue
          chunk_order: globalChunkIndex,
          metadata: {
            chunk_index: globalChunkIndex,
            total_chunks: chunks.length,
            queued_for_embedding: true,
            queued_at: new Date().toISOString(),
            chunking_method: chunkingMethod
          }
        })
        .select('id')
        .single();
      
      if (chunkError) {
        console.error(`[process-document-for-rag] Error inserting chunk ${globalChunkIndex}:`, chunkError);
        chunkResults.push({ index: globalChunkIndex, success: false, error: chunkError.message });
        failedChunks++;
      } else {
        // Queue this chunk for embedding generation with HIGH PRIORITY
        const { error: queueError } = await supabase.rpc('pgmq_send', {
          queue_name: 'document_chunk_embeddings',
          message: {
            chunk_id: chunkData.id,
            document_id: document.id,
            chunk_text: chunk,
            chunk_index: globalChunkIndex,
            total_chunks: chunks.length,
            priority: 'high', // High priority for new hierarchical chunks
            chunking_method: chunkingMethod,
            created_at: new Date().toISOString()
          }
        });
        
        if (queueError) {
          console.error(`[process-document-for-rag] Error queuing chunk ${globalChunkIndex}:`, queueError);
          chunkResults.push({ index: globalChunkIndex, success: false, error: queueError.message });
          failedChunks++;
        } else {
          chunkResults.push({ index: globalChunkIndex, success: true, id: chunkData.id });
          successfulChunks++;
          console.log(`[process-document-for-rag] Queued chunk ${globalChunkIndex} for embedding generation`);
        }
      }
      
    } catch (chunkProcessingError) {
      console.error(`[process-document-for-rag] Error processing chunk ${globalChunkIndex}:`, chunkProcessingError);
      const errorMessage = chunkProcessingError instanceof Error ? chunkProcessingError.message : 'Unknown error';
      chunkResults.push({ index: globalChunkIndex, success: false, error: errorMessage });
      failedChunks++;
    }
  }
  
  return { successfulChunks, failedChunks, chunkResults };
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ 
        error: 'Method not allowed. Use POST to process documents for RAG.' 
      }), 
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    // Add global timeout to prevent function from hanging
    const processingPromise = processDocumentWithTimeout(req);
    const timeoutPromise = new Promise<Response>((_, reject) => {
      setTimeout(() => reject(new Error('Function timeout after 60 seconds')), 60000);
    });
    return await Promise.race([processingPromise, timeoutPromise]);
  } catch (error) {
    console.error('[process-document-for-rag] Error processing document:', error);
    // Try to update document status to failed if we have a document reference
    if (typeof error === 'object' && error !== null && 'document' in error) {
      try {
        const document = (error as { document: { id: string } }).document;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await supabase
          .from('documents')
          .update({ 
            status: 'failed',
            metadata: {
              error: errorMessage,
              failed_at: new Date().toISOString()
            }
          })
          .eq('id', document.id);
      } catch (updateError) {
        console.error('[process-document-for-rag] Error updating failed status:', updateError);
      }
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process document', 
        details: errorMessage 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function processDocumentWithTimeout(req: Request): Promise<Response> {
  try {
    // Parse request body
    const requestBody: ProcessDocumentRequest = await req.json();
    
    // Validate required fields
    const { source_type, source_id, user_id } = requestBody;
    if (!source_type || !source_id || !user_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields', 
          details: 'source_type, source_id, and user_id are required' 
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log(`[process-document-for-rag] Processing ${source_type} document with ID ${source_id} for user ${user_id}`);
    console.log(`[process-document-for-rag] Request parameters:`, {
      source_type,
      source_id, 
      user_id,
      existing_document_id: requestBody.existing_document_id,
      title: requestBody.title,
      is_public: requestBody.is_public,
      metadata: requestBody.metadata
    });
    
    // Fetch document content
    let text, sourceTitle, sourceMetadata;
    try {
      const contentResult = await fetchDocumentContent(source_type, source_id);
      text = contentResult.text;
      sourceTitle = contentResult.title;
      sourceMetadata = contentResult.metadata;
      console.log(`[process-document-for-rag] Successfully fetched extraction row and content for source_id: ${source_id}`);
    } catch (fetchErr) {
      let errMsg = 'Unknown error';
      if (fetchErr instanceof Error) {
        errMsg = fetchErr.message;
      } else if (typeof fetchErr === 'object' && fetchErr && 'message' in fetchErr) {
        errMsg = (fetchErr as any).message;
      } else {
        errMsg = String(fetchErr);
      }
      console.error(`[process-document-for-rag] Aborting document processing due to extraction fetch error:`, errMsg);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch extraction row for document',
          details: errMsg
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Determine document title and metadata
    const documentTitle = requestBody.title || sourceTitle || `${source_type.charAt(0).toUpperCase() + source_type.slice(1)} Document`;
    const isPublic = requestBody.is_public !== undefined ? requestBody.is_public : false;
    const combinedMetadata = {
      ...sourceMetadata,
      ...requestBody.metadata
    };
    
    let document;
    
    if (requestBody.existing_document_id) {
      // Use specific existing document (for reprocessing)
      console.log(`[process-document-for-rag] Looking for existing document with ID: ${requestBody.existing_document_id}`);
      
      const { data: existingDoc, error: findError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', requestBody.existing_document_id)
        .single();
      
      if (existingDoc && !findError) {
        document = existingDoc;
        console.log(`[process-document-for-rag] Successfully found and using existing document with ID ${document.id}`);
        
        // Update document status and metadata for reprocessing
        const { data: updatedDoc, error: updateError } = await supabase
          .from('documents')
          .update({
            status: 'processing',
            metadata: {
              ...document.metadata,
              ...combinedMetadata,
              reprocessing_started: new Date().toISOString(),
              reprocessing_attempt: (document.metadata?.reprocessing_attempt || 0) + 1
            }
          })
          .eq('id', document.id)
          .select()
          .single();
        
        if (updateError) {
          console.warn(`[process-document-for-rag] Error updating document status:`, updateError);
        } else {
          document = updatedDoc;
          console.log(`[process-document-for-rag] Updated existing document status to processing`);
        }
      } else {
        console.error(`[process-document-for-rag] Specified document ID ${requestBody.existing_document_id} not found:`, findError);
        throw new Error(`Specified document ID ${requestBody.existing_document_id} not found`);
      }
    } else {
      // Use the safe document creation function
      document = await getOrCreateDocument(
        source_type,
        source_id,
        user_id,
        documentTitle,
        isPublic,
        combinedMetadata
      );
    }
    
    // Before chunking, delete only chunks with the same chunking method to prevent duplicates
    // Keep legacy chunks if we're creating content-aware chunks
    if (requestBody.metadata?.chunking_method === 'content_aware_hierarchical') {
      await supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', document.id)
        .eq('metadata->>chunking_method', 'content_aware_hierarchical');
    } else {
      // For legacy processing, delete all chunks
      await supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', document.id);
    }

    // Chunk the text with hierarchical, content-aware boundaries and fallback
    const chunkResult = chunkText(text, 1000, 80); // Hierarchical chunking with 800-1000 char target
    const chunks = chunkResult.chunks;
    const chunkingMethod = chunkResult.method;
    console.log(`[process-document-for-rag] Created ${chunks.length} chunks from document using ${chunkingMethod} method`);
    
    // Check for existing chunks if this is a resumption
    let startFromChunk = 0;
    const isResume = requestBody.metadata?.resume_processing;
    
    if (isResume) {
      // Get the highest chunk_order that already exists
      const { data: existingChunks, error: chunkCheckError } = await supabase
        .from('document_chunks')
        .select('chunk_order')
        .eq('document_id', document.id)
        .order('chunk_order', { ascending: false })
        .limit(1);
        
      if (chunkCheckError) {
        console.warn(`[process-document-for-rag] Error checking existing chunks:`, chunkCheckError);
      } else if (existingChunks && existingChunks.length > 0) {
        startFromChunk = existingChunks[0].chunk_order + 1;
        console.log(`[process-document-for-rag] Resuming processing from chunk ${startFromChunk}`);
      }
    }
    
    // Set max chunks per run
    const maxChunksPerRun = 20; // Process all chunks in one run for complete RAG functionality
    const endChunk = Math.min(startFromChunk + maxChunksPerRun, chunks.length);
    const chunksToProcess = chunks.slice(startFromChunk, endChunk);
    if (endChunk < chunks.length) {
      console.log(`[process-document-for-rag] Document has ${chunks.length} chunks, processing chunks ${startFromChunk}-${endChunk-1}. ${chunks.length - endChunk} chunks remaining.`);
    } else if (startFromChunk > 0) {
      console.log(`[process-document-for-rag] Resuming processing: chunks ${startFromChunk}-${endChunk-1} of ${chunks.length} total chunks.`);
    }
    
    // Process chunks in batches
    let totalSuccessfulChunks = 0;
    let totalFailedChunks = 0;
    const allChunkResults = [];
    
    const batchSize = 10; // Process chunks in parallel for better performance, increased to 10
    
    for (let batchStartIndex = 0; batchStartIndex < chunksToProcess.length; batchStartIndex += batchSize) {
      try {
        const { successfulChunks, failedChunks, chunkResults } = await processChunksBatch(
          chunksToProcess, 
          document, 
          batchStartIndex, 
          batchSize,
          startFromChunk, // Pass the global start index for proper chunk ordering
          chunkingMethod // Pass the chunking method
        );
        
        totalSuccessfulChunks += successfulChunks;
        totalFailedChunks += failedChunks;
        allChunkResults.push(...chunkResults);
        
        // Add small delay between batches to prevent overwhelming the system
        if (batchStartIndex + batchSize < chunksToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (batchError) {
        console.error(`[process-document-for-rag] Error processing batch starting at ${batchStartIndex}:`, batchError);
        // Mark all chunks in this batch as failed
        for (let i = batchStartIndex; i < Math.min(batchStartIndex + batchSize, chunksToProcess.length); i++) {
          const globalIndex = startFromChunk + i;
          allChunkResults.push({ index: globalIndex, success: false, error: 'Batch processing error' });
          totalFailedChunks++;
        }
      }
    }
    
    const successfulChunks = totalSuccessfulChunks;
    const failedChunks = totalFailedChunks;
    const chunkResults = allChunkResults;
    
    console.log(`[process-document-for-rag] Chunk processing completed: ${successfulChunks} successful, ${failedChunks} failed`);
    
    // Determine final status based on processing results
    let finalStatus: string;
    let statusMessage: string;
    
    if (successfulChunks === 0 && chunksToProcess.length > 0) {
      // No chunks were processed successfully
      finalStatus = 'failed';
      statusMessage = 'Failed to process any document chunks';
      console.error('[process-document-for-rag] No chunks were processed successfully');
    } else if (successfulChunks === chunksToProcess.length && endChunk >= chunks.length) {
      // All chunks processed successfully - document is complete and ready for use
      finalStatus = 'indexed';
      statusMessage = `Successfully processed all ${chunks.length} chunks - document is ready for use`;
    } else if (endChunk < chunks.length || failedChunks > 0) {
      // Partial processing - either limited by chunk count or had failures
      finalStatus = 'partial';
      if (endChunk < chunks.length) {
        const totalProcessed = startFromChunk + successfulChunks;
        statusMessage = `Queued ${totalProcessed}/${chunks.length} chunks (${chunks.length - endChunk} chunks remaining)`;
      } else {
        statusMessage = `Queued ${successfulChunks}/${chunksToProcess.length} chunks with ${failedChunks} failures`;
      }
    } else {
      // All processed chunks were successful
      finalStatus = 'indexed';
      statusMessage = `Successfully processed all ${chunks.length} chunks - document is ready for use`;
    }
    
    // Update document status with metadata about processing
    const updateData: any = {
      status: finalStatus,
      last_indexed_at: new Date().toISOString(),
      metadata: {
        ...document.metadata,
        chunks_total: chunks.length,
        chunks_processed_this_run: chunksToProcess.length,
        chunks_successful_this_run: successfulChunks,
        chunks_failed_this_run: failedChunks,
        chunks_remaining: Math.max(0, chunks.length - endChunk),
        chunks_completed_total: startFromChunk + successfulChunks,
        processing_limited: endChunk < chunks.length,
        last_processing_attempt: new Date().toISOString(),
        resumed_processing: isResume,
        start_chunk_index: startFromChunk,
        end_chunk_index: endChunk - 1
      }
    };
    
    const { error: updateError } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', document.id);
    
    if (updateError) {
      console.error('[process-document-for-rag] Error updating document status:', updateError);
    }
    
    // Return results
    const responseStatus = finalStatus === 'failed' ? 500 : 200;
    
    // Ensure document status is updated even if there were errors
    if (document) {
      try {
        await supabase
          .from('documents')
          .update({ 
            status: finalStatus,
            last_indexed_at: new Date().toISOString(),
            metadata: {
              ...document.metadata,
              processing_completed: new Date().toISOString(),
              final_status: finalStatus
            }
          })
          .eq('id', document.id);
      } catch (finalUpdateError) {
        console.error('[process-document-for-rag] Error in final status update:', finalUpdateError);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: finalStatus !== 'failed',
        document_id: document.id,
        chunks_total: chunks.length,
        chunks_processed_this_run: chunksToProcess.length,
        chunks_successful_this_run: successfulChunks,
        chunks_failed_this_run: failedChunks,
        chunks_remaining: Math.max(0, chunks.length - endChunk),
        chunks_completed_total: startFromChunk + successfulChunks,
        status: finalStatus,
        message: statusMessage,
        processing_limited: endChunk < chunks.length,
        can_resume: endChunk < chunks.length || (finalStatus === 'partial' && failedChunks > 0),
        resumed_processing: isResume,
        start_chunk_index: startFromChunk,
        end_chunk_index: endChunk - 1
      }),
      {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('[process-document-for-rag] Error processing document:', error);
    
    // Try to update document status to failed if we have a document reference
    if (typeof error === 'object' && error !== null && 'document' in error) {
      try {
        const document = (error as any).document;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await supabase
          .from('documents')
          .update({ 
            status: 'failed',
            metadata: {
              error: errorMessage,
              failed_at: new Date().toISOString()
            }
          })
          .eq('id', document.id);
      } catch (updateError) {
        console.error('[process-document-for-rag] Error updating failed status:', updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process document', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

console.log("[process-document-for-rag] Edge Function initialized and ready to process documents for RAG.");