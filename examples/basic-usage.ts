/**
 * Basic Usage Example
 * 
 * Demonstrates how to use the content-aware chunking library
 * in a simple Node.js application.
 */

import { chunkText, createHierarchicalChunks, createFixedLengthChunks, analyzeChunkingQuality } from '../src/index.js';

// Sample document with clear structure
const structuredDocument = `
# AI Technology Overview

## Machine Learning
Machine learning algorithms enable computers to learn and improve from experience without being explicitly programmed. Key techniques include supervised learning, unsupervised learning, and reinforcement learning.

Supervised learning uses labeled training data to learn a mapping function from inputs to outputs. This is the most common type of machine learning and includes algorithms like linear regression, decision trees, and neural networks.

## Deep Learning
Deep learning is a subset of machine learning that uses neural networks with multiple layers to model and understand complex patterns in data. These networks are inspired by the structure and function of the human brain.

Deep learning has revolutionized many fields including computer vision, natural language processing, and speech recognition. Popular frameworks include TensorFlow, PyTorch, and Keras.

## Applications
AI technologies are being applied across numerous industries including healthcare, finance, transportation, and entertainment. The potential for AI to transform society is enormous, but it also raises important questions about ethics, privacy, and job displacement.
`;

// Sample document without clear structure
const unstructuredDocument = `
This is a long paragraph without any clear headings or structure. It contains multiple sentences that discuss various topics related to artificial intelligence and machine learning. The content flows from one idea to the next without clear section breaks or hierarchical organization. This type of document would typically benefit from fixed-length chunking rather than hierarchical chunking because there are no clear semantic boundaries to respect. The text continues with more information about AI applications, challenges, and future prospects. It covers topics like natural language processing, computer vision, robotics, and the ethical implications of AI development. The paragraph concludes with thoughts on the future of artificial intelligence and its potential impact on society.
`;

console.log('🧪 Content-Aware Chunking Examples\n');

// Example 1: Basic chunking with automatic method selection
console.log('1. Basic Chunking (Automatic Method Selection)');
console.log('=' .repeat(50));

const result1 = chunkText(structuredDocument, 1000, 80);
console.log(`Method: ${result1.method}`);
console.log(`Chunks: ${result1.chunks.length}`);
console.log(`First chunk preview: ${result1.chunks[0].substring(0, 100)}...\n`);

// Example 2: Hierarchical chunking specifically
console.log('2. Hierarchical Chunking (Structured Document)');
console.log('=' .repeat(50));

const hierarchicalChunks = createHierarchicalChunks(structuredDocument, 1000);
console.log(`Chunks: ${hierarchicalChunks.length}`);
console.log(`First chunk: ${hierarchicalChunks[0]}\n`);

// Example 3: Fixed-length chunking specifically
console.log('3. Fixed-Length Chunking (Unstructured Document)');
console.log('=' .repeat(50));

const fixedLengthChunks = createFixedLengthChunks(unstructuredDocument, 800, 80);
console.log(`Chunks: ${fixedLengthChunks.length}`);
console.log(`First chunk: ${fixedLengthChunks[0].substring(0, 100)}...\n`);

// Example 4: Quality analysis
console.log('4. Chunking Quality Analysis');
console.log('=' .repeat(50));

const stats1 = analyzeChunkingQuality(result1.chunks, result1.method);
console.log('Structured Document Stats:');
console.log(`- Total chunks: ${stats1.totalChunks}`);
console.log(`- Method: ${stats1.method}`);
console.log(`- Average chunk size: ${stats1.averageChunkSize} characters`);
console.log(`- Sentence boundary preservation: ${stats1.sentenceBoundaryPreservation}%\n`);

const result2 = chunkText(unstructuredDocument, 800, 80);
const stats2 = analyzeChunkingQuality(result2.chunks, result2.method);
console.log('Unstructured Document Stats:');
console.log(`- Total chunks: ${stats2.totalChunks}`);
console.log(`- Method: ${stats2.method}`);
console.log(`- Average chunk size: ${stats2.averageChunkSize} characters`);
console.log(`- Sentence boundary preservation: ${stats2.sentenceBoundaryPreservation}%\n`);

// Example 5: Fallback detection
console.log('5. Fallback Detection');
console.log('=' .repeat(50));

const fallbackResult = chunkText(unstructuredDocument, 1000, 80);
console.log(`Document type: Unstructured`);
console.log(`Method used: ${fallbackResult.method}`);
console.log(`Fallback triggered: ${fallbackResult.method === 'fixed_length' ? 'Yes' : 'No'}\n`);

console.log('✅ All examples completed successfully!');
