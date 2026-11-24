import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PLAYER_ROLE_BADGE,
  MERCHANT_ROLE_BADGE,
  PLAYER_ROLE_BADGES,
  STATUS_PRESET_OPTIONS,
  encodeProfileIdentityToSkinsTags,
  formatProfileLinkDisplay,
  getAnyRoleBadgeSpec,
  getPlayerRoleBadgeSpec,
  isPlayerRoleBadgeId,
  normalizeProfileLinkHref,
  parseProfileIdentityFromSkinsTags,
} from './buddiesProfileIdentity';

describe('buddiesProfileIdentity', () => {
  it('exposes exactly the five player-selectable role badges and excludes Merchant', () => {
    assert.deepEqual(
      PLAYER_ROLE_BADGES.map((b) => ({ id: b.id, label: b.label, color: b.color, icon: b.icon })),
      [
        { id: 'builder', label: 'Builder', color: '#F97316', icon: 'gear' },
        { id: 'founder', label: 'Founder', color: '#8B5CF6', icon: 'crown' },
        { id: 'artist', label: 'Artist', color: '#EC4899', icon: 'paintbrush' },
        { id: 'community', label: 'Community', color: '#22C55E', icon: 'smiley' },
        { id: 'investor', label: 'Investor', color: '#3B82F6', icon: 'shield' },
      ],
    );

    assert.equal(isPlayerRoleBadgeId('merchant'), false);
    assert.equal(MERCHANT_ROLE_BADGE.isNpcOnly, true);
    assert.equal(getPlayerRoleBadgeSpec('merchant').id, DEFAULT_PLAYER_ROLE_BADGE);
    assert.equal(getAnyRoleBadgeSpec('merchant', true).id, 'merchant');
  });

  it('exposes the exact four plain-English status presets', () => {
    assert.deepEqual([...STATUS_PRESET_OPTIONS], [
      'Open to work',
      'Looking for a team',
      'Here for an event',
      'Just visiting',
    ]);
  });

  it('round-trips role badge, project line, and social links through bb_profiles skin tags', () => {
    const identity = {
      roleBadge: 'founder' as const,
      buildingProject: 'Buddies Social',
      links: {
        x: '@alice_builds',
        github: 'alice-dev',
        website: 'alice.example.com',
      },
    };

    const tags = encodeProfileIdentityToSkinsTags(identity);
    const parsed = parseProfileIdentityFromSkinsTags(['default', 'gender:female', ...tags]);

    assert.equal(parsed.roleBadge, 'founder');
    assert.equal(parsed.buildingProject, 'Buddies Social');
    assert.deepEqual(parsed.links, identity.links);
  });

  it('normalizes and validates X, GitHub, and Website links safely', () => {
    assert.equal(normalizeProfileLinkHref('x', '@near_builder'), 'https://x.com/near_builder');
    assert.equal(normalizeProfileLinkHref('x', 'https://x.com/near_builder'), 'https://x.com/near_builder');
    assert.equal(normalizeProfileLinkHref('github', 'buddies-dev'), 'https://github.com/buddies-dev');
    assert.equal(normalizeProfileLinkHref('website', 'buddies.app'), 'https://buddies.app/');
    assert.equal(normalizeProfileLinkHref('website', 'javascript:alert(1)'), null);
    assert.equal(normalizeProfileLinkHref('x', 'javascript:alert(1)'), null);

    assert.equal(formatProfileLinkDisplay('x', 'https://x.com/near_builder'), '@near_builder');
    assert.equal(formatProfileLinkDisplay('github', 'https://github.com/buddies-dev'), 'buddies-dev');
    assert.equal(formatProfileLinkDisplay('website', 'https://www.buddies.app/'), 'buddies.app');
  });
});
