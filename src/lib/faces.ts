import type { Box } from './anonymize/render.ts'
import type { Detection } from './detect/centerface.ts'

/** Detections are kept down to this score so the threshold slider can reveal more without re-running the model. */
export const MIN_THRESHOLD = 0.05

export interface Face extends Box {
  id: number
  score: number
  /** Drawn or edited by the user: always masked, whatever the threshold. */
  manual: boolean
}

let nextId = 0

export const fromDetection = (d: Detection): Face => ({ ...d, id: nextId++, manual: false })

export const manualFace = (b: Box): Face => ({ ...b, id: nextId++, score: 1, manual: true })

export const visible = (faces: Face[], threshold: number) => faces.filter((f) => f.manual || f.score >= threshold)
