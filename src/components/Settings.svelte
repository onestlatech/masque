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
    gap: 0.75rem;
    /* Fieldsets refuse to shrink below their content by default. */
    min-width: 0;
    border: 2px solid var(--fg);
  }

  /* Label text on its own row, control and value below: fits narrow sidebars and long translations. */
  label {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0.25rem 0.5rem;
  }

  label > :is(select, input) {
    grid-row: 2;
    grid-column: 1;
    min-width: 0;
  }

  label > select {
    grid-column: 1 / -1;
  }

  label > output {
    grid-row: 2;
    grid-column: 2;
  }

  label.inline {
    display: flex;
  }

  .warning {
    margin: 0;
    color: var(--accent-strong);
  }

  .help {
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted);
  }
</style>
