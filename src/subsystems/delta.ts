/**
 * KONOMI v3.1 - δ (Delta) Subsystem: System
 *
 * δ:sys{δ1→config, δ2→init, δ3→monitor, δ4→stop}
 *
 * Manages system lifecycle: configuration, initialization,
 * monitoring, and shutdown.
 */

import { Result, success, failure, DeltaOps, SubsystemId } from '../core/types.js';
import { KAPPA_STAR } from '../core/phi.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Configuration value types */
export type ConfigValue =
  | string
  | number
  | boolean
  | null
  | ConfigValue[]
  | { [key: string]: ConfigValue };

/** Configuration schema for validation */
export interface ConfigSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  default?: ConfigValue;
  validator?: (value: ConfigValue) => boolean;
  description?: string;
}

/** Configuration section */
export interface ConfigSection {
  [key: string]: ConfigValue;
}

/** Full system configuration */
export interface SystemConfig {
  version: string;
  environment: 'development' | 'staging' | 'production';
  kappa: number;           // System chaos/order balance
  subsystems: {
    [K in SubsystemId]?: ConfigSection;
  };
  plugins?: ConfigSection;
  custom?: ConfigSection;
}

// ═══════════════════════════════════════════════════════════════════════════
// δ1: CONFIG - Configuration management
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default system configuration
 */
export function defaultConfig(): SystemConfig {
  return {
    version: '3.1.0',
    environment: 'development',
    kappa: KAPPA_STAR,
    subsystems: {},
  };
}

/**
 * δ1: Load configuration from source
 */
export function loadConfig(
  source: Partial<SystemConfig>,
  base: SystemConfig = defaultConfig()
): Result<SystemConfig> {
  try {
    const merged = deepMerge(base, source) as SystemConfig;
    return success(merged);
  } catch (e) {
    return failure(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * δ1: Validate configuration against schema
 */
export function validateConfig(
  config: SystemConfig,
  schema: Record<string, ConfigSchema>
): Result<void> {
  const errors: string[] = [];

  for (const [key, schemaEntry] of Object.entries(schema)) {
    const value = getConfigValue(config, key);

    if (schemaEntry.required && value === undefined) {
      errors.push(`Missing required config: ${key}`);
      continue;
    }

    if (value !== undefined && schemaEntry.validator) {
      if (!schemaEntry.validator(value)) {
        errors.push(`Invalid config value for: ${key}`);
      }
    }
  }

  if (errors.length > 0) {
    return failure(new Error(`Config validation failed:\n${errors.join('\n')}`));
  }

  return success(undefined);
}

/**
 * δ1: Get config value by dot-notation path
 */
export function getConfigValue(
  config: SystemConfig,
  path: string
): ConfigValue | undefined {
  const parts = path.split('.');
  let current: ConfigValue = config as unknown as ConfigValue;

  for (const part of parts) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, ConfigValue>)[part];
  }

  return current;
}

// ═══════════════════════════════════════════════════════════════════════════
// δ2: INIT - System initialization
// ═══════════════════════════════════════════════════════════════════════════

/** Initialization hook */
export type InitHook = (config: SystemConfig) => Promise<void> | void;

/** System state */
export type SystemState =
  | 'stopped'
  | 'initializing'
  | 'running'
  | 'stopping'
  | 'error';

/** System info */
export interface SystemInfo {
  state: SystemState;
  startedAt?: number;
  uptime?: number;
  config: SystemConfig;
  subsystems: Map<SubsystemId, boolean>;
}

/**
 * δ2: Initialize system
 */
export async function init(
  config: SystemConfig,
  hooks: InitHook[] = []
): Promise<Result<SystemInfo>> {
  const info: SystemInfo = {
    state: 'initializing',
    config,
    subsystems: new Map(),
  };

  try {
    // Run initialization hooks in order
    for (const hook of hooks) {
      await hook(config);
    }

    info.state = 'running';
    info.startedAt = Date.now();

    return success(info);
  } catch (e) {
    info.state = 'error';
    return failure(e instanceof Error ? e : new Error(String(e)));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// δ3: MONITOR - System monitoring
// ═══════════════════════════════════════════════════════════════════════════

/** Health status */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/** Health check result */
export interface HealthCheck {
  name: string;
  status: HealthStatus;
  latency?: number;
  message?: string;
  timestamp: number;
}

/** System metrics */
export interface SystemMetrics {
  cpu?: number;
  memory?: {
    used: number;
    total: number;
    percent: number;
  };
  uptime: number;
  eventLoopLag?: number;
  custom: Map<string, number>;
}

/** Monitor callback */
export type MonitorCallback = (metrics: SystemMetrics) => void;

/**
 * δ3: Perform health check
 */
export async function healthCheck(
  checks: Array<{
    name: string;
    check: () => Promise<boolean> | boolean;
  }>
): Promise<HealthCheck[]> {
  const results: HealthCheck[] = [];

  for (const { name, check } of checks) {
    const start = Date.now();
    try {
      const healthy = await check();
      results.push({
        name,
        status: healthy ? 'healthy' : 'unhealthy',
        latency: Date.now() - start,
        timestamp: Date.now(),
      });
    } catch (e) {
      results.push({
        name,
        status: 'unhealthy',
        latency: Date.now() - start,
        message: e instanceof Error ? e.message : String(e),
        timestamp: Date.now(),
      });
    }
  }

  return results;
}

/**
 * δ3: Collect system metrics
 */
export function collectMetrics(startedAt: number): SystemMetrics {
  const now = Date.now();

  return {
    uptime: now - startedAt,
    memory: getMemoryUsage(),
    custom: new Map(),
  };
}

/**
 * δ3: Get overall health status
 */
export function getOverallHealth(checks: HealthCheck[]): HealthStatus {
  if (checks.some(c => c.status === 'unhealthy')) {
    return 'unhealthy';
  }
  if (checks.some(c => c.status === 'degraded')) {
    return 'degraded';
  }
  return 'healthy';
}

// ═══════════════════════════════════════════════════════════════════════════
// δ4: STOP - System shutdown
// ═══════════════════════════════════════════════════════════════════════════

/** Shutdown hook */
export type ShutdownHook = (info: SystemInfo) => Promise<void> | void;

/**
 * δ4: Stop system gracefully
 */
export async function stop(
  info: SystemInfo,
  hooks: ShutdownHook[] = [],
  timeout = 30000
): Promise<Result<void>> {
  info.state = 'stopping';

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Shutdown timeout')), timeout);
  });

  try {
    // Run shutdown hooks in reverse order
    const reversedHooks = [...hooks].reverse();

    await Promise.race([
      (async () => {
        for (const hook of reversedHooks) {
          await hook(info);
        }
      })(),
      timeoutPromise,
    ]);

    info.state = 'stopped';
    return success(undefined);
  } catch (e) {
    info.state = 'error';
    return failure(e instanceof Error ? e : new Error(String(e)));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DELTA SUBSYSTEM CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Delta Subsystem - System lifecycle management
 */
export class DeltaSubsystem {
  readonly id = 'δ';
  readonly name = 'sys';

  private config: SystemConfig | null = null;
  private info: SystemInfo | null = null;
  private initHooks: InitHook[] = [];
  private shutdownHooks: ShutdownHook[] = [];
  private monitorCallbacks: MonitorCallback[] = [];
  private monitorInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Get current operations
   */
  getOps() {
    return DeltaOps;
  }

  /**
   * δ1: Load and validate configuration
   */
  async config_(
    source: Partial<SystemConfig>,
    schema?: Record<string, ConfigSchema>
  ): Promise<Result<SystemConfig>> {
    const loadResult = loadConfig(source);
    if (!loadResult.ok) return loadResult;

    if (schema) {
      const validateResult = validateConfig(loadResult.value, schema);
      if (!validateResult.ok) return validateResult;
    }

    this.config = loadResult.value;
    return success(this.config);
  }

  /**
   * δ2: Initialize system
   */
  async init(): Promise<Result<SystemInfo>> {
    if (!this.config) {
      return failure(new Error('Must configure before init'));
    }

    const result = await init(this.config, this.initHooks);
    if (result.ok) {
      this.info = result.value;
    }
    return result;
  }

  /**
   * δ3: Start monitoring
   */
  monitor(intervalMs = 5000): void {
    if (!this.info || this.info.state !== 'running') return;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    this.monitorInterval = setInterval(() => {
      if (this.info?.startedAt) {
        const metrics = collectMetrics(this.info.startedAt);
        for (const callback of this.monitorCallbacks) {
          callback(metrics);
        }
      }
    }, intervalMs);
  }

  /**
   * δ3: Perform health check
   */
  async healthCheck(
    checks: Array<{ name: string; check: () => Promise<boolean> | boolean }>
  ): Promise<HealthCheck[]> {
    return healthCheck(checks);
  }

  /**
   * δ4: Stop system
   */
  async stop(timeout?: number): Promise<Result<void>> {
    if (!this.info) {
      return success(undefined);
    }

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    return stop(this.info, this.shutdownHooks, timeout);
  }

  /**
   * Register initialization hook
   */
  onInit(hook: InitHook): void {
    this.initHooks.push(hook);
  }

  /**
   * Register shutdown hook
   */
  onShutdown(hook: ShutdownHook): void {
    this.shutdownHooks.push(hook);
  }

  /**
   * Register monitor callback
   */
  onMonitor(callback: MonitorCallback): void {
    this.monitorCallbacks.push(callback);
  }

  /**
   * Get current state
   */
  getState(): SystemState {
    return this.info?.state ?? 'stopped';
  }

  /**
   * Get system info
   */
  getInfo(): SystemInfo | null {
    return this.info;
  }

  /**
   * Get configuration
   */
  getConfig(): SystemConfig | null {
    return this.config;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function deepMerge(target: ConfigValue, source: ConfigValue): ConfigValue {
  if (source === null || source === undefined) return target;
  if (target === null || target === undefined) return source;

  if (typeof source !== 'object' || typeof target !== 'object') {
    return source;
  }

  if (Array.isArray(source)) {
    return source;
  }

  const result: Record<string, ConfigValue> = { ...(target as Record<string, ConfigValue>) };

  for (const key of Object.keys(source as Record<string, ConfigValue>)) {
    result[key] = deepMerge(
      (target as Record<string, ConfigValue>)[key],
      (source as Record<string, ConfigValue>)[key]
    );
  }

  return result;
}

function getMemoryUsage(): SystemMetrics['memory'] {
  // Node.js environment
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return {
      used: usage.heapUsed,
      total: usage.heapTotal,
      percent: (usage.heapUsed / usage.heapTotal) * 100,
    };
  }
  return undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createDeltaSubsystem(): DeltaSubsystem {
  return new DeltaSubsystem();
}
