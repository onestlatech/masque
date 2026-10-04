<script lang="ts">
  import { applyMasks, type Box, type MaskOptions } from '../lib/anonymize/render.ts'
  import type { Face } from '../lib/faces.ts'

  let {
    bitmap,
    faces,
    options,
    selected = $bindable(),
    onadd,
    onchange,
    onremove,
  }: {
    bitmap: ImageBitmap
    faces: Face[]
    options: MaskOptions
    selected?: number
    /** Returns the new mask's id. */
    onadd: (box: Box) => number
    onchange: (id: number, box: Box) => void
    onremove: (id: number) => void
  } = $props()

  const HANDLE = 12 // CSS pixels

  let canvas: HTMLCanvasElement
  let drag:
    | { kind: 'new'; x: number; y: number; id?: number }
    | { kind: 'move' | 'resize'; x: number; y: number; id: number; orig: Box }
    | undefined

  $effect(() => {
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    applyMasks(ctx, faces, options)

    const px = pixelRatio()
    ctx.lineWidth = 2 * px
    for (const f of faces) {
      ctx.strokeStyle = f.id === selected ? '#facc15' : f.manual ? '#60a5fa' : '#f87171'
      ctx.strokeRect(f.x1, f.y1, f.x2 - f.x1, f.y2 - f.y1)
      if (f.id === selected) {
        ctx.fillStyle = '#facc15'
        ctx.fillRect(f.x2 - HANDLE * px, f.y2 - HANDLE * px, HANDLE * px, HANDLE * px)
      }
    }
  })

  /** Image pixels per CSS pixel. */
  const pixelRatio = () => canvas.width / (canvas.getBoundingClientRect().width || canvas.width)

  function point(e: PointerEvent) {
    const r = canvas.getBoundingClientRect()
    return { x: ((e.clientX - r.left) * canvas.width) / r.width, y: ((e.clientY - r.top) * canvas.height) / r.height }
  }

  function hit(x: number, y: number) {
    // Topmost first: the last drawn box wins.
    for (let i = faces.length - 1; i >= 0; i--) {
      const f = faces[i]
      if (x >= f.x1 && x <= f.x2 && y >= f.y1 && y <= f.y2) return f
    }
  }

  function pointerdown(e: PointerEvent) {
    canvas.setPointerCapture(e.pointerId)
    const { x, y } = point(e)
    const face = hit(x, y)
    if (!face) {
      selected = undefined
      drag = { kind: 'new', x, y }
      return
    }
    selected = face.id
    const h = HANDLE * pixelRatio()
    const kind = x >= face.x2 - h && y >= face.y2 - h ? 'resize' : 'move'
    drag = { kind, x, y, id: face.id, orig: { x1: face.x1, y1: face.y1, x2: face.x2, y2: face.y2 } }
  }

  function pointermove(e: PointerEvent) {
    const d = drag
    if (!d) return
    const { x, y } = point(e)
    if (d.kind === 'new') {
      const box = { x1: Math.min(d.x, x), y1: Math.min(d.y, y), x2: Math.max(d.x, x), y2: Math.max(d.y, y) }
      if (d.id !== undefined) onchange(d.id, box)
      else if (box.x2 - box.x1 > 4 && box.y2 - box.y1 > 4) d.id = selected = onadd(box)
      return
    }
    const dx = x - d.x
    const dy = y - d.y
    const { orig } = d
    onchange(
      d.id,
      d.kind === 'move'
        ? { x1: orig.x1 + dx, y1: orig.y1 + dy, x2: orig.x2 + dx, y2: orig.y2 + dy }
        : { ...orig, x2: Math.max(orig.x1 + 4, orig.x2 + dx), y2: Math.max(orig.y1 + 4, orig.y2 + dy) },
    )
  }

  function remove(id: number) {
    if (selected === id) selected = undefined
    onremove(id)
  }

  function keydown(e: KeyboardEvent) {
    if (selected === undefined) return
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      remove(selected)
    } else if (e.key === 'Escape') selected = undefined
  }
</script>

<canvas
  bind:this={canvas}
  tabindex="0"
  aria-label="Image with hidden faces. Drag to add a mask; select a mask to move it, resize it from its corner, or delete it."
  onpointerdown={pointerdown}
  onpointermove={pointermove}
  onpointerup={() => (drag = undefined)}
  onkeydown={keydown}
></canvas>

<details>
  <summary>{faces.length} {faces.length === 1 ? 'mask' : 'masks'}</summary>
  <ul>
    {#each faces as f, i (f.id)}
      <li data-box={[f.x1, f.y1, f.x2, f.y2, f.score].map((v) => v.toFixed(3)).join(',')} class:selected={f.id === selected}>
        <button type="button" class="link" onclick={() => (selected = f.id)}>
          {f.manual ? 'Manual mask' : `Face ${i + 1}`}{f.manual ? '' : ` (${Math.round(f.score * 100)}%)`}
        </button>
        <button type="button" aria-label="Remove mask {i + 1}" onclick={() => remove(f.id)}>Remove</button>
      </li>
    {/each}
  </ul>
</details>

<style>
  canvas {
    display: block;
    max-width: 100%;
    max-height: 75vh;
    margin: 0 auto;
    touch-action: none;
    cursor: crosshair;
  }

  ul {
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    justify-content: space-between;
    padding: 0.125rem 0;
  }

  li.selected {
    font-weight: bold;
  }

  .link {
    background: none;
    border: 0;
    padding: 0;
    color: inherit;
    cursor: pointer;
  }
</style>
