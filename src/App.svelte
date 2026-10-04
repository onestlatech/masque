<script lang="ts">
  import DropZone from './components/DropZone.svelte'
  import Photo from './components/Photo.svelte'
  import Video from './components/Video.svelte'
  import { defaultMaskOptions, type MaskOptions } from './lib/anonymize/render.ts'
  import { Engine } from './lib/detect/client.ts'
  import type { Backend } from './lib/detect/detector.ts'

  const worker = new Engine()

  let backend = $state<Backend>()
  let error = $state<string>()
  let options = $state<MaskOptions>({ ...defaultMaskOptions })
  let threshold = $state(0.2)
  let file = $state.raw<File>()

  worker.call('init', {}).then(
    (b) => (backend = b),
    (e: Error) => (error = `The face detector could not start: ${e.message}`),
  )

  function open([f]: File[]) {
    error = undefined
    file = f
  }

  const onerror = (message: string) => (error = message)
  const onclose = () => (file = undefined)
</script>

<main>
  <header>
    <h1>Masque</h1>
    <p>Hide faces in photos and videos. Everything runs on your device: your files are never uploaded.</p>
  </header>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  {#if file}
    {#key file}
      {#if file.type.startsWith('video/')}
        <Video {file} {worker} bind:options bind:threshold {onerror} {onclose} />
      {:else}
        <Photo {file} {worker} bind:options bind:threshold {onerror} {onclose} />
      {/if}
    {/key}
  {:else}
    <DropZone accept="image/*,video/*" onfiles={open} />
  {/if}

  <footer>
    <p>
      Check everything before sharing: automatic detection can miss faces. Clothing, tattoos, banners, and places can
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

  .error {
    color: var(--accent);
  }

  footer {
    margin-top: 2rem;
    font-size: 0.875rem;
  }
</style>
