import React from 'react';
import type { TogethernessActionCategory } from '../game/npcTogethernessRegistry';

export type TogethernessDockIconKind = TogethernessActionCategory | 'end';

/**
 * Literal one-icon, one-meaning SVGs for the NPC chat bottom dock:
 * - ride: scooter side view
 * - walk: two figures walking
 * - hold_hands: two hands holding
 * - hug: two figures embracing
 * - dance: dancing figure with a music note
 * - kiss: lips
 * - sit_together: bench with two figures
 * - fun_pose: camera
 * - end: step-down arrow
 */
export const TogethernessDockIcon: React.FC<{
  kind: TogethernessDockIconKind;
  className?: string;
}> = ({ kind, className = 'w-4 h-4' }) => {
  switch (kind) {
    case 'ride':
      // Scooter side view
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="6.5" cy="17.5" r="2.75" />
          <circle cx="17.5" cy="17.5" r="2.75" />
          <path d="M9.2 17.5h5.2l2.4-7.5h2.2" />
          <path d="M15.6 10l-1.2-3.5h-2.6" />
          <path d="M5 14h6.5l1.3 3.5" />
          <path d="M7.5 11.5h3.5" />
        </svg>
      );
    case 'walk':
      // Two figures walking
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="8" cy="5.5" r="1.8" />
          <path d="M8 8.5v5l-2.2 5M8 13.5l2 5M5.5 11l2.5-1.5 2.2 1.8" />
          <circle cx="16.2" cy="6" r="1.7" />
          <path d="M16.2 9v4.5l-2 5M16.2 13.5l2.2 5M14 11.2l2.2-1.2 2 1.6" />
        </svg>
      );
    case 'hold_hands':
      // Two hands holding
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M3 13l4-3 3.5 2.5a2 2 0 0 0 2.6-.2L17 9l4 3" />
          <path d="M7 14.5l3.2 2.5a2 2 0 0 0 2.6 0l4.2-3.5" />
          <path d="M10.5 12.5l2 2" />
        </svg>
      );
    case 'hug':
      // Two figures embracing
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="9.2" cy="6" r="2" />
          <circle cx="14.8" cy="6.4" r="2" />
          <path d="M6.5 19v-6.5a2.8 2.8 0 0 1 2.8-2.8h5.4a2.8 2.8 0 0 1 2.8 2.8V19" />
          <path d="M8.5 13c1.6 1.2 5.4 1.2 7 0" />
        </svg>
      );
    case 'dance':
      // Dancing figure with music note
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="9" cy="5.5" r="1.8" />
          <path d="M5.5 10.5l3.5-1.5 3 2.5M9 9v5l-3 5M9 14l3.5 4.5" />
          <path d="M16.5 11.5V5.5l4-1v5" />
          <circle cx="15.5" cy="12" r="1.2" />
          <circle cx="19.5" cy="10.2" r="1.2" />
        </svg>
      );
    case 'kiss':
      // Lips
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M3.5 12c2.2-2.8 4.8-3.5 6.8-1.8 1 .8 2.4.8 3.4 0 2-1.7 4.6-1 6.8 1.8" />
          <path d="M3.5 12c2.5 3.6 5.5 5 8.5 5s6-1.4 8.5-5" />
          <path d="M6 12.2c2.2.8 9.8.8 12 0" />
        </svg>
      );
    case 'sit_together':
      // Bench with two figures
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="8.5" cy="7" r="1.7" />
          <circle cx="15.5" cy="7" r="1.7" />
          <path d="M8.5 9.5v4.5M15.5 9.5v4.5" />
          <path d="M3.5 14h17M5 14v5M19 14v5M4.5 11.5h15" />
        </svg>
      );
    case 'fun_pose':
      // Camera
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18v-8A1.5 1.5 0 0 1 4 8.5z" />
          <circle cx="12" cy="13.8" r="3.2" />
        </svg>
      );
    case 'end':
      // Step-down arrow
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12 4v11" />
          <path d="M7.5 11.5L12 16l4.5-4.5" />
          <path d="M5 19.5h14" />
        </svg>
      );
  }
};
