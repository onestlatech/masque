<script lang="ts">
  import { errorMessage, t } from "../lib/i18n.svelte.ts";
  import { onDestroy, untrack } from "svelte";
  import Editor from "./Editor.svelte";
  import Progress from "./Progress.svelte";
  import Settings from "./Settings.svelte";
  import UndoRedo from "./UndoRedo.svelte";
  import { History } from "../lib/history.svelte.ts";
  import type { Box } from "../lib/anonymize/render.ts";
  import type { Engine } from "../lib/detect/client.ts";
  import type { Face } from "../lib/faces.ts";
  import { download } from "../lib/media/image.ts";
  import type { Analysis } from "../lib/media/video.ts";
  import {
    currentWatermark,
    settings,
    trackSettings,
    watermark,
  } from "../lib/settings.svelte.ts";
  import {
    boxAt,
    buildTracks,
    newTrack,
    setKeyframe,
    trackerOptions,
    type Track,
  } from "../lib/track/tracker.ts";

  let {
    file,
    worker,
    onerror,
    onclose,
  }: {
    file: File;
    worker: Engine;
    onerror: (message: string) => void;
    onclose: () => void;
  } = $props();

  let video = $state<number>();
  let analysis = $state.raw<Analysis>();
  let tracks = $state<Track[]>([]);
  let frame = $state(0);
  let bitmap = $state.raw<ImageBitmap>();
  let bitmapFrame = $state<number>();
  let selected = $state<number>();
  let task = $state<{
    label: string;
    fraction: number;
    controller: AbortController;
  }>();

  const history = new History();
  trackSettings(history);
  /** Restored with the tracks, so that undoing a threshold change does not rebuild them. */
  let builtFor: number | undefined;
  const trackedTracks = history.track(
    () => ({ tracks, builtFor }),
    (v) => {
      tracks = v.tracks;
      builtFor = v.builtFor;
    },
  );

  const last = $derived(analysis ? analysis.timestamps.length - 1 : 0);
  const selectedTrack = $derived(tracks.find((t) => t.id === selected));
  // Masks follow the frame on screen, which lags behind the slider while the next frame decodes.
  const shownFrame = $derived(bitmapFrame ?? frame);

  async function run<T>(
    label: string,
    work: (o: {
      signal: AbortSignal;
      onProgress: (f: number) => void;
    }) => Promise<T>,
  ) {
    const controller = new AbortController();
    task = { label, fraction: 0, controller };
    try {
      return await work({
        signal: controller.signal,
        onProgress: (f) => task && (task.fraction = f),
      });
    } finally {
      task = undefined;
    }
  }

  $effect(() => {
    let id: number | undefined;
    let cancelled = false;
    (async () => {
      try {
        const info = await worker.call("open", { file });
        id = info.video;
        if (cancelled) {
          await worker.call("close", { video: id });
          return;
        }
        video = id;
        analysis = await run(t("lookingForFaces"), (o) =>
          worker.call("analyze", { video: info.video }, o),
        );
      } catch (e) {
        if (cancelled) return;
        onerror(t("cannotProcess", file.name, errorMessage(e)));
        onclose();
      }
    })();
    return () => {
      cancelled = true;
      task?.controller.abort();
      if (id !== undefined)
        worker
          .call("close", { video: id })
          .catch((e) =>
            onerror(t("cannotProcess", file.name, errorMessage(e))),
          );
    };
  });

  // Automatic tracks follow the threshold; tracks the user touched are kept as they are.
  $effect(() => {
    if (!analysis || settings.threshold === builtFor) return;
    const first = builtFor === undefined;
    builtFor = settings.threshold;
    const auto = buildTracks(
      analysis.detections,
      builtFor,
      trackerOptions(analysis.fps),
    );
    tracks = [...untrack(() => tracks.filter((t) => t.manual)), ...auto];
    if (first) trackedTracks.rebase();
  });

  $effect(() => {
    if (video === undefined || !analysis) return;
    let stale = false;
    const controller = new AbortController();
    const requestedFrame = frame;
    const timestamp = analysis.timestamps[requestedFrame];
    (async () => {
      try {
        const b = await worker.call(
          "frame",
          { video, timestamp },
          { signal: controller.signal },
        );
        if (stale) return b.close();
        bitmap?.close();
        bitmap = b;
        bitmapFrame = requestedFrame;
      } catch (e) {
        if (!stale) onerror(t("cannotProcess", file.name, errorMessage(e)));
      }
    })();
    return () => {
      stale = true;
      controller.abort();
    };
  });

  onDestroy(() => bitmap?.close());

  const faces = $derived(
    tracks.flatMap((t): Face[] => {
      const b = boxAt(t, shownFrame);
      return b ? [{ ...b, id: t.id, score: t.score, manual: t.manual }] : [];
    }),
  );

  function add(box: Box) {
    // New masks cover the whole video; trim them with "Starts here" and "Ends here".
    const t = newTrack(shownFrame, box, 0, last, 1, true);
    tracks.push(t);
    return t.id;
  }

  async function save() {
    try {
      const w = currentWatermark();
      // The worker closes its copy once done.
      const copy = w && { ...w, image: await createImageBitmap(w.image) };
      const out = await run(t("exporting"), (o) =>
        worker.call(
          "render",
          {
            video: video!,
            timestamps: analysis!.timestamps,
            tracks: $state.snapshot(tracks),
            options: $state.snapshot(settings.options),
            watermark: copy,
            discardAudio: settings.discardAudio,
          },
          { ...o, transfer: copy ? [copy.image] : [] },
        ),
      );
      download(out, out.name);
    } catch (e) {
      onerror(t("exportFailed", errorMessage(e)));
    }
  }

  const time = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
</script>

<div class="workspace">
  <section aria-label={t("preview")}>
    {#if bitmap}
      <Editor
        {bitmap}
        {faces}
        options={settings.options}
        watermark={watermark.bitmap}
        bind:placement={settings.watermark}
        bind:selected
        onadd={add}
        onchange={(id, box) =>
          setKeyframe(
            tracks.find((t) => t.id === id)!,
            shownFrame,
            box,
          )}
        onremove={(id) => (tracks = tracks.filter((t) => t.id !== id))}
        oncommit={() => history.commit()}
      />
    {/if}
    {#if analysis}
      <div class="timeline">
        <button
          type="button"
          aria-label={t("previousFrame")}
          onclick={() => (frame = Math.max(0, frame - 1))}>‹</button
        >
        <input
          type="range"
          min="0"
          max={last}
          bind:value={frame}
          aria-label={t("frame")}
        />
        <button
          type="button"
          aria-label={t("nextFrame")}
          onclick={() => (frame = Math.min(last, frame + 1))}>›</button
        >
        <output>{time(analysis.timestamps[shownFrame])}</output>
      </div>
    {/if}
    {#if selectedTrack}
      <div class="range" role="group" aria-label={t("selectedMask")}>
        <span>{t("selectedRange", selectedTrack.start, selectedTrack.end)}</span
        >
        <button
          type="button"
          onclick={() => {
            selectedTrack.start = Math.min(shownFrame, selectedTrack.end);
            history.commit();
          }}>{t("startsHere")}</button
        >
        <button
          type="button"
          onclick={() => {
            selectedTrack.end = Math.max(shownFrame, selectedTrack.start);
            history.commit();
          }}>{t("endsHere")}</button
        >
      </div>
    {/if}
  </section>
  <aside>
    {#if task}
      <Progress
        label={task.label}
        fraction={task.fraction}
        oncancel={() => task?.controller.abort()}
      />
    {/if}
    <UndoRedo {history} />
    <Settings onchange={() => history.commit()} />
    <label class="audio">
      <input
        type="checkbox"
        bind:checked={settings.discardAudio}
        onchange={() => history.commit()}
      />
      {t("removeSound")}
    </label>
    <button
      type="button"
      class="primary"
      onclick={save}
      disabled={!analysis || !!task}>{t("download")}</button
    >
    <button type="button" onclick={onclose}>{t("openAnother")}</button>
  </aside>
</div>

<style>
  .timeline,
  .range {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.5rem;
  }

  .timeline input {
    flex: 1;
  }

  .range span {
    flex: 1;
  }

  .audio {
    display: flex;
    gap: 0.5rem;
  }
</style>
