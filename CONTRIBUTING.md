# Contributing Guide

We welcome contributions! This guide will help you get started with contributing to the content-aware chunking library.

## Getting Started

### Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **Git**: For version control
- **TypeScript**: For development (optional but recommended)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/content-aware-chunking.git
cd content-aware-chunking

# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm test

# Run the basic example
npx tsx examples/basic-usage.ts
```

## Development Workflow

### 1. Fork and Clone
1. Fork the repository on GitHub
2. Clone your fork locally
3. Add the upstream repository as a remote

```bash
git remote add upstream https://github.com/yourusername/content-aware-chunking.git
```

### 2. Create a Branch
```bash
git checkout -b feature/your-feature-name
```

### 3. Make Changes
- Write your code
- Add tests for new functionality
- Update documentation as needed
- Ensure all tests pass

### 4. Test Your Changes
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run the basic example
npx tsx examples/basic-usage.ts
```

### 5. Commit and Push
```bash
git add .
git commit -m "feat: add your feature description"
git push origin feature/your-feature-name
```

### 6. Create a Pull Request
1. Go to your fork on GitHub
2. Click "New Pull Request"
3. Fill out the PR template
4. Submit the PR

## Code Standards

### TypeScript
- Use strict TypeScript configuration
- Provide proper type annotations
- Use interfaces for complex types
- Follow the existing code style

### Testing
- Write tests for all new functionality
- Maintain or improve test coverage
- Use descriptive test names
- Test edge cases and error conditions

### Documentation
- Update README.md for user-facing changes
- Update API.md for new functions
- Add JSDoc comments for new functions
- Update examples if needed

## Project Structure

```
content-aware-chunking/
├── src/                    # Core library source code
│   ├── index.ts           # Main exports
│   ├── chunking.ts        # Core chunking functions
│   └── types.ts           # TypeScript type definitions
├── examples/               # Usage examples
│   ├── basic-usage.ts     # Node.js example
│   └── supabase-edge-function/ # Supabase example
├── tests/                  # Test files
│   └── chunking.test.ts   # Main test suite
├── docs/                   # Documentation
│   ├── API.md             # API reference
│   ├── STRATEGIES.md      # Chunking strategies
│   └── PERFORMANCE.md     # Performance guide
└── dist/                   # Built library output
```

## Types of Contributions

### Bug Reports
- Use the GitHub issue template
- Provide steps to reproduce
- Include expected vs actual behavior
- Add relevant system information

### Feature Requests
- Use the GitHub issue template
- Describe the use case
- Explain the expected behavior
- Consider implementation complexity

### Code Contributions
- Bug fixes
- New features
- Performance improvements
- Documentation updates
- Test improvements

## Pull Request Guidelines

### Before Submitting
- [ ] All tests pass
- [ ] Code follows project style
- [ ] Documentation is updated
- [ ] Examples work correctly
- [ ] No breaking changes (or clearly documented)

### PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass
- [ ] New tests added
- [ ] Examples tested

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes
```

## Development Tips

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Building the Library
```bash
# Build once
npm run build

# Build in watch mode
npm run dev
```

### Testing Examples
```bash
# Test basic usage
npx tsx examples/basic-usage.ts

# Test with different parameters
npx tsx -e "import { chunkText } from './src/index.js'; console.log(chunkText('test', 100, 20));"
```

## Release Process

### Version Bumping
- **Patch**: Bug fixes (1.0.0 → 1.0.1)
- **Minor**: New features (1.0.0 → 1.1.0)
- **Major**: Breaking changes (1.0.0 → 2.0.0)

### Publishing
1. Update version in package.json
2. Update CHANGELOG.md
3. Create release tag
4. Publish to npm

## Getting Help

- **Issues**: Use GitHub issues for bug reports and feature requests
- **Discussions**: Use GitHub discussions for questions and ideas
- **Documentation**: Check the docs/ directory for detailed guides

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please:

- Be respectful and constructive
- Focus on what's best for the community
- Show empathy towards other community members
- Accept constructive criticism gracefully
- Help others learn and grow

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
