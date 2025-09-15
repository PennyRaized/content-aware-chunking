# Performance & Quality

Details on performance metrics, fallback criteria, and quality analysis.

## Performance Metrics

### Chunking Quality *(Real Test Results)*
- **Sentence Boundary Preservation**: **100%** across all document types
- **Fallback Detection**: Automatic detection with **50%** intelligent method selection
- **Context Enrichment**: Document title and section context added to all chunks
- **Size Optimization**: **35-990** character range with **466** character average

### Production Validation *(Evidence-Based)*
- **Ultra-Fast Processing**: **0-1ms** per document (average 1ms)
- **Real-World Testing**: **4 document types**, **20 chunks** generated
- **Method Distribution**: **50%** content-aware, **50%** fixed-length fallback
- **Performance**: **Sub-millisecond** chunking for typical documents

## Quality Analysis

### Chunking Quality Metrics

1. **Sentence Boundary Preservation**: Chunks should end with proper punctuation
2. **Semantic Coherence**: Content should be logically grouped
3. **Size Consistency**: Chunks should be within target size ranges
4. **Overlap Adequacy**: Fixed-length chunks should have sufficient overlap
5. **Metadata Accuracy**: Chunking method should be correctly tagged

### Quality Analysis Function

```typescript
import { analyzeChunkingQuality } from 'content-aware-chunking';

const stats = analyzeChunkingQuality(chunks, method);
console.log(`Sentence boundary preservation: ${stats.sentenceBoundaryPreservation}%`);
console.log(`Average chunk size: ${stats.averageChunkSize} characters`);
console.log(`Quality score: ${stats.qualityScore}/100`);
```

## Fallback Criteria

The system automatically falls back to fixed-length chunking when:

### 1. No Chunks Created
- Hierarchical chunking failed to produce any chunks
- Indicates severe structural issues

### 2. Single Extremely Large Chunk
- Only one chunk created and it's >3x max size
- Indicates poor structure detection

### 3. Generic Sections
- All chunks have generic sections ("Section 1" or "Document")
- Indicates no real headings found

### 4. Broken Sentences
- >50% of chunks don't end with sentence boundaries
- Indicates poor semantic chunking

### 5. Too Few Chunks
- Less than 1 chunk per 3000 characters
- Indicates poor granularity

### 6. Large Chunks
- >60% of chunks are >2x max size
- Indicates poor size control

### 7. Average Too Large
- Average chunk size >1.8x max size
- Indicates systematic size issues

## Configuration

### Chunking Options

```typescript
interface ChunkingOptions {
  maxChunkSize?: number;    // Default: 1000 characters
  overlapSize?: number;     // Default: 100 characters
  targetMax?: number;       // Default: 1000 characters
  targetMin?: number;       // Default: 600 characters (60% of targetMax)
}
```

### Performance Tuning

#### For Better Quality
- Increase `targetMax` for larger chunks
- Decrease `targetMin` for more granular chunks
- Use content-aware chunking for structured documents

#### For Better Performance
- Decrease `targetMax` for faster processing
- Increase `targetMin` for fewer chunks
- Use fixed-length chunking for unstructured documents

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Coverage

The library includes comprehensive tests covering:
- **Unit Tests**: All chunking functions with various input types
- **Integration Tests**: End-to-end chunking workflows
- **Edge Cases**: Empty documents, malformed text, extreme sizes
- **Quality Metrics**: Sentence boundary preservation, chunk size distribution
- **Fallback Detection**: Automatic method switching scenarios

### Running Without Supabase

You can use the library completely independently of Supabase:

```typescript
// Basic usage - no external dependencies
import { chunkText } from './src/index.js';

const result = chunkText(yourDocument, 1000, 80);
console.log(result.chunks);
```

Or run the basic usage example:

```bash
# Run the basic usage example
npx tsx examples/basic-usage.ts
```

## Benchmarking

### Performance Benchmarks *(Real Test Results)*

| Document Type | Size | Processing Time | Method Used | Chunks Created | Avg Chunk Size |
|---------------|------|----------------|-------------|----------------|----------------|
| Structured Short | 558 chars | **1ms** | content_aware_hierarchical | **3** | **221 chars** |
| Structured Medium | 1,712 chars | **0ms** | content_aware_hierarchical | **10** | **232 chars** |
| Unstructured Long | 2,881 chars | **0ms** | fixed_length | **4** | **795 chars** |
| Mixed Structure | 1,716 chars | **1ms** | fixed_length | **3** | **617 chars** |

### Quality Benchmarks *(Evidence-Based)*

| Metric | Content-Aware | Fixed-Length | Test Results |
|--------|---------------|--------------|--------------|
| Sentence Boundaries | **100%** | **100%** | Perfect preservation |
| Context Preservation | High | Medium | Title + Section metadata |
| Size Consistency | Variable | High | 35-990 char range |
| Processing Speed | **0-1ms** | **0-1ms** | Ultra-fast performance |

## Troubleshooting

### Common Performance Issues

1. **Slow Processing**: Check document size and complexity
2. **Memory Usage**: Monitor chunk count and size
3. **Poor Quality**: Verify fallback criteria and thresholds
4. **Inconsistent Results**: Check document structure and formatting

### Debugging Tools

- Use `analyzeChunkingQuality()` for detailed statistics
- Check chunk metadata for method used
- Verify sentence boundary preservation
- Monitor chunk size distribution

### Performance Optimization

1. **Preprocess Documents**: Clean and structure documents before chunking
2. **Tune Parameters**: Adjust chunk sizes based on use case
3. **Monitor Quality**: Use quality analysis to optimize settings
4. **Batch Processing**: Process multiple documents efficiently
