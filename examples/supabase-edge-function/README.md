# Supabase Edge Function Integration

This example shows how to use the content-aware chunking library in a Supabase Edge Function for production document processing.

## Overview

The Supabase Edge Function demonstrates:
- Integration with the core chunking library
- Production-ready error handling
- CORS support for web applications
- Structured response format

## Usage

### Deploy to Supabase

1. Copy the `index.ts` file to your Supabase functions directory
2. Deploy using the Supabase CLI:
   ```bash
   supabase functions deploy process-document-for-rag
   ```

### API Endpoint

**POST** `/functions/v1/process-document-for-rag`

### Request Body

```json
{
  "source_type": "pdf",
  "source_id": "document-123",
  "user_id": "user-456",
  "metadata": {
    "text": "Your document content here..."
  }
}
```

### Response

```json
{
  "success": true,
  "chunks_total": 15,
  "chunks": [
    "Title: Document\nSection: Introduction\nContent: ...",
    "Title: Document\nSection: Methodology\nContent: ..."
  ],
  "method": "content_aware_hierarchical",
  "message": "Successfully processed document using content_aware_hierarchical chunking method"
}
```

## Key Features

- **Thin Wrapper**: Uses the core library for all chunking logic
- **Production Ready**: Comprehensive error handling and logging
- **CORS Support**: Works with web applications
- **Structured Responses**: Clear success/error responses
- **Method Detection**: Reports which chunking method was used

## Environment Variables

Required environment variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

## Error Handling

The function handles:
- Missing required fields
- Invalid request methods
- Chunking errors
- General processing errors

All errors return structured JSON responses with appropriate HTTP status codes.
