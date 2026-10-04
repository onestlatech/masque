import { zipSync } from 'fflate'

// The default entry date is "now", which would record when the user exported.
const MTIME = new Date(1980, 0, 1)

/** Stores without compression: photos are already compressed. */
export const zip = (files: Record<string, Uint8Array>) =>
  new Blob([zipSync(files, { level: 0, mtime: MTIME })], { type: 'application/zip' })
