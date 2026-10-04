<script lang="ts">
  import { errorMessage, t } from '../lib/i18n.svelte.ts'
  import Editor from './Editor.svelte'
  import Settings from './Settings.svelte'
  import type { MaskOptions } from '../lib/anonymize/render.ts'
  import type { Engine } from '../lib/detect/client.ts'
  import { editFace, fromDetection, manualFace, MIN_THRESHOLD, visible, type Face } from '../lib/faces.ts'
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
          onerror(t('detectionFailed', errorMessage(e)))
        } finally {
          detecting = false
        }
      },
      () => {
        onerror(t('cannotOpen', file.name))
        onclose()
      },
    )
    return () => b?.close()
  })

  async function save() {
    const type = outputType(file.type)
    const blob = await exportImage(bitmap!, $state.snapshot(shown), $state.snapshot(options), type)
    download(blob, outputName(type))
  }
</script>

<div class="workspace">
  <section aria-label={t('preview')}>
    {#if detecting}
      <p role="status">{t('lookingForFaces')}</p>
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
        onchange={(id, box) => editFace(faces, id, box)}
        onremove={(id) => (faces = faces.filter((f) => f.id !== id))}
      />
    {/if}
  </section>
  <aside>
    <Settings bind:options bind:threshold />
    <button type="button" class="primary" onclick={save} disabled={detecting}>{t('download')}</button>
    <button type="button" onclick={onclose}>{t('startOver')}</button>
  </aside>
</div>
