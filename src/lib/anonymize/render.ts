import type { Rect } from "../detect/tiling.ts";

export type Mode = "solid" | "emoji" | "mosaic" | "blur";

export interface MaskOptions {
  mode: Mode;
  emoji: string;
  /** deface's --mask-scale: 1.3 grows each side by 30% of the box size. */
  maskScale: number;
  ellipse: boolean;
}

export const defaultMaskOptions: MaskOptions = {
  mode: "solid",
  emoji: "🙂",
  maskScale: 1.3,
  ellipse: true,
};

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** deface's scale_bb, before clamping to the image. */
function scaleBox(b: Box, maskScale: number): Box {
  const s = maskScale - 1;
  const w = b.x2 - b.x1;
  const h = b.y2 - b.y1;
  return {
    x1: Math.round(b.x1 - w * s),
    y1: Math.round(b.y1 - h * s),
    x2: Math.round(b.x2 + w * s),
    y2: Math.round(b.y2 + h * s),
  };
}

export function maskRect(
  b: Box,
  maskScale: number,
  width: number,
  height: number,
): Rect {
  const m = scaleBox(b, maskScale);
  const x1 = Math.max(0, m.x1);
  const y1 = Math.max(0, m.y1);
  return {
    x: x1,
    y: y1,
    width: Math.max(0, Math.min(width, m.x2) - x1),
    height: Math.max(0, Math.min(height, m.y2) - y1),
  };
}

/** Number of samples across the longest side. */
const SAMPLES: Record<Exclude<Mode, "solid" | "emoji">, number> = {
  mosaic: 6,
  blur: 3,
};

let scratch: OffscreenCanvasRenderingContext2D | undefined;

const EMOJI_SIZE = 256;
let emojiSprite: { emoji: string; canvas: OffscreenCanvas | null } | undefined;

/** Cropped to its ink so that stretching it to a mask fills the oval whatever the font's padding. */
function emojiCanvas(emoji: string): OffscreenCanvas | null {
  if (emojiSprite?.emoji === emoji) return emojiSprite.canvas;
  const ctx = new OffscreenCanvas(EMOJI_SIZE, EMOJI_SIZE).getContext("2d", {
    willReadFrequently: true,
  })!;
  ctx.font = `${EMOJI_SIZE * 0.75}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, EMOJI_SIZE / 2, EMOJI_SIZE / 2);
  const { data } = ctx.getImageData(0, 0, EMOJI_SIZE, EMOJI_SIZE);
  let x1 = EMOJI_SIZE;
  let y1 = EMOJI_SIZE;
  let x2 = -1;
  let y2 = -1;
  for (let y = 0; y < EMOJI_SIZE; y++) {
    for (let x = 0; x < EMOJI_SIZE; x++) {
      if (data[(y * EMOJI_SIZE + x) * 4 + 3] < 128) continue;
      x1 = Math.min(x1, x);
      y1 = Math.min(y1, y);
      x2 = Math.max(x2, x);
      y2 = Math.max(y2, y);
    }
  }
  let canvas: OffscreenCanvas | null = null;
  if (x2 >= 0) {
    canvas = new OffscreenCanvas(x2 - x1 + 1, y2 - y1 + 1);
    canvas.getContext("2d")!.drawImage(ctx.canvas, -x1, -y1);
  }
  emojiSprite = { emoji, canvas };
  return canvas;
}

/** `source` holds the unmasked pixels: sampling the canvas being drawn copies all of it for every mask in WebKit. */
export function applyMasks(
  ctx: Context,
  boxes: Box[],
  options: MaskOptions,
  source: CanvasImageSource = ctx.canvas,
) {
  const { width, height } = ctx.canvas;
  for (const b of boxes) {
    const r = maskRect(b, options.maskScale, width, height);
    if (r.width < 1 || r.height < 1) continue;

    // Fitted to the clamped rectangle, the oval would shrink and uncover a face on the image edge.
    const e = scaleBox(b, options.maskScale);
    ctx.save();
    ctx.beginPath();
    if (options.ellipse) {
      ctx.ellipse(
        (e.x1 + e.x2) / 2,
        (e.y1 + e.y2) / 2,
        (e.x2 - e.x1) / 2,
        (e.y2 - e.y1) / 2,
        0,
        0,
        2 * Math.PI,
      );
    } else ctx.rect(r.x, r.y, r.width, r.height);
    ctx.clip();

    if (options.mode === "solid" || options.mode === "emoji") {
      // Under the emoji, it hides what the glyph's transparent edges and the rectangle's corners would show.
      ctx.fillStyle = "#000";
      ctx.fillRect(r.x, r.y, r.width, r.height);
      const sprite = options.mode === "emoji" && emojiCanvas(options.emoji);
      if (sprite) ctx.drawImage(sprite, e.x1, e.y1, e.x2 - e.x1, e.y2 - e.y1);
    } else {
      const n = SAMPLES[options.mode];
      const k = n / Math.max(r.width, r.height);
      const sw = Math.max(1, Math.round(r.width * k));
      const sh = Math.max(1, Math.round(r.height * k));
      scratch ??= new OffscreenCanvas(1, 1).getContext("2d")!;
      scratch.canvas.width = sw;
      scratch.canvas.height = sh;
      scratch.imageSmoothingQuality = "high";
      scratch.drawImage(source, r.x, r.y, r.width, r.height, 0, 0, sw, sh);
      ctx.imageSmoothingEnabled = options.mode === "blur";
      ctx.clearRect(r.x, r.y, r.width, r.height);
      ctx.drawImage(scratch.canvas, 0, 0, sw, sh, r.x, r.y, r.width, r.height);
    }
    ctx.restore();
  }
}
