# API Reference

Complete reference for all exported functions and types in the content-aware chunking library.

## Main Functions

### `chunkText(text: string, maxChunkSize?: number, overlapSize?: number): ChunkResult`

Main chunking function with intelligent method selection.

**Parameters:**
- `text`: The document text to chunk
- `maxChunkSize`: Maximum chunk size in characters (default: 1000)
- `overlapSize`: Overlap size for fixed-length chunking in characters (default: 100)

**Returns:**
- `chunks`: Array of chunk strings
- `method`: The chunking method used (`'content_aware_hierarchical'` or `'fixed_length'`)

**Example:**
```typescript
import { chunkText } from 'content-aware-chunking';

const result = chunkText(document, 1000, 80);
console.log(`Created ${result.chunks.length} chunks using ${result.method} method`);
```

### `createHierarchicalChunks(text: string, targetMax?: number): string[]`

Create hierarchical chunks with content-aware boundaries.

**Parameters:**
- `text`: The document text to chunk
- `targetMax`: Target maximum chunk size in characters (default: 1000)

**Returns:** Array of hierarchical chunks with context metadata

**Example:**
```typescript
import { createHierarchicalChunks } from 'content-aware-chunking';

const chunks = createHierarchicalChunks(document, 1000);
// Each chunk includes: "Title: Document Title\nSection: Section Name\nContent: ..."
```

### `createFixedLengthChunks(text: string, maxChunkSize: number, overlapSize: number): string[]`

Create fixed-length chunks with sentence boundary awareness.

**Parameters:**
- `text`: The document text to chunk
- `maxChunkSize`: Maximum chunk size in characters
- `overlapSize`: Overlap size between chunks in characters

**Returns:** Array of fixed-length chunks

**Example:**
```typescript
import { createFixedLengthChunks } from 'content-aware-chunking';

const chunks = createFixedLengthChunks(document, 800, 80);
// Raw content chunks without metadata prefixes
```

### `analyzeChunkingQuality(chunks: string[], method: string): ChunkingStats`

Analyze chunking quality and provide statistics.

**Parameters:**
- `chunks`: Array of chunk strings to analyze
- `method`: The chunking method used

**Returns:**
- `totalChunks`: Number of chunks created
- `method`: Chunking method used
- `averageChunkSize`: Average chunk size in characters
- `sentenceBoundaryPreservation`: Percentage of chunks ending with proper punctuation
- `sizeDistribution`: Distribution of chunk sizes
- `qualityScore`: Overall quality score (0-100)

**Example:**
```typescript
import { analyzeChunkingQuality } from 'content-aware-chunking';

const stats = analyzeChunkingQuality(chunks, 'content_aware_hierarchical');
console.log(`Sentence boundary preservation: ${stats.sentenceBoundaryPreservation}%`);
```

## Utility Functions

### `splitByHeadings(text: string): Section[]`

Split text by markdown headings (##, ###) and return sections with titles and content.

**Parameters:**
- `text`: The document text to split

**Returns:** Array of sections with `title` and `content` properties

**Example:**
```typescript
import { splitByHeadings } from 'content-aware-chunking';

const sections = splitByHeadings(document);
// [{ title: "Machine Learning", content: "..." }, ...]
```

### `splitSectionIntoChunks(content: string, targetMin: number, targetMax: number): string[]`

Split a section into smaller chunks while respecting paragraph boundaries.

**Parameters:**
- `content`: The section content to split
- `targetMin`: Minimum chunk size in characters
- `targetMax`: Maximum chunk size in characters

**Returns:** Array of chunk strings

### `extractDocumentTitle(text: string): string`

Extract the main document title from the first # heading.

**Parameters:**
- `text`: The document text

**Returns:** Document title or "Document" if no title found

**Example:**
```typescript
import { extractDocumentTitle } from 'content-aware-chunking';

const title = extractDocumentTitle(document);
// "AI Technology Overview"
```

### `cleanMarkdown(content: string): string`

Remove markdown artifacts, citations, and normalize whitespace for clean text.

**Parameters:**
- `content`: The content to clean

**Returns:** Cleaned text without markdown artifacts

**Example:**
```typescript
import { cleanMarkdown } from 'content-aware-chunking';

const cleaned = cleanMarkdown("## Heading\n**Bold** text with [links](url)");
// "Heading Bold text with links"
```

### `shouldUseFixedLengthFallback(originalText: string, chunks: string[], maxChunkSize: number): boolean`

Check if hierarchical chunking produced poor results and should fall back to fixed-length chunking.

**Parameters:**
- `originalText`: The original document text
- `chunks`: The chunks produced by hierarchical chunking
- `maxChunkSize`: The maximum chunk size

**Returns:** `true` if should fall back to fixed-length chunking

## Type Definitions

### `ChunkResult`

```typescript
interface ChunkResult {
  chunks: string[];
  method: 'content_aware_hierarchical' | 'fixed_length';
}
```

### `ChunkingStats`

```typescript
interface ChunkingStats {
  totalChunks: number;
  method: string;
  averageChunkSize: number;
  sentenceBoundaryPreservation: number;
  sizeDistribution: number[];
  qualityScore: number;
}
```

### `Section`

```typescript
interface Section {
  title: string;
  content: string;
}
```

### `ChunkingOptions`

```typescript
interface ChunkingOptions {
  maxChunkSize?: number;    // Default: 1000 characters
  overlapSize?: number;     // Default: 100 characters
  targetMax?: number;       // Default: 1000 characters
  targetMin?: number;       // Default: 600 characters (60% of targetMax)
}
```

### `FallbackCriteria`

```typescript
interface FallbackCriteria {
  noChunks: boolean;
  singleLargeChunk: boolean;
  genericSections: boolean;
  brokenSentences: boolean;
  tooFewChunks: boolean;
  largeChunks: boolean;
  averageTooLarge: boolean;
}
```

## Error Handling

All functions include comprehensive error handling:

- **Empty Input**: Returns empty results gracefully
- **Invalid Parameters**: Throws descriptive errors
- **Edge Cases**: Handles malformed text, special characters, and extreme sizes
- **Type Safety**: Full TypeScript support with strict type checking

## Performance Considerations

- **Zero Dependencies**: Core functions have no external dependencies
- **Memory Efficient**: Processes documents in streaming fashion
- **Fast Execution**: Sub-second processing for typical documents
- **Scalable**: Handles documents from small text to large reports
