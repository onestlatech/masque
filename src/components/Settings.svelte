<script lang="ts">
  import { formatNumber, t } from "../lib/i18n.svelte.ts";
  import { EMOJIS } from "../lib/anonymize/emojis.ts";
  import { MIN_THRESHOLD } from "../lib/faces.ts";
  import { resetSettings, settings } from "../lib/settings.svelte.ts";

  const options = $derived(settings.options);
</script>

<fieldset>
  <legend>{t("masking")}</legend>

  <label>
    {t("style")}
    <select bind:value={options.mode}>
      <option value="solid">{t("solid")}</option>
      <option value="emoji">{t("emoji")}</option>
      <option value="mosaic">{t("mosaic")}</option>
      <option value="blur">{t("blur")}</option>
    </select>
  </label>
  {#if options.mode === "solid"}
    <label class="inline">
      <input type="color" bind:value={options.color} />
      {t("color")}
    </label>
  {:else if options.mode === "emoji"}
    <fieldset class="emojis">
      <legend>{t("pickEmoji")}</legend>
      <div>
        {#each Object.entries(EMOJIS) as [emoji, color] (emoji)}
          <label>
            <input
              type="radio"
              name="emoji"
              value={emoji}
              bind:group={options.emoji}
              onchange={() => (options.emojiColor = color)}
            />
            <span>{emoji}</span>
          </label>
        {/each}
      </div>
    </fieldset>
    <label class="inline">
      <input type="color" bind:value={options.emojiColor} />
      {t("emojiColor")}
    </label>
  {/if}
  {#if options.mode === "mosaic" || options.mode === "blur"}
    <p class="warning" role="note">{t("weakWarning")}</p>
  {/if}

  <label>
    {t("threshold")}
    <input
      type="range"
      min={MIN_THRESHOLD}
      max="0.9"
      step="0.05"
      bind:value={settings.threshold}
      aria-describedby="threshold-help"
    />
    <output>{formatNumber(settings.threshold, 2)}</output>
  </label>
  <p id="threshold-help" class="help">{t("thresholdHelp")}</p>

  <label>
    {t("maskSize")}
    <input
      type="range"
      min="1"
      max="2"
      step="0.1"
      bind:value={options.maskScale}
    />
    <output>{formatNumber(options.maskScale, 1)}×</output>
  </label>

  <label class="inline">
    <input type="checkbox" bind:checked={options.ellipse} />
    {t("oval")}
  </label>

  <button type="button" onclick={resetSettings}>{t("resetSettings")}</button>
  <p class="help">{t("settingsSaved")}</p>
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

  input[type="color"] {
    width: 3rem;
    height: 1.75rem;
    padding: 0;
  }

  .emojis {
    padding: 0;
    margin: 0;
    border: 0;
  }

  .emojis legend {
    padding: 0;
    margin-bottom: 0.25rem;
  }

  /* Two and a half rows: the cut-off row shows that the list scrolls. */
  .emojis div {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    max-height: 6.5rem;
    overflow-y: auto;
  }

  .emojis label {
    display: block;
    position: relative;
  }

  /* Hidden but focusable: the emoji tile is the visible control. */
  .emojis input {
    position: absolute;
    opacity: 0;
  }

  .emojis span {
    display: block;
    padding: 0.125rem 0.25rem;
    font-size: 1.5rem;
    line-height: 1.2;
    border: 2px solid transparent;
  }

  .emojis input:checked + span {
    border-color: var(--accent);
  }

  .emojis input:focus-visible + span {
    outline: 2px solid var(--fg);
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
