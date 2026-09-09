import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

/**
 * The console shell mounts the command palette, which needs a Next router.
 * Recording the pushes rather than discarding them lets a test assert where a
 * command actually navigates, instead of only that it did not throw.
 */
export const routerPushes: string[] = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (href: string) => {
      routerPushes.push(href);
    },
    replace: (href: string) => {
      routerPushes.push(href);
    },
    back: () => {},
    forward: () => {},
    refresh: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));


/**
 * jsdom's Storage implementation varies between versions, and the production
 * code deliberately guards every access. A plain in-memory Storage keeps the
 * tests deterministic and lets us spy on the prototype to simulate a browser
 * that denies storage.
 */
class MemoryStorage implements Storage {
  #map = new Map<string, string>();

  get length(): number {
    return this.#map.size;
  }

  clear(): void {
    this.#map.clear();
  }

  getItem(key: string): string | null {
    return this.#map.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#map.set(key, String(value));
  }
}

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: new MemoryStorage(),
});

if (typeof HTMLDialogElement !== "undefined") {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
  }
}

if (typeof HTMLMediaElement !== "undefined") {
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.pause = () => {};
  HTMLMediaElement.prototype.load = () => {};
}


/**
 * jsdom does not implement matchMedia. Default to "no preference" so reveal
 * motion is exercised, and let a test override it to assert the reduced
 * motion path.
 */
export function setReducedMotion(reduce: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

/**
 * jsdom has no IntersectionObserver. Without this, reveal-on-scroll code takes
 * its "observer unavailable" branch in every test and the real behaviour is
 * never exercised.
 */
export const observed: {
  callback: IntersectionObserverCallback;
  elements: Element[];
}[] = [];

class TestIntersectionObserver implements IntersectionObserver {
  root = null;
  rootMargin = "";
  thresholds: readonly number[] = [];
  #entry: { callback: IntersectionObserverCallback; elements: Element[] };

  constructor(callback: IntersectionObserverCallback) {
    this.#entry = { callback, elements: [] };
    observed.push(this.#entry);
  }

  observe(element: Element): void {
    this.#entry.elements.push(element);
  }

  unobserve(element: Element): void {
    this.#entry.elements = this.#entry.elements.filter((e) => e !== element);
  }

  disconnect(): void {
    this.#entry.elements = [];
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

/** Fire a callback for every observed element with the given geometry. */
export function fireIntersection(options: { isIntersecting: boolean; top: number }): void {
  for (const entry of [...observed]) {
    const elements = [...entry.elements];
    if (elements.length === 0) continue;
    entry.callback(
      elements.map((target) => ({
        target,
        isIntersecting: options.isIntersecting,
        boundingClientRect: { top: options.top } as DOMRectReadOnly,
        intersectionRatio: options.isIntersecting ? 1 : 0,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: null,
        time: 0,
      })) as unknown as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
  }
}

beforeEach(() => {
  routerPushes.length = 0;
  window.localStorage.clear();
  setReducedMotion(false);
  observed.length = 0;
  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: TestIntersectionObserver,
  });
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: TestIntersectionObserver,
  });
});

afterEach(() => {
  cleanup();
});
