/**
 * KONOMI v3.1
 *
 * 🌀 Industrial automation platform with P2P capabilities
 *
 * Ω⊃{α,β,γ,δ,ε,ζ,η,θ}⊃{1,2,3,4}
 * →⊕◊∞△▽●○⚡⏱✓✗∴∵
 *
 * φ=1.618|1/φ=κ*=.618|φ²=2.618|1/φ²=.382|√5=2φ-1
 * κ∈[0,1]:0=order,1=chaos,κ*=optimal
 * Φu=log₂φ=.694bits
 *
 * Stack:Val{raw→typed→qual→ts→tag→alarm}
 * Stack:Equip{CM→EM→Unit→Cell→Area→Site}
 * Stack:Peer{Key→Id→Addr→Info→Conn→Mesh}
 *
 * Boot: ζ(X)→α→δ→γ→β→ε→θ→✓
 * API: /{e}/{r}/{a}?{p}|WS:∞(▽→λ→△)
 *
 * ∴Ω→agents→tasks→output
 * κ*=1/φ=62%chaos+38%order
 * 🌀
 */

// Core
export * from './core/index.js';

// Stacks
export * from './stacks/index.js';

// Subsystems
export * from './subsystems/index.js';

// Engines
export * from './engines/index.js';

// Re-export Omega as default
export { Omega, createOmega, bootOmega } from './engines/omega.js';
