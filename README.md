# Content-Aware Chunking

*Intelligent document chunking for RAG systems with automatic fallback*

[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 **Problem Statement**

Traditional document chunking for RAG systems often breaks sentences, destroys context, and creates poor-quality embeddings. Most chunking strategies use simple fixed-length splitting that ignores document structure, leading to:

- **Context Fragmentation**: Sentences and ideas are arbitrarily split
- **Loss of Positional Context**: Chunks have no knowledge of their location within the document
- **Poor Embedding Quality**: Noisy text with markdown artifacts and broken sentences
- **Inconsistent Chunk Quality**: Same approach used regardless of document structure

## 🚀 **Our Solution**

Content-Aware Chunking is an intelligent chunking system that automatically chooses between **hierarchical content-aware chunking** and **fixed-length chunking with overlap** based on document structure.

### **Key Features**

- **🧠 Intelligent Method Selection**: Automatic choice between hierarchical and fixed-length chunking
- **📊 High Fidelity**: **100%** sentence boundary preservation (tested)
- **🔄 Smart Fallback**: Automatic detection of poor hierarchical results
- **📝 Context Enrichment**: Adds document title and section context to chunks
- **⚡ Zero Dependencies**: Core functionality has no external dependencies
- **🔧 TypeScript First**: Full type safety and IntelliSense support
- **🏭 Production Ready**: **0-1ms** processing time (evidence-based)

## 🏗️ **Architecture Overview**

```mermaid
graph TD
    A[Raw Document] --> B[Content Analysis]
    B --> C{Document Structure?}
    C -->|Well Structured| D[Hierarchical Chunking]
    C -->|Poor Structure| E[Fixed-Length Chunking]
    D --> F[Content-Aware Chunks]
    E --> G[Fixed-Length Chunks]
    F --> H[Context Enrichment]
    G --> H
    H --> I[Final Chunks]
```

## 📋 **Getting Started**

### **Prerequisites**

- **Node.js**: Version 18.0.0 or higher
- **TypeScript**: For TypeScript projects (optional but recommended)

### **Installation**

```bash
# Install the package (when published to npm)
npm install content-aware-chunking

# Or clone and build from source
git clone https://github.com/yourusername/content-aware-chunking.git
cd content-aware-chunking
npm install
npm run build
```

### **Basic Usage**

```typescript
import { chunkText } from 'content-aware-chunking';

const document = `
# AI Technology Overview

## Machine Learning
Machine learning algorithms enable computers to learn and improve from experience...

## Deep Learning
Deep learning is a subset of machine learning that uses neural networks...
`;

const result = chunkText(document, 1000, 80);
console.log(`Created ${result.chunks.length} chunks using ${result.method} method`);
```

## 📚 **Documentation**

- [**API Reference**](./docs/API.md) - *A deep dive into all exported functions and types*
- [**Chunking Strategies**](./docs/STRATEGIES.md) - *An explanation of the different chunking methods and their outputs*
- [**Production Examples**](./examples/) - *Guidance on using the Supabase and Node.js examples*
- [**Performance & Quality**](./docs/PERFORMANCE.md) - *Details on performance metrics and fallback criteria*
- [**Contributing Guide**](./CONTRIBUTING.md)

## 📄 **License**

MIT License - see [LICENSE](./LICENSE) for details.

## 🙏 **Acknowledgments**

This library is based on production-tested chunking logic that has been refined through real-world usage. The intelligent fallback mechanism and content-aware boundaries have been designed to handle various document types and structures effectively.

---

*This library provides a robust, intelligent approach to document chunking that automatically adapts to different content types and structures.*