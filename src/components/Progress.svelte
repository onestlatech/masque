<script lang="ts">
  let { label, fraction, oncancel }: { label: string; fraction: number; oncancel: () => void } = $props()

  const started = performance.now()

  const remaining = $derived.by(() => {
    if (fraction < 0.02) return
    const seconds = ((performance.now() - started) / 1000) * ((1 - fraction) / fraction)
    return seconds < 60 ? `${Math.ceil(seconds)} s left` : `${Math.ceil(seconds / 60)} min left`
  })
</script>

<div class="progress" role="status">
  <span>{label} {Math.floor(fraction * 100)}%{remaining ? ` · ${remaining}` : ''}</span>
  <progress value={fraction}></progress>
  <button type="button" onclick={oncancel}>Cancel</button>
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
