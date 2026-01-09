/**
 * KONOMI v3.1 - ζ (Zeta) Subsystem: Test
 *
 * ζ:test{ζ1→assert, ζ2→mock, ζ3→cover, ζ4→report}
 *
 * Testing framework with assertions, mocking, coverage, and reporting.
 */

import { Result, success, failure, ZetaOps } from '../core/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// TEST TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Test case definition */
export interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
  timeout?: number;
  skip?: boolean;
  only?: boolean;
  tags?: string[];
}

/** Test suite */
export interface TestSuite {
  name: string;
  tests: TestCase[];
  beforeAll?: () => void | Promise<void>;
  afterAll?: () => void | Promise<void>;
  beforeEach?: () => void | Promise<void>;
  afterEach?: () => void | Promise<void>;
}

/** Test result */
export interface TestResult {
  name: string;
  suite: string;
  status: 'passed' | 'failed' | 'skipped' | 'timeout';
  duration: number;
  error?: Error;
}

/** Test run summary */
export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: TestResult[];
}

// ═══════════════════════════════════════════════════════════════════════════
// ζ1: ASSERT - Assertion functions
// ═══════════════════════════════════════════════════════════════════════════

export class AssertionError extends Error {
  constructor(
    message: string,
    public expected?: unknown,
    public actual?: unknown
  ) {
    super(message);
    this.name = 'AssertionError';
  }
}

/**
 * ζ1: Assert that a condition is true
 */
export function assert(condition: boolean, message = 'Assertion failed'): void {
  if (!condition) {
    throw new AssertionError(message);
  }
}

/**
 * ζ1: Assert equality (deep)
 */
export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (!deepEqual(actual, expected)) {
    throw new AssertionError(
      message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      expected,
      actual
    );
  }
}

/**
 * ζ1: Assert not equal
 */
export function assertNotEqual<T>(actual: T, expected: T, message?: string): void {
  if (deepEqual(actual, expected)) {
    throw new AssertionError(
      message ?? `Expected values to be different`,
      expected,
      actual
    );
  }
}

/**
 * ζ1: Assert strict equality (===)
 */
export function assertStrictEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new AssertionError(
      message ?? `Expected ${expected}, got ${actual}`,
      expected,
      actual
    );
  }
}

/**
 * ζ1: Assert truthy
 */
export function assertTruthy(value: unknown, message?: string): void {
  if (!value) {
    throw new AssertionError(message ?? `Expected truthy value, got ${value}`);
  }
}

/**
 * ζ1: Assert falsy
 */
export function assertFalsy(value: unknown, message?: string): void {
  if (value) {
    throw new AssertionError(message ?? `Expected falsy value, got ${value}`);
  }
}

/**
 * ζ1: Assert throws
 */
export function assertThrows(
  fn: () => void,
  errorType?: new (...args: unknown[]) => Error,
  message?: string
): void {
  let threw = false;
  let thrownError: unknown;

  try {
    fn();
  } catch (e) {
    threw = true;
    thrownError = e;
  }

  if (!threw) {
    throw new AssertionError(message ?? 'Expected function to throw');
  }

  if (errorType && !(thrownError instanceof errorType)) {
    throw new AssertionError(
      message ?? `Expected ${errorType.name}, got ${(thrownError as Error)?.constructor?.name}`
    );
  }
}

/**
 * ζ1: Assert async throws
 */
export async function assertAsyncThrows(
  fn: () => Promise<void>,
  errorType?: new (...args: unknown[]) => Error,
  message?: string
): Promise<void> {
  let threw = false;
  let thrownError: unknown;

  try {
    await fn();
  } catch (e) {
    threw = true;
    thrownError = e;
  }

  if (!threw) {
    throw new AssertionError(message ?? 'Expected async function to throw');
  }

  if (errorType && !(thrownError instanceof errorType)) {
    throw new AssertionError(
      message ?? `Expected ${errorType.name}, got ${(thrownError as Error)?.constructor?.name}`
    );
  }
}

/**
 * ζ1: Assert contains (array or string)
 */
export function assertContains<T>(
  haystack: T[] | string,
  needle: T | string,
  message?: string
): void {
  const contains = Array.isArray(haystack)
    ? haystack.includes(needle as T)
    : haystack.includes(needle as string);

  if (!contains) {
    throw new AssertionError(
      message ?? `Expected ${JSON.stringify(haystack)} to contain ${JSON.stringify(needle)}`
    );
  }
}

/**
 * ζ1: Assert type
 */
export function assertType(
  value: unknown,
  expectedType: 'string' | 'number' | 'boolean' | 'object' | 'function' | 'undefined',
  message?: string
): void {
  const actualType = typeof value;
  if (actualType !== expectedType) {
    throw new AssertionError(
      message ?? `Expected type ${expectedType}, got ${actualType}`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ζ2: MOCK - Mocking utilities
// ═══════════════════════════════════════════════════════════════════════════

/** Mock function call record */
export interface MockCall {
  args: unknown[];
  result?: unknown;
  error?: Error;
  timestamp: number;
}

/** Mock function */
export interface MockFn<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): ReturnType<T>;
  calls: MockCall[];
  callCount: number;
  mockImplementation(impl: T): void;
  mockReturnValue(value: ReturnType<T>): void;
  mockReturnValueOnce(value: ReturnType<T>): void;
  mockRejectedValue(error: Error): void;
  mockResolvedValue(value: unknown): void;
  mockClear(): void;
  mockReset(): void;
}

/**
 * ζ2: Create a mock function
 */
export function mock<T extends (...args: unknown[]) => unknown>(
  implementation?: T
): MockFn<T> {
  const calls: MockCall[] = [];
  let impl = implementation;
  const returnValues: ReturnType<T>[] = [];
  let defaultReturn: ReturnType<T> | undefined;
  let rejectedError: Error | undefined;
  let resolvedValue: unknown | undefined;

  const mockFn = ((...args: Parameters<T>): ReturnType<T> => {
    const call: MockCall = {
      args,
      timestamp: Date.now(),
    };

    try {
      let result: ReturnType<T>;

      if (returnValues.length > 0) {
        result = returnValues.shift()!;
      } else if (rejectedError) {
        throw rejectedError;
      } else if (resolvedValue !== undefined) {
        result = Promise.resolve(resolvedValue) as ReturnType<T>;
      } else if (impl) {
        result = impl(...args) as ReturnType<T>;
      } else if (defaultReturn !== undefined) {
        result = defaultReturn;
      } else {
        result = undefined as ReturnType<T>;
      }

      call.result = result;
      calls.push(call);
      return result;
    } catch (e) {
      call.error = e instanceof Error ? e : new Error(String(e));
      calls.push(call);
      throw e;
    }
  }) as MockFn<T>;

  Object.defineProperty(mockFn, 'calls', {
    get: () => calls,
  });

  Object.defineProperty(mockFn, 'callCount', {
    get: () => calls.length,
  });

  mockFn.mockImplementation = (newImpl: T) => {
    impl = newImpl;
  };

  mockFn.mockReturnValue = (value: ReturnType<T>) => {
    defaultReturn = value;
  };

  mockFn.mockReturnValueOnce = (value: ReturnType<T>) => {
    returnValues.push(value);
  };

  mockFn.mockRejectedValue = (error: Error) => {
    rejectedError = error;
  };

  mockFn.mockResolvedValue = (value: unknown) => {
    resolvedValue = value;
  };

  mockFn.mockClear = () => {
    calls.length = 0;
  };

  mockFn.mockReset = () => {
    calls.length = 0;
    impl = undefined;
    defaultReturn = undefined;
    returnValues.length = 0;
    rejectedError = undefined;
    resolvedValue = undefined;
  };

  return mockFn;
}

/**
 * ζ2: Create a spy on an object method
 */
export function spy<T extends object, K extends keyof T>(
  obj: T,
  method: K
): MockFn<T[K] extends (...args: unknown[]) => unknown ? T[K] : never> {
  const original = obj[method];
  const mockFn = mock(original as (...args: unknown[]) => unknown);
  (obj as Record<K, unknown>)[method] = mockFn;
  return mockFn as MockFn<T[K] extends (...args: unknown[]) => unknown ? T[K] : never>;
}

// ═══════════════════════════════════════════════════════════════════════════
// ζ3: COVER - Coverage tracking
// ═══════════════════════════════════════════════════════════════════════════

/** Coverage data for a file */
export interface FileCoverage {
  path: string;
  lines: {
    total: number;
    covered: number;
    uncovered: number[];
  };
  functions: {
    total: number;
    covered: number;
    uncoveredNames: string[];
  };
  branches: {
    total: number;
    covered: number;
  };
}

/** Coverage summary */
export interface CoverageSummary {
  files: FileCoverage[];
  totals: {
    lines: { total: number; covered: number; percent: number };
    functions: { total: number; covered: number; percent: number };
    branches: { total: number; covered: number; percent: number };
  };
}

/**
 * ζ3: Coverage collector (simplified)
 */
export class CoverageCollector {
  private files: Map<string, FileCoverage> = new Map();

  /**
   * Track file coverage
   */
  trackFile(path: string, coverage: Omit<FileCoverage, 'path'>): void {
    this.files.set(path, { path, ...coverage });
  }

  /**
   * Get coverage for a file
   */
  getFileCoverage(path: string): FileCoverage | undefined {
    return this.files.get(path);
  }

  /**
   * ζ3: Generate coverage summary
   */
  getSummary(): CoverageSummary {
    const files = Array.from(this.files.values());

    const totals = {
      lines: { total: 0, covered: 0, percent: 0 },
      functions: { total: 0, covered: 0, percent: 0 },
      branches: { total: 0, covered: 0, percent: 0 },
    };

    for (const file of files) {
      totals.lines.total += file.lines.total;
      totals.lines.covered += file.lines.covered;
      totals.functions.total += file.functions.total;
      totals.functions.covered += file.functions.covered;
      totals.branches.total += file.branches.total;
      totals.branches.covered += file.branches.covered;
    }

    totals.lines.percent = totals.lines.total > 0
      ? (totals.lines.covered / totals.lines.total) * 100
      : 0;
    totals.functions.percent = totals.functions.total > 0
      ? (totals.functions.covered / totals.functions.total) * 100
      : 0;
    totals.branches.percent = totals.branches.total > 0
      ? (totals.branches.covered / totals.branches.total) * 100
      : 0;

    return { files, totals };
  }

  /**
   * Clear coverage data
   */
  clear(): void {
    this.files.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ζ4: REPORT - Test reporting
// ═══════════════════════════════════════════════════════════════════════════

/** Reporter interface */
export interface Reporter {
  onSuiteStart?(suite: TestSuite): void;
  onSuiteEnd?(suite: TestSuite, results: TestResult[]): void;
  onTestStart?(test: TestCase): void;
  onTestEnd?(result: TestResult): void;
  onRunStart?(suites: TestSuite[]): void;
  onRunEnd?(summary: TestSummary): void;
}

/**
 * ζ4: Console reporter
 */
export class ConsoleReporter implements Reporter {
  onSuiteStart(suite: TestSuite): void {
    console.log(`\n  ${suite.name}`);
  }

  onTestEnd(result: TestResult): void {
    const icon = result.status === 'passed' ? '✓' :
                 result.status === 'failed' ? '✗' :
                 result.status === 'skipped' ? '○' : '⏱';
    const color = result.status === 'passed' ? '\x1b[32m' :
                  result.status === 'failed' ? '\x1b[31m' :
                  '\x1b[33m';
    const reset = '\x1b[0m';

    console.log(`    ${color}${icon}${reset} ${result.name} (${result.duration}ms)`);

    if (result.error) {
      console.log(`      ${result.error.message}`);
    }
  }

  onRunEnd(summary: TestSummary): void {
    console.log(`\n  ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped`);
    console.log(`  Duration: ${summary.duration}ms\n`);
  }
}

/**
 * ζ4: JSON reporter
 */
export class JsonReporter implements Reporter {
  private output: TestSummary | null = null;

  onRunEnd(summary: TestSummary): void {
    this.output = summary;
  }

  getOutput(): TestSummary | null {
    return this.output;
  }

  toJson(): string {
    return JSON.stringify(this.output, null, 2);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ZETA SUBSYSTEM CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Zeta Subsystem - Testing framework
 */
export class ZetaSubsystem {
  readonly id = 'ζ';
  readonly name = 'test';

  private suites: TestSuite[] = [];
  private reporters: Reporter[] = [new ConsoleReporter()];
  private coverage = new CoverageCollector();

  /**
   * Get current operations
   */
  getOps() {
    return ZetaOps;
  }

  /**
   * Define a test suite
   */
  describe(name: string, fn: () => void): TestSuite {
    const suite: TestSuite = {
      name,
      tests: [],
    };

    // Capture test registrations
    const originalIt = globalThis.it;
    (globalThis as { it?: (name: string, fn: () => void | Promise<void>) => void }).it = (testName, testFn) => {
      suite.tests.push({ name: testName, fn: testFn });
    };

    fn();

    (globalThis as { it?: typeof originalIt }).it = originalIt;

    this.suites.push(suite);
    return suite;
  }

  /**
   * Add a test to current suite
   */
  it(name: string, fn: () => void | Promise<void>, options?: Partial<TestCase>): void {
    if (this.suites.length === 0) {
      this.suites.push({ name: 'Default Suite', tests: [] });
    }
    const currentSuite = this.suites[this.suites.length - 1];
    currentSuite.tests.push({ name, fn, ...options });
  }

  /**
   * Run all tests
   */
  async run(): Promise<TestSummary> {
    const summary: TestSummary = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      results: [],
    };

    const startTime = Date.now();

    for (const reporter of this.reporters) {
      reporter.onRunStart?.(this.suites);
    }

    for (const suite of this.suites) {
      for (const reporter of this.reporters) {
        reporter.onSuiteStart?.(suite);
      }

      // Run beforeAll
      if (suite.beforeAll) {
        await suite.beforeAll();
      }

      const suiteResults: TestResult[] = [];

      for (const test of suite.tests) {
        summary.total++;

        if (test.skip) {
          const result: TestResult = {
            name: test.name,
            suite: suite.name,
            status: 'skipped',
            duration: 0,
          };
          summary.skipped++;
          suiteResults.push(result);
          summary.results.push(result);

          for (const reporter of this.reporters) {
            reporter.onTestEnd?.(result);
          }
          continue;
        }

        for (const reporter of this.reporters) {
          reporter.onTestStart?.(test);
        }

        // Run beforeEach
        if (suite.beforeEach) {
          await suite.beforeEach();
        }

        const testStart = Date.now();
        const result: TestResult = {
          name: test.name,
          suite: suite.name,
          status: 'passed',
          duration: 0,
        };

        try {
          const timeout = test.timeout ?? 5000;
          await Promise.race([
            test.fn(),
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Test timeout')), timeout);
            }),
          ]);
          summary.passed++;
        } catch (e) {
          if ((e as Error).message === 'Test timeout') {
            result.status = 'timeout';
          } else {
            result.status = 'failed';
            result.error = e instanceof Error ? e : new Error(String(e));
          }
          summary.failed++;
        }

        result.duration = Date.now() - testStart;
        suiteResults.push(result);
        summary.results.push(result);

        for (const reporter of this.reporters) {
          reporter.onTestEnd?.(result);
        }

        // Run afterEach
        if (suite.afterEach) {
          await suite.afterEach();
        }
      }

      // Run afterAll
      if (suite.afterAll) {
        await suite.afterAll();
      }

      for (const reporter of this.reporters) {
        reporter.onSuiteEnd?.(suite, suiteResults);
      }
    }

    summary.duration = Date.now() - startTime;

    for (const reporter of this.reporters) {
      reporter.onRunEnd?.(summary);
    }

    return summary;
  }

  /**
   * Add a reporter
   */
  addReporter(reporter: Reporter): void {
    this.reporters.push(reporter);
  }

  /**
   * Clear reporters
   */
  clearReporters(): void {
    this.reporters = [];
  }

  /**
   * Get coverage collector
   */
  getCoverage(): CoverageCollector {
    return this.coverage;
  }

  /**
   * Clear all suites
   */
  clear(): void {
    this.suites = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, i) => deepEqual(item, b[i]));
    }

    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);

    if (keysA.length !== keysB.length) return false;

    return keysA.every(key =>
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    );
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createZetaSubsystem(): ZetaSubsystem {
  return new ZetaSubsystem();
}
