/**
 * KONOMI v3.1 - Val Stack
 *
 * Stack:Val{raw→typed→qual→ts→tag→alarm}
 *
 * A pipeline for transforming raw sensor/process values into
 * fully qualified, timestamped, tagged values with alarm detection.
 */

import { Result, success, failure } from '../core/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// VALUE TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Supported raw value types */
export type RawValue = number | boolean | string | Buffer | null;

/** Typed value with explicit type information */
export interface TypedValue<T extends RawValue = RawValue> {
  raw: T;
  type: 'number' | 'boolean' | 'string' | 'binary' | 'null';
  unit?: string;
}

/** Quality indicators for industrial values */
export type Quality =
  | 'good'        // Value is valid and reliable
  | 'uncertain'   // Value may be unreliable
  | 'bad'         // Value is invalid
  | 'substituted' // Value has been substituted
  | 'simulated';  // Value is simulated/forced

/** Qualified value with quality metadata */
export interface QualifiedValue<T extends RawValue = RawValue> {
  typed: TypedValue<T>;
  quality: Quality;
  source?: string;
}

/** Timestamped value with temporal metadata */
export interface TimestampedValue<T extends RawValue = RawValue> {
  qualified: QualifiedValue<T>;
  timestamp: number;        // Unix ms
  sourceTimestamp?: number; // Original source timestamp
}

/** Tag metadata for industrial tag identification */
export interface Tag {
  id: string;
  name: string;
  description?: string;
  area?: string;
  unit?: string;
  engineeringUnits?: string;
}

/** Tagged value with full identification */
export interface TaggedValue<T extends RawValue = RawValue> {
  timestamped: TimestampedValue<T>;
  tag: Tag;
}

/** Alarm severity levels */
export type AlarmSeverity =
  | 'low'      // Informational
  | 'medium'   // Warning
  | 'high'     // Alarm
  | 'urgent'   // Critical
  | 'none';    // No alarm

/** Alarm state */
export interface AlarmState {
  active: boolean;
  severity: AlarmSeverity;
  message?: string;
  acknowledgedAt?: number;
  clearedAt?: number;
}

/** Final value with alarm state - the complete Val stack output */
export interface AlarmValue<T extends RawValue = RawValue> {
  tagged: TaggedValue<T>;
  alarm: AlarmState;
}

// ═══════════════════════════════════════════════════════════════════════════
// ALARM CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/** Alarm limit configuration */
export interface AlarmLimits {
  lowLow?: number;    // Urgent low
  low?: number;       // Low warning
  high?: number;      // High warning
  highHigh?: number;  // Urgent high
  deadband?: number;  // Hysteresis
}

// ═══════════════════════════════════════════════════════════════════════════
// VAL STACK PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Val Stack - Transforms raw values through the complete pipeline:
 * raw → typed → qual → ts → tag → alarm
 */
export class ValStack<T extends RawValue = RawValue> {
  private limits: AlarmLimits;
  private tag: Tag;

  constructor(tag: Tag, limits: AlarmLimits = {}) {
    this.tag = tag;
    this.limits = limits;
  }

  /**
   * Stage 1: raw → typed
   * Converts raw value to typed value with type inference
   */
  toTyped(raw: T): Result<TypedValue<T>> {
    try {
      const type = this.inferType(raw);
      return success({
        raw,
        type,
        unit: this.tag.engineeringUnits,
      });
    } catch (e) {
      return failure(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Stage 2: typed → qual
   * Adds quality information to typed value
   */
  toQualified(
    typed: TypedValue<T>,
    quality: Quality = 'good',
    source?: string
  ): Result<QualifiedValue<T>> {
    return success({
      typed,
      quality,
      source,
    });
  }

  /**
   * Stage 3: qual → ts
   * Adds timestamp to qualified value
   */
  toTimestamped(
    qualified: QualifiedValue<T>,
    sourceTimestamp?: number
  ): Result<TimestampedValue<T>> {
    return success({
      qualified,
      timestamp: Date.now(),
      sourceTimestamp,
    });
  }

  /**
   * Stage 4: ts → tag
   * Associates tag metadata with timestamped value
   */
  toTagged(timestamped: TimestampedValue<T>): Result<TaggedValue<T>> {
    return success({
      timestamped,
      tag: this.tag,
    });
  }

  /**
   * Stage 5: tag → alarm
   * Evaluates alarm conditions and produces final value
   */
  toAlarm(tagged: TaggedValue<T>): Result<AlarmValue<T>> {
    const alarm = this.evaluateAlarm(tagged);
    return success({
      tagged,
      alarm,
    });
  }

  /**
   * Complete pipeline: raw → alarm
   * Transforms raw value through all stages
   */
  process(
    raw: T,
    options: {
      quality?: Quality;
      source?: string;
      sourceTimestamp?: number;
    } = {}
  ): Result<AlarmValue<T>> {
    const { quality = 'good', source, sourceTimestamp } = options;

    const typedResult = this.toTyped(raw);
    if (!typedResult.ok) return typedResult;

    const qualResult = this.toQualified(typedResult.value, quality, source);
    if (!qualResult.ok) return qualResult;

    const tsResult = this.toTimestamped(qualResult.value, sourceTimestamp);
    if (!tsResult.ok) return tsResult;

    const tagResult = this.toTagged(tsResult.value);
    if (!tagResult.ok) return tagResult;

    return this.toAlarm(tagResult.value);
  }

  /**
   * Update alarm limits
   */
  setLimits(limits: AlarmLimits): void {
    this.limits = { ...this.limits, ...limits };
  }

  /**
   * Get current alarm limits
   */
  getLimits(): AlarmLimits {
    return { ...this.limits };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private inferType(raw: RawValue): TypedValue['type'] {
    if (raw === null) return 'null';
    if (typeof raw === 'number') return 'number';
    if (typeof raw === 'boolean') return 'boolean';
    if (typeof raw === 'string') return 'string';
    if (Buffer.isBuffer(raw)) return 'binary';
    return 'null';
  }

  private evaluateAlarm(tagged: TaggedValue<T>): AlarmState {
    const raw = tagged.timestamped.qualified.typed.raw;

    // Only evaluate numeric values for alarm limits
    if (typeof raw !== 'number') {
      return { active: false, severity: 'none' };
    }

    const { lowLow, low, high, highHigh, deadband = 0 } = this.limits;

    // Check alarm conditions in order of severity
    if (highHigh !== undefined && raw >= highHigh - deadband) {
      return {
        active: true,
        severity: 'urgent',
        message: `Value ${raw} exceeds high-high limit ${highHigh}`,
      };
    }

    if (lowLow !== undefined && raw <= lowLow + deadband) {
      return {
        active: true,
        severity: 'urgent',
        message: `Value ${raw} below low-low limit ${lowLow}`,
      };
    }

    if (high !== undefined && raw >= high - deadband) {
      return {
        active: true,
        severity: 'high',
        message: `Value ${raw} exceeds high limit ${high}`,
      };
    }

    if (low !== undefined && raw <= low + deadband) {
      return {
        active: true,
        severity: 'medium',
        message: `Value ${raw} below low limit ${low}`,
      };
    }

    return { active: false, severity: 'none' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new Val stack for a tag
 */
export function createValStack<T extends RawValue>(
  tag: Tag,
  limits?: AlarmLimits
): ValStack<T> {
  return new ValStack<T>(tag, limits);
}

/**
 * Quick process: create stack and process value in one call
 */
export function processValue<T extends RawValue>(
  raw: T,
  tag: Tag,
  options: {
    limits?: AlarmLimits;
    quality?: Quality;
    source?: string;
    sourceTimestamp?: number;
  } = {}
): Result<AlarmValue<T>> {
  const { limits, ...processOptions } = options;
  const stack = createValStack<T>(tag, limits);
  return stack.process(raw, processOptions);
}
