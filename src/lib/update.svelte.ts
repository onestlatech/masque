/** Notices when a new version of the service worker waits to replace the one serving this page. */
export class Updater {
  available = $state(false);
  #requested = false;

  constructor(
    private container: ServiceWorkerContainer,
    private registration: ServiceWorkerRegistration,
    private reload = () => location.reload(),
  ) {
    container.addEventListener("controllerchange", () => {
      // Without a request from this page, another tab applied the update and this page runs outdated code.
      if (this.#requested) this.reload();
      else this.available = true;
    });
    // The browser checks for updates on navigation: one may have started before registration.
    if (registration.waiting) this.#found();
    this.#track(registration.installing);
    registration.addEventListener("updatefound", () =>
      this.#track(registration.installing),
    );
  }

  #track(worker: ServiceWorker | null) {
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed") this.#found();
    });
  }

  #found() {
    // The first install has no controller to replace.
    if (this.container.controller) this.available = true;
  }

  apply() {
    const waiting = this.registration.waiting;
    if (!waiting) return this.reload();
    this.#requested = true;
    waiting.postMessage("skipWaiting");
  }
}
