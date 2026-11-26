import type { NearbyEntityUser } from '../components/SocialChatModal';

/**
 * WS15 — Single Source of Truth for Bottom Chat Input Routing & Labels
 * ====================================================================
 * Both the bottom chat bar's UI (placeholder, aria-label, route attribute,
 * maxLength, mode badge) and its `onSubmit` send handler MUST read from
 * `resolveBottomChatInputTarget(...)` so the displayed target and the actual
 * delivery target can never disagree.
 */

export type BottomChatInputTarget =
  | {
      kind: 'npc';
      channel: 'npc_merchant' | 'citizen_dialogue';
      npcName: string;
      npcBadgeLabel: string;
      placeholder: string;
      ariaLabel: string;
      routeAttr: 'npc_merchant' | 'citizen_dialogue';
      maxLength: number;
      allowSlashEmotes: false;
    }
  | {
      kind: 'private';
      recipient: NearbyEntityUser;
      placeholder: string;
      ariaLabel: string;
      routeAttr: 'private_chat';
      maxLength: number;
      allowSlashEmotes: false;
    }
  | {
      kind: 'world';
      placeholder: string;
      ariaLabel: string;
      routeAttr: 'social_world';
      maxLength: number;
      allowSlashEmotes: true;
    };

export interface BottomChatInputRoutingState {
  /** True when the merchant NPC modal (`npc_merchant`) is open in the foreground. */
  isMerchantNpcChatOpen: boolean;
  /** True when the citizen NPC dialogue modal is open (and not in warzone). */
  isCitizenNpcChatOpen: boolean;
  /** Optional DOM fallback when an NPC modal is visibly mounted. */
  hasDomNpcDialogOpen?: boolean;
  /** Display name of the active NPC (e.g. 'Hana', 'Kai', 'Nadia'). */
  activeNpcName?: string;
  /** Uppercase badge label of the active NPC (e.g. 'HANA', 'KAI', 'NADIA'). */
  activeNpcBadgeLabel?: string;
  /**
   * True whenever any private/social chat surface is open in the foreground
   * (standalone SocialChatModal OR Smartphone Messages/Contacts app).
   */
  isPrivateChatSurfaceOpen: boolean;
  /** Currently selected user in the private chat surface (null if none selected). */
  selectedPrivateUser: NearbyEntityUser | null;
}

export function resolveBottomChatInputTarget(
  state: BottomChatInputRoutingState,
): BottomChatInputTarget {
  // 1. Foreground NPC dialogue always takes exclusive priority.
  if (
    state.isMerchantNpcChatOpen ||
    state.isCitizenNpcChatOpen ||
    state.hasDomNpcDialogOpen
  ) {
    const channel: 'npc_merchant' | 'citizen_dialogue' =
      state.isCitizenNpcChatOpen && !state.isMerchantNpcChatOpen
        ? 'citizen_dialogue'
        : 'npc_merchant';
    const npcName = (state.activeNpcName || 'Citizen').trim() || 'Citizen';
    const npcBadgeLabel =
      (state.activeNpcBadgeLabel || npcName.toUpperCase()).trim() || 'NPC';

    return {
      kind: 'npc',
      channel,
      npcName,
      npcBadgeLabel,
      placeholder:
        channel === 'npc_merchant'
          ? `Ask ${npcName} anything...`
          : `Chat with ${npcName}...`,
      ariaLabel: 'NPC Dialogue Chat Input',
      routeAttr: channel,
      maxLength: 220,
      allowSlashEmotes: false,
    };
  }

  // 2. Foreground private chat surface with a valid non-NPC recipient.
  const recipient = state.selectedPrivateUser;
  const recipientName = recipient?.name?.trim() ?? '';
  if (
    state.isPrivateChatSurfaceOpen &&
    recipient &&
    !recipient.isNpc &&
    recipientName.length > 0
  ) {
    return {
      kind: 'private',
      recipient,
      placeholder: `Whisper @${recipientName}...`,
      ariaLabel: `Whisper ${recipientName} Chat Input`,
      routeAttr: 'private_chat',
      maxLength: 64,
      allowSlashEmotes: false,
    };
  }

  // 3. Default: world public chat (including slash emotes).
  return {
    kind: 'world',
    placeholder: 'Say something or /wave, /dance...',
    ariaLabel: 'Social Talk Chat Input',
    routeAttr: 'social_world',
    maxLength: 64,
    allowSlashEmotes: true,
  };
}
