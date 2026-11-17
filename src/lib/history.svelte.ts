import { flushSync, untrack } from "svelte";

const LIMIT = 100;

const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" &&
  v !== null &&
  [Object.prototype, null].includes(Object.getPrototypeOf(v));

/** Deep copy of arrays and plain objects (reactive proxies included); Blobs and bitmaps are shared. */
function clone<T>(v: T): T {
  if (Array.isArray(v)) return v.map(clone) as T;
  if (isPlain(v))
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, clone(x)]),
    ) as T;
  return v;
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a))
    return (
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((x, i) => equal(x, b[i]))
    );
  if (!isPlain(a) || !isPlain(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((k) => equal(a[k], b[k]))
  );
}

interface Change {
  value: Tracked<unknown>;
  before: unknown;
  after: unknown;
}

/** A value whose changes are recorded, compared with its state at the last step. */
export class Tracked<T> {
  #last: T;

  constructor(
    private get: () => T,
    private set: (value: T) => void,
  ) {
    this.#last = this.#read();
  }

  #read = () => untrack(() => clone(this.get()));

  /** Takes the current state as the reference: for changes that the user did not make, such as detection results. */
  rebase() {
    this.#last = this.#read();
  }

  diff(): Change | undefined {
    const now = this.#read();
    if (equal(now, this.#last)) return;
    const change = { value: this, before: this.#last, after: now };
    this.#last = now;
    return change as Change;
  }

  restore(value: T) {
    this.#last = value;
    this.set(clone(value));
  }
}

/** Undo and redo for the values it tracks. A step groups everything that changed since the previous one. */
export class History {
  #tracked: Tracked<unknown>[] = [];
  #done = $state.raw<Change[][]>([]);
  #undone = $state.raw<Change[][]>([]);

  readonly canUndo = $derived(this.#done.length > 0);
  readonly canRedo = $derived(this.#undone.length > 0);

  track<T>(get: () => T, set: (value: T) => void): Tracked<T> {
    const t = new Tracked(get, set);
    this.#tracked.push(t as Tracked<unknown>);
    return t;
  }

  /** Records a step, if anything changed. Call it once a gesture or an edit is over. */
  commit() {
    // Effects that follow the change, such as tracks rebuilt for a new threshold, belong to the same step.
    flushSync();
    const step = this.#tracked.flatMap((t) => t.diff() ?? []);
    if (!step.length) return;
    this.#done = [...this.#done, step].slice(-LIMIT);
    this.#undone = [];
  }

  undo() {
    // Changes not committed yet are the last step.
    this.commit();
    const step = this.#done.at(-1);
    if (!step) return;
    this.#done = this.#done.slice(0, -1);
    for (const c of step.toReversed()) c.value.restore(c.before);
    this.#undone = [...this.#undone, step];
  }

  redo() {
    // New changes discard what was undone.
    this.commit();
    const step = this.#undone.at(-1);
    if (!step) return;
    this.#undone = this.#undone.slice(0, -1);
    for (const c of step) c.value.restore(c.after);
    this.#done = [...this.#done, step];
  }

  /** Forgets every step. */
  clear() {
    this.#done = [];
    this.#undone = [];
    for (const t of this.#tracked) t.rebase();
  }
}
