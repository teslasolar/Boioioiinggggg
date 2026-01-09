/**
 * KONOMI v3.1 - Core Type Definitions
 *
 * Ω⊃{α,β,γ,δ,ε,ζ,η,θ}⊃{1,2,3,4}
 * Symbols: →⊕◊∞△▽●○⚡⏱✓✗∴∵
 */

// ═══════════════════════════════════════════════════════════════════════════
// SYMBOLS AND MARKERS
// ═══════════════════════════════════════════════════════════════════════════

export const Symbols = {
  FLOW: '→',
  MERGE: '⊕',
  OPTIONAL: '◊',
  INFINITE: '∞',
  UP: '△',
  DOWN: '▽',
  FILLED: '●',
  EMPTY: '○',
  INSTANT: '⚡',
  TIMED: '⏱',
  SUCCESS: '✓',
  FAILURE: '✗',
  THEREFORE: '∴',
  BECAUSE: '∵',
} as const;

export type Symbol = typeof Symbols[keyof typeof Symbols];

// ═══════════════════════════════════════════════════════════════════════════
// SUBSYSTEM IDENTIFIERS
// ═══════════════════════════════════════════════════════════════════════════

/** α: Architecture subsystem operations */
export type AlphaOp = 'α1' | 'α2' | 'α3';
export const AlphaOps = {
  SCAFFOLD: 'α1',
  WIRE: 'α2',
  CLEAN: 'α3',
} as const;

/** β: Build subsystem operations */
export type BetaOp = 'β1' | 'β2' | 'β3' | 'β4';
export const BetaOps = {
  PARSE: 'β1',
  TRANSFORM: 'β2',
  EMIT: 'β3',
  CHAIN: 'β4',
} as const;

/** γ: Cache subsystem operations */
export type GammaOp = 'γ1' | 'γ2' | 'γ3' | 'γ4';
export const GammaOps = {
  HYDRATE: 'γ1',
  QUERY: 'γ2',
  MUTATE: 'γ3',
  EVICT: 'γ4',
} as const;

/** δ: System subsystem operations */
export type DeltaOp = 'δ1' | 'δ2' | 'δ3' | 'δ4';
export const DeltaOps = {
  CONFIG: 'δ1',
  INIT: 'δ2',
  MONITOR: 'δ3',
  STOP: 'δ4',
} as const;

/** ε: API subsystem operations */
export type EpsilonOp = 'ε1' | 'ε2' | 'ε3' | 'ε4';
export const EpsilonOps = {
  ROUTE: 'ε1',
  VALIDATE: 'ε2',
  RESPOND: 'ε3',
  STREAM: 'ε4',
} as const;

/** ζ: Test subsystem operations */
export type ZetaOp = 'ζ1' | 'ζ2' | 'ζ3' | 'ζ4';
export const ZetaOps = {
  ASSERT: 'ζ1',
  MOCK: 'ζ2',
  COVER: 'ζ3',
  REPORT: 'ζ4',
} as const;

/** η: Documentation subsystem operations */
export type EtaOp = 'η1' | 'η2' | 'η3';
export const EtaOps = {
  EXTRACT: 'η1',
  GENERATE: 'η2',
  PUBLISH: 'η3',
} as const;

/** θ: Sync subsystem operations */
export type ThetaOp = 'θ1' | 'θ2' | 'θ3' | 'θ4';
export const ThetaOps = {
  DIFF: 'θ1',
  PUSH: 'θ2',
  PULL: 'θ3',
  RESOLVE: 'θ4',
} as const;

/** All subsystem operation types */
export type SubsystemOp =
  | AlphaOp
  | BetaOp
  | GammaOp
  | DeltaOp
  | EpsilonOp
  | ZetaOp
  | EtaOp
  | ThetaOp;

/** Subsystem identifier */
export type SubsystemId = 'α' | 'β' | 'γ' | 'δ' | 'ε' | 'ζ' | 'η' | 'θ';

// ═══════════════════════════════════════════════════════════════════════════
// RESULT TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface Success<T> {
  ok: true;
  value: T;
  symbol: '✓';
}

export interface Failure<E = Error> {
  ok: false;
  error: E;
  symbol: '✗';
}

export type Result<T, E = Error> = Success<T> | Failure<E>;

export function success<T>(value: T): Success<T> {
  return { ok: true, value, symbol: '✓' };
}

export function failure<E = Error>(error: E): Failure<E> {
  return { ok: false, error, symbol: '✗' };
}

export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result.ok;
}

export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return !result.ok;
}

// ═══════════════════════════════════════════════════════════════════════════
// ASYNC PATTERNS
// ═══════════════════════════════════════════════════════════════════════════

/** WebSocket message flow: ∞(▽→λ→△) */
export interface StreamMessage<T> {
  direction: '△' | '▽';  // up or down
  payload: T;
  timestamp: number;
}

/** Infinite stream handler */
export type StreamHandler<T> = (message: StreamMessage<T>) => void | Promise<void>;

// ═══════════════════════════════════════════════════════════════════════════
// STATE MARKERS
// ═══════════════════════════════════════════════════════════════════════════

/** PackML state markers: ● (active) ○ (inactive) */
export type PackMLMarker = '●' | '○';

export interface PackMLState {
  name: string;
  active: PackMLMarker;
  transitions: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// OMEGA (Ω) - THE SYSTEM CONTAINER
// ═══════════════════════════════════════════════════════════════════════════

/** Boot sequence: ζ(X)→α→δ→γ→β→ε→θ→✓ */
export type BootPhase =
  | 'ζ'   // Test (validation first)
  | 'α'   // Architecture
  | 'δ'   // System
  | 'γ'   // Cache
  | 'β'   // Build
  | 'ε'   // API
  | 'θ'   // Sync
  | '✓';  // Complete

export interface OmegaState {
  phase: BootPhase;
  subsystems: Map<SubsystemId, boolean>;
  kappa: number;
  ready: boolean;
}

/** Output flow: Ω→agents→tasks→output */
export interface OmegaOutput<T> {
  source: 'Ω';
  agent: string;
  task: string;
  output: T;
  timestamp: number;
}
