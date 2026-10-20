import { defaultMaskOptions, type MaskOptions } from "./anonymize/render.ts";

export interface Settings {
  options: MaskOptions;
  threshold: number;
  discardAudio: boolean;
}

const defaults: Settings = {
  options: defaultMaskOptions,
  threshold: 0.2,
  discardAudio: false,
};

const STORAGE_KEY = "masque.settings";

const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Keeps saved values only where their type matches the default: fields added or changed since then get the default. */
function merge<T>(fallback: T, saved: unknown): T {
  if (isPlain(fallback))
    return Object.fromEntries(
      Object.entries(fallback).map(([k, v]) => [
        k,
        merge(v, isPlain(saved) ? saved[k] : undefined),
      ]),
    ) as T;
  return typeof saved === typeof fallback ? (saved as T) : fallback;
}

function load(): Settings {
  try {
    return merge(defaults, JSON.parse(localStorage.getItem(STORAGE_KEY)!));
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
    return merge(defaults, undefined);
  }
}

export const settings = $state(load());

$effect.root(() => {
  $effect(() => {
    const json = JSON.stringify(settings);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {
      // Not remembered; the defaults apply next time.
    }
  });
});

export function resetSettings() {
  Object.assign(settings, merge(defaults, undefined));
}
