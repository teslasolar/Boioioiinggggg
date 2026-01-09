/**
 * KONOMI v3.1 - φ (Phi) Constants and Mathematical Utilities
 *
 * E1: φ{derive:φ→T0→T1→T2→T3, prec:Φu, cache:metallic+roots+trig}
 *
 * Tiers based on computational cost in Φu (phi information units):
 * - T0⚡ Instant: φ family and derived constants
 * - T1⏱ Moderate (2Φu): Simple roots
 * - T2⏱ Higher (3-5Φu): Complex roots
 * - T3⏱ Expensive (10Φu): Transcendentals (cached)
 */

// ═══════════════════════════════════════════════════════════════════════════
// T0⚡ INSTANT - Golden Ratio Family (φ derived, zero cost)
// ═══════════════════════════════════════════════════════════════════════════

/** φ (phi) - The golden ratio: (1 + √5) / 2 */
export const PHI = 1.6180339887498948482;

/** 1/φ (kappa*) - Optimal chaos/order balance = φ - 1 */
export const KAPPA_STAR = 0.6180339887498948482;

/** φ² - Phi squared */
export const PHI_SQUARED = 2.6180339887498948482;

/** 1/φ² - Inverse phi squared */
export const INV_PHI_SQUARED = 0.3819660112501051518;

/** √5 - Square root of 5, derived from phi: √5 = 2φ - 1 */
export const SQRT_5 = 2.2360679774997896964;

/** cos(36°) - Golden angle cosine = φ/2 */
export const COS_36 = 0.8090169943749474241;

/** cos(72°) - Golden angle complement = (φ-1)/2 = κ*/2 */
export const COS_72 = 0.3090169943749474241;

/** Φu - Phi information unit: log₂(φ) bits */
export const PHI_UNIT = 0.6942419136306173;

// ═══════════════════════════════════════════════════════════════════════════
// T1⏱ MODERATE - Simple Roots (cost: 2Φu)
// ═══════════════════════════════════════════════════════════════════════════

/** σ (silver ratio) - 1 + √2 */
export const SIGMA = 2.4142135623730950488;

/** √2 - Square root of 2 */
export const SQRT_2 = 1.4142135623730950488;

/** √3 - Square root of 3 */
export const SQRT_3 = 1.7320508075688772935;

// ═══════════════════════════════════════════════════════════════════════════
// T2⏱ HIGHER - Complex Roots (cost: 3-5Φu)
// ═══════════════════════════════════════════════════════════════════════════

/** √6 - Square root of 6 */
export const SQRT_6 = 2.4494897427831780982;

/** √7 - Square root of 7 */
export const SQRT_7 = 2.6457513110645905905;

/** √10 - Square root of 10 */
export const SQRT_10 = 3.1622776601683793320;

// ═══════════════════════════════════════════════════════════════════════════
// T3⏱ EXPENSIVE - Transcendentals (cost: 10Φu, cached)
// ═══════════════════════════════════════════════════════════════════════════

/** π - Pi, cached transcendental */
export const PI = 3.1415926535897932385;

/** e - Euler's number, cached transcendental */
export const E = 2.7182818284590452354;

/** ln(2) - Natural log of 2, cached transcendental */
export const LN_2 = 0.6931471805599453094;

// ═══════════════════════════════════════════════════════════════════════════
// KAPPA (κ) - Chaos/Order Balance System
// ═══════════════════════════════════════════════════════════════════════════

/**
 * κ ∈ [0,1] where:
 * - 0 = pure order (crystalline, rigid)
 * - 1 = pure chaos (entropic, random)
 * - κ* = 0.618 = optimal balance (golden mean)
 */
export interface KappaState {
  value: number;
  label: 'order' | 'optimal' | 'chaos';
}

export function evaluateKappa(kappa: number): KappaState {
  if (kappa < 0 || kappa > 1) {
    throw new RangeError(`κ must be in [0,1], got ${kappa}`);
  }

  const threshold = 0.1; // tolerance for optimal detection
  const isOptimal = Math.abs(kappa - KAPPA_STAR) < threshold;

  return {
    value: kappa,
    label: isOptimal ? 'optimal' : kappa < 0.5 ? 'order' : 'chaos'
  };
}

/** Get the optimal kappa value (κ* = 1/φ) */
export function optimalKappa(): number {
  return KAPPA_STAR;
}

// ═══════════════════════════════════════════════════════════════════════════
// TIER SYSTEM - Computational Cost Tracking
// ═══════════════════════════════════════════════════════════════════════════

export type Tier = 'T0' | 'T1' | 'T2' | 'T3';

export interface TierInfo {
  tier: Tier;
  cost: number;      // Cost in Φu
  cached: boolean;
  symbol: '⚡' | '⏱';
}

const TIER_COSTS: Record<Tier, number> = {
  T0: 0,
  T1: 2 * PHI_UNIT,
  T2: 4 * PHI_UNIT,  // avg of 3-5
  T3: 10 * PHI_UNIT
};

export function getTierInfo(tier: Tier): TierInfo {
  return {
    tier,
    cost: TIER_COSTS[tier],
    cached: tier === 'T3',
    symbol: tier === 'T0' ? '⚡' : '⏱'
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANT CACHE - Pre-computed constant registry
// ═══════════════════════════════════════════════════════════════════════════

export interface CachedConstant {
  name: string;
  symbol: string;
  value: number;
  tier: Tier;
  category: 'metallic' | 'roots' | 'trig' | 'transcendental';
}

export const CONSTANT_CACHE: Map<string, CachedConstant> = new Map([
  // T0 - Metallic
  ['phi', { name: 'phi', symbol: 'φ', value: PHI, tier: 'T0', category: 'metallic' }],
  ['kappa_star', { name: 'kappa_star', symbol: 'κ*', value: KAPPA_STAR, tier: 'T0', category: 'metallic' }],
  ['phi_squared', { name: 'phi_squared', symbol: 'φ²', value: PHI_SQUARED, tier: 'T0', category: 'metallic' }],
  ['inv_phi_squared', { name: 'inv_phi_squared', symbol: '1/φ²', value: INV_PHI_SQUARED, tier: 'T0', category: 'metallic' }],

  // T0 - Roots (phi-derived)
  ['sqrt_5', { name: 'sqrt_5', symbol: '√5', value: SQRT_5, tier: 'T0', category: 'roots' }],

  // T0 - Trig (phi-derived)
  ['cos_36', { name: 'cos_36', symbol: 'cos36°', value: COS_36, tier: 'T0', category: 'trig' }],
  ['cos_72', { name: 'cos_72', symbol: 'cos72°', value: COS_72, tier: 'T0', category: 'trig' }],

  // T1 - Metallic
  ['sigma', { name: 'sigma', symbol: 'σ', value: SIGMA, tier: 'T1', category: 'metallic' }],

  // T1 - Roots
  ['sqrt_2', { name: 'sqrt_2', symbol: '√2', value: SQRT_2, tier: 'T1', category: 'roots' }],
  ['sqrt_3', { name: 'sqrt_3', symbol: '√3', value: SQRT_3, tier: 'T1', category: 'roots' }],

  // T2 - Roots
  ['sqrt_6', { name: 'sqrt_6', symbol: '√6', value: SQRT_6, tier: 'T2', category: 'roots' }],
  ['sqrt_7', { name: 'sqrt_7', symbol: '√7', value: SQRT_7, tier: 'T2', category: 'roots' }],
  ['sqrt_10', { name: 'sqrt_10', symbol: '√10', value: SQRT_10, tier: 'T2', category: 'roots' }],

  // T3 - Transcendental
  ['pi', { name: 'pi', symbol: 'π', value: PI, tier: 'T3', category: 'transcendental' }],
  ['e', { name: 'e', symbol: 'e', value: E, tier: 'T3', category: 'transcendental' }],
  ['ln_2', { name: 'ln_2', symbol: 'ln2', value: LN_2, tier: 'T3', category: 'transcendental' }],
]);

/** Derive constants by tier: φ → T0 → T1 → T2 → T3 */
export function deriveByTier(tier: Tier): CachedConstant[] {
  const tierOrder: Tier[] = ['T0', 'T1', 'T2', 'T3'];
  const tierIndex = tierOrder.indexOf(tier);

  return Array.from(CONSTANT_CACHE.values())
    .filter(c => tierOrder.indexOf(c.tier) <= tierIndex);
}

/** Get constants by category */
export function getByCategory(category: CachedConstant['category']): CachedConstant[] {
  return Array.from(CONSTANT_CACHE.values())
    .filter(c => c.category === category);
}
