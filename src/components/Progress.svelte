<script lang="ts">
  import { formatPercent, t } from '../lib/i18n.svelte.ts'
  let { label, fraction, oncancel }: { label: string; fraction: number; oncancel: () => void } = $props()

  const started = performance.now()

  const remaining = $derived.by(() => {
    if (fraction < 0.02) return
    const seconds = ((performance.now() - started) / 1000) * ((1 - fraction) / fraction)
    return seconds < 60 ? t('secondsLeft', Math.ceil(seconds)) : t('minutesLeft', Math.ceil(seconds / 60))
  })
</script>

<div class="progress" role="status">
  <span>{label} {formatPercent(fraction)}{remaining ? ` · ${remaining}` : ''}</span>
  <progress value={fraction}></progress>
  <button type="button" onclick={oncancel}>{t('cancel')}</button>
</div>

<style>
  .progress {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
    align-items: center;
  }

  span {
    grid-column: 1 / -1;
  }

  progress {
    width: 100%;
  }
</style>
