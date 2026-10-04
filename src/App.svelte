<script lang="ts">
  import { i18n, setLocale, t, type Locale } from './lib/i18n.svelte.ts'
  import Batch from './components/Batch.svelte'
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
  let files = $state.raw<File[]>([])
  let offline = $state(false)

  navigator.serviceWorker?.ready.then(() => (offline = true))

  worker
    .call('init', {})
    .then(
      (b) => (backend = b),
      (e: Error) => (error = t('detectorFailed', e.message)),
    )
    // Precaching the model while the detector downloads it makes Chromium's HTTP cache fail one of the two.
    .finally(() => {
      if (import.meta.env.PROD && 'serviceWorker' in navigator)
        navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
    })

  function open(selected: File[]) {
    error = undefined
    if (selected.length > 1 && selected.some((f) => f.type.startsWith('video/'))) {
      error = t('oneVideo')
      return
    }
    files = selected
  }

  const onerror = (message: string) => (error = message)
  const onclose = () => (files = [])
</script>

<main>
  <header>
    <h1>Masque</h1>
    <p>{t('tagline')}</p>
  </header>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  {#if files.length}
    {#key files}
      {#if files.length > 1}
        <Batch {files} {worker} bind:options bind:threshold {onclose} />
      {:else if files[0].type.startsWith('video/')}
        <Video file={files[0]} {worker} bind:options bind:threshold {onerror} {onclose} />
      {:else}
        <Photo file={files[0]} {worker} bind:options bind:threshold {onerror} {onclose} />
      {/if}
    {/key}
  {:else}
    <DropZone accept="image/*,video/*" onfiles={open} />
  {/if}

  <footer>
    <p>{t('warning')}</p>
    {#if offline}
      <p>{t('offline')}</p>
    {/if}
    {#if backend}
      <p class="backend">{t(backend === 'webgpu' ? 'backendGpu' : 'backendCpu')}</p>
    {/if}
    <label>
      {t('language')}
      <select value={i18n.locale} onchange={(e) => setLocale(e.currentTarget.value as Locale)}>
        <option value="en" lang="en">English</option>
        <option value="fr" lang="fr">Français</option>
      </select>
    </label>
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
