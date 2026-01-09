/**
 * KONOMI v3.1 - Equip Stack
 *
 * Stack:Equip{CM→EM→Unit→Cell→Area→Site}
 *
 * E2:ISA{L0-4,S88:Cell→Unit→EM→CM,S95:Ent→Site→Area→WC,PackML●○}
 *
 * Implements ISA-88 (S88) physical model and ISA-95 (S95) hierarchy
 * with PackML state machine support.
 */

import { PackMLMarker } from '../core/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// ISA-95 LEVELS (L0-L4)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ISA-95 automation pyramid levels:
 * - L0: Physical process (sensors, actuators)
 * - L1: Basic control (PLCs, DCS)
 * - L2: Supervisory (SCADA, HMI)
 * - L3: Manufacturing operations (MES)
 * - L4: Business planning (ERP)
 */
export type ISA95Level = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export interface ISA95LevelInfo {
  level: ISA95Level;
  name: string;
  description: string;
  timescale: string;
}

export const ISA95_LEVELS: Record<ISA95Level, ISA95LevelInfo> = {
  L0: { level: 'L0', name: 'Process', description: 'Physical process', timescale: 'ms' },
  L1: { level: 'L1', name: 'Control', description: 'Basic control', timescale: 'ms-s' },
  L2: { level: 'L2', name: 'Supervisory', description: 'Supervisory control', timescale: 's-min' },
  L3: { level: 'L3', name: 'MOM', description: 'Manufacturing operations', timescale: 'min-hr' },
  L4: { level: 'L4', name: 'Business', description: 'Business planning', timescale: 'hr-day' },
};

// ═══════════════════════════════════════════════════════════════════════════
// ISA-88 (S88) PHYSICAL MODEL: CM → EM → Unit → Cell
// ═══════════════════════════════════════════════════════════════════════════

/** Base equipment entity interface */
export interface EquipmentEntity {
  id: string;
  name: string;
  description?: string;
  level: ISA95Level;
}

/**
 * Control Module (CM) - ISA-88
 * Lowest level: single actuator, sensor, or control loop
 */
export interface ControlModule extends EquipmentEntity {
  type: 'CM';
  level: 'L0' | 'L1';
  ioType?: 'DI' | 'DO' | 'AI' | 'AO';
  address?: string;
}

/**
 * Equipment Module (EM) - ISA-88
 * Collection of control modules that perform a specific function
 */
export interface EquipmentModule extends EquipmentEntity {
  type: 'EM';
  level: 'L1';
  controlModules: ControlModule[];
  capabilities: string[];
}

/**
 * Unit - ISA-88
 * Processing entity where materials are transformed
 */
export interface Unit extends EquipmentEntity {
  type: 'Unit';
  level: 'L2';
  equipmentModules: EquipmentModule[];
  state: PackMLState;
}

/**
 * Cell - ISA-88
 * Collection of units that work together
 */
export interface Cell extends EquipmentEntity {
  type: 'Cell';
  level: 'L2';
  units: Unit[];
}

// ═══════════════════════════════════════════════════════════════════════════
// ISA-95 (S95) HIERARCHY: Enterprise → Site → Area → WorkCenter
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Work Center (WC) - ISA-95
 * Contains process cells
 */
export interface WorkCenter extends EquipmentEntity {
  type: 'WorkCenter';
  level: 'L3';
  cells: Cell[];
}

/**
 * Area - ISA-95
 * Physical, geographical, or logical grouping
 */
export interface Area extends EquipmentEntity {
  type: 'Area';
  level: 'L3';
  workCenters: WorkCenter[];
}

/**
 * Site - ISA-95
 * Physical location (plant, factory)
 */
export interface Site extends EquipmentEntity {
  type: 'Site';
  level: 'L4';
  areas: Area[];
  location?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };
}

/**
 * Enterprise - ISA-95
 * Top level organization
 */
export interface Enterprise extends EquipmentEntity {
  type: 'Enterprise';
  level: 'L4';
  sites: Site[];
}

// ═══════════════════════════════════════════════════════════════════════════
// PackML STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PackML States (ISA-TR88.00.02)
 * Standard state model for packaging machines
 */
export type PackMLStateName =
  // Execute states
  | 'IDLE'
  | 'STARTING'
  | 'EXECUTE'
  | 'COMPLETING'
  | 'COMPLETE'
  // Stop states
  | 'RESETTING'
  | 'HOLDING'
  | 'HELD'
  | 'UNHOLDING'
  | 'SUSPENDING'
  | 'SUSPENDED'
  | 'UNSUSPENDING'
  // Fault states
  | 'STOPPING'
  | 'STOPPED'
  | 'ABORTING'
  | 'ABORTED'
  | 'CLEARING';

export type PackMLMode = 'PRODUCTION' | 'MAINTENANCE' | 'MANUAL';

export interface PackMLState {
  name: PackMLStateName;
  mode: PackMLMode;
  active: PackMLMarker;
  enteredAt: number;
}

/** PackML state transition */
export interface PackMLTransition {
  from: PackMLStateName;
  to: PackMLStateName;
  command: string;
}

/** Valid PackML transitions based on ISA-TR88.00.02 */
export const PACKML_TRANSITIONS: PackMLTransition[] = [
  // Normal execution flow
  { from: 'IDLE', to: 'STARTING', command: 'Start' },
  { from: 'STARTING', to: 'EXECUTE', command: 'SC' },
  { from: 'EXECUTE', to: 'COMPLETING', command: 'SC' },
  { from: 'COMPLETING', to: 'COMPLETE', command: 'SC' },
  { from: 'COMPLETE', to: 'RESETTING', command: 'Reset' },
  { from: 'RESETTING', to: 'IDLE', command: 'SC' },

  // Hold flow
  { from: 'EXECUTE', to: 'HOLDING', command: 'Hold' },
  { from: 'HOLDING', to: 'HELD', command: 'SC' },
  { from: 'HELD', to: 'UNHOLDING', command: 'Unhold' },
  { from: 'UNHOLDING', to: 'EXECUTE', command: 'SC' },

  // Suspend flow
  { from: 'EXECUTE', to: 'SUSPENDING', command: 'Suspend' },
  { from: 'SUSPENDING', to: 'SUSPENDED', command: 'SC' },
  { from: 'SUSPENDED', to: 'UNSUSPENDING', command: 'Unsuspend' },
  { from: 'UNSUSPENDING', to: 'EXECUTE', command: 'SC' },

  // Stop flow (from any state)
  { from: 'EXECUTE', to: 'STOPPING', command: 'Stop' },
  { from: 'STOPPING', to: 'STOPPED', command: 'SC' },
  { from: 'STOPPED', to: 'RESETTING', command: 'Reset' },

  // Abort flow (from any state)
  { from: 'EXECUTE', to: 'ABORTING', command: 'Abort' },
  { from: 'ABORTING', to: 'ABORTED', command: 'SC' },
  { from: 'ABORTED', to: 'CLEARING', command: 'Clear' },
  { from: 'CLEARING', to: 'STOPPED', command: 'SC' },
];

// ═══════════════════════════════════════════════════════════════════════════
// EQUIP STACK - HIERARCHY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/** Equipment type union */
export type Equipment =
  | ControlModule
  | EquipmentModule
  | Unit
  | Cell
  | WorkCenter
  | Area
  | Site
  | Enterprise;

/**
 * Equip Stack - Manages ISA-88/95 equipment hierarchy
 */
export class EquipStack {
  private enterprise: Enterprise | null = null;
  private equipmentIndex: Map<string, Equipment> = new Map();

  /**
   * Set the enterprise root
   */
  setEnterprise(enterprise: Enterprise): void {
    this.enterprise = enterprise;
    this.rebuildIndex();
  }

  /**
   * Get the enterprise root
   */
  getEnterprise(): Enterprise | null {
    return this.enterprise;
  }

  /**
   * Find equipment by ID
   */
  findById(id: string): Equipment | undefined {
    return this.equipmentIndex.get(id);
  }

  /**
   * Find equipment by path (e.g., "Site1/Area1/WC1/Cell1")
   */
  findByPath(path: string): Equipment | undefined {
    const parts = path.split('/');
    let current: Equipment | undefined = this.enterprise ?? undefined;

    for (const part of parts) {
      if (!current) return undefined;
      current = this.getChild(current, part);
    }

    return current;
  }

  /**
   * Get all equipment at a specific ISA-95 level
   */
  getByLevel(level: ISA95Level): Equipment[] {
    return Array.from(this.equipmentIndex.values())
      .filter(e => e.level === level);
  }

  /**
   * Get the path to an equipment item
   */
  getPath(equipment: Equipment): string {
    const path: string[] = [];
    let current: Equipment | undefined = equipment;

    while (current) {
      path.unshift(current.name);
      current = this.findParent(current);
    }

    return path.join('/');
  }

  /**
   * Traverse the hierarchy with a visitor function
   */
  traverse(visitor: (equipment: Equipment, depth: number) => void): void {
    if (!this.enterprise) return;
    this.traverseNode(this.enterprise, 0, visitor);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private rebuildIndex(): void {
    this.equipmentIndex.clear();
    if (this.enterprise) {
      this.indexNode(this.enterprise);
    }
  }

  private indexNode(equipment: Equipment): void {
    this.equipmentIndex.set(equipment.id, equipment);

    const children = this.getChildren(equipment);
    for (const child of children) {
      this.indexNode(child);
    }
  }

  private getChildren(equipment: Equipment): Equipment[] {
    switch (equipment.type) {
      case 'Enterprise':
        return equipment.sites;
      case 'Site':
        return equipment.areas;
      case 'Area':
        return equipment.workCenters;
      case 'WorkCenter':
        return equipment.cells;
      case 'Cell':
        return equipment.units;
      case 'Unit':
        return equipment.equipmentModules;
      case 'EM':
        return equipment.controlModules;
      case 'CM':
        return [];
    }
  }

  private getChild(equipment: Equipment, name: string): Equipment | undefined {
    return this.getChildren(equipment).find(c => c.name === name);
  }

  private findParent(equipment: Equipment): Equipment | undefined {
    for (const [, e] of this.equipmentIndex) {
      if (this.getChildren(e).some(c => c.id === equipment.id)) {
        return e;
      }
    }
    return undefined;
  }

  private traverseNode(
    equipment: Equipment,
    depth: number,
    visitor: (equipment: Equipment, depth: number) => void
  ): void {
    visitor(equipment, depth);
    for (const child of this.getChildren(equipment)) {
      this.traverseNode(child, depth + 1, visitor);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PackML STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PackML State Machine implementation
 */
export class PackMLStateMachine {
  private state: PackMLState;
  private listeners: ((state: PackMLState) => void)[] = [];

  constructor(mode: PackMLMode = 'PRODUCTION') {
    this.state = {
      name: 'STOPPED',
      mode,
      active: '○',
      enteredAt: Date.now(),
    };
  }

  /**
   * Get current state
   */
  getState(): PackMLState {
    return { ...this.state };
  }

  /**
   * Execute a command to transition state
   */
  execute(command: string): boolean {
    const transition = PACKML_TRANSITIONS.find(
      t => t.from === this.state.name && t.command === command
    );

    if (!transition) {
      return false;
    }

    this.setState(transition.to);
    return true;
  }

  /**
   * Complete state change (SC = State Complete)
   */
  stateComplete(): boolean {
    return this.execute('SC');
  }

  /**
   * Check if a command is valid from current state
   */
  canExecute(command: string): boolean {
    return PACKML_TRANSITIONS.some(
      t => t.from === this.state.name && t.command === command
    );
  }

  /**
   * Get available commands from current state
   */
  getAvailableCommands(): string[] {
    return PACKML_TRANSITIONS
      .filter(t => t.from === this.state.name)
      .map(t => t.command);
  }

  /**
   * Set the mode
   */
  setMode(mode: PackMLMode): void {
    this.state.mode = mode;
    this.notifyListeners();
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(listener: (state: PackMLState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private setState(name: PackMLStateName): void {
    const isActive = !['STOPPED', 'ABORTED', 'IDLE', 'COMPLETE', 'HELD', 'SUSPENDED'].includes(name);
    this.state = {
      ...this.state,
      name,
      active: isActive ? '●' : '○',
      enteredAt: Date.now(),
    };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.getState());
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function createControlModule(
  id: string,
  name: string,
  options: Partial<ControlModule> = {}
): ControlModule {
  return {
    id,
    name,
    type: 'CM',
    level: 'L0',
    ...options,
  };
}

export function createEquipmentModule(
  id: string,
  name: string,
  controlModules: ControlModule[] = [],
  options: Partial<EquipmentModule> = {}
): EquipmentModule {
  return {
    id,
    name,
    type: 'EM',
    level: 'L1',
    controlModules,
    capabilities: [],
    ...options,
  };
}

export function createUnit(
  id: string,
  name: string,
  equipmentModules: EquipmentModule[] = [],
  options: Partial<Unit> = {}
): Unit {
  return {
    id,
    name,
    type: 'Unit',
    level: 'L2',
    equipmentModules,
    state: {
      name: 'STOPPED',
      mode: 'PRODUCTION',
      active: '○',
      enteredAt: Date.now(),
    },
    ...options,
  };
}

export function createCell(
  id: string,
  name: string,
  units: Unit[] = [],
  options: Partial<Cell> = {}
): Cell {
  return {
    id,
    name,
    type: 'Cell',
    level: 'L2',
    units,
    ...options,
  };
}

export function createWorkCenter(
  id: string,
  name: string,
  cells: Cell[] = [],
  options: Partial<WorkCenter> = {}
): WorkCenter {
  return {
    id,
    name,
    type: 'WorkCenter',
    level: 'L3',
    cells,
    ...options,
  };
}

export function createArea(
  id: string,
  name: string,
  workCenters: WorkCenter[] = [],
  options: Partial<Area> = {}
): Area {
  return {
    id,
    name,
    type: 'Area',
    level: 'L3',
    workCenters,
    ...options,
  };
}

export function createSite(
  id: string,
  name: string,
  areas: Area[] = [],
  options: Partial<Site> = {}
): Site {
  return {
    id,
    name,
    type: 'Site',
    level: 'L4',
    areas,
    ...options,
  };
}

export function createEnterprise(
  id: string,
  name: string,
  sites: Site[] = [],
  options: Partial<Enterprise> = {}
): Enterprise {
  return {
    id,
    name,
    type: 'Enterprise',
    level: 'L4',
    sites,
    ...options,
  };
}

export function createEquipStack(): EquipStack {
  return new EquipStack();
}
