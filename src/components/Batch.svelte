<script lang="ts">
  import { t } from '../lib/i18n.svelte.ts'
  import { onMount, untrack } from 'svelte'
  import Editor from './Editor.svelte'
  import Settings from './Settings.svelte'
  import type { MaskOptions } from '../lib/anonymize/render.ts'
  import type { Engine } from '../lib/detect/client.ts'
  import { editFace, fromDetection, manualFace, MIN_THRESHOLD, visible, type Face } from '../lib/faces.ts'
  import { download, exportImage, loadImage, outputName, outputType } from '../lib/media/image.ts'
  import { zip } from '../lib/media/zip.ts'

  let {
    files,
    worker,
    options = $bindable(),
    threshold = $bindable(),
    onclose,
  }: {
    files: File[]
    worker: Engine
    options: MaskOptions
    threshold: number
    onclose: () => void
  } = $props()

  interface Item {
    file: File
    faces: Face[]
    status: 'waiting' | 'ready' | 'error'
  }

  // Bitmaps are decoded on demand: keeping dozens of full-size photos decoded would exhaust memory.
  let items = $state<Item[]>(untrack(() => files).map((file) => ({ file, faces: [], status: 'waiting' })))
  let current = $state(0)
  let bitmap = $state.raw<ImageBitmap>()
  let exporting = $state(false)

  const done = $derived(items.filter((i) => i.status !== 'waiting').length)
  const item = $derived(items[current])

  onMount(() => {
    let stopped = false
    const controller = new AbortController()
    ;(async () => {
      for (const it of items) {
        if (stopped) return
        let b: ImageBitmap | undefined
        try {
          b = await loadImage(it.file)
          if (stopped) return
          const found = await worker.call('detect', { image: b, threshold: MIN_THRESHOLD }, { transfer: [b], signal: controller.signal })
          if (stopped) return
          it.faces = found.map(fromDetection)
          it.status = 'ready'
        } catch {
          it.status = 'error'
        } finally {
          b?.close()
        }
      }
    })()
    return () => {
      stopped = true
      controller.abort()
    }
  })

  $effect(() => {
    const file = item.file
    bitmap = undefined
    let b: ImageBitmap | undefined
    let stale = false
    loadImage(file).then(
      (loaded) => {
        if (stale) return loaded.close()
        bitmap = b = loaded
      },
      () => { if (!stale) bitmap = undefined },
    )
    return () => {
      stale = true
      b?.close()
    }
  })

  async function save() {
    exporting = true
    try {
      const out: Record<string, Uint8Array> = {}
      let n = 0
      for (const it of items) {
        if (it.status !== 'ready') continue
        const b = await loadImage(it.file)
        const type = outputType(it.file.type)
        try {
          const blob = await exportImage(b, $state.snapshot(visible(it.faces, threshold)), $state.snapshot(options), type)
          // Numbered in input order; original names may identify the photographer, place or date.
          out[`${String(++n).padStart(3, '0')}.${type === 'image/png' ? 'png' : 'jpg'}`] = new Uint8Array(await blob.arrayBuffer())
        } finally {
          b.close()
        }
      }
      download(zip(out), outputName('application/zip'))
    } finally {
      exporting = false
    }
  }
</script>

<div class="workspace">
  <section aria-label={t('preview')}>
    <ol class="items">
      {#each items as it, i (it.file)}
        <li>
          <button type="button" class:current={i === current} onclick={() => (current = i)} aria-current={i === current}>
            {i + 1}
            <small>
              {#if it.status === 'waiting'}…{:else if it.status === 'error'}{t('unreadable')}{:else}{t('masks', visible(it.faces, threshold).length)}{/if}
            </small>
          </button>
        </li>
      {/each}
    </ol>
    {#if done < items.length}
      <p role="status">{t('lookingProgress', done, items.length)}</p>
    {/if}
    {#if bitmap && item.status === 'ready'}
      {#key item}
        <Editor
          {bitmap}
          faces={visible(item.faces, threshold)}
          {options}
          onadd={(box) => {
            const face = manualFace(box)
            item.faces.push(face)
            return face.id
          }}
          onchange={(id, box) => editFace(item.faces, id, box)}
          onremove={(id) => (item.faces = item.faces.filter((f) => f.id !== id))}
        />
      {/key}
    {/if}
  </section>
  <aside>
    <Settings bind:options bind:threshold />
    <button type="button" class="primary" onclick={save} disabled={done < items.length || exporting}>
      {t('downloadAll', items.filter((i) => i.status === 'ready').length)}
    </button>
    <button type="button" onclick={onclose}>{t('openAnother')}</button>
  </aside>
</div>

<style>
  .items {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding: 0;
    list-style: none;
  }

  .items button {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 4.5rem;
    padding: 0.25rem 0.5rem;
  }

  .items button.current {
    border-color: var(--accent);
    font-weight: bold;
  }
</style>
