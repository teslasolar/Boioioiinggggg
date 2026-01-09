/**
 * KONOMI v3.1 - θ (Theta) Subsystem: Sync
 *
 * θ:sync{θ1→diff, θ2→push, θ3→pull, θ4→resolve}
 *
 * E4:PLC{Type→Field→CM, vendor⟷UDT, git:diff→merge→sync}
 *
 * Synchronization system with diff, push, pull, and conflict resolution.
 */

import { Result, success, failure, ThetaOps } from '../core/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// SYNC TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Change type */
export type ChangeType = 'add' | 'modify' | 'delete' | 'rename';

/** Change record */
export interface Change<T = unknown> {
  type: ChangeType;
  path: string;
  oldValue?: T;
  newValue?: T;
  timestamp: number;
}

/** Diff result */
export interface DiffResult<T = unknown> {
  changes: Change<T>[];
  added: number;
  modified: number;
  deleted: number;
  renamed: number;
}

/** Conflict */
export interface Conflict<T = unknown> {
  path: string;
  local: T;
  remote: T;
  base?: T;
  type: 'content' | 'structure' | 'type';
}

/** Merge result */
export interface MergeResult<T = unknown> {
  merged: T;
  conflicts: Conflict<T>[];
  applied: Change<T>[];
}

/** Sync state */
export interface SyncState {
  lastSync: number;
  localVersion: number;
  remoteVersion: number;
  pending: Change[];
  conflicts: Conflict[];
}

// ═══════════════════════════════════════════════════════════════════════════
// θ1: DIFF - Compare and detect changes
// ═══════════════════════════════════════════════════════════════════════════

/**
 * θ1: Compute diff between two objects
 */
export function diff<T extends Record<string, unknown>>(
  oldObj: T,
  newObj: T,
  options: { deep?: boolean; ignorePaths?: string[] } = {}
): Result<DiffResult> {
  const changes: Change[] = [];
  const { deep = true, ignorePaths = [] } = options;

  try {
    diffObjects(oldObj, newObj, '', changes, deep, new Set(ignorePaths));

    return success({
      changes,
      added: changes.filter(c => c.type === 'add').length,
      modified: changes.filter(c => c.type === 'modify').length,
      deleted: changes.filter(c => c.type === 'delete').length,
      renamed: changes.filter(c => c.type === 'rename').length,
    });
  } catch (e) {
    return failure(e instanceof Error ? e : new Error(String(e)));
  }
}

function diffObjects(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  path: string,
  changes: Change[],
  deep: boolean,
  ignorePaths: Set<string>
): void {
  const oldKeys = new Set(Object.keys(oldObj));
  const newKeys = new Set(Object.keys(newObj));
  const now = Date.now();

  // Check for deletions and modifications
  for (const key of oldKeys) {
    const currentPath = path ? `${path}.${key}` : key;

    if (ignorePaths.has(currentPath)) continue;

    if (!newKeys.has(key)) {
      changes.push({
        type: 'delete',
        path: currentPath,
        oldValue: oldObj[key],
        timestamp: now,
      });
    } else if (deep && isObject(oldObj[key]) && isObject(newObj[key])) {
      diffObjects(
        oldObj[key] as Record<string, unknown>,
        newObj[key] as Record<string, unknown>,
        currentPath,
        changes,
        deep,
        ignorePaths
      );
    } else if (!deepEqual(oldObj[key], newObj[key])) {
      changes.push({
        type: 'modify',
        path: currentPath,
        oldValue: oldObj[key],
        newValue: newObj[key],
        timestamp: now,
      });
    }
  }

  // Check for additions
  for (const key of newKeys) {
    const currentPath = path ? `${path}.${key}` : key;

    if (ignorePaths.has(currentPath)) continue;

    if (!oldKeys.has(key)) {
      changes.push({
        type: 'add',
        path: currentPath,
        newValue: newObj[key],
        timestamp: now,
      });
    }
  }
}

/**
 * θ1: Compute diff for arrays
 */
export function diffArrays<T>(
  oldArr: T[],
  newArr: T[],
  keyFn: (item: T) => string = item => JSON.stringify(item)
): Result<DiffResult<T>> {
  const changes: Change<T>[] = [];
  const now = Date.now();

  const oldMap = new Map(oldArr.map(item => [keyFn(item), item]));
  const newMap = new Map(newArr.map(item => [keyFn(item), item]));

  // Deletions
  for (const [key, item] of oldMap) {
    if (!newMap.has(key)) {
      changes.push({
        type: 'delete',
        path: key,
        oldValue: item,
        timestamp: now,
      });
    }
  }

  // Additions and modifications
  for (const [key, item] of newMap) {
    if (!oldMap.has(key)) {
      changes.push({
        type: 'add',
        path: key,
        newValue: item,
        timestamp: now,
      });
    } else {
      const oldItem = oldMap.get(key);
      if (!deepEqual(oldItem, item)) {
        changes.push({
          type: 'modify',
          path: key,
          oldValue: oldItem,
          newValue: item,
          timestamp: now,
        });
      }
    }
  }

  return success({
    changes,
    added: changes.filter(c => c.type === 'add').length,
    modified: changes.filter(c => c.type === 'modify').length,
    deleted: changes.filter(c => c.type === 'delete').length,
    renamed: 0,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// θ2: PUSH - Apply local changes to remote
// ═══════════════════════════════════════════════════════════════════════════

/** Push target interface */
export interface PushTarget<T = unknown> {
  name: string;
  apply(changes: Change<T>[]): Promise<Result<void>>;
  getVersion(): Promise<number>;
  setVersion(version: number): Promise<void>;
}

/** Push options */
export interface PushOptions {
  force?: boolean;
  dryRun?: boolean;
}

/**
 * θ2: Push changes to a target
 */
export async function push<T>(
  changes: Change<T>[],
  target: PushTarget<T>,
  options: PushOptions = {}
): Promise<Result<{ applied: number; skipped: number }>> {
  if (changes.length === 0) {
    return success({ applied: 0, skipped: 0 });
  }

  try {
    if (options.dryRun) {
      return success({ applied: changes.length, skipped: 0 });
    }

    const result = await target.apply(changes);
    if (!result.ok) return result;

    const currentVersion = await target.getVersion();
    await target.setVersion(currentVersion + 1);

    return success({ applied: changes.length, skipped: 0 });
  } catch (e) {
    return failure(e instanceof Error ? e : new Error(String(e)));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// θ3: PULL - Fetch remote changes to local
// ═══════════════════════════════════════════════════════════════════════════

/** Pull source interface */
export interface PullSource<T = unknown> {
  name: string;
  fetch(sinceVersion: number): Promise<Result<Change<T>[]>>;
  getVersion(): Promise<number>;
}

/** Pull options */
export interface PullOptions {
  sinceVersion?: number;
  limit?: number;
}

/**
 * θ3: Pull changes from a source
 */
export async function pull<T>(
  source: PullSource<T>,
  options: PullOptions = {}
): Promise<Result<{ changes: Change<T>[]; version: number }>> {
  try {
    const sinceVersion = options.sinceVersion ?? 0;
    const result = await source.fetch(sinceVersion);

    if (!result.ok) return result;

    let changes = result.value;
    if (options.limit) {
      changes = changes.slice(0, options.limit);
    }

    const version = await source.getVersion();

    return success({ changes, version });
  } catch (e) {
    return failure(e instanceof Error ? e : new Error(String(e)));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// θ4: RESOLVE - Merge and resolve conflicts
// ═══════════════════════════════════════════════════════════════════════════

/** Conflict resolver function */
export type ConflictResolver<T> = (conflict: Conflict<T>) => T | null;

/** Built-in resolution strategies */
export type ResolutionStrategy = 'local' | 'remote' | 'newest' | 'merge' | 'manual';

/**
 * θ4: Merge changes with conflict detection
 */
export function merge<T extends Record<string, unknown>>(
  base: T,
  local: T,
  remote: T,
  resolver?: ConflictResolver<T[keyof T]>
): Result<MergeResult<T>> {
  const conflicts: Conflict[] = [];
  const applied: Change[] = [];
  const merged = { ...base } as Record<string, unknown>;

  // Get diffs
  const localDiff = diff(base, local);
  const remoteDiff = diff(base, remote);

  if (!localDiff.ok) return localDiff;
  if (!remoteDiff.ok) return remoteDiff;

  const localChanges = new Map(localDiff.value.changes.map(c => [c.path, c]));
  const remoteChanges = new Map(remoteDiff.value.changes.map(c => [c.path, c]));

  // Apply non-conflicting remote changes
  for (const [path, remoteChange] of remoteChanges) {
    const localChange = localChanges.get(path);

    if (!localChange) {
      // No conflict, apply remote change
      applyChange(merged, remoteChange);
      applied.push(remoteChange);
    } else if (!deepEqual(localChange.newValue, remoteChange.newValue)) {
      // Conflict detected
      const conflict: Conflict = {
        path,
        local: localChange.newValue,
        remote: remoteChange.newValue,
        base: localChange.oldValue,
        type: 'content',
      };

      if (resolver) {
        const resolved = resolver(conflict);
        if (resolved !== null) {
          setByPath(merged, path, resolved);
          applied.push({
            type: 'modify',
            path,
            oldValue: conflict.base,
            newValue: resolved,
            timestamp: Date.now(),
          });
        } else {
          conflicts.push(conflict);
        }
      } else {
        conflicts.push(conflict);
      }
    }
  }

  // Apply local-only changes
  for (const [path, localChange] of localChanges) {
    if (!remoteChanges.has(path)) {
      applyChange(merged, localChange);
      applied.push(localChange);
    }
  }

  return success({
    merged: merged as T,
    conflicts,
    applied,
  });
}

/**
 * θ4: Create a resolver with a strategy
 */
export function createResolver<T>(strategy: ResolutionStrategy): ConflictResolver<T> {
  switch (strategy) {
    case 'local':
      return (conflict) => conflict.local as T;
    case 'remote':
      return (conflict) => conflict.remote as T;
    case 'newest':
      return (conflict) => {
        // Assume local is newer if we don't have timestamps
        return conflict.local as T;
      };
    case 'merge':
      return (conflict) => {
        // For objects, try to merge
        if (isObject(conflict.local) && isObject(conflict.remote)) {
          return {
            ...(conflict.local as object),
            ...(conflict.remote as object),
          } as T;
        }
        return null; // Can't merge, leave as conflict
      };
    case 'manual':
    default:
      return () => null; // Always treat as conflict
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// THETA SUBSYSTEM CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Theta Subsystem - Synchronization management
 */
export class ThetaSubsystem {
  readonly id = 'θ';
  readonly name = 'sync';

  private state: SyncState = {
    lastSync: 0,
    localVersion: 0,
    remoteVersion: 0,
    pending: [],
    conflicts: [],
  };

  private targets: Map<string, PushTarget> = new Map();
  private sources: Map<string, PullSource> = new Map();

  /**
   * Get current operations
   */
  getOps() {
    return ThetaOps;
  }

  /**
   * θ1: Compute diff
   */
  diff<T extends Record<string, unknown>>(
    oldObj: T,
    newObj: T,
    options?: { deep?: boolean; ignorePaths?: string[] }
  ): Result<DiffResult> {
    return diff(oldObj, newObj, options);
  }

  /**
   * θ1: Diff arrays
   */
  diffArrays<T>(
    oldArr: T[],
    newArr: T[],
    keyFn?: (item: T) => string
  ): Result<DiffResult<T>> {
    return diffArrays(oldArr, newArr, keyFn);
  }

  /**
   * θ2: Push to a target
   */
  async push<T>(
    changes: Change<T>[],
    targetName: string,
    options?: PushOptions
  ): Promise<Result<{ applied: number; skipped: number }>> {
    const target = this.targets.get(targetName);
    if (!target) {
      return failure(new Error(`Unknown target: ${targetName}`));
    }
    return push(changes, target as PushTarget<T>, options);
  }

  /**
   * θ3: Pull from a source
   */
  async pull<T>(
    sourceName: string,
    options?: PullOptions
  ): Promise<Result<{ changes: Change<T>[]; version: number }>> {
    const source = this.sources.get(sourceName);
    if (!source) {
      return failure(new Error(`Unknown source: ${sourceName}`));
    }
    return pull(source as PullSource<T>, options);
  }

  /**
   * θ4: Merge with conflict resolution
   */
  merge<T extends Record<string, unknown>>(
    base: T,
    local: T,
    remote: T,
    strategy: ResolutionStrategy = 'manual'
  ): Result<MergeResult<T>> {
    const resolver = createResolver<T[keyof T]>(strategy);
    return merge(base, local, remote, resolver);
  }

  /**
   * Register a push target
   */
  registerTarget(target: PushTarget): void {
    this.targets.set(target.name, target);
  }

  /**
   * Register a pull source
   */
  registerSource(source: PullSource): void {
    this.sources.set(source.name, source);
  }

  /**
   * Get sync state
   */
  getState(): SyncState {
    return { ...this.state };
  }

  /**
   * Add pending change
   */
  addPending(change: Change): void {
    this.state.pending.push(change);
  }

  /**
   * Clear pending changes
   */
  clearPending(): void {
    this.state.pending = [];
  }

  /**
   * Get pending changes
   */
  getPending(): Change[] {
    return [...this.state.pending];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, i) => deepEqual(item, b[i]));
    }

    if (isObject(a) && isObject(b)) {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      return keysA.every(key => deepEqual(a[key], b[key]));
    }
  }

  return false;
}

function applyChange(obj: Record<string, unknown>, change: Change): void {
  switch (change.type) {
    case 'add':
    case 'modify':
      setByPath(obj, change.path, change.newValue);
      break;
    case 'delete':
      deleteByPath(obj, change.path);
      break;
  }
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current)) {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

function deleteByPath(obj: Record<string, unknown>, path: string): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current)) return;
    current = current[parts[i]] as Record<string, unknown>;
  }

  delete current[parts[parts.length - 1]];
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createThetaSubsystem(): ThetaSubsystem {
  return new ThetaSubsystem();
}
