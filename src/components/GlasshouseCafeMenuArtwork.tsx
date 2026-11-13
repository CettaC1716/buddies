import React from 'react';
import type { CafeMenuItemSpec } from '../game/buddiesCafeRules';

export const CafeMenuItemArtwork: React.FC<{
  itemId: CafeMenuItemSpec['id'];
  className?: string;
}> = ({ itemId, className = 'w-14 h-14' }) => {
  switch (itemId) {
    case 'latte':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <ellipse cx="32" cy="52" rx="22" ry="6" fill="#e2e8f0" stroke="#14161d" strokeWidth="2.5" />
          <path d="M16 24h30v14c0 9-6.5 14-15 14s-15-5-15-14V24z" fill="#ffffff" stroke="#14161d" strokeWidth="2.5" />
          <path d="M46 28h5c3.5 0 5.5 2.5 5.5 5.5S54.5 39 51 39h-5" fill="none" stroke="#14161d" strokeWidth="3.5" strokeLinecap="round" />
          <ellipse cx="31" cy="24" rx="15" ry="5.5" fill="#d97706" stroke="#14161d" strokeWidth="2.2" />
          <path d="M31 27c-3.5-2-5.5-3.6-5.5-5.2 0-1.4 1.2-2.4 2.7-2.4 1.1 0 2.1.6 2.8 1.5.7-.9 1.7-1.5 2.8-1.5 1.5 0 2.7 1 2.7 2.4 0 1.6-2 3.2-5.5 5.2z" fill="#fef3c7" />
        </svg>
      );
    case 'croissant':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <path
            d="M12 42c-2-8 6-22 20-22s22 14 20 22c-3 4-9 4-13 1-4 3-10 3-14 0-4 3-10 3-13-1z"
            fill="#f59e0b"
            stroke="#14161d"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <path d="M23 21c-2 7-2 15 0 21M32 20v23M41 21c2 7 2 15 0 21" stroke="#92400e" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M19 29c4-3 9-4 13-4s9 1 13 4" fill="none" stroke="#fde68a" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'sandwich':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <polygon points="10,40 34,24 54,36 28,52" fill="#d97706" stroke="#14161d" strokeWidth="2.5" strokeLinejoin="round" />
          <polygon points="11,35 34,20 53,32 28,47" fill="#ef4444" stroke="#14161d" strokeWidth="2" strokeLinejoin="round" />
          <polygon points="10,31 34,16 54,28 28,43" fill="#4ade80" stroke="#14161d" strokeWidth="2" strokeLinejoin="round" />
          <polygon points="10,27 34,12 54,24 28,39" fill="#fde68a" stroke="#14161d" strokeWidth="2.5" strokeLinejoin="round" />
          <polygon points="14,26 33,15 49,24 28,35" fill="#fef9c3" />
        </svg>
      );
    case 'espresso':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <ellipse cx="32" cy="51" rx="19" ry="5.5" fill="#cbd5e1" stroke="#14161d" strokeWidth="2.5" />
          <path d="M19 25h24v13c0 7.5-5.5 11.5-12 11.5S19 45.5 19 38V25z" fill="#f8fafc" stroke="#14161d" strokeWidth="2.5" />
          <path d="M43 29h4.5c2.8 0 4.5 2 4.5 4.5S50.3 38 47.5 38H43" fill="none" stroke="#14161d" strokeWidth="3.2" strokeLinecap="round" />
          <ellipse cx="31" cy="25" rx="12" ry="4.5" fill="#451a03" stroke="#14161d" strokeWidth="2.2" />
          <path d="M25 16c0-3 3-3 3-6M35 15c0-3 3-3 3-6" fill="none" stroke="#cbd5e1" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'cinnamon_roll':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <ellipse cx="32" cy="36" rx="20" ry="15" fill="#d97706" stroke="#14161d" strokeWidth="2.6" />
          <ellipse cx="32" cy="33" rx="17" ry="12" fill="#f59e0b" stroke="#14161d" strokeWidth="2" />
          <path
            d="M32 33c2 0 4-1.5 4-3.5S34 26 31 26c-4 0-7 3-7 6.8 0 4.5 4 7.8 9 7.8 6 0 10-4.2 10-9.2"
            fill="none"
            stroke="#78350f"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M21 26c4-3 18-3 22 0" fill="none" stroke="#fef3c7" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      );
    case 'donut':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <circle cx="32" cy="33" r="20" fill="#eab308" stroke="#14161d" strokeWidth="2.6" />
          <path
            d="M13 30c3-10 12-16 19-16 10 0 18 7 19 16-3 3-6 1-9 3s-4 4-8 2-5-1-8 2-6 1-8-1-4-3-5-6z"
            fill="#f472b6"
            stroke="#14161d"
            strokeWidth="2.2"
          />
          <circle cx="32" cy="33" r="6.5" fill="#14161d" stroke="#14161d" strokeWidth="2.2" />
          <circle cx="32" cy="33" r="4.5" fill="#1e293b" />
          <line x1="23" y1="22" x2="27" y2="24" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="38" y1="21" x2="41" y2="24" stroke="#fde047" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="42" y1="31" x2="45" y2="29" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'muffin':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <polygon points="18,34 46,34 41,54 23,54" fill="#e2e8f0" stroke="#14161d" strokeWidth="2.5" strokeLinejoin="round" />
          <line x1="26" y1="34" x2="28" y2="54" stroke="#94a3b8" strokeWidth="2" />
          <line x1="38" y1="34" x2="36" y2="54" stroke="#94a3b8" strokeWidth="2" />
          <path
            d="M14 34c0-10 8-18 18-18s18 8 18 18c-3 3-33 3-36 0z"
            fill="#f59e0b"
            stroke="#14161d"
            strokeWidth="2.5"
          />
          <circle cx="24" cy="26" r="3.2" fill="#2563eb" stroke="#14161d" strokeWidth="1.5" />
          <circle cx="35" cy="22" r="3.2" fill="#2563eb" stroke="#14161d" strokeWidth="1.5" />
          <circle cx="40" cy="29" r="3" fill="#2563eb" stroke="#14161d" strokeWidth="1.5" />
        </svg>
      );
    case 'iced_latte':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <path d="M21 20h22l-3.5 34h-15L21 20z" fill="#d97706" stroke="#14161d" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M22.5 34h19l-2 20h-15l-2-20z" fill="#92400e" />
          <path d="M21 20h22v10c-5 2-17 2-22 0V20z" fill="#fef3c7" />
          <ellipse cx="32" cy="19" rx="12" ry="4" fill="#e0f2fe" stroke="#14161d" strokeWidth="2.2" />
          <line x1="36" y1="8" x2="32" y2="28" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" />
          <rect x="25" y="21" width="6" height="6" rx="1" fill="#bae6fd" stroke="#14161d" strokeWidth="1.4" />
        </svg>
      );
    case 'hot_mocha':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <path d="M16 25h28v15c0 8-6 13-14 13s-14-5-14-13V25z" fill="#ef4444" stroke="#14161d" strokeWidth="2.5" />
          <path d="M44 29h5c3 0 5 2.2 5 5s-2 5-5 5h-5" fill="none" stroke="#14161d" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M17 25c2-7 8-10 13-10s11 3 13 10z" fill="#fffbeb" stroke="#14161d" strokeWidth="2.2" />
          <circle cx="26" cy="20" r="1.5" fill="#451a03" />
          <circle cx="31" cy="18" r="1.5" fill="#451a03" />
          <circle cx="35" cy="21" r="1.5" fill="#451a03" />
        </svg>
      );
  }
};
