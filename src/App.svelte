<script lang="ts">
  import { i18n, setLocale, t, type Locale } from './lib/i18n.svelte.ts'
  import Batch from './components/Batch.svelte'
  import DropZone from './components/DropZone.svelte'
  import Photo from './components/Photo.svelte'
  import Video from './components/Video.svelte'
  import { defaultMaskOptions, type MaskOptions } from './lib/anonymize/render.ts'
  import { Engine } from './lib/detect/client.ts'
  import type { Backend } from './lib/detect/detector.ts'
  import fist from './assets/brand/fist.png'
  import offensive from './assets/brand/offensive.png'

  const worker = new Engine()

  const CREDITS = [
    { name: 'CenterFace', url: 'https://github.com/Star-Clouds/CenterFace', license: 'MIT', role: 'creditCenterface' },
    { name: 'deface', url: 'https://github.com/ORB-HD/deface', license: 'MIT', role: 'creditDeface' },
    { name: 'ONNX Runtime Web', url: 'https://onnxruntime.ai', license: 'MIT', role: 'creditOnnx' },
    { name: 'Mediabunny', url: 'https://mediabunny.dev', license: 'MPL-2.0', role: 'creditMediabunny' },
    { name: 'Svelte', url: 'https://svelte.dev', license: 'MIT', role: 'creditSvelte' },
    { name: 'fflate', url: 'https://github.com/101arrowz/fflate', license: 'MIT', role: 'creditFflate' },
    { name: 'IBM Plex Mono', url: 'https://github.com/IBM/plex', license: 'OFL-1.1', role: 'creditPlex' },
  ] as const

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
    <h1><img src={fist} alt="" width="64" height="64" />Masque</h1>
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

  <p class="disclaimer">{t('warning')}</p>

  <footer>
    <section aria-labelledby="about">
      <h2 id="about">{t('about')}</h2>
      <p>{t('aboutText')}</p>
    </section>

    <section aria-labelledby="created-by">
      <h2 id="created-by">{t('createdBy')}</h2>
      <ul class="orgs">
        <li>
          <a href="https://onestla.tech" target="_blank" rel="noopener noreferrer" class="onestla">
            <img src={fist} alt="" width="48" height="48" /><span>on<b>est</b>la.tech<b>/</b></span>
          </a>
          <p>{t('onestlaDescription')}</p>
        </li>
        <li>
          <a href="https://offensive.eco" target="_blank" rel="noopener noreferrer">
            <img src={offensive} alt="L’Offensive" width="96" height="96" />
          </a>
          <p>{t('offensiveDescription')}</p>
        </li>
      </ul>
    </section>

    <section aria-labelledby="credits">
      <h2 id="credits">{t('credits')}</h2>
      <ul class="credits">
        {#each CREDITS as c (c.name)}
          <li>
            <a href={c.url} target="_blank" rel="noopener noreferrer">{c.name}</a>: {t(c.role)} ({c.license})
          </li>
        {/each}
      </ul>
    </section>

    <div class="meta">
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
    </div>
  </footer>
</main>

<style>
  main {
    --gutter: 2rem;
    max-width: 76rem;
    min-height: 100vh;
    margin: 0 auto;
    padding: 0 var(--gutter) 1.5rem;
    background: var(--surface);
  }

  @media (max-width: 40rem) {
    main {
      --gutter: 1rem;
    }
  }

  header {
    text-align: center;
  }

  h1 {
    margin: 0;
    padding: 1.5rem 0 0.5rem;
    font-size: 3rem;
    font-weight: 400;
  }

  h1 img {
    height: 1em;
    width: auto;
    margin-right: 0.5em;
    vertical-align: -0.1em;
  }

  header p {
    margin-top: 0;
    color: var(--muted);
  }

  .error {
    color: var(--danger);
    font-weight: bold;
  }

  .disclaimer {
    margin: 2rem calc(-1 * var(--gutter)) 0;
    padding: 1rem var(--gutter);
    color: var(--accent-strong);
    font-weight: bold;
    background: var(--tint);
  }

  footer {
    font-size: 0.875rem;
  }

  h2 {
    margin: 2rem 0 0.5rem;
    font-size: 1.25rem;
  }

  h2::after {
    content: '';
    display: block;
    width: 4rem;
    margin-top: 0.25rem;
    border-top: 3px solid var(--accent);
  }

  ul {
    padding: 0;
    list-style: none;
  }

  .orgs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1.5rem;
  }

  .orgs a {
    display: inline-flex;
    align-items: center;
    min-height: 96px;
    color: inherit;
    text-decoration: none;
  }

  .onestla {
    gap: 0.5rem;
    font-size: 1.5rem;
  }

  .onestla img {
    width: 48px;
    height: 48px;
  }

  .orgs p {
    margin: 0.25rem 0 0;
    color: var(--muted);
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 2rem;
    align-items: center;
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid var(--muted);
    color: var(--muted);
  }

  .meta p {
    margin: 0;
  }
</style>
