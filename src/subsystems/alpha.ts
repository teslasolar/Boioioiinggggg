/**
 * KONOMI v3.1 - α (Alpha) Subsystem: Architecture
 *
 * α:arch{α1→scaffold, α2→wire, α3→clean}
 *
 * Manages system architecture through scaffolding, wiring components,
 * and cleanup operations.
 */

import { Result, success, failure, AlphaOps } from '../core/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Component definition for scaffolding */
export interface ComponentDef {
  id: string;
  name: string;
  type: string;
  dependencies: string[];
  config?: Record<string, unknown>;
}

/** Wiring connection between components */
export interface Wire {
  id: string;
  from: { componentId: string; port: string };
  to: { componentId: string; port: string };
  protocol?: string;
}

/** Scaffolded component instance */
export interface ScaffoldedComponent {
  def: ComponentDef;
  instance: unknown;
  status: 'pending' | 'scaffolded' | 'wired' | 'active' | 'disposed';
}

/** Architecture state */
export interface ArchState {
  components: Map<string, ScaffoldedComponent>;
  wires: Map<string, Wire>;
  order: string[]; // Topologically sorted component order
}

// ═══════════════════════════════════════════════════════════════════════════
// α1: SCAFFOLD - Create component instances
// ═══════════════════════════════════════════════════════════════════════════

export type ComponentFactory = (def: ComponentDef) => unknown;

const defaultFactories: Map<string, ComponentFactory> = new Map();

/**
 * Register a component factory
 */
export function registerFactory(type: string, factory: ComponentFactory): void {
  defaultFactories.set(type, factory);
}

/**
 * α1: Scaffold components from definitions
 */
export function scaffold(
  defs: ComponentDef[],
  factories: Map<string, ComponentFactory> = defaultFactories
): Result<ArchState> {
  const state: ArchState = {
    components: new Map(),
    wires: new Map(),
    order: [],
  };

  // Topological sort based on dependencies
  const sorted = topologicalSort(defs);
  if (!sorted.ok) return sorted;

  state.order = sorted.value;

  // Create component instances in order
  for (const id of state.order) {
    const def = defs.find(d => d.id === id);
    if (!def) {
      return failure(new Error(`Component definition not found: ${id}`));
    }

    const factory = factories.get(def.type);
    if (!factory) {
      return failure(new Error(`No factory registered for type: ${def.type}`));
    }

    try {
      const instance = factory(def);
      state.components.set(id, {
        def,
        instance,
        status: 'scaffolded',
      });
    } catch (e) {
      return failure(e instanceof Error ? e : new Error(String(e)));
    }
  }

  return success(state);
}

// ═══════════════════════════════════════════════════════════════════════════
// α2: WIRE - Connect components together
// ═══════════════════════════════════════════════════════════════════════════

export type WireHandler = (
  from: ScaffoldedComponent,
  to: ScaffoldedComponent,
  wire: Wire
) => void;

const defaultWireHandlers: Map<string, WireHandler> = new Map();

/**
 * Register a wire handler for a protocol
 */
export function registerWireHandler(protocol: string, handler: WireHandler): void {
  defaultWireHandlers.set(protocol, handler);
}

/**
 * α2: Wire components according to wire definitions
 */
export function wire(
  state: ArchState,
  wireDefs: Wire[],
  handlers: Map<string, WireHandler> = defaultWireHandlers
): Result<ArchState> {
  for (const wireDef of wireDefs) {
    const fromComponent = state.components.get(wireDef.from.componentId);
    const toComponent = state.components.get(wireDef.to.componentId);

    if (!fromComponent) {
      return failure(new Error(`Source component not found: ${wireDef.from.componentId}`));
    }
    if (!toComponent) {
      return failure(new Error(`Target component not found: ${wireDef.to.componentId}`));
    }

    const protocol = wireDef.protocol ?? 'default';
    const handler = handlers.get(protocol);

    if (handler) {
      try {
        handler(fromComponent, toComponent, wireDef);
      } catch (e) {
        return failure(e instanceof Error ? e : new Error(String(e)));
      }
    }

    state.wires.set(wireDef.id, wireDef);
    fromComponent.status = 'wired';
    toComponent.status = 'wired';
  }

  return success(state);
}

// ═══════════════════════════════════════════════════════════════════════════
// α3: CLEAN - Dispose and cleanup
// ═══════════════════════════════════════════════════════════════════════════

export type CleanupHandler = (component: ScaffoldedComponent) => void | Promise<void>;

const defaultCleanupHandlers: Map<string, CleanupHandler> = new Map();

/**
 * Register a cleanup handler for a component type
 */
export function registerCleanupHandler(type: string, handler: CleanupHandler): void {
  defaultCleanupHandlers.set(type, handler);
}

/**
 * α3: Clean up architecture state
 */
export async function clean(
  state: ArchState,
  handlers: Map<string, CleanupHandler> = defaultCleanupHandlers
): Promise<Result<void>> {
  // Clean in reverse order of creation
  const reverseOrder = [...state.order].reverse();

  for (const id of reverseOrder) {
    const component = state.components.get(id);
    if (!component) continue;

    const handler = handlers.get(component.def.type);
    if (handler) {
      try {
        await handler(component);
      } catch (e) {
        return failure(e instanceof Error ? e : new Error(String(e)));
      }
    }

    component.status = 'disposed';
  }

  state.wires.clear();
  state.components.clear();
  state.order = [];

  return success(undefined);
}

// ═══════════════════════════════════════════════════════════════════════════
// ALPHA SUBSYSTEM CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Alpha Subsystem - Architecture management
 */
export class AlphaSubsystem {
  readonly id = 'α';
  readonly name = 'arch';

  private state: ArchState | null = null;
  private factories: Map<string, ComponentFactory> = new Map(defaultFactories);
  private wireHandlers: Map<string, WireHandler> = new Map(defaultWireHandlers);
  private cleanupHandlers: Map<string, CleanupHandler> = new Map(defaultCleanupHandlers);

  /**
   * Get current operation
   */
  getOps() {
    return AlphaOps;
  }

  /**
   * α1: Scaffold components
   */
  scaffold(defs: ComponentDef[]): Result<ArchState> {
    const result = scaffold(defs, this.factories);
    if (result.ok) {
      this.state = result.value;
    }
    return result;
  }

  /**
   * α2: Wire components
   */
  wire(wireDefs: Wire[]): Result<ArchState> {
    if (!this.state) {
      return failure(new Error('Must scaffold before wiring'));
    }
    return wire(this.state, wireDefs, this.wireHandlers);
  }

  /**
   * α3: Clean up
   */
  async clean(): Promise<Result<void>> {
    if (!this.state) {
      return success(undefined);
    }
    const result = await clean(this.state, this.cleanupHandlers);
    if (result.ok) {
      this.state = null;
    }
    return result;
  }

  /**
   * Register a component factory
   */
  registerFactory(type: string, factory: ComponentFactory): void {
    this.factories.set(type, factory);
  }

  /**
   * Register a wire handler
   */
  registerWireHandler(protocol: string, handler: WireHandler): void {
    this.wireHandlers.set(protocol, handler);
  }

  /**
   * Register a cleanup handler
   */
  registerCleanupHandler(type: string, handler: CleanupHandler): void {
    this.cleanupHandlers.set(type, handler);
  }

  /**
   * Get current state
   */
  getState(): ArchState | null {
    return this.state;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Topological sort of components based on dependencies
 */
function topologicalSort(defs: ComponentDef[]): Result<string[]> {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const result: string[] = [];
  const defMap = new Map(defs.map(d => [d.id, d]));

  function visit(id: string): boolean {
    if (visited.has(id)) return true;
    if (visiting.has(id)) return false; // Cycle detected

    visiting.add(id);

    const def = defMap.get(id);
    if (def) {
      for (const dep of def.dependencies) {
        if (!visit(dep)) {
          return false;
        }
      }
    }

    visiting.delete(id);
    visited.add(id);
    result.push(id);
    return true;
  }

  for (const def of defs) {
    if (!visit(def.id)) {
      return failure(new Error(`Circular dependency detected involving: ${def.id}`));
    }
  }

  return success(result);
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createAlphaSubsystem(): AlphaSubsystem {
  return new AlphaSubsystem();
}
