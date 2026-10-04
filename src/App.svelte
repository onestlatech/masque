<script lang="ts">
  import DropZone from './components/DropZone.svelte'
  import Editor from './components/Editor.svelte'
  import Settings from './components/Settings.svelte'
  import { defaultMaskOptions, type MaskOptions } from './lib/anonymize/render.ts'
  import { DetectorClient } from './lib/detect/client.ts'
  import type { Backend } from './lib/detect/detector.ts'
  import { fromDetection, MIN_THRESHOLD, visible, type Face } from './lib/faces.ts'
  import { download, exportImage, loadImage, outputName, outputType } from './lib/media/image.ts'

  const detector = new DetectorClient()

  let backend = $state<Backend>()
  let error = $state<string>()
  let status = $state<string>()
  let options = $state<MaskOptions>({ ...defaultMaskOptions })
  let threshold = $state(0.2)
  let image = $state.raw<{ file: File; bitmap: ImageBitmap }>()
  let faces = $state<Face[]>([])

  detector.init().then(
    (b) => (backend = b),
    (e: Error) => (error = `The face detector could not start: ${e.message}`),
  )

  async function open([file]: File[]) {
    error = undefined
    image?.bitmap.close()
    image = undefined
    faces = []

    let bitmap: ImageBitmap
    try {
      bitmap = await loadImage(file)
    } catch {
      error = `Your browser cannot open “${file.name}”. Convert it to JPEG or PNG and try again.`
      return
    }
    image = { file, bitmap }
    status = 'Looking for faces…'
    try {
      const found = await detector.detect(await createImageBitmap(bitmap), MIN_THRESHOLD)
      faces = found.map(fromDetection)
      status = undefined
    } catch (e) {
      status = undefined
      error = `Face detection failed: ${(e as Error).message}. You can still add masks by hand.`
    }
  }

  async function save() {
    if (!image) return
    const type = outputType(image.file.type)
    const blob = await exportImage(image.bitmap, $state.snapshot(visible(faces, threshold)), $state.snapshot(options), type)
    download(blob, outputName(type))
  }
</script>

<main>
  <header>
    <h1>Masque</h1>
    <p>Hide faces in photos and videos. Everything runs on your device: your files are never uploaded.</p>
  </header>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  {#if image}
    <div class="workspace">
      <section aria-label="Preview">
        {#if status}
          <p role="status">{status}</p>
        {/if}
        {#key image}
          <Editor bitmap={image.bitmap} bind:faces {threshold} {options} />
        {/key}
      </section>
      <aside>
        <Settings bind:options bind:threshold />
        <button type="button" class="primary" onclick={save} disabled={!!status}>Download</button>
        <button type="button" onclick={() => open([])}>Start over</button>
      </aside>
    </div>
  {:else}
    <DropZone accept="image/*" onfiles={open} />
  {/if}

  <footer>
    <p>
      Check every photo before sharing it: automatic detection can miss faces. Clothing, tattoos, banners, and places can
      still identify people, and your phone may have backed up the original to the cloud.
    </p>
    {#if backend}
      <p class="backend">Detection runs on your {backend === 'webgpu' ? 'GPU (WebGPU)' : 'CPU (WebAssembly)'}.</p>
    {/if}
  </footer>
</main>

<style>
  main {
    max-width: 72rem;
    margin: 0 auto;
    padding: 1rem;
  }

  header p,
  footer {
    color: var(--muted);
  }

  .workspace {
    display: grid;
    grid-template-columns: 1fr 20rem;
    gap: 1rem;
  }

  @media (max-width: 48rem) {
    .workspace {
      grid-template-columns: 1fr;
    }
  }

  aside {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  button {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    border: 1px solid var(--muted);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
    font-weight: bold;
  }

  .error {
    color: var(--accent);
  }

  footer {
    margin-top: 2rem;
    font-size: 0.875rem;
  }
</style>
