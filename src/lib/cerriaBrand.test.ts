import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CERRIA_APP_NAME,
  CERRIA_CITY_NAME,
  CERRIA_LOAD_BEARING_INVARIANTS,
  CERRIA_OFFICIAL_DESCRIPTION,
  CERRIA_OFFICIAL_TICKER,
  CERRIA_OUTLINE_COLOR,
  CERRIA_OUTLINE_HEX,
  MS_PER_DAY,
  OPEN_LOT_RENTAL_EVENT,
} from './cerriaBrand';
import { SHOP_BUILDING_FORMS } from '../game/buddiesCityRentalLotsRules';
import { SHOP_LOT_PLACEMENT_SYNC_EVENT } from '../game/shopPlacementController';
import { MS_PER_DAY as SHOP_ENGINE_MS_PER_DAY } from '../game/shopRentalEngine';
import { buildNpcSystemInstruction } from '../../api/npc-agent';

const REPO_ROOT = process.cwd();

function readRepoFile(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

describe('Cerria brand identity & load-bearing invariants', () => {
  it('syncs metadata.json with official Cerria name, description, and server Gemini capability', () => {
    const metadata = JSON.parse(readRepoFile('metadata.json')) as {
      name: string;
      description: string;
      majorCapabilities: string[];
    };

    assert.equal(metadata.name, CERRIA_APP_NAME);
    assert.equal(metadata.description, CERRIA_OFFICIAL_DESCRIPTION);
    assert.ok(
      metadata.majorCapabilities.includes('MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API'),
      'metadata.json must retain MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API',
    );
  });

  it('syncs index.html title and meta descriptions with Cerria metadata', () => {
    const html = readRepoFile('index.html');
    assert.ok(html.includes(`<title>${CERRIA_APP_NAME}</title>`));
    assert.ok(html.includes(`content="${CERRIA_OFFICIAL_DESCRIPTION}"`));
    assert.ok(html.includes(`<meta property="og:title" content="${CERRIA_APP_NAME}" />`));
    assert.ok(
      html.includes(`<meta property="og:description" content="${CERRIA_OFFICIAL_DESCRIPTION}" />`),
    );
    assert.doesNotMatch(html, /buddies\s+(blitz|city)/i);
  });

  it('defines canonical ticker, outline color, and deduplicated MS_PER_DAY', () => {
    assert.equal(
      CERRIA_OFFICIAL_TICKER,
      'EXPLORE THE CITY • MEET THE COMMUNITY • VISIT HOMES • OPEN A SHOP',
    );
    assert.equal(CERRIA_CITY_NAME, 'Cerria');
    assert.equal(CERRIA_OUTLINE_HEX, '#12121e');
    assert.equal(CERRIA_OUTLINE_COLOR, 0x12121e);
    assert.equal(MS_PER_DAY, 86_400_000);
    assert.equal(SHOP_ENGINE_MS_PER_DAY, MS_PER_DAY);
  });

  it('preserves all load-bearing events, shop form IDs, and catalog item IDs unchanged', () => {
    assert.equal(
      SHOP_LOT_PLACEMENT_SYNC_EVENT,
      CERRIA_LOAD_BEARING_INVARIANTS.customEvents.shopLotPlacementSync,
    );
    assert.equal(
      OPEN_LOT_RENTAL_EVENT,
      CERRIA_LOAD_BEARING_INVARIANTS.customEvents.openLotRental,
    );

    const forms = Object.values(SHOP_BUILDING_FORMS);
    const formIds = forms.map((f) => f.id).sort();
    const expectedFormIds = [...CERRIA_LOAD_BEARING_INVARIANTS.shopFormIds].sort();
    assert.deepEqual(formIds, expectedFormIds);

    const itemIds = forms.map((f) => f.catalogItemId).sort();
    const expectedItemIds = [...CERRIA_LOAD_BEARING_INVARIANTS.shopCatalogItemIds].sort();
    assert.deepEqual(itemIds, expectedItemIds);
  });

  it('keeps NPC AI system instructions branded exclusively as Cerria', () => {
    const hanaPrompt = buildNpcSystemInstruction('lobby_cafe', {});
    const kaiPrompt = buildNpcSystemInstruction('beach_house', {});

    assert.match(hanaPrompt, /\bCerria\b/);
    assert.match(kaiPrompt, /\bCerria\b/);
    assert.doesNotMatch(hanaPrompt, /buddies\s+(blitz|city)/i);
    assert.doesNotMatch(kaiPrompt, /buddies\s+(blitz|city)/i);
  });

  it('contains zero legacy Buddies Blitz / Buddies City copy in audited UI files', () => {
    const auditedFiles = [
      'src/components/HudWeatherAndTimeControl.tsx',
      'src/components/CityFeedModal.tsx',
      'src/components/SocialChatModal.tsx',
      'src/components/CharacterProfileModal.tsx',
      'src/components/SmartphoneOsModal.tsx',
      'src/lib/phoneHomeCityNews.ts',
      'src/lib/lettersRules.ts',
    ];

    for (const relPath of auditedFiles) {
      const content = readRepoFile(relPath);
      assert.doesNotMatch(
        content,
        /buddies\s+(blitz|city)/i,
        `${relPath} must not contain legacy Buddies Blitz / Buddies City text`,
      );
    }
  });
});
