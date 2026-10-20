import type { Rect } from "./detect/tiling.ts";

/** Relative to the image, so that one placement suits photos and videos of any size and orientation. */
export interface Placement {
  /** 0 puts the watermark against the left margin, 1 against the right one. */
  x: number;
  /** 0 puts the watermark against the top margin, 1 against the bottom one. */
  y: number;
  /** Longest side of the watermark, as a fraction of the shortest side of the image. */
  size: number;
  opacity: number;
}

export const defaultPlacement: Placement = {
  x: 1,
  y: 1,
  size: 0.2,
  opacity: 0.8,
};

export interface Watermark {
  image: ImageBitmap;
  placement: Placement;
}

type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Size = { width: number; height: number };

/** Of the shortest side of the image. */
const MARGIN = 0.03;

function layout(image: Size, mark: Size, size: number) {
  const short = Math.min(image.width, image.height);
  const k = (size * short) / Math.max(mark.width, mark.height);
  const width = mark.width * k;
  const height = mark.height * k;
  const margin = MARGIN * short;
  return {
    width,
    height,
    margin,
    freeX: image.width - width - 2 * margin,
    freeY: image.height - height - 2 * margin,
  };
}

export function watermarkRect(
  image: Size,
  mark: Size,
  { x, y, size }: Placement,
): Rect {
  const l = layout(image, mark, size);
  return {
    x: l.margin + x * l.freeX,
    y: l.margin + y * l.freeY,
    width: l.width,
    height: l.height,
  };
}

/** The placement after dragging the watermark by (dx, dy) image pixels, kept within the margins. */
export function moveWatermark(
  image: Size,
  mark: Size,
  placement: Placement,
  dx: number,
  dy: number,
): Placement {
  const l = layout(image, mark, placement.size);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return {
    ...placement,
    x: l.freeX > 0 ? clamp(placement.x + dx / l.freeX) : placement.x,
    y: l.freeY > 0 ? clamp(placement.y + dy / l.freeY) : placement.y,
  };
}

export function drawWatermark(ctx: Context, { image, placement }: Watermark) {
  const r = watermarkRect(ctx.canvas, image, placement);
  ctx.save();
  ctx.globalAlpha = placement.opacity;
  ctx.drawImage(image, r.x, r.y, r.width, r.height);
  ctx.restore();
}
