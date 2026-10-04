<script lang="ts">
  let { accept, onfiles }: { accept: string; onfiles: (files: File[]) => void } = $props()

  let over = $state(false)

  function drop(e: DragEvent) {
    e.preventDefault()
    over = false
    if (e.dataTransfer?.files.length) onfiles([...e.dataTransfer.files])
  }
</script>

<label
  class="zone"
  class:over
  ondragover={(e) => {
    e.preventDefault()
    over = true
  }}
  ondragleave={() => (over = false)}
  ondrop={drop}
>
  <input
    type="file"
    {accept}
    multiple
    onchange={(e) => {
      const input = e.currentTarget
      if (input.files?.length) onfiles([...input.files])
      input.value = ''
    }}
  />
  <strong>Choose a photo or video</strong>
  <span>or drop it here</span>
</label>

<style>
  .zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 3rem 1rem;
    border: 2px dashed var(--muted);
    border-radius: 0.75rem;
    cursor: pointer;
    text-align: center;
  }

  .zone.over,
  .zone:focus-within {
    border-color: var(--accent);
  }

  input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }

  span {
    color: var(--muted);
  }
</style>
