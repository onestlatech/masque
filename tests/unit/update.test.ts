import { expect, test, vi } from "vitest";
import { Updater } from "../../src/lib/update.svelte.ts";

class FakeWorker extends EventTarget {
  state = "installing";
  postMessage = vi.fn();
  install() {
    this.state = "installed";
    this.dispatchEvent(new Event("statechange"));
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  find() {
    this.installing = new FakeWorker();
    this.dispatchEvent(new Event("updatefound"));
    return this.installing;
  }
}

function setup({ controlled = true, waiting = false, installing = false }) {
  const container = Object.assign(new EventTarget(), {
    controller: controlled ? {} : null,
  });
  const registration = new FakeRegistration();
  if (waiting) registration.waiting = new FakeWorker();
  if (installing) registration.installing = new FakeWorker();
  const reload = vi.fn();
  const updater = new Updater(
    container as unknown as ServiceWorkerContainer,
    registration as unknown as ServiceWorkerRegistration,
    reload,
  );
  return { container, registration, reload, updater };
}

test("reports an update found after registration", () => {
  const { registration, updater } = setup({});
  expect(updater.available).toBe(false);
  const worker = registration.find();
  expect(updater.available).toBe(false);
  worker.install();
  expect(updater.available).toBe(true);
});

test("reports updates found before registration", () => {
  expect(setup({ waiting: true }).updater.available).toBe(true);
  const { registration, updater } = setup({ installing: true });
  registration.installing!.install();
  expect(updater.available).toBe(true);
});

test("ignores the first install", () => {
  const { registration, updater } = setup({ controlled: false });
  registration.find().install();
  expect(updater.available).toBe(false);
});

test("activates the waiting worker, then reloads", () => {
  const { container, registration, reload, updater } = setup({
    waiting: true,
  });
  updater.apply();
  expect(registration.waiting!.postMessage).toHaveBeenCalledWith("skipWaiting");
  expect(reload).not.toHaveBeenCalled();
  container.dispatchEvent(new Event("controllerchange"));
  expect(reload).toHaveBeenCalledOnce();
});

test("keeps other tabs open when the update applies", () => {
  const { container, registration, reload, updater } = setup({});
  container.dispatchEvent(new Event("controllerchange"));
  expect(reload).not.toHaveBeenCalled();
  expect(updater.available).toBe(true);
  updater.apply();
  expect(registration.waiting).toBeNull();
  expect(reload).toHaveBeenCalledOnce();
});
