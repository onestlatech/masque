import { defaultMaskOptions, type MaskOptions } from "./anonymize/render.ts";
import {
  defaultPlacement,
  type Placement,
  type Watermark,
} from "./watermark.ts";

export interface Settings {
  options: MaskOptions;
  threshold: number;
  discardAudio: boolean;
  watermark: Placement;
}

const defaults: Settings = {
  options: defaultMaskOptions,
  threshold: 0.2,
  discardAudio: false,
  watermark: defaultPlacement,
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
  setWatermark(undefined);
}

/** In IndexedDB: localStorage only holds a few megabytes of strings. */
export const watermark = $state<{ image?: Blob; bitmap?: ImageBitmap }>({});

/** Larger watermarks only waste memory: they never cover more than half of a 4K frame's height. */
const MAX_WATERMARK = 2048;
const WATERMARK_KEY = "watermark";
let generation = 0;

/** Rejects when the browser cannot decode the image. */
export async function setWatermark(image: Blob | undefined, save = true) {
  const current = ++generation;
  let bitmap: ImageBitmap | undefined;
  if (image) {
    bitmap = await createImageBitmap(image);
    const k = MAX_WATERMARK / Math.max(bitmap.width, bitmap.height);
    if (k < 1) {
      const large = bitmap;
      bitmap = await createImageBitmap(large, {
        resizeWidth: Math.max(1, Math.round(large.width * k)),
        resizeHeight: Math.max(1, Math.round(large.height * k)),
        resizeQuality: "high",
      });
      large.close();
    }
  }
  if (current !== generation) return bitmap?.close();
  watermark.bitmap?.close();
  watermark.image = image;
  watermark.bitmap = bitmap;
  if (save) persist(image, current);
}

async function persist(image: Blob | undefined, current: number) {
  try {
    // WebKit cannot store Blobs in private browsing.
    const saved = image && {
      type: image.type,
      bytes: await image.arrayBuffer(),
    };
    if (current !== generation) return;
    await store("readwrite", (s) =>
      saved ? s.put(saved, WATERMARK_KEY) : s.delete(WATERMARK_KEY),
    );
  } catch {
    // Not remembered; the watermark is gone next time.
  }
}

export const currentWatermark = (): Watermark | undefined =>
  watermark.bitmap && {
    image: watermark.bitmap,
    placement: $state.snapshot(settings.watermark),
  };

function store(
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("masque", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("files");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("files", mode);
      const request = run(tx.objectStore("files"));
      tx.oncomplete = () => {
        db.close();
        resolve(request.result);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

async function loadWatermark() {
  try {
    const saved = await store("readonly", (s) => s.get(WATERMARK_KEY));
    const { type, bytes } = (saved ?? {}) as {
      type?: string;
      bytes?: ArrayBuffer;
    };
    // The user may have picked one while it loaded.
    if (bytes && !generation)
      await setWatermark(new Blob([bytes], { type }), false);
  } catch {
    // Storage unavailable or image no longer decodable: start without a watermark.
  }
}

loadWatermark();
