/**
 * KONOMI v3.1 - Ω (Omega) System Orchestrator
 *
 * Ω⊃{α,β,γ,δ,ε,ζ,η,θ}⊃{1,2,3,4}
 *
 * Boot sequence: ζ(X)→α→δ→γ→β→ε→θ→✓
 *
 * Ω.boot: Test → Arch → Sys → Cache → Build → API → Sync → ✓
 *
 * Output flow: Ω→agents→tasks→output
 * κ* = 1/φ = 62% chaos + 38% order
 */

import {
  Result,
  success,
  failure,
  BootPhase,
  OmegaState,
  OmegaOutput,
  SubsystemId,
} from '../core/types.js';
import { KAPPA_STAR, evaluateKappa, KappaState } from '../core/phi.js';

// Import subsystems
import { AlphaSubsystem, createAlphaSubsystem } from '../subsystems/alpha.js';
import { BetaSubsystem, createBetaSubsystem } from '../subsystems/beta.js';
import { GammaSubsystem, createGammaSubsystem } from '../subsystems/gamma.js';
import { DeltaSubsystem, createDeltaSubsystem, SystemConfig } from '../subsystems/delta.js';
import { EpsilonSubsystem, createEpsilonSubsystem } from '../subsystems/epsilon.js';
import { ZetaSubsystem, createZetaSubsystem } from '../subsystems/zeta.js';
import { EtaSubsystem, createEtaSubsystem } from '../subsystems/eta.js';
import { ThetaSubsystem, createThetaSubsystem } from '../subsystems/theta.js';

// ═══════════════════════════════════════════════════════════════════════════
// OMEGA TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Boot phase handler */
export type BootPhaseHandler = () => Promise<Result<void>> | Result<void>;

/** Boot sequence configuration */
export interface BootConfig {
  skipTests?: boolean;
  testPattern?: string;
  config?: Partial<SystemConfig>;
  onPhaseStart?: (phase: BootPhase) => void;
  onPhaseComplete?: (phase: BootPhase, success: boolean) => void;
}

/** Agent definition for task execution */
export interface Agent {
  id: string;
  name: string;
  execute: (task: Task) => Promise<Result<unknown>>;
}

/** Task definition */
export interface Task {
  id: string;
  name: string;
  agent: string;
  input: unknown;
  priority?: number;
  timeout?: number;
}

/** Task result */
export interface TaskResult {
  task: Task;
  output: OmegaOutput<unknown>;
  success: boolean;
  duration: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// OMEGA CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ω (Omega) - The System Orchestrator
 *
 * Contains all subsystems and manages boot sequence:
 * ζ(X) → α → δ → γ → β → ε → θ → ✓
 */
export class Omega {
  // Subsystems
  readonly α: AlphaSubsystem;
  readonly β: BetaSubsystem;
  readonly γ: GammaSubsystem;
  readonly δ: DeltaSubsystem;
  readonly ε: EpsilonSubsystem;
  readonly ζ: ZetaSubsystem;
  readonly η: EtaSubsystem;
  readonly θ: ThetaSubsystem;

  // State
  private state: OmegaState;
  private agents: Map<string, Agent> = new Map();
  private taskQueue: Task[] = [];

  constructor() {
    // Initialize all subsystems
    this.α = createAlphaSubsystem();
    this.β = createBetaSubsystem();
    this.γ = createGammaSubsystem();
    this.δ = createDeltaSubsystem();
    this.ε = createEpsilonSubsystem();
    this.ζ = createZetaSubsystem();
    this.η = createEtaSubsystem();
    this.θ = createThetaSubsystem();

    // Initialize state
    this.state = {
      phase: 'ζ',
      subsystems: new Map([
        ['α', false],
        ['β', false],
        ['γ', false],
        ['δ', false],
        ['ε', false],
        ['ζ', false],
        ['η', false],
        ['θ', false],
      ]),
      kappa: KAPPA_STAR,
      ready: false,
    };
  }

  /**
   * Boot sequence: ζ(X)→α→δ→γ→β→ε→θ→✓
   */
  async boot(config: BootConfig = {}): Promise<Result<OmegaState>> {
    const phases: Array<{ phase: BootPhase; handler: () => Promise<Result<void>> }> = [
      { phase: 'ζ', handler: () => this.bootZeta(config) },
      { phase: 'α', handler: () => this.bootAlpha(config) },
      { phase: 'δ', handler: () => this.bootDelta(config) },
      { phase: 'γ', handler: () => this.bootGamma(config) },
      { phase: 'β', handler: () => this.bootBeta(config) },
      { phase: 'ε', handler: () => this.bootEpsilon(config) },
      { phase: 'θ', handler: () => this.bootTheta(config) },
    ];

    for (const { phase, handler } of phases) {
      this.state.phase = phase;
      config.onPhaseStart?.(phase);

      const result = await handler();

      if (!result.ok) {
        config.onPhaseComplete?.(phase, false);
        return failure(new Error(`Boot failed at phase ${phase}: ${result.error.message}`));
      }

      this.state.subsystems.set(phase as SubsystemId, true);
      config.onPhaseComplete?.(phase, true);
    }

    this.state.phase = '✓';
    this.state.ready = true;

    return success(this.state);
  }

  /**
   * ζ: Test phase - validate system before boot
   */
  private async bootZeta(config: BootConfig): Promise<Result<void>> {
    if (config.skipTests) {
      return success(undefined);
    }

    // Run any registered tests
    // In production, this would validate critical paths
    return success(undefined);
  }

  /**
   * α: Architecture phase - scaffold and wire components
   */
  private async bootAlpha(_config: BootConfig): Promise<Result<void>> {
    // Architecture is ready to use
    return success(undefined);
  }

  /**
   * δ: System phase - configure and initialize
   */
  private async bootDelta(config: BootConfig): Promise<Result<void>> {
    if (config.config) {
      const configResult = await this.δ.config_(config.config);
      if (!configResult.ok) return configResult;
    }

    const initResult = await this.δ.init();
    if (!initResult.ok) return initResult;

    return success(undefined);
  }

  /**
   * γ: Cache phase - initialize cache subsystem
   */
  private async bootGamma(_config: BootConfig): Promise<Result<void>> {
    // Cache is ready to use
    return success(undefined);
  }

  /**
   * β: Build phase - initialize build pipeline
   */
  private async bootBeta(_config: BootConfig): Promise<Result<void>> {
    // Build subsystem is ready
    return success(undefined);
  }

  /**
   * ε: API phase - set up routes and handlers
   */
  private async bootEpsilon(_config: BootConfig): Promise<Result<void>> {
    // Set up default routes
    const router = this.ε.getRouter();

    // Health check endpoint
    router.get('/health', () => ({
      status: 200,
      headers: new Map([['Content-Type', 'application/json']]),
      body: {
        status: 'healthy',
        phase: this.state.phase,
        kappa: this.state.kappa,
        ready: this.state.ready,
      },
    }));

    // Status endpoint
    router.get('/status', () => ({
      status: 200,
      headers: new Map([['Content-Type', 'application/json']]),
      body: this.getStatus(),
    }));

    return success(undefined);
  }

  /**
   * θ: Sync phase - initialize sync subsystem
   */
  private async bootTheta(_config: BootConfig): Promise<Result<void>> {
    // Sync subsystem is ready
    return success(undefined);
  }

  /**
   * Shutdown the system
   */
  async shutdown(): Promise<Result<void>> {
    // Cleanup in reverse order
    await this.α.clean();
    const stopResult = await this.δ.stop();

    if (!stopResult.ok) return stopResult;

    this.state.ready = false;
    this.state.phase = 'ζ';

    for (const [id] of this.state.subsystems) {
      this.state.subsystems.set(id, false);
    }

    return success(undefined);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Agent & Task System: Ω → agents → tasks → output
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register an agent
   */
  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * Submit a task
   */
  async submitTask(task: Task): Promise<Result<TaskResult>> {
    const agent = this.agents.get(task.agent);
    if (!agent) {
      return failure(new Error(`Unknown agent: ${task.agent}`));
    }

    const start = Date.now();

    try {
      const result = await agent.execute(task);

      const output: OmegaOutput<unknown> = {
        source: 'Ω',
        agent: agent.id,
        task: task.id,
        output: result.ok ? result.value : result.error,
        timestamp: Date.now(),
      };

      return success({
        task,
        output,
        success: result.ok,
        duration: Date.now() - start,
      });
    } catch (e) {
      return failure(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Queue a task for later execution
   */
  queueTask(task: Task): void {
    this.taskQueue.push(task);
    this.taskQueue.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * Process queued tasks
   */
  async processQueue(): Promise<TaskResult[]> {
    const results: TaskResult[] = [];

    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()!;
      const result = await this.submitTask(task);

      if (result.ok) {
        results.push(result.value);
      }
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Kappa (κ) Balance Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get current kappa state
   */
  getKappa(): KappaState {
    return evaluateKappa(this.state.kappa);
  }

  /**
   * Set kappa value (chaos/order balance)
   */
  setKappa(value: number): void {
    this.state.kappa = Math.max(0, Math.min(1, value));
  }

  /**
   * Reset kappa to optimal (κ* = 1/φ ≈ 0.618)
   */
  resetKappa(): void {
    this.state.kappa = KAPPA_STAR;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Status & Introspection
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get current state
   */
  getState(): OmegaState {
    return { ...this.state };
  }

  /**
   * Check if system is ready
   */
  isReady(): boolean {
    return this.state.ready;
  }

  /**
   * Get system status
   */
  getStatus(): {
    phase: BootPhase;
    ready: boolean;
    kappa: KappaState;
    subsystems: Record<string, boolean>;
    agents: string[];
    queuedTasks: number;
  } {
    return {
      phase: this.state.phase,
      ready: this.state.ready,
      kappa: this.getKappa(),
      subsystems: Object.fromEntries(this.state.subsystems),
      agents: Array.from(this.agents.keys()),
      queuedTasks: this.taskQueue.length,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new Omega instance
 */
export function createOmega(): Omega {
  return new Omega();
}

/**
 * Create and boot Omega
 */
export async function bootOmega(config?: BootConfig): Promise<Result<Omega>> {
  const omega = createOmega();
  const result = await omega.boot(config);

  if (!result.ok) {
    return failure(result.error);
  }

  return success(omega);
}
