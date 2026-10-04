<script lang="ts">
  import Editor from './Editor.svelte'
  import Settings from './Settings.svelte'
  import type { MaskOptions } from '../lib/anonymize/render.ts'
  import type { Engine } from '../lib/detect/client.ts'
  import { fromDetection, manualFace, MIN_THRESHOLD, visible, type Face } from '../lib/faces.ts'
  import { download, exportImage, loadImage, outputName, outputType } from '../lib/media/image.ts'

  let {
    file,
    worker,
    options = $bindable(),
    threshold = $bindable(),
    onerror,
    onclose,
  }: {
    file: File
    worker: Engine
    options: MaskOptions
    threshold: number
    onerror: (message: string) => void
    onclose: () => void
  } = $props()

  let bitmap = $state.raw<ImageBitmap>()
  let faces = $state<Face[]>([])
  let detecting = $state(true)
  const shown = $derived(visible(faces, threshold))

  $effect(() => {
    let b: ImageBitmap | undefined
    loadImage(file).then(
      async (loaded) => {
        bitmap = b = loaded
        try {
          const copy = await createImageBitmap(loaded)
          const found = await worker.call('detect', { image: copy, threshold: MIN_THRESHOLD }, { transfer: [copy] })
          faces = found.map(fromDetection)
        } catch (e) {
          onerror(`Face detection failed: ${(e as Error).message}. You can still add masks by hand.`)
        } finally {
          detecting = false
        }
      },
      () => {
        onerror(`Your browser cannot open “${file.name}”. Convert it to JPEG or PNG and try again.`)
        onclose()
      },
    )
    return () => b?.close()
  })

  function change(id: number, box: object) {
    const face = faces.find((f) => f.id === id)!
    Object.assign(face, box, { manual: true })
  }

  async function save() {
    const type = outputType(file.type)
    const blob = await exportImage(bitmap!, $state.snapshot(shown), $state.snapshot(options), type)
    download(blob, outputName(type))
  }
</script>

<div class="workspace">
  <section aria-label="Preview">
    {#if detecting}
      <p role="status">Looking for faces…</p>
    {/if}
    {#if bitmap}
      <Editor
        {bitmap}
        faces={shown}
        {options}
        onadd={(box) => {
          const face = manualFace(box)
          faces.push(face)
          return face.id
        }}
        onchange={change}
        onremove={(id) => (faces = faces.filter((f) => f.id !== id))}
      />
    {/if}
  </section>
  <aside>
    <Settings bind:options bind:threshold />
    <button type="button" class="primary" onclick={save} disabled={detecting}>Download</button>
    <button type="button" onclick={onclose}>Start over</button>
  </aside>
</div>
