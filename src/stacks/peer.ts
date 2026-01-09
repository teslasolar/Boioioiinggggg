/**
 * KONOMI v3.1 - Peer Stack
 *
 * Stack:Peer{Key→Id→Addr→Info→Conn→Mesh}
 *
 * E3:P2P{libp2p+yjs, CRDT:{reg,ctr,set,txt}, room→sync→aware}
 *
 * Implements peer-to-peer networking with CRDT support for
 * distributed industrial automation systems.
 */

import { Result, success, failure } from '../core/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// PEER STACK TYPES: Key → Id → Addr → Info → Conn → Mesh
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Stage 1: Key - Cryptographic identity key pair
 */
export interface PeerKey {
  publicKey: Uint8Array;
  privateKey?: Uint8Array; // Only available for local peer
  algorithm: 'Ed25519' | 'secp256k1' | 'RSA';
}

/**
 * Stage 2: Id - Derived peer identifier
 */
export interface PeerId {
  key: PeerKey;
  id: string;           // Base58 encoded multihash
  shortId: string;      // First 8 chars for display
}

/**
 * Stage 3: Addr - Network multiaddress
 */
export interface PeerAddr {
  peerId: PeerId;
  multiaddrs: string[];  // e.g., ["/ip4/192.168.1.1/tcp/4001/p2p/QmXy..."]
}

/**
 * Stage 4: Info - Extended peer information
 */
export interface PeerInfo {
  addr: PeerAddr;
  protocols: string[];   // Supported protocols
  agent?: string;        // User agent string
  latency?: number;      // RTT in ms
  lastSeen?: number;     // Unix timestamp
  metadata: Map<string, unknown>;
}

/**
 * Stage 5: Conn - Active connection
 */
export interface PeerConn {
  info: PeerInfo;
  status: 'connecting' | 'connected' | 'disconnecting' | 'disconnected';
  direction: 'inbound' | 'outbound';
  streams: PeerStream[];
  establishedAt?: number;
}

/**
 * Stream within a connection
 */
export interface PeerStream {
  id: string;
  protocol: string;
  direction: 'inbound' | 'outbound';
}

/**
 * Stage 6: Mesh - Network topology
 */
export interface PeerMesh {
  localPeer: PeerInfo;
  connections: Map<string, PeerConn>;
  rooms: Map<string, Room>;
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOM & AWARENESS (yjs-compatible)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Room - Collaborative space for CRDT sync
 */
export interface Room {
  id: string;
  name: string;
  topic: string;
  peers: Set<string>;      // Peer IDs in the room
  createdAt: number;
  metadata: Map<string, unknown>;
}

/**
 * Awareness - Ephemeral presence state
 */
export interface AwarenessState {
  peerId: string;
  user?: {
    name: string;
    color?: string;
    cursor?: { x: number; y: number };
  };
  lastUpdated: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CRDT TYPES: {reg, ctr, set, txt}
// ═══════════════════════════════════════════════════════════════════════════

/** CRDT type identifiers */
export type CRDTType = 'reg' | 'ctr' | 'set' | 'txt';

/**
 * LWW Register - Last-Writer-Wins register
 */
export interface CRDTRegister<T> {
  type: 'reg';
  value: T;
  timestamp: number;
  peerId: string;
}

/**
 * G-Counter / PN-Counter - Grow-only or positive-negative counter
 */
export interface CRDTCounter {
  type: 'ctr';
  increments: Map<string, number>;  // peerId -> increment count
  decrements: Map<string, number>;  // peerId -> decrement count
}

/**
 * G-Set / OR-Set - Grow-only or Observed-Remove set
 */
export interface CRDTSet<T> {
  type: 'set';
  elements: Map<string, { value: T; added: number; removed?: number }>;
}

/**
 * Y-Text compatible rich text
 */
export interface CRDTText {
  type: 'txt';
  content: CRDTTextOp[];
  length: number;
}

export interface CRDTTextOp {
  insert?: string;
  delete?: number;
  retain?: number;
  attributes?: Record<string, unknown>;
}

/** Union of all CRDT types */
export type CRDT<T = unknown> =
  | CRDTRegister<T>
  | CRDTCounter
  | CRDTSet<T>
  | CRDTText;

// ═══════════════════════════════════════════════════════════════════════════
// CRDT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new LWW Register
 */
export function createRegister<T>(value: T, peerId: string): CRDTRegister<T> {
  return {
    type: 'reg',
    value,
    timestamp: Date.now(),
    peerId,
  };
}

/**
 * Merge two LWW Registers (last writer wins)
 */
export function mergeRegisters<T>(
  a: CRDTRegister<T>,
  b: CRDTRegister<T>
): CRDTRegister<T> {
  if (a.timestamp > b.timestamp) return a;
  if (b.timestamp > a.timestamp) return b;
  // Tie-breaker: lexicographic peer ID comparison
  return a.peerId > b.peerId ? a : b;
}

/**
 * Create a new counter
 */
export function createCounter(): CRDTCounter {
  return {
    type: 'ctr',
    increments: new Map(),
    decrements: new Map(),
  };
}

/**
 * Increment counter for a peer
 */
export function incrementCounter(counter: CRDTCounter, peerId: string): CRDTCounter {
  const newIncrements = new Map(counter.increments);
  newIncrements.set(peerId, (newIncrements.get(peerId) ?? 0) + 1);
  return { ...counter, increments: newIncrements };
}

/**
 * Decrement counter for a peer
 */
export function decrementCounter(counter: CRDTCounter, peerId: string): CRDTCounter {
  const newDecrements = new Map(counter.decrements);
  newDecrements.set(peerId, (newDecrements.get(peerId) ?? 0) + 1);
  return { ...counter, decrements: newDecrements };
}

/**
 * Get counter value
 */
export function getCounterValue(counter: CRDTCounter): number {
  let total = 0;
  for (const inc of counter.increments.values()) total += inc;
  for (const dec of counter.decrements.values()) total -= dec;
  return total;
}

/**
 * Merge two counters
 */
export function mergeCounters(a: CRDTCounter, b: CRDTCounter): CRDTCounter {
  const increments = new Map(a.increments);
  const decrements = new Map(a.decrements);

  for (const [peerId, count] of b.increments) {
    increments.set(peerId, Math.max(increments.get(peerId) ?? 0, count));
  }
  for (const [peerId, count] of b.decrements) {
    decrements.set(peerId, Math.max(decrements.get(peerId) ?? 0, count));
  }

  return { type: 'ctr', increments, decrements };
}

/**
 * Create a new OR-Set
 */
export function createSet<T>(): CRDTSet<T> {
  return {
    type: 'set',
    elements: new Map(),
  };
}

/**
 * Add element to set
 */
export function addToSet<T>(set: CRDTSet<T>, id: string, value: T): CRDTSet<T> {
  const elements = new Map(set.elements);
  elements.set(id, { value, added: Date.now() });
  return { ...set, elements };
}

/**
 * Remove element from set
 */
export function removeFromSet<T>(set: CRDTSet<T>, id: string): CRDTSet<T> {
  const elements = new Map(set.elements);
  const element = elements.get(id);
  if (element) {
    elements.set(id, { ...element, removed: Date.now() });
  }
  return { ...set, elements };
}

/**
 * Get active set elements
 */
export function getSetElements<T>(set: CRDTSet<T>): T[] {
  const result: T[] = [];
  for (const element of set.elements.values()) {
    if (!element.removed || element.added > element.removed) {
      result.push(element.value);
    }
  }
  return result;
}

/**
 * Merge two OR-Sets
 */
export function mergeSets<T>(a: CRDTSet<T>, b: CRDTSet<T>): CRDTSet<T> {
  const elements = new Map(a.elements);

  for (const [id, bElem] of b.elements) {
    const aElem = elements.get(id);
    if (!aElem) {
      elements.set(id, bElem);
    } else {
      // Merge: latest add wins, latest remove wins
      elements.set(id, {
        value: bElem.added > aElem.added ? bElem.value : aElem.value,
        added: Math.max(aElem.added, bElem.added),
        removed: aElem.removed || bElem.removed
          ? Math.max(aElem.removed ?? 0, bElem.removed ?? 0)
          : undefined,
      });
    }
  }

  return { type: 'set', elements };
}

// ═══════════════════════════════════════════════════════════════════════════
// PEER STACK IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Peer Stack - Manages P2P networking and CRDT sync
 */
export class PeerStack {
  private mesh: PeerMesh | null = null;
  private awareness: Map<string, AwarenessState> = new Map();
  private documents: Map<string, CRDT> = new Map();

  /**
   * Stage 1: Generate a new key pair
   */
  generateKey(algorithm: PeerKey['algorithm'] = 'Ed25519'): Result<PeerKey> {
    // In a real implementation, this would use crypto libraries
    const publicKey = new Uint8Array(32);
    const privateKey = new Uint8Array(64);
    // Placeholder: fill with random bytes
    crypto.getRandomValues(publicKey);
    crypto.getRandomValues(privateKey);

    return success({ publicKey, privateKey, algorithm });
  }

  /**
   * Stage 2: Derive peer ID from key
   */
  deriveId(key: PeerKey): Result<PeerId> {
    // Generate a base58-like ID from the public key
    const id = this.bytesToBase58(key.publicKey);
    return success({
      key,
      id,
      shortId: id.substring(0, 8),
    });
  }

  /**
   * Stage 3: Create peer address
   */
  createAddr(peerId: PeerId, multiaddrs: string[]): Result<PeerAddr> {
    return success({ peerId, multiaddrs });
  }

  /**
   * Stage 4: Create peer info
   */
  createInfo(addr: PeerAddr, protocols: string[] = []): Result<PeerInfo> {
    return success({
      addr,
      protocols,
      metadata: new Map(),
    });
  }

  /**
   * Stage 5: Establish connection
   */
  connect(info: PeerInfo): Result<PeerConn> {
    return success({
      info,
      status: 'connected',
      direction: 'outbound',
      streams: [],
      establishedAt: Date.now(),
    });
  }

  /**
   * Stage 6: Initialize mesh
   */
  initMesh(localInfo: PeerInfo): Result<PeerMesh> {
    this.mesh = {
      localPeer: localInfo,
      connections: new Map(),
      rooms: new Map(),
    };
    return success(this.mesh);
  }

  /**
   * Get current mesh
   */
  getMesh(): PeerMesh | null {
    return this.mesh;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Room Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create or join a room
   */
  joinRoom(roomId: string, name?: string): Result<Room> {
    if (!this.mesh) {
      return failure(new Error('Mesh not initialized'));
    }

    let room = this.mesh.rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        name: name ?? roomId,
        topic: `/konomi/room/${roomId}`,
        peers: new Set(),
        createdAt: Date.now(),
        metadata: new Map(),
      };
      this.mesh.rooms.set(roomId, room);
    }

    room.peers.add(this.mesh.localPeer.addr.peerId.id);
    return success(room);
  }

  /**
   * Leave a room
   */
  leaveRoom(roomId: string): Result<void> {
    if (!this.mesh) {
      return failure(new Error('Mesh not initialized'));
    }

    const room = this.mesh.rooms.get(roomId);
    if (room) {
      room.peers.delete(this.mesh.localPeer.addr.peerId.id);
      if (room.peers.size === 0) {
        this.mesh.rooms.delete(roomId);
      }
    }
    return success(undefined);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Awareness Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update local awareness state
   */
  updateAwareness(state: Partial<AwarenessState>): Result<AwarenessState> {
    if (!this.mesh) {
      return failure(new Error('Mesh not initialized'));
    }

    const peerId = this.mesh.localPeer.addr.peerId.id;
    const current = this.awareness.get(peerId) ?? { peerId, lastUpdated: 0 };
    const updated: AwarenessState = {
      ...current,
      ...state,
      peerId,
      lastUpdated: Date.now(),
    };

    this.awareness.set(peerId, updated);
    return success(updated);
  }

  /**
   * Get awareness state for a peer
   */
  getAwareness(peerId: string): AwarenessState | undefined {
    return this.awareness.get(peerId);
  }

  /**
   * Get all awareness states
   */
  getAllAwareness(): AwarenessState[] {
    return Array.from(this.awareness.values());
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CRDT Document Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create or get a CRDT document
   */
  getOrCreateDocument<T extends CRDT>(
    docId: string,
    factory: () => T
  ): T {
    let doc = this.documents.get(docId);
    if (!doc) {
      doc = factory();
      this.documents.set(docId, doc);
    }
    return doc as T;
  }

  /**
   * Update a document
   */
  updateDocument<T extends CRDT>(docId: string, doc: T): void {
    this.documents.set(docId, doc);
  }

  /**
   * Get a document
   */
  getDocument<T extends CRDT>(docId: string): T | undefined {
    return this.documents.get(docId) as T | undefined;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private bytesToBase58(bytes: Uint8Array): string {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    let num = BigInt(0);
    for (const byte of bytes) {
      num = num * BigInt(256) + BigInt(byte);
    }
    while (num > 0) {
      result = ALPHABET[Number(num % BigInt(58))] + result;
      num = num / BigInt(58);
    }
    return result || '1';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function createPeerStack(): PeerStack {
  return new PeerStack();
}

/**
 * Quick initialization: create stack with local peer
 */
export async function initPeerStack(
  multiaddrs: string[] = []
): Promise<Result<PeerStack>> {
  const stack = createPeerStack();

  const keyResult = stack.generateKey();
  if (!keyResult.ok) return keyResult;

  const idResult = stack.deriveId(keyResult.value);
  if (!idResult.ok) return idResult;

  const addrResult = stack.createAddr(idResult.value, multiaddrs);
  if (!addrResult.ok) return addrResult;

  const infoResult = stack.createInfo(addrResult.value, [
    '/konomi/sync/1.0.0',
    '/konomi/aware/1.0.0',
  ]);
  if (!infoResult.ok) return infoResult;

  const meshResult = stack.initMesh(infoResult.value);
  if (!meshResult.ok) return meshResult;

  return success(stack);
}
