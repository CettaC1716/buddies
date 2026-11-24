import { useEffect, useState } from 'react';
import {
  classifyAdaptiveViewport,
  type AdaptiveViewportInfo,
} from '../game/buddiesAdaptiveViewportRules';

function detectHasTouch(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(hover: none)').matches);
  const touchPoints =
    typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0;
  return Boolean(coarse || touchPoints || 'ontouchstart' in window);
}

function readViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 720 };
  }
  const vv = window.visualViewport;
  const width = Math.round(vv?.width || window.innerWidth || 1280);
  const height = Math.round(vv?.height || window.innerHeight || 720);
  return { width, height };
}

export function useAdaptiveViewport(): AdaptiveViewportInfo {
  const [viewport, setViewport] = useState<AdaptiveViewportInfo>(() => {
    const { width, height } = readViewportSize();
    return classifyAdaptiveViewport(width, height, detectHasTouch());
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncDocumentAttrs = (next: AdaptiveViewportInfo) => {
      const root = document.documentElement;
      if (root) {
        root.dataset.device = next.device;
        root.dataset.orientation = next.orientation;
        root.dataset.hudDensity = next.hudDensity;
      }
    };

    const update = (forceTouch = false) => {
      const { width, height } = readViewportSize();
      setViewport((prev) => {
        const hasTouch = forceTouch || prev.hasTouch || detectHasTouch();
        const next = classifyAdaptiveViewport(width, height, hasTouch);
        if (
          prev.width === next.width &&
          prev.height === next.height &&
          prev.hasTouch === next.hasTouch &&
          prev.device === next.device &&
          prev.orientation === next.orientation
        ) {
          return prev;
        }
        syncDocumentAttrs(next);
        return next;
      });
    };

    syncDocumentAttrs(viewport);

    const onResize = () => update(false);
    const onFirstTouch = () => update(true);

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    window.addEventListener('touchstart', onFirstTouch, { passive: true });

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.removeEventListener('touchstart', onFirstTouch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return viewport;
}
