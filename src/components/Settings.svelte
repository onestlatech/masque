<script lang="ts">
  import { formatNumber, t } from '../lib/i18n.svelte.ts'
  import type { MaskOptions } from '../lib/anonymize/render.ts'
  import { MIN_THRESHOLD } from '../lib/faces.ts'

  let { options = $bindable(), threshold = $bindable() }: { options: MaskOptions; threshold: number } = $props()
</script>

<fieldset>
  <legend>{t('masking')}</legend>

  <label>
    {t('style')}
    <select bind:value={options.mode}>
      <option value="solid">{t('solid')}</option>
      <option value="mosaic">{t('mosaic')}</option>
      <option value="blur">{t('blur')}</option>
    </select>
  </label>
  {#if options.mode !== 'solid'}
    <p class="warning" role="note">{t('weakWarning')}</p>
  {/if}

  <label>
    {t('threshold')}
    <input type="range" min={MIN_THRESHOLD} max="0.9" step="0.05" bind:value={threshold} aria-describedby="threshold-help" />
    <output>{formatNumber(threshold, 2)}</output>
  </label>
  <p id="threshold-help" class="help">{t('thresholdHelp')}</p>

  <label>
    {t('maskSize')}
    <input type="range" min="1" max="2" step="0.1" bind:value={options.maskScale} />
    <output>{formatNumber(options.maskScale, 1)}×</output>
  </label>

  <label class="inline">
    <input type="checkbox" bind:checked={options.ellipse} />
    {t('oval')}
  </label>
</fieldset>

<style>
  fieldset {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border: 1px solid var(--muted);
    border-radius: 0.5rem;
  }

  label {
    display: grid;
    grid-template-columns: 9rem 1fr 3rem;
    align-items: center;
    gap: 0.5rem;
  }

  label.inline {
    display: flex;
  }

  .warning {
    margin: 0;
    color: var(--accent);
  }

  .help {
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted);
  }
</style>
