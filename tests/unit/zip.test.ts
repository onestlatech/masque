import { unzipSync } from 'fflate'
import { expect, test } from 'vitest'
import { zip } from '../../src/lib/media/zip.ts'

test('zip stores entries with a fixed date', async () => {
  const bytes = new Uint8Array(await zip({ '001.jpg': Uint8Array.of(1, 2, 3) }).arrayBuffer())
  expect(unzipSync(bytes)).toEqual({ '001.jpg': Uint8Array.of(1, 2, 3) })
  // Local header: DOS time then date, little-endian; 1980-01-01 00:00 is time 0, date 0x0021.
  expect([...bytes.subarray(10, 14)]).toEqual([0, 0, 0x21, 0])
})
