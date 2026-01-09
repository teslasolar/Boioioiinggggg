/**
 * KONOMI v3.1 - β (Beta) Subsystem: Build
 *
 * β:build{β1→parse, β2→transform, β3→emit, β4→chain}
 *
 * Manages build pipeline for PLC/industrial code with parsing,
 * transformation, emission, and chained operations.
 *
 * E4:PLC{Type→Field→CM, vendor⟷UDT, git:diff→merge→sync}
 */

import { Result, success, failure, BetaOps } from '../core/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// AST TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Base AST node */
export interface ASTNode {
  type: string;
  loc?: SourceLocation;
  meta?: Record<string, unknown>;
}

/** Source location */
export interface SourceLocation {
  start: { line: number; column: number };
  end: { line: number; column: number };
  source?: string;
}

/** PLC data type definition (UDT) */
export interface TypeNode extends ASTNode {
  type: 'Type';
  name: string;
  fields: FieldNode[];
  vendor?: string;
}

/** Field within a type */
export interface FieldNode extends ASTNode {
  type: 'Field';
  name: string;
  dataType: string;
  initialValue?: unknown;
  comment?: string;
}

/** Control Module reference */
export interface CMRefNode extends ASTNode {
  type: 'CMRef';
  path: string;
  alias?: string;
}

/** Program block */
export interface ProgramNode extends ASTNode {
  type: 'Program';
  name: string;
  types: TypeNode[];
  variables: FieldNode[];
  body: StatementNode[];
}

/** Statement node */
export interface StatementNode extends ASTNode {
  type: 'Statement';
  kind: 'assignment' | 'call' | 'if' | 'loop' | 'return';
  children: ASTNode[];
}

/** Union of AST nodes */
export type PLCASTNode =
  | TypeNode
  | FieldNode
  | CMRefNode
  | ProgramNode
  | StatementNode;

// ═══════════════════════════════════════════════════════════════════════════
// β1: PARSE - Source code to AST
// ═══════════════════════════════════════════════════════════════════════════

/** Parser result */
export interface ParseResult {
  ast: ProgramNode;
  errors: ParseError[];
  warnings: ParseWarning[];
}

export interface ParseError {
  message: string;
  loc?: SourceLocation;
  code: string;
}

export interface ParseWarning {
  message: string;
  loc?: SourceLocation;
  code: string;
}

/** Parser interface */
export interface Parser {
  vendor: string;
  parse(source: string, options?: ParseOptions): Result<ParseResult>;
}

export interface ParseOptions {
  strict?: boolean;
  comments?: boolean;
  locations?: boolean;
}

/**
 * β1: Parse source code to AST
 */
export function parse(
  source: string,
  parser: Parser,
  options: ParseOptions = {}
): Result<ParseResult> {
  return parser.parse(source, options);
}

// ═══════════════════════════════════════════════════════════════════════════
// β2: TRANSFORM - AST manipulation
// ═══════════════════════════════════════════════════════════════════════════

/** Transform visitor */
export type TransformVisitor = {
  [K in PLCASTNode['type']]?: (
    node: Extract<PLCASTNode, { type: K }>,
    context: TransformContext
  ) => PLCASTNode | null;
};

export interface TransformContext {
  parent?: PLCASTNode;
  path: string[];
  state: Map<string, unknown>;
}

/**
 * β2: Transform AST using visitors
 */
export function transform(
  ast: ProgramNode,
  visitors: TransformVisitor[]
): Result<ProgramNode> {
  const context: TransformContext = {
    path: [],
    state: new Map(),
  };

  try {
    const result = transformNode(ast, visitors, context) as ProgramNode | null;
    if (!result) {
      return failure(new Error('Transform removed root node'));
    }
    return success(result);
  } catch (e) {
    return failure(e instanceof Error ? e : new Error(String(e)));
  }
}

function transformNode(
  node: PLCASTNode,
  visitors: TransformVisitor[],
  context: TransformContext
): PLCASTNode | null {
  let current: PLCASTNode | null = node;

  // Apply all visitors to this node
  for (const visitor of visitors) {
    if (!current) break;
    const handler = visitor[current.type as keyof TransformVisitor];
    if (handler) {
      current = (handler as (n: PLCASTNode, ctx: TransformContext) => PLCASTNode | null)(
        current,
        context
      );
    }
  }

  if (!current) return null;

  // Recursively transform children based on node type
  if (current.type === 'Program') {
    const prog = current as ProgramNode;
    prog.types = prog.types
      .map(t => transformNode(t, visitors, { ...context, parent: prog }) as TypeNode | null)
      .filter((t): t is TypeNode => t !== null);
    prog.variables = prog.variables
      .map(v => transformNode(v, visitors, { ...context, parent: prog }) as FieldNode | null)
      .filter((v): v is FieldNode => v !== null);
  } else if (current.type === 'Type') {
    const type = current as TypeNode;
    type.fields = type.fields
      .map(f => transformNode(f, visitors, { ...context, parent: type }) as FieldNode | null)
      .filter((f): f is FieldNode => f !== null);
  }

  return current;
}

// ═══════════════════════════════════════════════════════════════════════════
// β3: EMIT - AST to output
// ═══════════════════════════════════════════════════════════════════════════

/** Emitter interface */
export interface Emitter {
  vendor: string;
  emit(ast: ProgramNode, options?: EmitOptions): Result<EmitResult>;
}

export interface EmitOptions {
  format?: boolean;
  comments?: boolean;
  minify?: boolean;
}

export interface EmitResult {
  code: string;
  sourceMap?: string;
  files?: Map<string, string>;
}

/**
 * β3: Emit AST to output code
 */
export function emit(
  ast: ProgramNode,
  emitter: Emitter,
  options: EmitOptions = {}
): Result<EmitResult> {
  return emitter.emit(ast, options);
}

// ═══════════════════════════════════════════════════════════════════════════
// β4: CHAIN - Pipeline composition
// ═══════════════════════════════════════════════════════════════════════════

/** Build pipeline step */
export type BuildStep<TIn, TOut> = (input: TIn) => Result<TOut>;

/** Build chain for composing steps */
export class BuildChain<TIn, TOut> {
  private steps: BuildStep<unknown, unknown>[] = [];

  constructor(private initial: BuildStep<TIn, unknown>) {
    this.steps.push(initial as BuildStep<unknown, unknown>);
  }

  /**
   * Add a step to the chain
   */
  pipe<TNext>(step: BuildStep<TOut, TNext>): BuildChain<TIn, TNext> {
    const newChain = new BuildChain<TIn, TNext>(this.initial as BuildStep<TIn, unknown>);
    newChain.steps = [...this.steps, step as BuildStep<unknown, unknown>];
    return newChain;
  }

  /**
   * Execute the chain
   */
  execute(input: TIn): Result<TOut> {
    let current: unknown = input;

    for (const step of this.steps) {
      const result = step(current);
      if (!result.ok) {
        return result as Result<TOut>;
      }
      current = result.value;
    }

    return success(current as TOut);
  }
}

/**
 * β4: Create a build chain
 */
export function chain<TIn, TOut>(step: BuildStep<TIn, TOut>): BuildChain<TIn, TOut> {
  return new BuildChain(step);
}

// ═══════════════════════════════════════════════════════════════════════════
// VENDOR UDT CONVERSION
// ═══════════════════════════════════════════════════════════════════════════

/** Vendor-specific UDT format */
export interface VendorUDT {
  vendor: string;
  format: string;
  content: string;
}

/** UDT converter interface */
export interface UDTConverter {
  fromVendor: string;
  toVendor: string;
  convert(udt: VendorUDT): Result<VendorUDT>;
}

const converters: Map<string, UDTConverter> = new Map();

/**
 * Register a UDT converter
 */
export function registerConverter(converter: UDTConverter): void {
  const key = `${converter.fromVendor}→${converter.toVendor}`;
  converters.set(key, converter);
}

/**
 * Convert UDT between vendors
 */
export function convertUDT(
  udt: VendorUDT,
  toVendor: string
): Result<VendorUDT> {
  const key = `${udt.vendor}→${toVendor}`;
  const converter = converters.get(key);

  if (!converter) {
    return failure(new Error(`No converter for ${key}`));
  }

  return converter.convert(udt);
}

// ═══════════════════════════════════════════════════════════════════════════
// BETA SUBSYSTEM CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Beta Subsystem - Build pipeline management
 */
export class BetaSubsystem {
  readonly id = 'β';
  readonly name = 'build';

  private parsers: Map<string, Parser> = new Map();
  private emitters: Map<string, Emitter> = new Map();

  /**
   * Get current operations
   */
  getOps() {
    return BetaOps;
  }

  /**
   * Register a parser
   */
  registerParser(parser: Parser): void {
    this.parsers.set(parser.vendor, parser);
  }

  /**
   * Register an emitter
   */
  registerEmitter(emitter: Emitter): void {
    this.emitters.set(emitter.vendor, emitter);
  }

  /**
   * β1: Parse source code
   */
  parse(source: string, vendor: string, options?: ParseOptions): Result<ParseResult> {
    const parser = this.parsers.get(vendor);
    if (!parser) {
      return failure(new Error(`No parser for vendor: ${vendor}`));
    }
    return parse(source, parser, options);
  }

  /**
   * β2: Transform AST
   */
  transform(ast: ProgramNode, visitors: TransformVisitor[]): Result<ProgramNode> {
    return transform(ast, visitors);
  }

  /**
   * β3: Emit code
   */
  emit(ast: ProgramNode, vendor: string, options?: EmitOptions): Result<EmitResult> {
    const emitter = this.emitters.get(vendor);
    if (!emitter) {
      return failure(new Error(`No emitter for vendor: ${vendor}`));
    }
    return emit(ast, emitter, options);
  }

  /**
   * β4: Create a build chain
   */
  chain<TIn, TOut>(step: BuildStep<TIn, TOut>): BuildChain<TIn, TOut> {
    return chain(step);
  }

  /**
   * Convert between vendors
   */
  convert(udt: VendorUDT, toVendor: string): Result<VendorUDT> {
    return convertUDT(udt, toVendor);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createBetaSubsystem(): BetaSubsystem {
  return new BetaSubsystem();
}
