import { createPrng } from '../utils/prng';

const ALPHA_BUCKETS = [0.42, 0.64, 0.86] as const;

interface Snowflake {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  bucketIdx: 0 | 1 | 2;
  phase: number;
}

export class SnowfallEffect {
  private readonly flakes: Snowflake[];
  private readonly rand = createPrng(20270302);
  private lastWidth: number;
  private lastHeight: number;

  constructor(flakeCount: number, width: number, height: number) {
    this.lastWidth = Math.max(1, width);
    this.lastHeight = Math.max(1, height);
    this.flakes = Array.from({ length: flakeCount }, () => {
      const rawAlpha = this.rand() * 0.55 + 0.35;
      const bucketIdx: 0 | 1 | 2 = rawAlpha < 0.53 ? 0 : rawAlpha < 0.72 ? 1 : 2;
      return {
        x: this.rand() * this.lastWidth,
        y: this.rand() * this.lastHeight,
        r: this.rand() * 2.1 + 0.9,
        vy: this.rand() * 0.52 + 0.24,
        vx: (this.rand() - 0.5) * 0.3,
        bucketIdx,
        phase: this.rand() * Math.PI * 2
      };
    });
  }

  public resize(nextWidth: number, nextHeight: number): void {
    const safeW = Math.max(1, nextWidth);
    const safeH = Math.max(1, nextHeight);
    const scaleX = safeW / this.lastWidth;
    const scaleY = safeH / this.lastHeight;
    for (const f of this.flakes) {
      f.x *= scaleX;
      f.y *= scaleY;
    }
    this.lastWidth = safeW;
    this.lastHeight = safeH;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    isTinted: boolean,
    isAdvancing = true,
    dtScale = 1
  ): void {
    if (isAdvancing) {
      for (const f of this.flakes) {
        f.phase += 0.015 * dtScale;
        f.y += f.vy * dtScale;
        f.x += (f.vx + Math.sin(f.phase) * 0.18) * dtScale;
        if (f.y > h + 6) {
          f.y = -6;
          f.x = this.rand() * w;
        }
        if (f.x > w + 6) f.x = -6;
        else if (f.x < -6) f.x = w + 6;
      }
    }

    ctx.fillStyle = isTinted ? 'rgba(255, 245, 250, 0.92)' : '#FFFFFF';
    for (const [bucketIdx, bucketAlpha] of ALPHA_BUCKETS.entries()) {
      ctx.globalAlpha = bucketAlpha;
      ctx.beginPath();
      for (const f of this.flakes) {
        if (f.bucketIdx !== bucketIdx) continue;
        ctx.moveTo(f.x + f.r, f.y);
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }
}
