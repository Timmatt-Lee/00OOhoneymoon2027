import { createPrng } from '../utils/prng';

interface Snowflake {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  alpha: number;
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
    this.flakes = Array.from({ length: flakeCount }, () => ({
      x: this.rand() * this.lastWidth,
      y: this.rand() * this.lastHeight,
      r: this.rand() * 2.1 + 0.9,
      vy: this.rand() * 0.52 + 0.24,
      vx: (this.rand() - 0.5) * 0.3,
      alpha: this.rand() * 0.55 + 0.35,
      phase: this.rand() * Math.PI * 2
    }));
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
    isAdvancing = true
  ): void {
    ctx.fillStyle = isTinted ? 'rgba(255, 245, 250, 0.92)' : '#FFFFFF';
    for (const f of this.flakes) {
      if (isAdvancing) {
        f.phase += 0.015;
        f.y += f.vy;
        f.x += f.vx + Math.sin(f.phase) * 0.18;
        if (f.y > h + 6) {
          f.y = -6;
          f.x = this.rand() * w;
        }
        if (f.x > w + 6) f.x = -6;
        else if (f.x < -6) f.x = w + 6;
      }
      ctx.globalAlpha = f.alpha;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
