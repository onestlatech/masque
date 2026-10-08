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
  let detectionFailed = $state(false)
  let exporting = $state(false)
  const shown = $derived(visible(faces, threshold))

  $effect(() => {
    let b: ImageBitmap | undefined
    let stale = false
    const controller = new AbortController()
    loadImage(file).then(
      async (loaded) => {
        if (stale) return loaded.close()
        bitmap = b = loaded
        let copy: ImageBitmap | undefined
        try {
          copy = await createImageBitmap(loaded)
          const found = await worker.call('detect', { image: copy, threshold: MIN_THRESHOLD }, { transfer: [copy], signal: controller.signal })
          if (!stale) faces = [...faces.filter((f) => f.manual), ...found.map(fromDetection)]
        } catch (e) {
          if (stale) return
          detectionFailed = true
          onerror(t('detectionFailed', errorMessage(e)))
        } finally {
          copy?.close()
          if (!stale) detecting = false
        }
      },
      () => {
        if (stale) return
        onerror(t('cannotOpen', file.name))
        onclose()
      },
    )
    return () => {
      stale = true
      controller.abort()
      b?.close()
    }
  })

  async function save() {
    exporting = true
    try {
      const type = outputType(file.type)
      const blob = await exportImage(bitmap!, $state.snapshot(shown), $state.snapshot(options), type)
      download(blob, outputName(type))
    } catch (e) {
      onerror(t('exportFailed', errorMessage(e)))
    } finally {
      exporting = false
    }
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
    <button type="button" class="primary" onclick={save} disabled={!bitmap || detecting || exporting || (detectionFailed && !shown.length)}>{t('download')}</button>
    <button type="button" onclick={onclose}>{t('openAnother')}</button>
  </aside>
</div>
