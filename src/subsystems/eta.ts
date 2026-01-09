/**
 * KONOMI v3.1 - η (Eta) Subsystem: Documentation
 *
 * η:doc{η1→extract, η2→generate, η3→publish}
 *
 * Documentation system for extracting, generating, and publishing docs.
 */

import { Result, success, failure, EtaOps } from '../core/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// DOC TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Documentation node types */
export type DocNodeType =
  | 'module'
  | 'class'
  | 'interface'
  | 'type'
  | 'function'
  | 'method'
  | 'property'
  | 'parameter'
  | 'constant'
  | 'enum';

/** Documentation tag (JSDoc-style) */
export interface DocTag {
  name: string;
  text?: string;
  type?: string;
}

/** Documentation node */
export interface DocNode {
  type: DocNodeType;
  name: string;
  description?: string;
  signature?: string;
  tags: DocTag[];
  children: DocNode[];
  source?: {
    file: string;
    line: number;
    column: number;
  };
  deprecated?: boolean;
  since?: string;
  examples?: string[];
}

/** Documentation tree */
export interface DocTree {
  name: string;
  version: string;
  nodes: DocNode[];
  generated: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// η1: EXTRACT - Extract documentation from source
// ═══════════════════════════════════════════════════════════════════════════

/** JSDoc comment pattern */
const JSDOC_PATTERN = /\/\*\*\s*([\s\S]*?)\s*\*\//g;

/** Tag pattern */
const TAG_PATTERN = /@(\w+)(?:\s+\{([^}]*)\})?\s*([^\n@]*)?/g;

/** Extract options */
export interface ExtractOptions {
  includePrivate?: boolean;
  includeInternal?: boolean;
  parseExamples?: boolean;
}

/**
 * η1: Extract documentation from source code
 */
export function extract(
  source: string,
  filename: string,
  options: ExtractOptions = {}
): Result<DocNode[]> {
  const nodes: DocNode[] = [];

  try {
    // Find all JSDoc comments
    let match;
    while ((match = JSDOC_PATTERN.exec(source)) !== null) {
      const comment = match[1];
      const endPos = match.index + match[0].length;

      // Find the next declaration
      const rest = source.slice(endPos);
      const declaration = extractDeclaration(rest);

      if (declaration) {
        const node = parseDocComment(comment, declaration, filename, options);
        if (node && shouldInclude(node, options)) {
          nodes.push(node);
        }
      }
    }

    return success(nodes);
  } catch (e) {
    return failure(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Extract declaration after a JSDoc comment
 */
function extractDeclaration(source: string): { type: DocNodeType; name: string; signature: string } | null {
  const trimmed = source.trim();

  // Export patterns
  const patterns: Array<{ pattern: RegExp; type: DocNodeType }> = [
    { pattern: /^export\s+class\s+(\w+)/, type: 'class' },
    { pattern: /^export\s+interface\s+(\w+)/, type: 'interface' },
    { pattern: /^export\s+type\s+(\w+)/, type: 'type' },
    { pattern: /^export\s+function\s+(\w+)/, type: 'function' },
    { pattern: /^export\s+const\s+(\w+)/, type: 'constant' },
    { pattern: /^export\s+enum\s+(\w+)/, type: 'enum' },
    { pattern: /^class\s+(\w+)/, type: 'class' },
    { pattern: /^interface\s+(\w+)/, type: 'interface' },
    { pattern: /^type\s+(\w+)/, type: 'type' },
    { pattern: /^function\s+(\w+)/, type: 'function' },
    { pattern: /^const\s+(\w+)/, type: 'constant' },
    { pattern: /^(\w+)\s*\(/, type: 'method' },
  ];

  for (const { pattern, type } of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      // Get the full signature (first line or until {)
      const sigMatch = trimmed.match(/^[^{;]+/);
      return {
        type,
        name: match[1],
        signature: sigMatch?.[0].trim() ?? match[0],
      };
    }
  }

  return null;
}

/**
 * Parse a JSDoc comment
 */
function parseDocComment(
  comment: string,
  declaration: { type: DocNodeType; name: string; signature: string },
  filename: string,
  options: ExtractOptions
): DocNode | null {
  const lines = comment.split('\n').map(l => l.replace(/^\s*\*\s?/, '').trim());
  const tags: DocTag[] = [];
  const examples: string[] = [];
  let description = '';
  let deprecated = false;
  let since: string | undefined;

  // Parse description (text before first tag)
  const descLines: string[] = [];
  let inExample = false;
  let currentExample = '';

  for (const line of lines) {
    if (line.startsWith('@')) {
      if (inExample) {
        examples.push(currentExample.trim());
        inExample = false;
        currentExample = '';
      }

      const tagMatch = line.match(/@(\w+)(?:\s+\{([^}]*)\})?\s*(.*)?/);
      if (tagMatch) {
        const [, tagName, tagType, tagText] = tagMatch;

        if (tagName === 'example' && options.parseExamples) {
          inExample = true;
          currentExample = tagText ?? '';
        } else if (tagName === 'deprecated') {
          deprecated = true;
          if (tagText) tags.push({ name: 'deprecated', text: tagText });
        } else if (tagName === 'since') {
          since = tagText;
        } else {
          tags.push({
            name: tagName,
            type: tagType,
            text: tagText,
          });
        }
      }
    } else if (inExample) {
      currentExample += '\n' + line;
    } else {
      descLines.push(line);
    }
  }

  if (inExample) {
    examples.push(currentExample.trim());
  }

  description = descLines.join('\n').trim();

  return {
    type: declaration.type,
    name: declaration.name,
    description: description || undefined,
    signature: declaration.signature,
    tags,
    children: [],
    source: { file: filename, line: 0, column: 0 },
    deprecated,
    since,
    examples: examples.length > 0 ? examples : undefined,
  };
}

/**
 * Check if node should be included based on options
 */
function shouldInclude(node: DocNode, options: ExtractOptions): boolean {
  if (!options.includePrivate) {
    if (node.tags.some(t => t.name === 'private')) return false;
  }
  if (!options.includeInternal) {
    if (node.tags.some(t => t.name === 'internal')) return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// η2: GENERATE - Generate documentation output
// ═══════════════════════════════════════════════════════════════════════════

/** Output format */
export type DocFormat = 'markdown' | 'html' | 'json';

/** Generate options */
export interface GenerateOptions {
  format: DocFormat;
  title?: string;
  includeSource?: boolean;
  includeExamples?: boolean;
}

/**
 * η2: Generate documentation from tree
 */
export function generate(
  tree: DocTree,
  options: GenerateOptions
): Result<string> {
  try {
    switch (options.format) {
      case 'markdown':
        return success(generateMarkdown(tree, options));
      case 'html':
        return success(generateHtml(tree, options));
      case 'json':
        return success(JSON.stringify(tree, null, 2));
      default:
        return failure(new Error(`Unknown format: ${options.format}`));
    }
  } catch (e) {
    return failure(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Generate Markdown documentation
 */
function generateMarkdown(tree: DocTree, options: GenerateOptions): string {
  const lines: string[] = [];

  lines.push(`# ${options.title ?? tree.name}`);
  lines.push('');
  lines.push(`Version: ${tree.version}`);
  lines.push('');

  for (const node of tree.nodes) {
    lines.push(generateMarkdownNode(node, 2, options));
  }

  return lines.join('\n');
}

function generateMarkdownNode(node: DocNode, level: number, options: GenerateOptions): string {
  const lines: string[] = [];
  const heading = '#'.repeat(Math.min(level, 6));

  lines.push(`${heading} ${node.name}`);
  lines.push('');

  if (node.deprecated) {
    lines.push('> **Deprecated**');
    lines.push('');
  }

  if (node.signature) {
    lines.push('```typescript');
    lines.push(node.signature);
    lines.push('```');
    lines.push('');
  }

  if (node.description) {
    lines.push(node.description);
    lines.push('');
  }

  // Parameters
  const params = node.tags.filter(t => t.name === 'param');
  if (params.length > 0) {
    lines.push('**Parameters:**');
    lines.push('');
    for (const param of params) {
      lines.push(`- \`${param.text?.split(' ')[0]}\`${param.type ? ` (${param.type})` : ''}: ${param.text?.split(' ').slice(1).join(' ') ?? ''}`);
    }
    lines.push('');
  }

  // Returns
  const returns = node.tags.find(t => t.name === 'returns' || t.name === 'return');
  if (returns) {
    lines.push(`**Returns:** ${returns.type ? `\`${returns.type}\`` : ''} ${returns.text ?? ''}`);
    lines.push('');
  }

  // Examples
  if (options.includeExamples && node.examples && node.examples.length > 0) {
    lines.push('**Examples:**');
    lines.push('');
    for (const example of node.examples) {
      lines.push('```typescript');
      lines.push(example);
      lines.push('```');
      lines.push('');
    }
  }

  // Children
  for (const child of node.children) {
    lines.push(generateMarkdownNode(child, level + 1, options));
  }

  return lines.join('\n');
}

/**
 * Generate HTML documentation
 */
function generateHtml(tree: DocTree, options: GenerateOptions): string {
  const title = options.title ?? tree.name;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1 { border-bottom: 2px solid #333; }
    pre { background: #f4f4f4; padding: 1rem; overflow-x: auto; }
    code { font-family: monospace; }
    .deprecated { color: #d33; }
    .signature { background: #f0f0f0; padding: 0.5rem; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>Version: ${tree.version}</p>
  ${tree.nodes.map(n => generateHtmlNode(n, 2, options)).join('\n')}
</body>
</html>`;
}

function generateHtmlNode(node: DocNode, level: number, options: GenerateOptions): string {
  const h = `h${Math.min(level, 6)}`;

  let html = `<section>
    <${h}>${node.name}</${h}>`;

  if (node.deprecated) {
    html += `<p class="deprecated"><strong>Deprecated</strong></p>`;
  }

  if (node.signature) {
    html += `<pre class="signature"><code>${escapeHtml(node.signature)}</code></pre>`;
  }

  if (node.description) {
    html += `<p>${escapeHtml(node.description)}</p>`;
  }

  html += `</section>`;

  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════════════════════════════════
// η3: PUBLISH - Publish documentation
// ═══════════════════════════════════════════════════════════════════════════

/** Publisher interface */
export interface DocPublisher {
  name: string;
  publish(content: string, options: PublishOptions): Promise<Result<string>>;
}

/** Publish options */
export interface PublishOptions {
  destination: string;
  filename?: string;
  overwrite?: boolean;
}

/**
 * η3: Publish documentation
 */
export async function publish(
  content: string,
  publisher: DocPublisher,
  options: PublishOptions
): Promise<Result<string>> {
  return publisher.publish(content, options);
}

/**
 * File system publisher (placeholder)
 */
export class FilePublisher implements DocPublisher {
  name = 'file';

  async publish(content: string, options: PublishOptions): Promise<Result<string>> {
    // In real implementation, would write to file system
    const path = `${options.destination}/${options.filename ?? 'docs.md'}`;
    console.log(`Would publish to: ${path}`);
    return success(path);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ETA SUBSYSTEM CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Eta Subsystem - Documentation management
 */
export class EtaSubsystem {
  readonly id = 'η';
  readonly name = 'doc';

  private tree: DocTree | null = null;
  private publishers: Map<string, DocPublisher> = new Map();

  constructor() {
    this.publishers.set('file', new FilePublisher());
  }

  /**
   * Get current operations
   */
  getOps() {
    return EtaOps;
  }

  /**
   * η1: Extract documentation from source files
   */
  extract(
    sources: Array<{ content: string; filename: string }>,
    options?: ExtractOptions
  ): Result<DocTree> {
    const allNodes: DocNode[] = [];

    for (const { content, filename } of sources) {
      const result = extract(content, filename, options);
      if (!result.ok) return result;
      allNodes.push(...result.value);
    }

    this.tree = {
      name: 'KONOMI',
      version: '3.1.0',
      nodes: allNodes,
      generated: Date.now(),
    };

    return success(this.tree);
  }

  /**
   * η2: Generate documentation
   */
  generate(options: GenerateOptions): Result<string> {
    if (!this.tree) {
      return failure(new Error('Must extract before generating'));
    }
    return generate(this.tree, options);
  }

  /**
   * η3: Publish documentation
   */
  async publish(
    content: string,
    publisherName: string,
    options: PublishOptions
  ): Promise<Result<string>> {
    const publisher = this.publishers.get(publisherName);
    if (!publisher) {
      return failure(new Error(`Unknown publisher: ${publisherName}`));
    }
    return publish(content, publisher, options);
  }

  /**
   * Register a publisher
   */
  registerPublisher(publisher: DocPublisher): void {
    this.publishers.set(publisher.name, publisher);
  }

  /**
   * Get current tree
   */
  getTree(): DocTree | null {
    return this.tree;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createEtaSubsystem(): EtaSubsystem {
  return new EtaSubsystem();
}
