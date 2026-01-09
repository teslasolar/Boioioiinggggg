/**
 * KONOMI v3.1 - γ (Gamma) Subsystem: Cache
 *
 * γ:cache{γ1→hydrate, γ2→query, γ3→mutate, γ4→evict}
 *
 * Manages data caching with hydration, querying, mutation, and eviction.
 */

import { Result, success, failure, GammaOps } from '../core/types.js';
import { PHI, KAPPA_STAR } from '../core/phi.js';

// ═══════════════════════════════════════════════════════════════════════════
// CACHE TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Cache entry with metadata */
export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  updatedAt: number;
  accessedAt: number;
  accessCount: number;
  ttl?: number;          // Time-to-live in ms
  tags: Set<string>;     // For tag-based invalidation
  size?: number;         // Size in bytes (estimated)
}

/** Cache statistics */
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;          // Total entries
  memoryUsage?: number;  // Estimated bytes
  hitRate: number;       // hits / (hits + misses)
}

/** Eviction policy */
export type EvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'ttl' | 'phi';

/** Query filter function */
export type QueryFilter<T> = (entry: CacheEntry<T>) => boolean;

/** Mutation function */
export type Mutator<T> = (value: T) => T;

// ═══════════════════════════════════════════════════════════════════════════
// γ1: HYDRATE - Load data into cache
// ═══════════════════════════════════════════════════════════════════════════

export interface HydrateOptions {
  ttl?: number;
  tags?: string[];
}

/**
 * γ1: Hydrate cache with data
 */
export function hydrate<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  options: HydrateOptions = {}
): CacheEntry<T> {
  const now = Date.now();
  const existing = cache.get(key);

  const entry: CacheEntry<T> = {
    key,
    value,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    accessedAt: now,
    accessCount: existing?.accessCount ?? 0,
    ttl: options.ttl,
    tags: new Set(options.tags ?? []),
  };

  cache.set(key, entry);
  return entry;
}

/**
 * γ1: Bulk hydrate from data source
 */
export async function hydrateFrom<T>(
  cache: Map<string, CacheEntry<T>>,
  source: AsyncIterable<[string, T]> | Iterable<[string, T]>,
  options: HydrateOptions = {}
): Promise<number> {
  let count = 0;
  for await (const [key, value] of source) {
    hydrate(cache, key, value, options);
    count++;
  }
  return count;
}

// ═══════════════════════════════════════════════════════════════════════════
// γ2: QUERY - Retrieve data from cache
// ═══════════════════════════════════════════════════════════════════════════

export interface QueryResult<T> {
  entries: CacheEntry<T>[];
  total: number;
  fromCache: boolean;
}

/**
 * γ2: Query single entry by key
 */
export function query<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  stats?: CacheStats
): CacheEntry<T> | undefined {
  const entry = cache.get(key);

  if (entry) {
    // Check TTL
    if (entry.ttl && Date.now() - entry.updatedAt > entry.ttl) {
      cache.delete(key);
      if (stats) stats.misses++;
      return undefined;
    }

    // Update access metadata
    entry.accessedAt = Date.now();
    entry.accessCount++;
    if (stats) stats.hits++;
    return entry;
  }

  if (stats) stats.misses++;
  return undefined;
}

/**
 * γ2: Query multiple entries by filter
 */
export function queryAll<T>(
  cache: Map<string, CacheEntry<T>>,
  filter: QueryFilter<T>
): QueryResult<T> {
  const entries: CacheEntry<T>[] = [];
  const now = Date.now();

  for (const entry of cache.values()) {
    // Skip expired
    if (entry.ttl && now - entry.updatedAt > entry.ttl) {
      continue;
    }

    if (filter(entry)) {
      entry.accessedAt = now;
      entry.accessCount++;
      entries.push(entry);
    }
  }

  return {
    entries,
    total: entries.length,
    fromCache: true,
  };
}

/**
 * γ2: Query by tags
 */
export function queryByTags<T>(
  cache: Map<string, CacheEntry<T>>,
  tags: string[],
  mode: 'all' | 'any' = 'any'
): QueryResult<T> {
  const tagSet = new Set(tags);

  return queryAll(cache, entry => {
    if (mode === 'all') {
      return tags.every(tag => entry.tags.has(tag));
    } else {
      return tags.some(tag => entry.tags.has(tag));
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// γ3: MUTATE - Update cached data
// ═══════════════════════════════════════════════════════════════════════════

/**
 * γ3: Mutate a single entry
 */
export function mutate<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  mutator: Mutator<T>
): Result<CacheEntry<T>> {
  const entry = cache.get(key);
  if (!entry) {
    return failure(new Error(`Cache entry not found: ${key}`));
  }

  try {
    entry.value = mutator(entry.value);
    entry.updatedAt = Date.now();
    return success(entry);
  } catch (e) {
    return failure(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * γ3: Mutate multiple entries by filter
 */
export function mutateAll<T>(
  cache: Map<string, CacheEntry<T>>,
  filter: QueryFilter<T>,
  mutator: Mutator<T>
): Result<number> {
  let count = 0;
  const now = Date.now();

  try {
    for (const entry of cache.values()) {
      if (filter(entry)) {
        entry.value = mutator(entry.value);
        entry.updatedAt = now;
        count++;
      }
    }
    return success(count);
  } catch (e) {
    return failure(e instanceof Error ? e : new Error(String(e)));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// γ4: EVICT - Remove data from cache
// ═══════════════════════════════════════════════════════════════════════════

/**
 * γ4: Evict single entry
 */
export function evict<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  stats?: CacheStats
): boolean {
  const deleted = cache.delete(key);
  if (deleted && stats) {
    stats.evictions++;
  }
  return deleted;
}

/**
 * γ4: Evict by tags
 */
export function evictByTags<T>(
  cache: Map<string, CacheEntry<T>>,
  tags: string[],
  stats?: CacheStats
): number {
  const tagSet = new Set(tags);
  let count = 0;

  for (const [key, entry] of cache) {
    if (tags.some(tag => entry.tags.has(tag))) {
      cache.delete(key);
      count++;
    }
  }

  if (stats) stats.evictions += count;
  return count;
}

/**
 * γ4: Evict expired entries
 */
export function evictExpired<T>(
  cache: Map<string, CacheEntry<T>>,
  stats?: CacheStats
): number {
  const now = Date.now();
  let count = 0;

  for (const [key, entry] of cache) {
    if (entry.ttl && now - entry.updatedAt > entry.ttl) {
      cache.delete(key);
      count++;
    }
  }

  if (stats) stats.evictions += count;
  return count;
}

/**
 * γ4: Evict by policy to reach target size
 */
export function evictByPolicy<T>(
  cache: Map<string, CacheEntry<T>>,
  policy: EvictionPolicy,
  targetSize: number,
  stats?: CacheStats
): number {
  if (cache.size <= targetSize) return 0;

  const toEvict = cache.size - targetSize;
  const entries = Array.from(cache.entries());

  // Sort by policy
  switch (policy) {
    case 'lru':
      entries.sort((a, b) => a[1].accessedAt - b[1].accessedAt);
      break;
    case 'lfu':
      entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
      break;
    case 'fifo':
      entries.sort((a, b) => a[1].createdAt - b[1].createdAt);
      break;
    case 'ttl':
      entries.sort((a, b) => {
        const ttlA = a[1].ttl ?? Infinity;
        const ttlB = b[1].ttl ?? Infinity;
        const expiresA = a[1].updatedAt + ttlA;
        const expiresB = b[1].updatedAt + ttlB;
        return expiresA - expiresB;
      });
      break;
    case 'phi':
      // Golden ratio weighted scoring: balance recency and frequency
      const now = Date.now();
      entries.sort((a, b) => {
        const scoreA = phiScore(a[1], now);
        const scoreB = phiScore(b[1], now);
        return scoreA - scoreB;
      });
      break;
  }

  // Evict the sorted entries
  let count = 0;
  for (let i = 0; i < toEvict && i < entries.length; i++) {
    cache.delete(entries[i][0]);
    count++;
  }

  if (stats) stats.evictions += count;
  return count;
}

/**
 * Calculate phi-weighted cache score
 * Higher score = more valuable, keep longer
 */
function phiScore<T>(entry: CacheEntry<T>, now: number): number {
  const age = now - entry.createdAt;
  const recency = now - entry.accessedAt;
  const frequency = entry.accessCount;

  // Weighted combination using golden ratio
  // Recency weighted by κ* (0.618), frequency by 1/φ² (0.382)
  const recencyScore = 1 / (1 + recency / 60000); // Normalize to minutes
  const frequencyScore = Math.log2(1 + frequency);

  return KAPPA_STAR * recencyScore + (1 - KAPPA_STAR) * frequencyScore;
}

// ═══════════════════════════════════════════════════════════════════════════
// GAMMA SUBSYSTEM CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gamma Subsystem - Cache management
 */
export class GammaSubsystem<T = unknown> {
  readonly id = 'γ';
  readonly name = 'cache';

  private cache: Map<string, CacheEntry<T>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0,
  };
  private maxSize: number;
  private policy: EvictionPolicy;

  constructor(options: { maxSize?: number; policy?: EvictionPolicy } = {}) {
    this.maxSize = options.maxSize ?? 10000;
    this.policy = options.policy ?? 'phi';
  }

  /**
   * Get current operations
   */
  getOps() {
    return GammaOps;
  }

  /**
   * γ1: Hydrate cache
   */
  hydrate(key: string, value: T, options?: HydrateOptions): CacheEntry<T> {
    const entry = hydrate(this.cache, key, value, options);
    this.maybeEvict();
    this.updateStats();
    return entry;
  }

  /**
   * γ1: Bulk hydrate
   */
  async hydrateFrom(
    source: AsyncIterable<[string, T]> | Iterable<[string, T]>,
    options?: HydrateOptions
  ): Promise<number> {
    const count = await hydrateFrom(this.cache, source, options);
    this.maybeEvict();
    this.updateStats();
    return count;
  }

  /**
   * γ2: Query by key
   */
  query(key: string): T | undefined {
    const entry = query(this.cache, key, this.stats);
    this.updateStats();
    return entry?.value;
  }

  /**
   * γ2: Query by filter
   */
  queryAll(filter: QueryFilter<T>): QueryResult<T> {
    return queryAll(this.cache, filter);
  }

  /**
   * γ2: Query by tags
   */
  queryByTags(tags: string[], mode?: 'all' | 'any'): QueryResult<T> {
    return queryByTags(this.cache, tags, mode);
  }

  /**
   * γ3: Mutate entry
   */
  mutate(key: string, mutator: Mutator<T>): Result<CacheEntry<T>> {
    return mutate(this.cache, key, mutator);
  }

  /**
   * γ3: Mutate by filter
   */
  mutateAll(filter: QueryFilter<T>, mutator: Mutator<T>): Result<number> {
    return mutateAll(this.cache, filter, mutator);
  }

  /**
   * γ4: Evict by key
   */
  evict(key: string): boolean {
    const result = evict(this.cache, key, this.stats);
    this.updateStats();
    return result;
  }

  /**
   * γ4: Evict by tags
   */
  evictByTags(tags: string[]): number {
    const count = evictByTags(this.cache, tags, this.stats);
    this.updateStats();
    return count;
  }

  /**
   * γ4: Evict expired
   */
  evictExpired(): number {
    const count = evictExpired(this.cache, this.stats);
    this.updateStats();
    return count;
  }

  /**
   * γ4: Clear all
   */
  clear(): void {
    this.stats.evictions += this.cache.size;
    this.cache.clear();
    this.updateStats();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Set eviction policy
   */
  setPolicy(policy: EvictionPolicy): void {
    this.policy = policy;
  }

  /**
   * Set max size
   */
  setMaxSize(size: number): void {
    this.maxSize = size;
    this.maybeEvict();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private maybeEvict(): void {
    if (this.cache.size > this.maxSize) {
      evictByPolicy(this.cache, this.policy, this.maxSize, this.stats);
    }
  }

  private updateStats(): void {
    this.stats.size = this.cache.size;
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createGammaSubsystem<T = unknown>(
  options?: { maxSize?: number; policy?: EvictionPolicy }
): GammaSubsystem<T> {
  return new GammaSubsystem<T>(options);
}
