import React from 'react';
import type { DailyMissionId } from '../game/buddiesDailyMissions';

export const DailyMissionArtwork: React.FC<{
  missionId: DailyMissionId;
  className?: string;
}> = ({ missionId, className = 'w-14 h-14' }) => {
  switch (missionId) {
    case 'meet_kai':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          {/* Harbor Fish Keeper Straw Hat & Lifebuoy */}
          <ellipse cx="32" cy="40" rx="22" ry="7" fill="#fcd34d" stroke="#14161d" strokeWidth="2.5" />
          <path
            d="M19 37c1-13 5.5-20 13-20s12 7 13 20H19z"
            fill="#f59e0b"
            stroke="#14161d"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M19.5 33h25v4.5h-25z" fill="#0ea5e9" stroke="#14161d" strokeWidth="2" />
          <circle cx="48" cy="46" r="9" fill="#ffffff" stroke="#14161d" strokeWidth="2.4" />
          <circle cx="48" cy="46" r="4" fill="#38bdf8" stroke="#14161d" strokeWidth="2" />
          <path d="M48 37v5M48 50v5M39 46h5M52 46h5" stroke="#ef4444" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );
    case 'work_cafe':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          {/* Glasshouse Cafe Coffee Mug & Cloche */}
          <ellipse cx="32" cy="52" rx="21" ry="5.5" fill="#e2e8f0" stroke="#14161d" strokeWidth="2.5" />
          <path
            d="M17 24h28v15c0 8.5-6 13-14 13s-14-4.5-14-13V24z"
            fill="#ffffff"
            stroke="#14161d"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M45 28h5c3.2 0 5.2 2.4 5.2 5.2S53.2 38.5 50 38.5h-5"
            fill="none"
            stroke="#14161d"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <ellipse cx="31" cy="24" rx="14" ry="5" fill="#d97706" stroke="#14161d" strokeWidth="2.2" />
          <path
            d="M31 27c-3.2-1.8-5-3.2-5-4.7 0-1.3 1.1-2.2 2.4-2.2 1 0 1.9.5 2.6 1.3.7-.8 1.6-1.3 2.6-1.3 1.3 0 2.4.9 2.4 2.2 0 1.5-1.8 2.9-5 4.7z"
            fill="#fef3c7"
          />
          <path d="M24 14c0-3 3-3 3-6M35 13c0-3 3-3 3-6" fill="none" stroke="#94a3b8" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case 'go_fishing':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          {/* Leaping Coastal Fish + Red/White Bobber */}
          <path
            d="M11 49c5-4 10-4 15 0s10 4 15 0 10-4 14 0"
            fill="none"
            stroke="#0284c7"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M16 32c5-10 18-14 27-7l9-6-3 12 4 11-10-5c-8 6-22 3-27-5z"
            fill="#38bdf8"
            stroke="#14161d"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M28 21c5-5 10-5 12 0" fill="#b8ff3c" stroke="#14161d" strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="23" cy="30" r="2.6" fill="#ffffff" stroke="#14161d" strokeWidth="1.8" />
          <circle cx="22.8" cy="30" r="1.1" fill="#14161d" />
          <circle cx="48" cy="14" r="5.5" fill="#ef4444" stroke="#14161d" strokeWidth="2.2" />
          <path d="M42.5 14a5.5 5.5 0 0 0 11 0z" fill="#ffffff" stroke="#14161d" strokeWidth="2" />
        </svg>
      );
    case 'visit_claimed_house':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          {/* Cozy Neighborhood Plot House */}
          <polygon
            points="10,30 32,12 54,30"
            fill="#fb923c"
            stroke="#14161d"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <rect x="40" y="14" width="6" height="10" fill="#cbd5e1" stroke="#14161d" strokeWidth="2.2" />
          <rect
            x="15"
            y="30"
            width="34"
            height="22"
            fill="#fef3c7"
            stroke="#14161d"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <rect x="27" y="37" width="10" height="15" fill="#92400e" stroke="#14161d" strokeWidth="2.2" />
          <circle cx="34.5" cy="45" r="1.2" fill="#facc15" />
          <rect x="19" y="35" width="5.5" height="6" fill="#7dd3fc" stroke="#14161d" strokeWidth="2" />
          <rect x="39.5" y="35" width="5.5" height="6" fill="#7dd3fc" stroke="#14161d" strokeWidth="2" />
          <rect x="9" y="51" width="46" height="4" rx="1.5" fill="#4ade80" stroke="#14161d" strokeWidth="2" />
        </svg>
      );
  }
};
