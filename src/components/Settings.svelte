<script lang="ts">
  import type { MaskOptions } from '../lib/anonymize/render.ts'
  import { MIN_THRESHOLD } from '../lib/faces.ts'

  let { options = $bindable(), threshold = $bindable() }: { options: MaskOptions; threshold: number } = $props()
</script>

<fieldset>
  <legend>Masking</legend>

  <label>
    Style
    <select bind:value={options.mode}>
      <option value="solid">Solid (safest)</option>
      <option value="mosaic">Mosaic</option>
      <option value="blur">Blur</option>
    </select>
  </label>
  {#if options.mode !== 'solid'}
    <p class="warning" role="note">Mosaic and blur leave some information behind. Use solid for the strongest protection.</p>
  {/if}

  <label>
    Sensitivity
    <input type="range" min={MIN_THRESHOLD} max="0.9" step="0.05" bind:value={threshold} aria-describedby="threshold-help" />
    <output>{threshold.toFixed(2)}</output>
  </label>
  <p id="threshold-help" class="help">Lower values catch more faces, along with more false positives.</p>

  <label>
    Mask size
    <input type="range" min="1" max="2" step="0.1" bind:value={options.maskScale} />
    <output>{options.maskScale.toFixed(1)}×</output>
  </label>

  <label class="inline">
    <input type="checkbox" bind:checked={options.ellipse} />
    Oval masks
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
    grid-template-columns: 7rem 1fr 3rem;
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
