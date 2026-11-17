<script lang="ts">
  import { t } from "../lib/i18n.svelte.ts";
  import type { History } from "../lib/history.svelte.ts";

  let { history }: { history: History } = $props();

  const mac = /Mac|iPhone|iPad/.test(navigator.userAgent);

  function keydown(e: KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === "z" && !e.shiftKey) history.undo();
    else if (key === "y" || (key === "z" && e.shiftKey)) history.redo();
    else return;
    e.preventDefault();
  }
</script>

<svelte:window onkeydown={keydown} />

<div role="group" aria-label={t("history")}>
  <button
    type="button"
    disabled={!history.canUndo}
    aria-keyshortcuts="Control+Z Meta+Z"
    title={mac ? "⌘Z" : "Ctrl+Z"}
    onclick={() => history.undo()}>↶ {t("undo")}</button
  >
  <button
    type="button"
    disabled={!history.canRedo}
    aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
    title={mac ? "⇧⌘Z" : "Ctrl+Y"}
    onclick={() => history.redo()}>↷ {t("redo")}</button
  >
</div>

<style>
  div {
    display: flex;
    gap: 0.5rem;
  }

  button {
    flex: 1;
  }
</style>
