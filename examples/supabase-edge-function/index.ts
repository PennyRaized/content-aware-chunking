import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Import the core chunking library
import { chunkText } from '../../src/chunking.js';

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
  existing_document_id?: string;
}

// Main Edge Function handler
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
    
    // For this example, we'll use a simple text input
    const text = requestBody.metadata?.text || 'Sample document text for chunking demonstration.';
    
    // Use the core chunking library
    const chunkResult = chunkText(text, 1000, 80);
    const chunks = chunkResult.chunks;
    const chunkingMethod = chunkResult.method;
    
    console.log(`[process-document-for-rag] Created ${chunks.length} chunks from document using ${chunkingMethod} method`);
    
    // Return results
    return new Response(
      JSON.stringify({
        success: true,
        chunks_total: chunks.length,
        chunks: chunks.slice(0, 5), // Return first 5 chunks as example
        method: chunkingMethod,
        message: `Successfully processed document using ${chunkingMethod} chunking method`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('[process-document-for-rag] Error processing document:', error);
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

console.log("[process-document-for-rag] Edge Function initialized and ready to process documents for RAG.");
