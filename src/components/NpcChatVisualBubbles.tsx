import React from 'react';

export interface NpcChatVisualPayload {
  kind: 'interaction' | 'gift_box';
  emoji?: string;
  label?: string;
  itemName?: string;
}

/**
 * Inline SVG Gift Box rendered inside the player's chat bubble when sending
 * a gift to an NPC from the bottom-center dock.
 */
export const GiftBoxBubbleSvg: React.FC<{ itemName: string }> = ({ itemName }) => (
  <div className="flex items-center gap-2.5" data-player-gift-svg-bubble="true">
    <svg
      width="36"
      height="36"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 drop-shadow-sm"
      aria-label="Gift box"
    >
      {/* Box body */}
      <rect x="8" y="21" width="32" height="21" rx="4" fill="#FFF7ED" stroke="#F59E0B" strokeWidth="2.4" />
      {/* Box lid */}
      <rect x="5" y="14" width="38" height="8" rx="3" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2.4" />
      {/* Vertical ribbon */}
      <rect x="21" y="14" width="6" height="28" fill="#F43F5E" />
      {/* Horizontal ribbon */}
      <rect x="8" y="29" width="32" height="4.5" fill="#F43F5E" fillOpacity="0.9" />
      {/* Bow left loop */}
      <path
        d="M24 14C20 14 13.5 11.5 14.5 7.5C15.5 4.2 21.5 6.8 24 14Z"
        fill="#FB7185"
        stroke="#E11D48"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Bow right loop */}
      <path
        d="M24 14C28 14 34.5 11.5 33.5 7.5C32.5 4.2 26.5 6.8 24 14Z"
        fill="#FB7185"
        stroke="#E11D48"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Sparkle */}
      <path d="M40 7L41 9.5L43.5 10.5L41 11.5L40 14L39 11.5L36.5 10.5L39 9.5L40 7Z" fill="#FDE047" />
    </svg>
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-wide text-amber-100/95">
        Gift Sent
      </div>
      <div className="text-xs font-semibold text-white leading-snug truncate">
        {itemName}
      </div>
    </div>
  </div>
);

/**
 * Emoji / icon interaction bubble rendered inside the player's chat bubble
 * when requesting an interaction (e.g. Pair Pose) from the bottom-center dock.
 */
export const InteractionRequestBubble: React.FC<{ emoji: string; label: string }> = ({
  emoji,
  label,
}) => (
  <div className="flex items-center gap-2" data-player-interaction-emoji-bubble="true">
    <span className="text-xl leading-none" role="img" aria-label={label}>
      {emoji}
    </span>
    <span className="text-xs font-semibold text-white leading-snug">{label}</span>
  </div>
);
