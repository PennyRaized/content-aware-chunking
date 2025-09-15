# Production Examples

Guidance on using the Supabase and Node.js examples.

## Overview

This directory contains production-ready examples demonstrating how to use the content-aware chunking library in real-world scenarios.

## Examples

### 1. Basic Node.js Usage

**File**: `basic-usage.ts`

A complete Node.js example that runs independently of any external services.

**Features**:
- Demonstrates all chunking functions
- Shows quality analysis
- Includes fallback detection examples
- No external dependencies required

**Run it**:
```bash
npx tsx examples/basic-usage.ts
```

**What it shows**:
- Basic chunking with automatic method selection
- Hierarchical chunking for structured documents
- Fixed-length chunking for unstructured documents
- Quality analysis and statistics
- Fallback detection in action

### 2. Supabase Edge Function

**Directory**: `supabase-edge-function/`

A complete production implementation using Supabase Edge Functions.

**Features**:
- Complete, battle-tested production code (1,099 lines)
- Real-world error handling and queue integration
- Document management and status tracking
- Resume capability for interrupted processing
- Metadata extraction and content fetching

**What is Supabase?**
Supabase is a backend-as-a-service platform that provides:
- PostgreSQL database with real-time subscriptions
- Authentication and user management
- Serverless Edge Functions (like AWS Lambda)
- Free tier for development and testing

**To run this example**:
1. Sign up for a free Supabase account at [supabase.com](https://supabase.com)
2. Create a new project
3. Deploy the Edge Function from `examples/supabase-edge-function/`
4. Test with your documents via the Supabase dashboard or API

**Key Features Demonstrated**:
- **Document Management**: `getOrCreateDocument()` with race condition handling
- **Content Fetching**: Support for PDFs, market reports, and other sources
- **Batch Processing**: Efficient chunk processing with queue integration
- **Error Recovery**: Comprehensive error handling and status updates
- **Resume Capability**: Support for resuming interrupted processing
- **Metadata Extraction**: Intelligent report metadata extraction

## Usage Patterns

### Basic Library Usage

```typescript
import { chunkText } from 'content-aware-chunking';

// Simple usage
const result = chunkText(document, 1000, 80);
console.log(`Created ${result.chunks.length} chunks using ${result.method} method`);
```

### Advanced Usage

```typescript
import { 
  chunkText, 
  createHierarchicalChunks, 
  createFixedLengthChunks,
  analyzeChunkingQuality 
} from 'content-aware-chunking';

// Use specific chunking method
const hierarchicalChunks = createHierarchicalChunks(document, 1000);
const fixedLengthChunks = createFixedLengthChunks(document, 1000, 80);

// Analyze quality
const stats = analyzeChunkingQuality(result.chunks, result.method);
console.log(`Quality score: ${stats.qualityScore}/100`);
```

### Production Integration

```typescript
// In your production system
import { chunkText } from 'content-aware-chunking';

async function processDocument(documentText: string) {
  try {
    const result = chunkText(documentText, 1000, 80);
    
    // Process chunks
    for (const chunk of result.chunks) {
      // Generate embeddings
      // Store in database
      // Queue for processing
    }
    
    return {
      success: true,
      chunks: result.chunks,
      method: result.method
    };
  } catch (error) {
    console.error('Chunking failed:', error);
    return { success: false, error: error.message };
  }
}
```

## Testing the Examples

### Test Basic Usage
```bash
# Run the basic example
npx tsx examples/basic-usage.ts
```

### Test Supabase Example
1. Set up Supabase project
2. Deploy the Edge Function
3. Test with sample documents
4. Monitor processing in Supabase dashboard

## Customization

### Modify Chunking Parameters
```typescript
// Adjust chunk sizes
const result = chunkText(document, 800, 60); // Smaller chunks, less overlap

// Use specific method
const hierarchicalChunks = createHierarchicalChunks(document, 1200); // Larger target
```

### Add Custom Processing
```typescript
// Add custom processing to chunks
const result = chunkText(document, 1000, 80);
const processedChunks = result.chunks.map(chunk => {
  // Add custom metadata
  // Apply custom transformations
  // Validate chunk content
  return chunk;
});
```

## Troubleshooting

### Common Issues

1. **Import Errors**: Make sure to use the correct import path
2. **TypeScript Errors**: Ensure proper type definitions are available
3. **Performance Issues**: Check document size and chunking parameters
4. **Quality Issues**: Use quality analysis to optimize settings

### Getting Help

- Check the [API Reference](../docs/API.md) for function details
- Review [Chunking Strategies](../docs/STRATEGIES.md) for method selection
- See [Performance & Quality](../docs/PERFORMANCE.md) for optimization tips
