import { expect, test } from "vitest";
import { History } from "../../src/lib/history.svelte.ts";

function setup() {
  const history = new History();
  const state = { faces: [{ id: 1 }], mode: "solid" };
  const faces = history.track(
    () => state.faces,
    (v) => (state.faces = v),
  );
  history.track(
    () => state.mode,
    (v) => (state.mode = v),
  );
  return { history, state, faces };
}

test("undoes and redoes one step per commit", () => {
  const { history, state } = setup();
  state.faces.push({ id: 2 });
  state.mode = "blur";
  history.commit();
  state.faces = [];
  history.commit();

  history.undo();
  expect(state).toEqual({ faces: [{ id: 1 }, { id: 2 }], mode: "blur" });
  history.undo();
  expect(state).toEqual({ faces: [{ id: 1 }], mode: "solid" });
  expect(history.canUndo).toBe(false);
  history.redo();
  history.redo();
  expect(state).toEqual({ faces: [], mode: "blur" });
  expect(history.canRedo).toBe(false);
});

test("skips commits that change nothing", () => {
  const { history, state } = setup();
  state.faces = [{ id: 1 }];
  history.commit();
  expect(history.canUndo).toBe(false);
});

test("undo records pending changes first", () => {
  const { history, state } = setup();
  state.mode = "blur";
  history.undo();
  expect(state.mode).toBe("solid");
  history.redo();
  expect(state.mode).toBe("blur");
});

test("a new change discards what was undone", () => {
  const { history, state } = setup();
  state.mode = "blur";
  history.commit();
  history.undo();
  state.mode = "emoji";
  history.redo();
  expect(state.mode).toBe("emoji");
  expect(history.canRedo).toBe(false);
});

test("rebased changes are not steps", () => {
  const { history, state, faces } = setup();
  state.faces = [{ id: 3 }];
  faces.rebase();
  state.mode = "blur";
  history.commit();
  history.undo();
  expect(state).toEqual({ faces: [{ id: 3 }], mode: "solid" });
});

test("restored values do not share objects with the history", () => {
  const { history, state } = setup();
  state.faces = [];
  history.commit();
  history.undo();
  state.faces[0].id = 42;
  history.commit();
  history.undo();
  expect(state.faces).toEqual([{ id: 1 }]);
});
