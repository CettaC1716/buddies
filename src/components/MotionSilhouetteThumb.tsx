import React, { useEffect, useRef, useState } from 'react';
import {
  getCachedMotionSilhouetteThumbnail,
  renderMotionSilhouetteThumbnail,
} from '../game/shopMotionSilhouetteRenderer';

export interface MotionSilhouetteThumbProps {
  wardrobeItemId: string;
  alt: string;
  className?: string;
  isPaired?: boolean;
}

export const MOTION_SILHOUETTE_ORB_BG =
  'radial-gradient(circle at 35% 28%, #ffffff 0%, #f4f1ec 64%, #e2ddd5 100%)';

/**
 * Lazily renders and caches a posed jet-black 3D human silhouette PNG matching the
 * exact animation/pose of a Wardrobe motion item (`style_anim`, `style_dance`,
 * `style_pose`, `style_action`, `style_paired`).
 */
export const MotionSilhouetteThumb: React.FC<MotionSilhouetteThumbProps> = ({
  wardrobeItemId,
  alt,
  className = 'w-[92%] h-[92%]',
  isPaired = false,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(() =>
    getCachedMotionSilhouetteThumbnail(wardrobeItemId),
  );

  useEffect(() => {
    const cached = getCachedMotionSilhouetteThumbnail(wardrobeItemId);
    if (cached) {
      setThumbUrl(cached);
      return;
    }
    setThumbUrl(null);
    const el = hostRef.current;
    let cancelled = false;

    const triggerRender = () => {
      void renderMotionSilhouetteThumbnail(wardrobeItemId).then((url) => {
        if (!cancelled && url) {
          setThumbUrl(url);
        }
      });
    };

    if (el && typeof IntersectionObserver !== 'undefined') {
      const obs = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            obs.disconnect();
            triggerRender();
          }
        },
        { rootMargin: '160px' },
      );
      obs.observe(el);
      return () => {
        cancelled = true;
        obs.disconnect();
      };
    }

    triggerRender();
    return () => {
      cancelled = true;
    };
  }, [wardrobeItemId]);

  return (
    <div
      ref={hostRef}
      className="w-full h-full flex items-center justify-center pointer-events-none select-none"
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={alt}
          draggable={false}
          className={`${className} object-contain`}
        />
      ) : isPaired ? (
        <svg
          viewBox="0 0 64 64"
          className="w-[78%] h-[78%] opacity-35"
          aria-hidden="true"
        >
          <g fill="#111318">
            <circle cx="23" cy="16" r="4.3" />
            <path d="M18.5 23 C20 21.5 26 21.5 27.5 23.8 L26.8 36 L19.2 36 Z" />
            <path
              d="M26.5 25 L35.5 26.5 M19.4 25 L16 34 M21 35.5 L19.5 52 M25.2 35.5 L27.2 52"
              fill="none"
              stroke="#111318"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </g>
          <g fill="#374151">
            <circle cx="41" cy="14.5" r="4.5" />
            <path d="M36 22 C37.8 20.5 44.2 20.5 45.8 22.8 L44.8 36 L37 36 Z" />
            <path
              d="M36.8 24.5 L28 27 M44.8 24.5 L48 34 M39 35.5 L36.8 52 M43.2 35.5 L45 52"
              fill="none"
              stroke="#374151"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
          </g>
        </svg>
      ) : (
        <svg
          viewBox="0 0 64 64"
          className="w-[74%] h-[74%] opacity-35"
          aria-hidden="true"
        >
          <g fill="#111318">
            <circle cx="33" cy="14" r="4.8" />
            <path d="M27.5 21.5 C29.5 19.8 36.5 19.8 38.2 22.5 L37.2 35.2 L28.4 35.2 Z" />
            <path
              d="M28.4 22.6 L23.2 17.4 L28.2 13.8"
              fill="none"
              stroke="#111318"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M37.4 23.2 L39.2 33.4 L37.6 37.8"
              fill="none"
              stroke="#111318"
              strokeWidth="3.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M30.2 34.8 L28.6 52.8 M35.6 34.8 L39.2 53.5"
              fill="none"
              stroke="#111318"
              strokeWidth="3.8"
              strokeLinecap="round"
            />
          </g>
        </svg>
      )}
    </div>
  );
};
