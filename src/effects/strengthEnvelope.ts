export const FADE_TAU_MS = 220;
const SNAP_EPSILON = 0.004;

export function computeSpanTarget(dayFloat: number, activeSet: ReadonlySet<number>): number {
  const idxA = Math.floor(dayFloat);
  const idxB = idxA + 1;
  const frac = dayFloat - idxA;
  const valA = activeSet.has(idxA) ? 1 : 0;
  const valB = activeSet.has(idxB) ? 1 : 0;
  return valA + (valB - valA) * frac;
}

export class StrengthEnvelope {
  private readonly activeSet: ReadonlySet<number>;
  private currentStrength = 0;
  private isStrengthInitialized = false;

  constructor(activeDayIndices: readonly number[]) {
    this.activeSet = new Set(activeDayIndices);
  }

  public step(dayFloat: number, isAdvancing: boolean, dtScale: number): number {
    const spatialTarget = computeSpanTarget(dayFloat, this.activeSet);
    if (!this.isStrengthInitialized || !isAdvancing) {
      this.currentStrength = spatialTarget;
      this.isStrengthInitialized = true;
      return this.currentStrength;
    }

    const dtMs = dtScale * 16.667;
    const alpha = 1 - Math.exp(-dtMs / FADE_TAU_MS);
    this.currentStrength += (spatialTarget - this.currentStrength) * alpha;

    if (spatialTarget === 0 && this.currentStrength < SNAP_EPSILON) {
      this.currentStrength = 0;
    } else if (spatialTarget === 1 && this.currentStrength > 1 - SNAP_EPSILON) {
      this.currentStrength = 1;
    }

    return this.currentStrength;
  }
}
