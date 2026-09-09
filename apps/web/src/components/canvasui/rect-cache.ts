export interface RectCache {
  readonly current: DOMRect;
  destroy: () => void;
}

export function createRectCache(element: Element): RectCache {
  if (typeof window === "undefined" || !element) {
    const dummy = {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
    return {
      get current() {
        return dummy;
      },
      destroy: () => {},
    };
  }

  let current = element.getBoundingClientRect();

  const refresh = () => {
    if (element && typeof element.getBoundingClientRect === "function") {
      current = element.getBoundingClientRect();
    }
  };

  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(refresh);
    observer.observe(element);
  }

  window.addEventListener("resize", refresh, { passive: true });
  window.addEventListener("scroll", refresh, {
    capture: true,
    passive: true,
  });

  return {
    get current() {
      return current;
    },
    destroy() {
      if (observer) {
        observer.disconnect();
      }
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh, true);
    },
  };
}
