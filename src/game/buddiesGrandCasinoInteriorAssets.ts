import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createBlitzStrokeMesh } from './buddiesBlitzShadersAndAssets';
import {
  type CafeAssetStyler,
  makeRoundedBoxGeo,
} from './buddiesLShapedCafeAssets';
import {
  CASINO_BLACKJACK_TABLES,
  CASINO_CASHIER_BOOTH,
  CASINO_INTERIOR_BOUNDS,
  CASINO_LUXURY_BAR,
  CASINO_ROULETTE_TABLE,
  CASINO_SLOT_PLACEMENTS,
  CASINO_SLOT_CABINET_THEMES,
  type CasinoSlotCabinetTheme,
  getCasinoSlotCabinetTheme,
  getCasinoSlotGameVariantForPlacementId,
} from './buddiesGrandCasinoRules';

// =============================================================================
// 1:1 PROCEDURAL CANVAS TEXTURES (SRGBColorSpace, Blueprint Palette & Detail)
// =============================================================================

export interface CasinoTexturePack {
  persianCarpet: THREE.CanvasTexture;
  carraraMarble: THREE.CanvasTexture;
  creamPanelWall: THREE.CanvasTexture;
  wallPlaster: THREE.CanvasTexture;
  archedMirrorGlass: THREE.CanvasTexture;
  masonryCutaway: THREE.CanvasTexture;
  cofferedCeiling: THREE.CanvasTexture;
  blackjackFelt: THREE.CanvasTexture;
  rouletteFelt: THREE.CanvasTexture;
  rouletteWheelDisc: THREE.CanvasTexture;
  slotMarquee: THREE.CanvasTexture;
  slotUpperBonus: THREE.CanvasTexture;
  slotLowerReels: THREE.CanvasTexture;
  doorSunburstTympanum: THREE.CanvasTexture;
  mahoganyWood: THREE.CanvasTexture;
  slateMansard: THREE.CanvasTexture;
  giltFiligree: THREE.CanvasTexture;
  leatherTufted: THREE.CanvasTexture;
  allTextures: THREE.CanvasTexture[];
}

function makeCanvasTex(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    draw(ctx, w, h);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = repeatX === 1 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.wrapT = repeatY === 1 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.repeat.set(repeatX, repeatY);
  }
  tex.anisotropy = 4;
  return tex;
}

export function createCasinoTexturePack(): CasinoTexturePack {
  // 1. Ornate Crimson & Gold Damascus Floral Persian Carpet (screen_07df789a.png)
  const persianCarpet = makeCanvasTex(512, 512, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 40, w * 0.5, h * 0.5, w * 0.65);
    grad.addColorStop(0, '#a31c24');
    grad.addColorStop(0.68, '#7f1119');
    grad.addColorStop(1, '#54090e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Multi-tier gilded border frame
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 14;
    ctx.strokeRect(18, 18, w - 36, h - 36);
    ctx.strokeStyle = '#4c070b';
    ctx.lineWidth = 6;
    ctx.strokeRect(32, 32, w - 64, h - 64);
    ctx.strokeStyle = '#f3d778';
    ctx.lineWidth = 3;
    ctx.strokeRect(42, 42, w - 84, h - 84);

    // Ornate Damascus acanthus medallions & scrolling vines
    ctx.save();
    for (let gy = 84; gy < h - 70; gy += 84) {
      for (let gx = 84; gx < w - 70; gx += 84) {
        ctx.translate(gx, gy);
        ctx.strokeStyle = 'rgba(236, 200, 96, 0.42)';
        ctx.fillStyle = 'rgba(212, 175, 55, 0.19)';
        ctx.lineWidth = 2;
        for (let p = 0; p < 8; p++) {
          ctx.rotate(Math.PI / 4);
          ctx.beginPath();
          ctx.ellipse(0, 17, 7, 17, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(248, 222, 134, 0.48)';
        ctx.fill();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
    ctx.restore();
  }, 2, 1.5);

  // 2. Polished White/Grey Veined Carrara Marble (512x512, dado, cashier ledge, bar countertop)
  const carraraMarble = makeCanvasTex(512, 512, (ctx, w, h) => {
    const base = ctx.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, '#f7f5f0');
    base.addColorStop(0.5, '#efece6');
    base.addColorStop(1, '#f4f1ea');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    // Soft cloudy mineral patches
    for (let i = 0; i < 18; i++) {
      const cx = ((i * 97) % w);
      const cy = ((i * 151) % h);
      const r = 45 + (i % 5) * 18;
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
      g.addColorStop(0, 'rgba(170, 166, 158, 0.14)');
      g.addColorStop(1, 'rgba(170, 166, 158, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    // Primary diagonal grey marble veins + fine secondary gold-taupe wisps
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      let x = (i * 53) % w;
      let y = 0;
      ctx.moveTo(x, y);
      for (let s = 1; s <= 12; s++) {
        x += Math.sin(i * 1.7 + s * 0.75) * 32 + 12;
        y = (s / 12) * h;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(128, 126, 122, 0.34)' : 'rgba(155, 150, 142, 0.24)';
      ctx.lineWidth = i % 4 === 0 ? 3.2 : 1.6;
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(182, 165, 132, 0.20)';
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 38);
      ctx.bezierCurveTo(w * 0.35, i * 38 + 26, w * 0.68, i * 38 - 18, w, i * 38 + 10);
      ctx.stroke();
    }
  }, 2, 2);

  // 3. Ivory / Cream Beaux-Arts Wall Paneling w/ Double Gilded Trim & Corner Rosettes (screen_61ebacc8.png)
  const creamPanelWall = makeCanvasTex(512, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#f6efe0');
    grad.addColorStop(0.5, '#f2e8d2');
    grad.addColorStop(1, '#eadcc0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle lime-plaster patina flecks
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(180, 158, 120, 0.06)' : 'rgba(255, 252, 244, 0.14)';
      ctx.fillRect((i * 89) % w, (i * 149) % h, 18, 10);
    }

    // Outer recessed panel shadow & gilt molding frame
    ctx.strokeStyle = 'rgba(110, 82, 34, 0.35)';
    ctx.lineWidth = 10;
    ctx.strokeRect(20, 20, w - 40, h - 40);
    ctx.strokeStyle = '#c8a246';
    ctx.lineWidth = 11;
    ctx.strokeRect(28, 28, w - 56, h - 56);
    ctx.strokeStyle = '#8f6c20';
    ctx.lineWidth = 3;
    ctx.strokeRect(38, 38, w - 76, h - 76);
    ctx.strokeStyle = '#ecd58c';
    ctx.lineWidth = 5;
    ctx.strokeRect(54, 54, w - 108, h - 108);

    // Corner decorative gilt rosettes & scrolled brackets
    for (const [cx, cy] of [[68, 68], [w - 68, 68], [68, h - 68], [w - 68, h - 68]]) {
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.fillStyle = '#d4af37';
      ctx.fill();
      ctx.strokeStyle = '#8f6c20';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fef3c7';
      ctx.fill();
    }
  });

  // 3b. Seamless Warm Cream Beaux-Arts Stucco Plaster Backing Wall Texture
  const wallPlaster = makeCanvasTex(512, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#f5eedc');
    grad.addColorStop(0.55, '#efe4cc');
    grad.addColorStop(1, '#e6d7ba');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 240; i++) {
      const px = (i * 97) % w;
      const py = (i * 173) % h;
      const r = 16 + (i % 5) * 10;
      const g = ctx.createRadialGradient(px, py, 2, px, py, r);
      g.addColorStop(0, i % 2 === 0 ? 'rgba(186, 162, 122, 0.08)' : 'rgba(255, 252, 244, 0.12)');
      g.addColorStop(1, 'rgba(240, 228, 204, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    }
  }, 6, 2);

  // 3c. Warm Beveled Venetian Arched Mirror Glass (screen_61ebacc8.png / screen_07df789a.png)
  const archedMirrorGlass = makeCanvasTex(256, 512, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#f6efe0');
    bg.addColorStop(0.32, '#d8e3e8');
    bg.addColorStop(0.62, '#eef2f3');
    bg.addColorStop(1, '#becbd3');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Warm golden ambient chandelier glow reflected in upper mirror vault
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.28, 12, w * 0.5, h * 0.30, w * 0.65);
    glow.addColorStop(0, 'rgba(255, 232, 178, 0.55)');
    glow.addColorStop(0.55, 'rgba(255, 244, 214, 0.18)');
    glow.addColorStop(1, 'rgba(210, 224, 232, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Crisp diagonal glass specular highlight bands
    ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
    ctx.beginPath();
    ctx.moveTo(w * 0.12, h * 0.72);
    ctx.lineTo(w * 0.78, h * 0.14);
    ctx.lineTo(w * 0.90, h * 0.20);
    ctx.lineTo(w * 0.24, h * 0.78);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.moveTo(w * 0.34, h * 0.84);
    ctx.lineTo(w * 0.92, h * 0.34);
    ctx.lineTo(w * 0.97, h * 0.38);
    ctx.lineTo(w * 0.40, h * 0.88);
    ctx.closePath();
    ctx.fill();

    // Inner chamfered mirror bevel border
    ctx.strokeStyle = 'rgba(130, 146, 158, 0.45)';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
  });

  // 3d. Architectural Cutaway Brick & Cut Stone Masonry Cross-Section (screen_07df789a.png)
  const masonryCutaway = makeCanvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#9c8d79';
    ctx.fillRect(0, 0, w, h);
    const brickH = 24;
    const brickW = 64;
    for (let r = 0; r < h / brickH + 1; r++) {
      const off = (r % 2) * (brickW * 0.5);
      for (let c = -1; c <= w / brickW + 1; c++) {
        const bx = c * brickW + off;
        const by = r * brickH;
        ctx.fillStyle = (r + c) % 3 === 0 ? '#a85d47' : (r + c) % 2 === 0 ? '#96503c' : '#8a4836';
        ctx.fillRect(bx + 2, by + 2, brickW - 4, brickH - 4);
      }
    }
  }, 1, 8);

  // 4. Ornate Coffered Ceiling Rosette Tile (512x512, screen_07df789a.png)
  const cofferedCeiling = makeCanvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#f2e8d2';
    ctx.fillRect(0, 0, w, h);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const cx = c * 256 + 14;
        const cy = r * 256 + 14;
        const sz = 228;
        ctx.fillStyle = '#e6d6b5';
        ctx.fillRect(cx, cy, sz, sz);
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 7;
        ctx.strokeRect(cx + 8, cy + 8, sz - 16, sz - 16);
        ctx.strokeStyle = '#9a7b2c';
        ctx.lineWidth = 3;
        ctx.strokeRect(cx + 22, cy + 22, sz - 44, sz - 44);
        ctx.strokeStyle = '#e8cf88';
        ctx.lineWidth = 3;
        ctx.strokeRect(cx + 34, cy + 34, sz - 68, sz - 68);

        // Central gilded ceiling medallion inside each coffer bay
        const mx = cx + sz * 0.5;
        const my = cy + sz * 0.5;
        ctx.beginPath();
        ctx.arc(mx, my, 42, 0, Math.PI * 2);
        ctx.fillStyle = '#efe2c6';
        ctx.fill();
        ctx.strokeStyle = '#c8a246';
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(mx, my, 22, 0, Math.PI * 2);
        ctx.strokeStyle = '#9a7b2c';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
  }, 4, 3);

  // 5. D-Shaped Green Baize Felt w/ BLACKJACK & BACCARAT + INSURANCE + 7 Boxes (1024x512, screen_68a3f939.png)
  const blackjackFelt = makeCanvasTex(1024, 512, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.16, 40, w * 0.5, h * 0.48, w * 0.58);
    grad.addColorStop(0, '#218250');
    grad.addColorStop(0.6, '#17663d');
    grad.addColorStop(1, '#0e4528');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle baize cloth texture speckles
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let i = 0; i < 650; i++) {
      ctx.fillRect((i * 73) % w, (i * 137) % h, 2, 2);
    }

    // Dealer-top straight margin rule & left shoe / right discard mat markings
    ctx.strokeStyle = '#ecd67e';
    ctx.lineWidth = 4;
    ctx.strokeRect(56, 26, 98, 72);
    ctx.strokeRect(w - 154, 26, 98, 72);

    // Double arched gilded ribbons across the D-arc
    const arcY = 26;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w * 0.5, arcY, 278, 0.08 * Math.PI, 0.92 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w * 0.5, arcY, 344, 0.06 * Math.PI, 0.94 * Math.PI);
    ctx.stroke();

    // Crisp Gold & Ivory Arched Table Rules Text
    ctx.fillStyle = '#fae58c';
    ctx.font = '900 28px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('BLACKJACK & BACCARAT · PAYS 3 TO 2', w * 0.5, 224);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 22px Georgia, serif';
    ctx.fillText('INSURANCE PAYS 2 TO 1', w * 0.5, 316);

    // 7 Player Betting Position Boxes arrayed evenly along outer crescent arc
    for (let i = 0; i < 7; i++) {
      const t = (i - 3) / 3.35;
      const ang = Math.PI * 0.5 + t * 1.02;
      const bx = w * 0.5 - Math.cos(ang) * 408;
      const by = arcY + Math.sin(ang) * 408;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(ang - Math.PI * 0.5);
      ctx.strokeStyle = '#f4e08a';
      ctx.lineWidth = 4;
      ctx.strokeRect(-28, -34, 56, 66);
      ctx.fillStyle = 'rgba(255, 248, 220, 0.14)';
      ctx.fillRect(-26, -32, 52, 62);
      ctx.fillStyle = '#fae58c';
      ctx.font = '700 13px sans-serif';
      ctx.fillText(`P${i + 1}`, 0, 5);
      ctx.restore();
    }
  });

  // 6. European/American Roulette Felt Layout (1024x512, screen_3cc6b11f.png)
  const rouletteFelt = makeCanvasTex(1024, 512, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 50, w * 0.5, h * 0.5, w * 0.6);
    grad.addColorStop(0, '#1a7547');
    grad.addColorStop(1, '#104e2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Outer gilt table border
    ctx.strokeStyle = '#f0db86';
    ctx.lineWidth = 5;
    ctx.strokeRect(24, 24, w - 48, h - 48);

    // Top racetrack / chip rack & outside/inside header boxes (screen_3cc6b11f.png top view)
    ctx.strokeStyle = '#e7cf74';
    ctx.lineWidth = 3;
    ctx.strokeRect(112, 38, 680, 48);
    ctx.fillStyle = 'rgba(10, 45, 26, 0.45)';
    ctx.fillRect(114, 40, 676, 44);
    ctx.fillStyle = '#fae58c';
    ctx.font = '800 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VOISINS DU ZERO  ·  TIERS DU CYLINDRE  ·  ORPHELINS', 452, 62);

    // Semi-rounded 0 & 00 green zero pockets on left
    const gridX = 148;
    const gridY = 104;
    const cellW = 62;
    const cellH = 84;
    const zeroW = 84;
    ctx.fillStyle = '#15803d';
    ctx.fillRect(gridX - zeroW, gridY, zeroW, cellH * 1.5);
    ctx.fillRect(gridX - zeroW, gridY + cellH * 1.5, zeroW, cellH * 1.5);
    ctx.strokeStyle = '#f0db86';
    ctx.lineWidth = 4;
    ctx.strokeRect(gridX - zeroW, gridY, zeroW, cellH * 1.5);
    ctx.strokeRect(gridX - zeroW, gridY + cellH * 1.5, zeroW, cellH * 1.5);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 32px sans-serif';
    ctx.fillText('0', gridX - zeroW * 0.5, gridY + cellH * 0.75);
    ctx.fillText('00', gridX - zeroW * 0.5, gridY + cellH * 2.25);

    // 12x3 Number Inside Bet Grid (1..36)
    const redNums = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
    for (let col = 0; col < 12; col++) {
      for (let row = 0; row < 3; row++) {
        const num = col * 3 + (3 - row);
        const cx = gridX + col * cellW;
        const cy = gridY + row * cellH;
        ctx.fillStyle = redNums.has(num) ? '#a61b1b' : '#18181b';
        ctx.fillRect(cx + 3, cy + 3, cellW - 6, cellH - 6);
        ctx.strokeStyle = '#f0db86';
        ctx.lineWidth = 3.5;
        ctx.strokeRect(cx, cy, cellW, cellH);
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 26px sans-serif';
        ctx.fillText(String(num), cx + cellW * 0.5, cy + cellH * 0.52);
      }
    }

    // 2 TO 1 right column boxes
    const rightX = gridX + 12 * cellW;
    for (let row = 0; row < 3; row++) {
      const cy = gridY + row * cellH;
      ctx.fillStyle = 'rgba(15, 75, 44, 0.75)';
      ctx.fillRect(rightX + 2, cy + 2, 74, cellH - 4);
      ctx.strokeStyle = '#f0db86';
      ctx.lineWidth = 3.5;
      ctx.strokeRect(rightX, cy, 78, cellH);
      ctx.fillStyle = '#fae58c';
      ctx.font = '900 18px sans-serif';
      ctx.fillText('2:1', rightX + 39, cy + cellH * 0.52);
    }

    // Outside Bet Dozens (1st 12, 2nd 12, 3rd 12) & Even-Money row
    const outY = gridY + 3 * cellH;
    const dozenW = (12 * cellW) / 3;
    const dozenLabels = ['1st 12', '2nd 12', '3rd 12'];
    for (let i = 0; i < 3; i++) {
      const bx = gridX + i * dozenW;
      ctx.fillStyle = 'rgba(14, 70, 42, 0.75)';
      ctx.fillRect(bx + 2, outY + 2, dozenW - 4, 52);
      ctx.strokeStyle = '#f0db86';
      ctx.lineWidth = 3.5;
      ctx.strokeRect(bx, outY, dozenW, 56);
      ctx.fillStyle = '#fae58c';
      ctx.font = '900 22px sans-serif';
      ctx.fillText(dozenLabels[i], bx + dozenW * 0.5, outY + 29);
    }

    const subY = outY + 56;
    const subW = (12 * cellW) / 6;
    const subLabels = ['1-18', 'EVEN', 'RED', 'BLACK', 'ODD', '19-36'];
    for (let i = 0; i < 6; i++) {
      const bx = gridX + i * subW;
      ctx.fillStyle = i === 2 ? '#991b1b' : i === 3 ? '#18181b' : 'rgba(14, 70, 42, 0.8)';
      ctx.fillRect(bx + 2, subY + 2, subW - 4, 54);
      ctx.strokeStyle = '#f0db86';
      ctx.lineWidth = 3.5;
      ctx.strokeRect(bx, subY, subW, 58);
      if (i === 2 || i === 3) {
        // Classic Red & Black Casino Diamonds
        ctx.fillStyle = i === 2 ? '#dc2626' : '#09090b';
        ctx.strokeStyle = '#fae58c';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(bx + subW * 0.5, subY + 10);
        ctx.lineTo(bx + subW * 0.5 + 24, subY + 29);
        ctx.lineTo(bx + subW * 0.5, subY + 48);
        ctx.lineTo(bx + subW * 0.5 - 24, subY + 29);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 20px sans-serif';
        ctx.fillText(subLabels[i], bx + subW * 0.5, subY + 30);
      }
    }
  });

  // 7. Precision 37-Pocket Roulette Wheel Rotor Disc (512x512, screen_3cc6b11f.png)
  const rouletteWheelDisc = makeCanvasTex(512, 512, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    ctx.fillStyle = '#4d2312';
    ctx.fillRect(0, 0, w, h);

    const wheelSeq = [
      0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
      5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
    ];
    const redSet = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
    const pockets = wheelSeq.length;

    for (let i = 0; i < pockets; i++) {
      const a0 = (i / pockets) * Math.PI * 2;
      const a1 = ((i + 1) / pockets) * Math.PI * 2;
      const num = wheelSeq[i];
      // Outer colored number track ring
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 244, a0, a1);
      ctx.closePath();
      ctx.fillStyle = num === 0 ? '#15803d' : redSet.has(num) ? '#b91c1c' : '#111827';
      ctx.fill();
      ctx.strokeStyle = '#e7c667';
      ctx.lineWidth = 2.6;
      ctx.stroke();

      // Radial pocket numeral
      const midA = (a0 + a1) * 0.5;
      ctx.save();
      ctx.translate(cx + Math.cos(midA) * 212, cy + Math.sin(midA) * 212);
      ctx.rotate(midA + Math.PI * 0.5);
      ctx.fillStyle = '#fefce8';
      ctx.font = '900 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(num), 0, 0);
      ctx.restore();
    }

    // Inner brass pocket separator bezel
    ctx.beginPath();
    ctx.arc(cx, cy, 186, 0, Math.PI * 2);
    ctx.strokeStyle = '#f3d778';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Inner pocket divider ring + polished burled mahogany center cone
    const coneGrad = ctx.createRadialGradient(cx, cy, 24, cx, cy, 148);
    coneGrad.addColorStop(0, '#854220');
    coneGrad.addColorStop(0.65, '#662f15');
    coneGrad.addColorStop(1, '#441d0b');
    ctx.beginPath();
    ctx.arc(cx, cy, 148, 0, Math.PI * 2);
    ctx.fillStyle = coneGrad;
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#e7c667';
    ctx.stroke();

    // Brass spindle collar plate
    ctx.beginPath();
    ctx.arc(cx, cy, 62, 0, Math.PI * 2);
    ctx.fillStyle = '#d4af37';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fef08a';
    ctx.stroke();
  });

  // 8. Slot Machine Rounded JACKPOT Marquee (screen.png)
  const slotMarquee = makeCanvasTex(512, 224, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 18, w * 0.5, h * 0.5, w * 0.65);
    grad.addColorStop(0, '#9333ea');
    grad.addColorStop(0.55, '#581c87');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w * 0.5, h * 0.5);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.14)';
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-18, -w * 0.6);
      ctx.lineTo(18, -w * 0.6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.strokeStyle = '#e879f9';
    ctx.lineWidth = 4;
    ctx.strokeRect(18, 18, w - 36, h - 36);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#4c1d95';
    ctx.font = '900 84px sans-serif';
    ctx.strokeText('JACKPOT', w * 0.5, h * 0.53);
    const textGrad = ctx.createLinearGradient(0, h * 0.25, 0, h * 0.8);
    textGrad.addColorStop(0, '#fef9c3');
    textGrad.addColorStop(0.5, '#fde047');
    textGrad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = textGrad;
    ctx.fillText('JACKPOT', w * 0.5, h * 0.53);
  });

  // 9. Slot Upper Multi-Tier LED Bonus Screen (screen.png)
  const slotUpperBonus = makeCanvasTex(384, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#3b0764');
    grad.addColorStop(0.55, '#4c1d95');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#e879f9';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);

    ctx.fillStyle = '#581c87';
    ctx.fillRect(18, 18, w - 36, 46);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, w - 36, 46);
    ctx.fillStyle = '#fef08a';
    ctx.font = '900 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MULTI-TIER 777 BONUS', w * 0.5, 42);

    const tiers = [
      { label: 'GRAND  50,000', col: '#fca5a5', border: '#ef4444', y: 80 },
      { label: 'MAJOR  10,000', col: '#fde047', border: '#f59e0b', y: 132 },
      { label: 'MINOR   2,500', col: '#7dd3fc', border: '#38bdf8', y: 184 },
    ];
    for (const t of tiers) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.fillRect(24, t.y, w - 48, 42);
      ctx.strokeStyle = t.border;
      ctx.lineWidth = 3;
      ctx.strokeRect(24, t.y, w - 48, 42);
      ctx.fillStyle = t.col;
      ctx.font = '900 22px sans-serif';
      ctx.fillText(t.label, w * 0.5, t.y + 22);
    }
  });

  // 10. Slot Lower 3-Reel Illuminated Curved Drum Display (screen.png)
  const slotLowerReels = makeCanvasTex(384, 192, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1e1b4b');
    bg.addColorStop(0.5, '#312e81');
    bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const reels = [
      { x: 22, topSym: '★', midSym: '7', botSym: '♦', midCol: '#ef4444' },
      { x: 140, topSym: '♦', midSym: '7', botSym: '★', midCol: '#ef4444' },
      { x: 258, topSym: '★', midSym: '7', botSym: '♦', midCol: '#ef4444' },
    ];
    for (const r of reels) {
      const reelGrad = ctx.createLinearGradient(0, 14, 0, h - 14);
      reelGrad.addColorStop(0, '#cbd5e1');
      reelGrad.addColorStop(0.22, '#fffbeb');
      reelGrad.addColorStop(0.5, '#ffffff');
      reelGrad.addColorStop(0.78, '#fef3c7');
      reelGrad.addColorStop(1, '#94a3b8');
      ctx.fillStyle = reelGrad;
      ctx.fillRect(r.x, 14, 104, h - 28);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 5;
      ctx.strokeRect(r.x, 14, 104, h - 28);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#7c3aed';
      ctx.font = '900 28px serif';
      ctx.fillText(r.topSym, r.x + 52, 36);
      ctx.fillStyle = r.midCol;
      ctx.font = '900 76px serif';
      ctx.fillText(r.midSym, r.x + 52, h * 0.52);
      ctx.fillStyle = '#0284c7';
      ctx.font = '900 28px serif';
      ctx.fillText(r.botSym, r.x + 52, h - 34);
    }

    ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(12, h * 0.5);
    ctx.lineTo(w - 12, h * 0.5);
    ctx.stroke();
  });

  // 11. Arched Exit Door Golden Sunburst Tympanum (512x256, screen_61ebacc8.png)
  const doorSunburstTympanum = makeCanvasTex(512, 256, (ctx, w, h) => {
    const bg = ctx.createRadialGradient(w * 0.5, h, 20, w * 0.5, h, w * 0.52);
    bg.addColorStop(0, '#784617');
    bg.addColorStop(1, '#3b1c0c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h;
    for (let i = 0; i < 15; i++) {
      const a0 = Math.PI + (i / 15) * Math.PI;
      const a1 = a0 + 0.125;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, w * 0.47, a0, a1);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? '#ecd178' : '#c99c36';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 88, Math.PI, 0);
    ctx.fillStyle = '#b48628';
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.48, Math.PI, 0);
    ctx.strokeStyle = '#f5dc82';
    ctx.lineWidth = 10;
    ctx.stroke();
  });

  // 12. Rich Polished Mahogany Wood Grain & Panel Depth (512x512)
  const mahoganyWood = makeCanvasTex(512, 512, (ctx, w, h) => {
    const base = ctx.createLinearGradient(0, 0, w, 0);
    base.addColorStop(0, '#522412');
    base.addColorStop(0.5, '#632c17');
    base.addColorStop(1, '#4a2010');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < h; y += 7) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        w * 0.32,
        y + Math.sin(y * 0.15) * 6,
        w * 0.68,
        y - Math.cos(y * 0.12) * 6,
        w,
        y,
      );
      ctx.strokeStyle = y % 21 === 0 ? 'rgba(28, 10, 4, 0.44)' : 'rgba(130, 66, 34, 0.24)';
      ctx.lineWidth = y % 14 === 0 ? 3 : 1.5;
      ctx.stroke();
    }
  }, 2, 2);

  // 13. Second-Empire Charcoal Slate Mansard Tiles (512x512, screen_07df789a.png)
  const slateMansard = makeCanvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#333b48';
    ctx.fillRect(0, 0, w, h);
    const rowH = 44;
    const colW = 48;
    for (let r = 0; r < h / rowH + 1; r++) {
      const offset = (r % 2) * (colW * 0.5);
      for (let c = -1; c <= w / colW + 1; c++) {
        const tx = c * colW + offset;
        const ty = r * rowH;
        ctx.fillStyle = (r + c) % 3 === 0 ? '#3a4352' : '#2f3744';
        ctx.fillRect(tx + 2, ty + 2, colW - 4, rowH - 4);
        ctx.strokeStyle = '#1b202a';
        ctx.lineWidth = 3;
        ctx.strokeRect(tx, ty, colW, rowH);
      }
    }
  }, 6, 2);

  // 14. Gilded Baroque Scrollwork Filigree & Spandrel Ornament (512x128, screen_ba437caf.png)
  const giltFiligree = makeCanvasTex(512, 128, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#462210');
    bg.addColorStop(0.5, '#6a3a18');
    bg.addColorStop(1, '#3d1c0c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Upper & lower gilt molding rails
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(0, 4, w, 10);
    ctx.fillRect(0, h - 14, w, 10);

    // Repeating Baroque acanthus C-scrolls & rosette medallions
    for (let x = 32; x < w; x += 64) {
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, h * 0.5, 24, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x - 22, h * 0.45, 16, 0.2 * Math.PI, 1.5 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 22, h * 0.45, 16, -0.5 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(x, h * 0.5, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 4, 1);

  // 15. Dark Espresso/Charcoal Diamond-Tufted Leather Upholstery (Armchairs & Stools)
  const leatherTufted = makeCanvasTex(256, 256, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 16, w * 0.5, h * 0.5, w * 0.65);
    grad.addColorStop(0, '#36323a');
    grad.addColorStop(1, '#221f25');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const step = 64;
    ctx.strokeStyle = 'rgba(15, 12, 18, 0.55)';
    ctx.lineWidth = 3;
    for (let i = -w; i <= w * 2; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - h, h);
      ctx.stroke();
    }
    ctx.fillStyle = '#c89d3c';
    for (let y = 32; y < h; y += step) {
      for (let x = 32; x < w; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, 2, 2);

  return {
    persianCarpet,
    carraraMarble,
    creamPanelWall,
    wallPlaster,
    archedMirrorGlass,
    masonryCutaway,
    cofferedCeiling,
    blackjackFelt,
    rouletteFelt,
    rouletteWheelDisc,
    slotMarquee,
    slotUpperBonus,
    slotLowerReels,
    doorSunburstTympanum,
    mahoganyWood,
    slateMansard,
    giltFiligree,
    leatherTufted,
    allTextures: [
      persianCarpet,
      carraraMarble,
      creamPanelWall,
      wallPlaster,
      archedMirrorGlass,
      masonryCutaway,
      cofferedCeiling,
      blackjackFelt,
      rouletteFelt,
      rouletteWheelDisc,
      slotMarquee,
      slotUpperBonus,
      slotLowerReels,
      doorSunburstTympanum,
      mahoganyWood,
      slateMansard,
      giltFiligree,
      leatherTufted,
    ],
  };
}

export interface CasinoAtlasEntry {
  u0: number;
  v0: number;
  uW: number;
  vH: number;
  repeatX: number;
  repeatY: number;
  wrapRepeatX: boolean;
  wrapRepeatY: boolean;
}

export interface CasinoTextureAtlas {
  atlasTexture: THREE.CanvasTexture;
  entries: Map<THREE.Texture, CasinoAtlasEntry>;
}

export function createCasinoTextureAtlas(tex: CasinoTexturePack): CasinoTextureAtlas {
  const atlasSize = 2048;
  const pad = 4;
  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = atlasSize;
  atlasCanvas.height = atlasSize;
  const ctx = atlasCanvas.getContext('2d');
  const entries = new Map<THREE.Texture, CasinoAtlasEntry>();

  const slots: Array<{
    texture: THREE.CanvasTexture;
    x: number;
    y: number;
    w: number;
    h: number;
  }> = [
    // Row 1 (y = 0, h = 392)
    { texture: tex.persianCarpet, x: 4, y: 4, w: 384, h: 384 },
    { texture: tex.carraraMarble, x: 396, y: 4, w: 384, h: 384 },
    { texture: tex.creamPanelWall, x: 788, y: 4, w: 384, h: 384 },
    { texture: tex.wallPlaster, x: 1180, y: 4, w: 384, h: 384 },
    { texture: tex.cofferedCeiling, x: 1572, y: 4, w: 384, h: 384 },

    // Row 2 (y = 392, h = 392)
    { texture: tex.mahoganyWood, x: 4, y: 396, w: 384, h: 384 },
    { texture: tex.slateMansard, x: 396, y: 396, w: 384, h: 384 },
    { texture: tex.rouletteWheelDisc, x: 788, y: 396, w: 384, h: 384 },
    { texture: tex.archedMirrorGlass, x: 1180, y: 396, w: 192, h: 384 },
    { texture: tex.masonryCutaway, x: 1380, y: 396, w: 256, h: 256 },
    { texture: tex.leatherTufted, x: 1644, y: 396, w: 256, h: 256 },

    // Row 3 (y = 784, h = 488)
    { texture: tex.blackjackFelt, x: 4, y: 788, w: 960, h: 480 },
    { texture: tex.rouletteFelt, x: 972, y: 788, w: 960, h: 480 },

    // Row 4 (y = 1272, h = 264)
    { texture: tex.doorSunburstTympanum, x: 4, y: 1276, w: 512, h: 256 },
    { texture: tex.slotMarquee, x: 524, y: 1276, w: 512, h: 224 },
    { texture: tex.slotUpperBonus, x: 1044, y: 1276, w: 384, h: 256 },
    { texture: tex.slotLowerReels, x: 1436, y: 1276, w: 384, h: 192 },

    // Row 5 (y = 1536, h = 136)
    { texture: tex.giltFiligree, x: 4, y: 1540, w: 512, h: 128 },
  ];

  if (ctx) {
    ctx.clearRect(0, 0, atlasSize, atlasSize);
    for (const s of slots) {
      const src = s.texture.image as HTMLCanvasElement | undefined;
      if (!src) continue;
      const wrapSRepeat = s.texture.wrapS === THREE.RepeatWrapping;
      const wrapTRepeat = s.texture.wrapT === THREE.RepeatWrapping;

      ctx.save();
      ctx.beginPath();
      ctx.rect(s.x - pad, s.y - pad, s.w + pad * 2, s.h + pad * 2);
      ctx.clip();

      if (wrapSRepeat || wrapTRepeat) {
        const dxRange = wrapSRepeat ? [-1, 0, 1] : [0];
        const dyRange = wrapTRepeat ? [-1, 0, 1] : [0];
        for (const dy of dyRange) {
          for (const dx of dxRange) {
            ctx.drawImage(src, s.x + dx * s.w, s.y + dy * s.h, s.w, s.h);
          }
        }
      } else {
        const sw = src.width;
        const sh = src.height;
        ctx.drawImage(src, s.x, s.y, s.w, s.h);
        // Clamp-to-edge gutters (top, bottom, left, right, 4 corners)
        ctx.drawImage(src, 0, 0, sw, 1, s.x, s.y - pad, s.w, pad);
        ctx.drawImage(src, 0, sh - 1, sw, 1, s.x, s.y + s.h, s.w, pad);
        ctx.drawImage(src, 0, 0, 1, sh, s.x - pad, s.y, pad, s.h);
        ctx.drawImage(src, sw - 1, 0, 1, sh, s.x + s.w, s.y, pad, s.h);
        ctx.drawImage(src, 0, 0, 1, 1, s.x - pad, s.y - pad, pad, pad);
        ctx.drawImage(src, sw - 1, 0, 1, 1, s.x + s.w, s.y - pad, pad, pad);
        ctx.drawImage(src, 0, sh - 1, 1, 1, s.x - pad, s.y + s.h, pad, pad);
        ctx.drawImage(src, sw - 1, sh - 1, 1, 1, s.x + s.w, s.y + s.h, pad, pad);
      }
      ctx.restore();

      entries.set(s.texture, {
        u0: s.x / atlasSize,
        v0: 1.0 - (s.y + s.h) / atlasSize,
        uW: s.w / atlasSize,
        vH: s.h / atlasSize,
        repeatX: s.texture.repeat.x,
        repeatY: s.texture.repeat.y,
        wrapRepeatX: wrapSRepeat,
        wrapRepeatY: wrapTRepeat,
      });
    }
  }

  const atlasTexture = new THREE.CanvasTexture(atlasCanvas);
  atlasTexture.colorSpace = THREE.SRGBColorSpace;
  // LinearFilter without mipmaps eliminates fract()-seam lines and inter-tile mip bleeding
  atlasTexture.generateMipmaps = false;
  atlasTexture.minFilter = THREE.LinearFilter;
  atlasTexture.magFilter = THREE.LinearFilter;
  atlasTexture.wrapS = THREE.ClampToEdgeWrapping;
  atlasTexture.wrapT = THREE.ClampToEdgeWrapping;
  atlasTexture.needsUpdate = true;

  return { atlasTexture, entries };
}


// =============================================================================
// SHARED GEOMETRY / ASSET BUILDERS
// =============================================================================

function addPart(
  parent: THREE.Object3D,
  styler: CafeAssetStyler,
  geo: THREE.BufferGeometry,
  colorHex: string,
  x: number,
  y: number,
  z: number,
  strokeW = 0.004,
  opts?: Parameters<CafeAssetStyler['styleOpaque']>[4],
): THREE.Mesh {
  const m = new THREE.Mesh(geo);
  styler.styleOpaque(m, geo, colorHex, strokeW, opts);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/**
 * Shared Casino Service/Staff NPC Figure (Dealer, Bartender, Cashier Teller):
 * White dress shirt, tailored dark waistcoat/vest, crisp bowtie, subtle idle smile.
 */
export function buildCasinoStaffNpc(
  styler: CafeAssetStyler,
  role: 'dealer' | 'bartender' | 'cashier',
): THREE.Group {
  const g = new THREE.Group();
  const skinHex = role === 'bartender' ? '#f3c6a5' : role === 'cashier' ? '#eab696' : '#f1c2a0';
  const hairHex = role === 'bartender' ? '#2c1e16' : role === 'cashier' ? '#1c1917' : '#3a2518';
  const vestHex = role === 'dealer' ? '#1e2028' : role === 'bartender' ? '#2c1d18' : '#232736';

  // Trousers / Legs
  const legGeo = makeRoundedBoxGeo(0.11, 0.72, 0.12, 0.03, 1);
  addPart(g, styler, legGeo, '#18181f', -0.09, 0.36, 0, 0.004, { roughness: 0.75 });
  addPart(g, styler, legGeo, '#18181f', 0.09, 0.36, 0, 0.004, { roughness: 0.75 });

  // Torso (White Dress Shirt + Tailored Waistcoat + Bowtie)
  addPart(
    g,
    styler,
    makeRoundedBoxGeo(0.36, 0.48, 0.21, 0.05, 2),
    vestHex,
    0,
    0.96,
    0,
    0.005,
    { roughness: 0.62 },
  );
  // Crisp White Shirt Bib
  addPart(
    g,
    styler,
    new THREE.BoxGeometry(0.14, 0.36, 0.22),
    '#f8fafc',
    0,
    0.99,
    0.008,
    0,
    { roughness: 0.5 },
  );
  // Bowtie
  addPart(
    g,
    styler,
    new THREE.BoxGeometry(0.10, 0.04, 0.23),
    '#991b1b',
    0,
    1.16,
    0.012,
    0,
    { roughness: 0.4 },
  );

  // Arms in white rolled sleeves
  const armGeo = makeRoundedBoxGeo(0.09, 0.42, 0.10, 0.025, 1);
  const leftArm = addPart(g, styler, armGeo, '#f8fafc', -0.24, 0.96, 0.08, 0.004);
  leftArm.rotation.x = -0.45;
  const rightArm = addPart(g, styler, armGeo, '#f8fafc', 0.24, 0.96, 0.08, 0.004);
  rightArm.rotation.x = -0.45;

  // Head + Hair
  addPart(
    g,
    styler,
    new THREE.SphereGeometry(0.165, 14, 12),
    skinHex,
    0,
    1.39,
    0,
    0.005,
    { roughness: 0.55 },
  );
  addPart(
    g,
    styler,
    new THREE.SphereGeometry(0.174, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairHex,
    0,
    1.41,
    -0.015,
    0.004,
    { roughness: 0.7 },
  );
  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.018, 6, 6);
  addPart(g, styler, eyeGeo, '#111827', -0.055, 1.40, 0.148, 0);
  addPart(g, styler, eyeGeo, '#111827', 0.055, 1.40, 0.148, 0);

  return g;
}

// =============================================================================
// SHARED SMOOTH EXTRUDE / ARCH / LATHE HELPERS
// =============================================================================

function makeExtrudeTopMappedGeo(
  drawPlanXZ: (shape: THREE.Shape) => void,
  heightY: number,
  bevel = 0.015,
  bevelSegments = 4,
  curveSegments = 20,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  drawPlanXZ(shape);
  const innerDepth = Math.max(0.004, heightY - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: innerDepth,
    curveSegments,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const spanX = Math.max(1e-4, bb.max.x - bb.min.x);
  const spanZ = Math.max(1e-4, bb.max.z - bb.min.z);
  const pos = geo.getAttribute('position');
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uvs[i * 2] = (pos.getX(i) - bb.min.x) / spanX;
    uvs[i * 2 + 1] = 1 - (pos.getZ(i) - bb.min.z) / spanZ;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geo;
}

function makeHalfArchGeo(width: number, radiusY: number, rectH = 0, curveSegments = 22): THREE.BufferGeometry {
  const hw = width * 0.5;
  const s = new THREE.Shape();
  s.moveTo(-hw, 0);
  s.lineTo(-hw, rectH);
  s.absarc(0, rectH, hw, Math.PI, 0, true);
  s.lineTo(hw, 0);
  s.closePath();
  // Scale vertically above rectH if radiusY !== hw
  const geo = new THREE.ShapeGeometry(s, curveSegments);
  const pos = geo.getAttribute('position');
  const totalH = Math.max(1e-4, rectH + radiusY);
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    let py = pos.getY(i);
    if (py > rectH && hw > 1e-4) {
      py = rectH + ((py - rectH) / hw) * radiusY;
      pos.setY(i, py);
    }
    uvs[i * 2] = px / width + 0.5;
    uvs[i * 2 + 1] = py / totalH;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

function makeArchedRibbonExtrudeGeo(
  outerW: number,
  outerR: number,
  straightH: number,
  borderW: number,
  depthZ: number,
  bevel = 0.008,
): THREE.BufferGeometry {
  const ohw = outerW * 0.5;
  const ihw = Math.max(0.05, ohw - borderW);
  const s = new THREE.Shape();
  s.moveTo(-ohw, 0);
  s.lineTo(-ohw, straightH);
  s.absarc(0, straightH, ohw, Math.PI, 0, true);
  s.lineTo(ohw, 0);
  s.lineTo(ihw, 0);
  s.lineTo(ihw, straightH);
  s.absarc(0, straightH, ihw, 0, Math.PI, false);
  s.lineTo(-ihw, 0);
  s.closePath();

  const innerD = Math.max(0.004, depthZ - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(s, {
    steps: 1,
    depth: innerD,
    curveSegments: 22,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
  });
  geo.translate(0, 0, -innerD * 0.5);
  if (Math.abs(outerR - ohw) > 0.002 && ohw > 1e-4) {
    const pos = geo.getAttribute('position');
    const ratio = outerR / ohw;
    for (let i = 0; i < pos.count; i++) {
      const py = pos.getY(i);
      if (py > straightH) {
        pos.setY(i, straightH + (py - straightH) * ratio);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
  return geo;
}

function makeFlutedColumnGeo(
  radiusBottom: number,
  radiusTop: number,
  height: number,
  fluteCount = 14,
): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, fluteCount * 6, 18, false);
  const pos = geo.getAttribute('position');
  const halfH = height * 0.5;
  const bandMargin = Math.min(0.11, height * 0.08);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const r = Math.hypot(px, pz);
    // Keep top/bottom caps & shaft ends un-fluted for authentic classical fillets
    if (r < 1e-4) continue;
    const distFromEnd = halfH - Math.abs(py);
    if (distFromEnd <= bandMargin) continue;
    const endFade = Math.min(1, (distFromEnd - bandMargin) / 0.08);
    const ang = Math.atan2(pz, px);
    const phase = ((ang / (Math.PI * 2)) * fluteCount) % 1;
    const u = phase < 0 ? phase + 1 : phase;
    // Semicircular concave flutes separated by crisp narrow fillets
    let groove = 0;
    if (u > 0.14 && u < 0.86) {
      const t = ((u - 0.14) / 0.72) * 2 - 1;
      groove = Math.sqrt(Math.max(0, 1 - t * t));
    }
    const depth = radiusBottom * 0.095 * groove * endFade;
    const scale = Math.max(0.2, (r - depth) / r);
    pos.setX(i, px * scale);
    pos.setZ(i, pz * scale);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function makeWallMoldingProfileGeo(
  pointsZY: ReadonlyArray<[number, number]>,
  lengthX: number,
): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(pointsZY[0][0], pointsZY[0][1]);
  for (let i = 1; i < pointsZY.length; i++) {
    s.lineTo(pointsZY[i][0], pointsZY[i][1]);
  }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    steps: 1,
    depth: lengthX,
    bevelEnabled: false,
    curveSegments: 8,
  });
  // Extrude runs along +Z; rotate so profile depth projects into +Z, height is +Y, and length spans [-lengthX/2..+lengthX/2] along X
  geo.rotateY(-Math.PI * 0.5);
  geo.translate(lengthX * 0.5, 0, 0);
  geo.computeVertexNormals();
  return geo;
}

// =============================================================================
// BLUEPRINT #1 & #4: SINGLE-STORY LUXURY HALL + WALLS + PILASTERS + MANSARD CUTAWAY
// =============================================================================

export function buildCasinoSingleStoryCutawayHall(
  parent: THREE.Object3D,
  styler: CafeAssetStyler,
  tex: CasinoTexturePack,
): void {
  const hall = new THREE.Group();
  hall.name = 'GrandCasinoSingleStoryShell';

  const W = 20.0; // [-10.0 .. +10.0]
  const D = 14.0; // [-7.0 .. +7.0]
  const wallH = 4.86;
  const ceilY = 5.18;

  // 1. Beveled Subfloor Plinth Slab & Crimson-Gold Persian Carpet Floor + Carrara Marble Border Apron
  addPart(
    hall,
    styler,
    new RoundedBoxGeometry(W + 1.45, 0.36, D + 1.45, 3, 0.04),
    '#6c685e',
    0,
    -0.20,
    0,
    0.005,
    { roughness: 0.84 },
  );
  addPart(
    hall,
    styler,
    new RoundedBoxGeometry(W + 0.14, 0.04, D + 0.14, 2, 0.015),
    '#f3efe4',
    0,
    -0.015,
    0,
    0,
    { tex: tex.carraraMarble, roughness: 0.24, clearcoat: 0.45 },
  );
  addPart(
    hall,
    styler,
    new RoundedBoxGeometry(W - 1.1, 0.026, D - 1.1, 2, 0.01),
    '#8b141b',
    0,
    0.002,
    0,
    0,
    { tex: tex.persianCarpet, roughness: 0.88, sheen: 0.35 },
  );

  // 2. Sculpted Fluted Corinthian Pilasters, Paneled Dado, Arched Mirrors & 3-Arm Sconces (screen_61ebacc8.png)
  const pilasterRespondGeo = new RoundedBoxGeometry(0.42, 4.30, 0.10, 2, 0.016);
  const pedestalBaseGeo = new RoundedBoxGeometry(0.56, 0.14, 0.36, 3, 0.025);
  const pedestalBodyGeo = new RoundedBoxGeometry(0.48, 0.84, 0.30, 3, 0.022);
  const pedestalInsetGeo = new RoundedBoxGeometry(0.32, 0.56, 0.03, 2, 0.01);
  const pedestalCapGeo = new RoundedBoxGeometry(0.56, 0.10, 0.36, 3, 0.028);
  const pilasterBaseGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.225, 0),
      new THREE.Vector2(0.225, 0.042),
      new THREE.Vector2(0.185, 0.072),
      new THREE.Vector2(0.202, 0.105),
      new THREE.Vector2(0.165, 0.145),
      new THREE.Vector2(0, 0.145),
    ],
    20,
  );
  const pilasterShaftGeo = makeFlutedColumnGeo(0.158, 0.142, 2.74, 14);
  const pilasterCollarGeo = new THREE.TorusGeometry(0.148, 0.019, 8, 20);
  const capitalBellGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.142, 0),
      new THREE.Vector2(0.158, 0.08),
      new THREE.Vector2(0.192, 0.20),
      new THREE.Vector2(0.235, 0.28),
      new THREE.Vector2(0, 0.29),
    ],
    18,
  );
  const acanthusLeafGeo = makeExtrudeTopMappedGeo((s) => {
    s.moveTo(-0.042, 0);
    s.quadraticCurveTo(-0.055, 0.08, -0.028, 0.15);
    s.quadraticCurveTo(0, 0.18, 0.028, 0.15);
    s.quadraticCurveTo(0.055, 0.08, 0.042, 0);
    s.closePath();
  }, 0.022, 0.006, 2, 10);
  acanthusLeafGeo.rotateX(Math.PI * 0.5);
  const voluteCurlGeo = new THREE.TorusGeometry(0.042, 0.018, 8, 14);
  const abacusSlabGeo = new RoundedBoxGeometry(0.52, 0.075, 0.44, 3, 0.022);
  const abacusBossGeo = new THREE.SphereGeometry(0.036, 10, 8);

  const buildPilaster = (px: number, pz: number, rotY: number) => {
    const pg = new THREE.Group();
    pg.position.set(px, 0, pz);
    pg.rotation.y = rotY;
    // Wall Pilaster Respond Backing Strip
    addPart(pg, styler, pilasterRespondGeo, '#efe4cc', 0, 2.22, -0.01, 0.003, {
      tex: tex.wallPlaster,
      roughness: 0.58,
    });
    // Stepped Marble Pedestal w/ Framed Front Inset & Molded Cap
    addPart(pg, styler, pedestalBaseGeo, '#dfd4be', 0, 0.07, 0.06, 0.003, {
      tex: tex.carraraMarble,
      roughness: 0.30,
    });
    addPart(pg, styler, pedestalBodyGeo, '#f2ede3', 0, 0.54, 0.06, 0.004, {
      tex: tex.carraraMarble,
      roughness: 0.26,
      clearcoat: 0.35,
    });
    addPart(pg, styler, pedestalInsetGeo, '#e5ded0', 0, 0.54, 0.205, 0.002, {
      tex: tex.carraraMarble,
      roughness: 0.22,
    });
    addPart(pg, styler, pedestalCapGeo, '#e2d5bc', 0, 1.01, 0.06, 0.003, { roughness: 0.38 });
    // Attic Base & Fluted Shaft
    addPart(pg, styler, pilasterBaseGeo, '#eadfc6', 0, 1.06, 0.09, 0.003, { roughness: 0.42 });
    addPart(pg, styler, pilasterShaftGeo, '#f6efe0', 0, 2.575, 0.09, 0.004, { roughness: 0.44 });
    // Gilded Collar & Carved Corinthian Capital w/ Tiered Acanthus Leaves + Corner Volutes + Abacus
    const collar = addPart(pg, styler, pilasterCollarGeo, '#d4af37', 0, 3.95, 0.09, 0, {
      metalness: 0.86,
      roughness: 0.22,
    });
    collar.rotation.x = Math.PI * 0.5;
    addPart(pg, styler, capitalBellGeo, '#c9a134', 0, 3.96, 0.09, 0.003, {
      roughness: 0.26,
      metalness: 0.80,
    });
    for (let li = 0; li < 6; li++) {
      const a = -Math.PI * 0.42 + (li / 5) * Math.PI * 0.84;
      const leaf = addPart(
        pg,
        styler,
        acanthusLeafGeo,
        '#e7c667',
        Math.sin(a) * 0.165,
        4.04,
        0.09 + Math.cos(a) * 0.165,
        0,
        { metalness: 0.84, roughness: 0.24 },
      );
      leaf.rotation.order = 'YXZ';
      leaf.rotation.y = a;
      leaf.rotation.x = 0.24;
    }
    for (const [vx, vz, ry] of [
      [-0.19, 0.24, 0.45],
      [0.19, 0.24, -0.45],
      [-0.19, -0.05, -0.45],
      [0.19, -0.05, 0.45],
    ] as [number, number, number][]) {
      const vc = addPart(pg, styler, voluteCurlGeo, '#f0d278', vx, 4.22, vz, 0.001, {
        metalness: 0.88,
        roughness: 0.20,
      });
      vc.rotation.y = ry;
    }
    addPart(pg, styler, abacusSlabGeo, '#e6d8b8', 0, 4.29, 0.09, 0.003, { roughness: 0.36 });
    addPart(pg, styler, abacusBossGeo, '#e7c667', 0, 4.29, 0.31, 0, {
      metalness: 0.86,
      roughness: 0.22,
    });
    hall.add(pg);
  };

  // Shared 3-Arm Curved Brass Sconce
  const sconceBackGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.055, 0.015),
      new THREE.Vector2(0.072, 0.055),
      new THREE.Vector2(0.050, 0.13),
      new THREE.Vector2(0, 0.17),
    ],
    14,
  );
  const sconceSideCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0.03),
    new THREE.Vector3(0.06, -0.04, 0.08),
    new THREE.Vector3(0.11, 0.01, 0.11),
    new THREE.Vector3(0.12, 0.06, 0.11),
  ]);
  const sconceArmGeo = new THREE.TubeGeometry(sconceSideCurve, 12, 0.011, 8, false);
  const sconceMidCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0.03),
    new THREE.Vector3(0, -0.03, 0.10),
    new THREE.Vector3(0, 0.05, 0.13),
  ]);
  const sconceMidArmGeo = new THREE.TubeGeometry(sconceMidCurve, 10, 0.011, 8, false);
  const sconceCandleGeo = new THREE.CylinderGeometry(0.014, 0.016, 0.11, 10);
  const sconceFlameGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.022, 0.018),
      new THREE.Vector2(0.016, 0.045),
      new THREE.Vector2(0, 0.072),
    ],
    12,
  );

  const buildWallSconce = (sx: number, sy: number, sz: number, rotY: number) => {
    const sg = new THREE.Group();
    sg.position.set(sx, sy, sz);
    sg.rotation.y = rotY;
    const back = addPart(sg, styler, sconceBackGeo, '#c89d3c', 0, -0.06, 0.01, 0.002, {
      metalness: 0.82,
      roughness: 0.24,
    });
    back.rotation.x = Math.PI * 0.5;

    addPart(sg, styler, sconceArmGeo, '#d4af37', 0, 0, 0, 0, {
      metalness: 0.85,
      roughness: 0.22,
    });
    const leftArm = addPart(sg, styler, sconceArmGeo, '#d4af37', 0, 0, 0, 0, {
      metalness: 0.85,
      roughness: 0.22,
    });
    leftArm.scale.x = -1;
    addPart(sg, styler, sconceMidArmGeo, '#d4af37', 0, 0, 0, 0, {
      metalness: 0.85,
      roughness: 0.22,
    });

    for (const [bx, by, bz] of [[-0.12, 0.11, 0.11], [0, 0.10, 0.13], [0.12, 0.11, 0.11]] as [number, number, number][]) {
      addPart(sg, styler, sconceCandleGeo, '#fffdf5', bx, by, bz, 0);
      addPart(sg, styler, sconceFlameGeo, '#fff5cc', bx, by + 0.055, bz, 0, {
        emissiveHex: '#ffd166',
        emissiveIntensity: 1.65,
        roughness: 0.18,
      });
    }
    hall.add(sg);
  };

  // Sculpted Beaux-Arts Upper Wall Panel Bay & Marble Dado Bay Panel (1:1 screen_61ebacc8.png)
  const buildWallBayPanel = (
    bx: number,
    bz: number,
    rotY: number,
    panelW: number,
    withDadoPanel = true,
  ) => {
    const bg = new THREE.Group();
    bg.position.set(bx, 0, bz);
    bg.rotation.y = rotY;
    // Upper Cream Panel w/ Gilt Molding Trim (y = 1.24 .. 4.18)
    addPart(
      bg,
      styler,
      new RoundedBoxGeometry(panelW, 2.86, 0.036, 2, 0.01),
      '#f4ecda',
      0,
      2.68,
      0.016,
      0.002,
      { tex: tex.creamPanelWall, roughness: 0.56 },
    );
    if (withDadoPanel && panelW >= 0.55) {
      // Raised Beveled Carrara Marble Dado Panel Frame (y = 0.22 .. 0.90)
      addPart(
        bg,
        styler,
        new RoundedBoxGeometry(panelW * 0.88, 0.66, 0.042, 2, 0.012),
        '#f2ede3',
        0,
        0.56,
        0.048,
        0.002,
        { tex: tex.carraraMarble, roughness: 0.26, clearcoat: 0.36 },
      );
    }
    hall.add(bg);
  };

  // True Arched Mirror Bays w/ Flanking Colonnettes, Stepped Archivolte & Scroll Crest (screen_61ebacc8.png)
  const mirrorOuterArchGeo = makeArchedRibbonExtrudeGeo(1.76, 0.88, 2.02, 0.11, 0.09, 0.016);
  const mirrorInnerGiltGeo = makeArchedRibbonExtrudeGeo(1.48, 0.74, 1.98, 0.08, 0.075, 0.012);
  const mirrorPaneGeo = makeHalfArchGeo(1.32, 0.66, 1.98, 24);
  const mirrorSillGeo = new RoundedBoxGeometry(1.88, 0.11, 0.17, 3, 0.028);
  const mirrorJambShaftGeo = makeFlutedColumnGeo(0.056, 0.050, 1.92, 10);
  const mirrorJambCapGeo = new RoundedBoxGeometry(0.16, 0.09, 0.14, 2, 0.02);
  const mirrorCrestShellGeo = makeHalfArchGeo(0.46, 0.20, 0.02, 14);
  const mirrorCrestScrollGeo = new THREE.TorusGeometry(0.095, 0.024, 8, 16, Math.PI * 1.45);
  const mirrorKeystoneGeo = new RoundedBoxGeometry(0.14, 0.20, 0.11, 3, 0.024);

  const buildArchedMirrorBay = (bx: number, bz: number, rotY: number) => {
    const mg = new THREE.Group();
    mg.position.set(bx, 0, bz);
    mg.rotation.y = rotY;
    // Surrounding Cream & Gilt Architectural Wall Bay Backing + Dado Panel
    addPart(mg, styler, new RoundedBoxGeometry(2.08, 3.04, 0.032, 2, 0.01), '#f4ecda', 0, 2.72, 0.014, 0.002, {
      tex: tex.creamPanelWall,
      roughness: 0.56,
    });
    addPart(mg, styler, new RoundedBoxGeometry(1.82, 0.68, 0.045, 2, 0.012), '#f2ede3', 0, 0.56, 0.048, 0.002, {
      tex: tex.carraraMarble,
      roughness: 0.26,
      clearcoat: 0.36,
    });
    // Molded Stone Sill + Flanking Fluted Engaged Colonnettes
    addPart(mg, styler, mirrorSillGeo, '#dfd2b8', 0, 1.22, 0.055, 0.003, { roughness: 0.38 });
    for (const jx of [-0.82, 0.82]) {
      addPart(mg, styler, mirrorJambShaftGeo, '#efe4cc', jx, 2.24, 0.065, 0.002, { roughness: 0.44 });
      addPart(mg, styler, mirrorJambCapGeo, '#d4af37', jx, 3.24, 0.065, 0.002, {
        metalness: 0.82,
        roughness: 0.24,
      });
    }
    // Outer Cream-Stone Molded Archivolte + Inner Gilt Glazing Frame + Venetian Mirror Glass
    addPart(mg, styler, mirrorOuterArchGeo, '#e6d9be', 0, 1.27, 0.045, 0.003, { roughness: 0.40 });
    addPart(mg, styler, mirrorInnerGiltGeo, '#c89d3c', 0, 1.27, 0.055, 0.003, {
      metalness: 0.80,
      roughness: 0.24,
    });
    addPart(mg, styler, mirrorPaneGeo, '#ffffff', 0, 1.27, 0.062, 0, {
      tex: tex.archedMirrorGlass,
      roughness: 0.06,
      metalness: 0.52,
      clearcoat: 0.94,
    });
    // Carved Gilded Baroque Arch Crown: Shell Crest + Keystone + Paired Scroll Volutes
    addPart(mg, styler, mirrorCrestShellGeo, '#e7c667', 0, 4.08, 0.068, 0.002, {
      metalness: 0.86,
      roughness: 0.22,
    });
    addPart(mg, styler, mirrorKeystoneGeo, '#d4af37', 0, 4.09, 0.064, 0.002, {
      metalness: 0.84,
      roughness: 0.24,
    });
    for (const sx of [-0.22, 0.22]) {
      const sc = addPart(mg, styler, mirrorCrestScrollGeo, '#e7c667', sx, 4.10, 0.068, 0, {
        metalness: 0.86,
        roughness: 0.22,
      });
      sc.rotation.z = sx < 0 ? 0.5 : -2.6;
    }
    hall.add(mg);
  };

  // Profiled Extruded Classical Moldings (Dado Chair Rail + Overhanging Cyma Cornice)
  const dadoRailProfile: Array<[number, number]> = [
    [0.00, 0.00],
    [0.10, 0.00],
    [0.14, 0.03],
    [0.145, 0.065],
    [0.12, 0.09],
    [0.155, 0.115],
    [0.155, 0.135],
    [0.00, 0.135],
  ];
  const corniceProfile: Array<[number, number]> = [
    [0.00, 0.00],
    [0.16, 0.00],
    [0.20, 0.05],
    [0.24, 0.09],
    [0.32, 0.13],
    [0.37, 0.18],
    [0.38, 0.22],
    [0.00, 0.22],
  ];

  const doorMinX = CASINO_INTERIOR_BOUNDS.exitDoorX - 1.06;
  const doorMaxX = CASINO_INTERIOR_BOUNDS.exitDoorX + 1.06;
  const northLeftWallW = doorMinX - -(W * 0.5 + 0.2);
  const northRightWallW = W * 0.5 + 0.2 - doorMaxX;

  // Perimeter Walls + Profiled Marble Dado + Repeating Frieze + Dentil Course + Cyma Cornice
  const perimeterWalls: Array<{
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    d: number;
    isCutaway?: boolean;
    isNorthWall?: boolean;
  }> = [
    { x: 0, y: wallH * 0.5, z: -7.05, w: W + 0.4, h: wallH, d: 0.34, isNorthWall: true },
    { x: -10.05, y: wallH * 0.5, z: 0, w: 0.34, h: wallH, d: D + 0.4 },
    { x: 10.05, y: wallH * 0.5, z: 0, w: 0.34, h: wallH, d: D + 0.4 },
    { x: 0, y: wallH * 0.5, z: 7.05, w: W + 0.4, h: wallH, d: 0.34 },
  ];

  const dentilGeo = new RoundedBoxGeometry(0.11, 0.085, 0.12, 2, 0.015);
  const friezeCenterTex = tex.giltFiligree;

  for (const wSpec of perimeterWalls) {
    if (wSpec.isNorthWall) {
      // Cut physical North doorway opening [doorMinX..doorMaxX, y=0..2.66] + recessed upper header behind arch
      if (northLeftWallW > 0.1) {
        addPart(
          hall,
          styler,
          new RoundedBoxGeometry(northLeftWallW, wallH, wSpec.d, 2, 0.025),
          '#f4ecdb',
          (-(W * 0.5 + 0.2) + doorMinX) * 0.5,
          wallH * 0.5,
          wSpec.z,
          0.006,
          { tex: tex.wallPlaster, roughness: 0.62 },
        );
      }
      if (northRightWallW > 0.1) {
        addPart(
          hall,
          styler,
          new RoundedBoxGeometry(northRightWallW, wallH, wSpec.d, 2, 0.025),
          '#f4ecdb',
          (doorMaxX + (W * 0.5 + 0.2)) * 0.5,
          wallH * 0.5,
          wSpec.z,
          0.006,
          { tex: tex.wallPlaster, roughness: 0.62 },
        );
      }
      const headerY0 = 2.64;
      const headerH = wallH - headerY0;
      addPart(
        hall,
        styler,
        new RoundedBoxGeometry(doorMaxX - doorMinX + 0.04, headerH, 0.26, 2, 0.02),
        '#f4ecdb',
        (doorMinX + doorMaxX) * 0.5,
        headerY0 + headerH * 0.5,
        -7.09,
        0.004,
        { tex: tex.wallPlaster, roughness: 0.62 },
      );
    } else {
      addPart(
        hall,
        styler,
        new RoundedBoxGeometry(wSpec.w, wSpec.h, wSpec.d, 2, 0.025),
        wSpec.isCutaway ? '#d6c8ad' : '#f4ecdb',
        wSpec.x,
        wSpec.y,
        wSpec.z,
        0.006,
        {
          tex: wSpec.isCutaway ? tex.carraraMarble : tex.wallPlaster,
          roughness: wSpec.isCutaway ? 0.34 : 0.62,
        },
      );
    }
    if (!wSpec.isCutaway) {
      const isZWall = wSpec.w > wSpec.d;
      const wallSpan = isZWall ? wSpec.w - 0.2 : wSpec.d - 0.2;
      const innerFaceX = wSpec.x === 0 ? 0 : wSpec.x < 0 ? -9.88 : 9.88;
      const innerFaceZ = wSpec.z === 0 ? 0 : wSpec.z < 0 ? -6.88 : 6.88;
      const wallRotY =
        wSpec.x === 0
          ? wSpec.z > 0
            ? Math.PI
            : 0
          : wSpec.x < 0
            ? Math.PI * 0.5
            : -Math.PI * 0.5;

      // Split lower wall moldings cleanly around the North Wall Grand Exit Doorway
      const lowerSegments: Array<{ alongCoord: number; len: number }> = [];
      if (isZWall && wSpec.z < 0) {
        const wallLeft = -wallSpan * 0.5;
        const wallRight = wallSpan * 0.5;
        if (doorMinX > wallLeft + 0.1) {
          lowerSegments.push({
            alongCoord: (wallLeft + doorMinX) * 0.5,
            len: doorMinX - wallLeft,
          });
        }
        if (wallRight > doorMaxX + 0.1) {
          lowerSegments.push({
            alongCoord: (doorMaxX + wallRight) * 0.5,
            len: wallRight - doorMaxX,
          });
        }
      } else {
        lowerSegments.push({ alongCoord: 0, len: wallSpan });
      }

      for (const seg of lowerSegments) {
        const segX = isZWall ? seg.alongCoord : innerFaceX;
        const segZ = isZWall ? innerFaceZ : seg.alongCoord;

        // Stepped Dark Marble Baseboard Skirting (0..0.14m) + Carrara Dado Backing (0.14..0.98m)
        addPart(
          hall,
          styler,
          new RoundedBoxGeometry(
            isZWall ? seg.len : 0.11,
            0.14,
            isZWall ? 0.11 : seg.len,
            2,
            0.02,
          ),
          '#d7cfc0',
          segX,
          0.07,
          segZ,
          0.002,
          { tex: tex.carraraMarble, roughness: 0.30 },
        );
        addPart(
          hall,
          styler,
          new RoundedBoxGeometry(
            isZWall ? seg.len : 0.07,
            0.86,
            isZWall ? 0.07 : seg.len,
            2,
            0.016,
          ),
          '#f2ede2',
          segX,
          0.57,
          segZ,
          0.003,
          { tex: tex.carraraMarble, roughness: 0.26, clearcoat: 0.36 },
        );

        // Extruded Profiled Molded Marble Dado Chair-Rail (0.98..1.115m)
        const rail = addPart(
          hall,
          styler,
          makeWallMoldingProfileGeo(dadoRailProfile, seg.len),
          '#e0d3b8',
          segX,
          0.98,
          segZ,
          0.002,
          { roughness: 0.38 },
        );
        rail.rotation.y = wallRotY;
      }

      // Stepped Classical Architrave Band (4.33..4.42m)
      addPart(
        hall,
        styler,
        new RoundedBoxGeometry(
          isZWall ? wallSpan : 0.18,
          0.09,
          isZWall ? 0.18 : wallSpan,
          2,
          0.018,
        ),
        '#e8dcbe',
        innerFaceX,
        4.375,
        innerFaceZ,
        0.002,
        { roughness: 0.42 },
      );

      // Gilded Baroque Acanthus Frieze segmented cleanly in ~4m bays so filigree never stretches
      const friezeSegs = isZWall ? 5 : 4;
      const segLen = wallSpan / friezeSegs;
      for (let si = 0; si < friezeSegs; si++) {
        const offset = -wallSpan * 0.5 + (si + 0.5) * segLen;
        addPart(
          hall,
          styler,
          new RoundedBoxGeometry(
            isZWall ? segLen - 0.02 : 0.21,
            0.25,
            isZWall ? 0.21 : segLen - 0.02,
            2,
            0.02,
          ),
          '#d4af37',
          isZWall ? offset : innerFaceX,
          4.545,
          isZWall ? innerFaceZ : offset,
          0.003,
          { tex: friezeCenterTex, roughness: 0.28, metalness: 0.72 },
        );
      }

      // Classical Dentil Molding Course underneath Overhanging Cornice (4.69m)
      const dentilCount = Math.floor(wallSpan / 0.26);
      for (let di = 0; di < dentilCount; di++) {
        const dOff = -wallSpan * 0.5 + (di + 0.5) * (wallSpan / dentilCount);
        const dent = addPart(
          hall,
          styler,
          dentilGeo,
          '#eadcc0',
          isZWall ? dOff : wSpec.x < 0 ? -9.80 : 9.80,
          4.69,
          isZWall ? (wSpec.z < 0 ? -6.80 : 6.80) : dOff,
          0,
          { roughness: 0.42 },
        );
        dent.rotation.y = wallRotY;
      }

      // Extruded Overhanging Cyma-Recta Cornice Profile (4.72..4.94m)
      const cornice = addPart(
        hall,
        styler,
        makeWallMoldingProfileGeo(corniceProfile, wallSpan + 0.16),
        '#f4ead4',
        innerFaceX,
        4.72,
        innerFaceZ,
        0.003,
        { roughness: 0.40 },
      );
      cornice.rotation.y = wallRotY;
    }
  }

  // North Wall Architectural Rhythm (Pilasters, Arched Mirror Bays, Framed Bar Wing Panel, Exit Door)
  for (const px of [-9.65, -6.95, -4.25, -1.45, 1.35, 3.95, 8.35, 9.65]) {
    buildPilaster(px, -6.86, 0);
  }
  for (const mx of [-8.30, -5.60, -0.05, 2.65, 6.15]) {
    buildArchedMirrorBay(mx, -6.88, 0);
  }
  buildWallBayPanel(9.00, -6.88, 0, 0.80, true);
  buildWallSconce(9.00, 2.78, -6.83, 0);

  // South Wall Architectural Rhythm (Symmetrical 7-Bay Beaux-Arts Grand Salon: 8 Corinthian Pilasters, 3 Arched Venetian Mirrors, 4 Boiserie Sconce Bays)
  for (const px of [-9.65, -6.89, -4.13, -1.38, 1.38, 4.13, 6.89, 9.65]) {
    buildPilaster(px, 6.86, Math.PI);
  }
  for (const mx of [-5.51, 0.0, 5.51]) {
    buildArchedMirrorBay(mx, 6.88, Math.PI);
  }
  for (const bx of [-8.27, -2.755, 2.755, 8.27]) {
    buildWallBayPanel(bx, 6.88, Math.PI, 1.96, true);
    buildWallSconce(bx, 2.78, 6.83, Math.PI);
  }

  // Grand Mahogany Double Exit Door w/ True Arched Golden Sunburst Tympanum (screen_61ebacc8.png)
  const doorG = new THREE.Group();
  doorG.position.set(CASINO_INTERIOR_BOUNDS.exitDoorX, 0, -6.83);
  // Recessed stone shadow backing separated cleanly behind door leaves (`-0.06` vs leaf back `+0.005`)
  addPart(doorG, styler, new RoundedBoxGeometry(2.08, 2.66, 0.04, 2, 0.014), '#bcae92', 0, 1.33, -0.06, 0.002);
  // Flanking stone jambs (y = 0.03..2.59), transom lintel (y = 2.59..2.66) & threshold sill (y = 0..0.03)
  for (const jx of [-0.98, 0.98]) {
    addPart(doorG, styler, new RoundedBoxGeometry(0.18, 2.56, 0.20, 3, 0.025), '#dfd2b8', jx, 1.31, 0.02, 0.004);
  }
  addPart(doorG, styler, new RoundedBoxGeometry(2.20, 0.07, 0.22, 2, 0.016), '#dfd2b8', 0, 2.625, 0.03, 0.004);
  addPart(doorG, styler, new RoundedBoxGeometry(2.16, 0.03, 0.22, 2, 0.01), '#e5ded0', 0, 0.015, 0.03, 0.002);
  addPart(
    doorG,
    styler,
    makeArchedRibbonExtrudeGeo(2.20, 0.94, 0.04, 0.24, 0.20, 0.02),
    '#dfd2b8',
    0,
    2.66,
    0.02,
    0.004,
  );
  const doorLeafGeo = new RoundedBoxGeometry(0.84, 2.54, 0.10, 3, 0.018);
  const doorPanelInsetGeo = new RoundedBoxGeometry(0.60, 0.96, 0.04, 3, 0.012);
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.14, 0.02),
    new THREE.Vector3(0, -0.10, 0.075),
    new THREE.Vector3(0, 0.10, 0.075),
    new THREE.Vector3(0, 0.14, 0.02),
  ]);
  const doorHandleGeo = new THREE.TubeGeometry(handleCurve, 14, 0.016, 8, false);

  // Center Mahogany Astragal Meeting Strip
  addPart(doorG, styler, new RoundedBoxGeometry(0.06, 2.54, 0.06, 2, 0.012), '#461e0f', 0, 1.30, 0.045, 0.002, {
    tex: tex.mahoganyWood,
    roughness: 0.40,
  });

  for (const side of [-0.45, 0.45]) {
    addPart(doorG, styler, doorLeafGeo, '#542614', side, 1.30, 0.055, 0.004, {
      tex: tex.mahoganyWood,
      roughness: 0.38,
      clearcoat: 0.34,
    });
    addPart(doorG, styler, doorPanelInsetGeo, '#6a321a', side, 1.90, 0.10, 0.002, {
      tex: tex.mahoganyWood,
      roughness: 0.35,
    });
    addPart(doorG, styler, doorPanelInsetGeo, '#6a321a', side, 0.76, 0.10, 0.002, {
      tex: tex.mahoganyWood,
      roughness: 0.35,
    });
    addPart(
      doorG,
      styler,
      doorHandleGeo,
      '#e7c667',
      side > 0 ? 0.12 : -0.12,
      1.14,
      0.105,
      0,
      { metalness: 0.88, roughness: 0.20 },
    );
  }
  const tympanumGeo = makeHalfArchGeo(1.74, 0.74, 0.02, 24);
  addPart(doorG, styler, tympanumGeo, '#ffffff', 0, 2.70, 0.06, 0.002, {
    tex: tex.doorSunburstTympanum,
    roughness: 0.30,
    metalness: 0.45,
  });
  addPart(
    doorG,
    styler,
    new THREE.TorusGeometry(0.87, 0.04, 10, 26, Math.PI),
    '#d4af37',
    0,
    2.71,
    0.07,
    0.002,
    { metalness: 0.84, roughness: 0.22 },
  );
  hall.add(doorG);

  // West & East Side Walls: 4 Corinthian Pilasters + 3 Arched Mirror Bays + Flanking Framed Panels & Sconces
  for (const pz of [-6.55, -2.55, 1.45, 5.45]) {
    buildPilaster(-9.86, pz, Math.PI * 0.5);
    buildPilaster(9.86, pz, -Math.PI * 0.5);
  }
  for (const mz of [-4.55, -0.55, 3.45]) {
    buildArchedMirrorBay(-9.88, mz, Math.PI * 0.5);
    buildArchedMirrorBay(9.88, mz, -Math.PI * 0.5);
    // Flanking Framed Cream & Gilt Panels + Centered 3-Arm Brass Sconces (exact screen_61ebacc8.png bay rhythm)
    for (const sOff of [-1.18, 1.18]) {
      buildWallBayPanel(-9.88, mz + sOff, Math.PI * 0.5, 0.72, true);
      buildWallBayPanel(9.88, mz + sOff, -Math.PI * 0.5, 0.72, true);
      buildWallSconce(-9.83, 2.78, mz + sOff, Math.PI * 0.5);
      buildWallSconce(9.83, 2.78, mz + sOff, -Math.PI * 0.5);
    }
  }
  // Cutaway front-end wall bays (+5.45 .. +6.90)
  buildWallBayPanel(-9.88, 6.18, Math.PI * 0.5, 0.96, true);
  buildWallBayPanel(9.88, 6.18, -Math.PI * 0.5, 0.96, true);

  // 3. Ornate Coffered Ceiling (`y = 5.18m`) + Beveled Coffer Beams + Slate Mansard Rim (screen_07df789a.png)
  addPart(
    hall,
    styler,
    new RoundedBoxGeometry(W + 0.4, 0.22, D + 0.4, 2, 0.02),
    '#eee4cc',
    0,
    ceilY,
    0,
    0.005,
    { tex: tex.cofferedCeiling, roughness: 0.52 },
  );
  for (const bx of [-5.0, 0.0, 5.0]) {
    addPart(hall, styler, new RoundedBoxGeometry(0.30, 0.14, D - 0.4, 2, 0.03), '#e2d1aa', bx, ceilY - 0.13, 0, 0.003);
  }
  for (const bz of [-3.5, 0.0, 3.5]) {
    addPart(hall, styler, new RoundedBoxGeometry(W - 0.4, 0.14, 0.30, 2, 0.03), '#e2d1aa', 0, ceilY - 0.13, bz, 0.003);
  }

  const mansardSpecs: Array<{ x: number; y: number; z: number; w: number; h: number; d: number; rx?: number; rz?: number }> = [
    { x: 0, y: 5.58, z: -7.55, w: W + 1.8, h: 1.55, d: 1.15, rx: 0.35 },
    { x: 0, y: 5.58, z: 7.55, w: W + 1.8, h: 1.55, d: 1.15, rx: -0.35 },
    { x: -10.55, y: 5.58, z: 0, w: 1.15, h: 1.55, d: D + 1.8, rz: -0.35 },
    { x: 10.55, y: 5.58, z: 0, w: 1.15, h: 1.55, d: D + 1.8, rz: 0.35 },
  ];
  for (const ms of mansardSpecs) {
    const slab = addPart(
      hall,
      styler,
      new RoundedBoxGeometry(ms.w, ms.h, ms.d, 2, 0.04),
      '#343c49',
      ms.x,
      ms.y,
      ms.z,
      0.006,
      { tex: tex.slateMansard, roughness: 0.72 },
    );
    if (ms.rx) slab.rotation.x = ms.rx;
    if (ms.rz) slab.rotation.z = ms.rz;
  }

  parent.add(hall);
}

// =============================================================================
// BLUEPRINT #3: GRAND ORNATE CRYSTAL CHANDELIER (160cm D x 180cm H, 1:1 Sculpted)
// =============================================================================

export interface ChandelierGeoPack {
  rosetteGeo: THREE.BufferGeometry;
  chainLinkGeo: THREE.BufferGeometry;
  crownRingGeo: THREE.BufferGeometry;
  balusterStemGeo: THREE.BufferGeometry;
  mainRingGeo: THREE.BufferGeometry;
  crystalBasinGeo: THREE.BufferGeometry;
  armGeo: THREE.BufferGeometry;
  bobecheGeo: THREE.BufferGeometry;
  candleGeo: THREE.BufferGeometry;
  flameGeo: THREE.BufferGeometry;
  swagArcGeo: THREE.BufferGeometry;
  pendeloqueGeo: THREE.BufferGeometry;
  finialBallGeo: THREE.BufferGeometry;
}

export function createChandelierGeoPack(): ChandelierGeoPack {
  const rosetteGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.92, 0),
      new THREE.Vector2(0.90, 0.03),
      new THREE.Vector2(0.76, 0.055),
      new THREE.Vector2(0.55, 0.068),
      new THREE.Vector2(0.28, 0.09),
      new THREE.Vector2(0.11, 0.12),
      new THREE.Vector2(0, 0.13),
    ],
    28,
  );
  rosetteGeo.rotateX(Math.PI);

  const chainLinkGeo = new THREE.TorusGeometry(0.034, 0.011, 8, 14);
  const crownRingGeo = new THREE.TorusGeometry(0.24, 0.028, 10, 24);
  const balusterStemGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.055, -0.02),
      new THREE.Vector2(0.115, -0.09),
      new THREE.Vector2(0.062, -0.19),
      new THREE.Vector2(0.145, -0.34),
      new THREE.Vector2(0.135, -0.46),
      new THREE.Vector2(0.072, -0.58),
      new THREE.Vector2(0.160, -0.70),
      new THREE.Vector2(0, -0.74),
    ],
    20,
  );
  const mainRingGeo = new THREE.TorusGeometry(0.68, 0.034, 10, 32);
  const crystalBasinGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.64, 0),
      new THREE.Vector2(0.56, -0.08),
      new THREE.Vector2(0.40, -0.17),
      new THREE.Vector2(0.20, -0.24),
      new THREE.Vector2(0.09, -0.27),
      new THREE.Vector2(0, -0.28),
    ],
    24,
  );

  // Gracefully S-curved Gilt Brass Arm
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -1.24, 0.24),
    new THREE.Vector3(0, -1.32, 0.44),
    new THREE.Vector3(0, -1.25, 0.65),
    new THREE.Vector3(0, -1.12, 0.74),
  ]);
  const armGeo = new THREE.TubeGeometry(armCurve, 18, 0.016, 8, false);
  const bobecheGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.026, 0.005),
      new THREE.Vector2(0.058, 0.024),
      new THREE.Vector2(0.062, 0.034),
      new THREE.Vector2(0, 0.034),
    ],
    14,
  );
  const candleGeo = new THREE.CylinderGeometry(0.017, 0.019, 0.13, 10);
  const flameGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.024, 0.020),
      new THREE.Vector2(0.018, 0.050),
      new THREE.Vector2(0, 0.078),
    ],
    12,
  );

  // Curved Crystal Strand Swag connecting Crown -> Outer Brass Ring
  const swagCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.44, 0.24),
    new THREE.Vector3(0, -0.78, 0.36),
    new THREE.Vector3(0, -1.10, 0.56),
    new THREE.Vector3(0, -1.18, 0.68),
  ]);
  const swagArcGeo = new THREE.TubeGeometry(swagCurve, 16, 0.011, 6, false);

  // Faceted Crystal Pendeloque Teardrop
  const pendeloqueGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.014, -0.02),
      new THREE.Vector2(0.036, -0.06),
      new THREE.Vector2(0.028, -0.10),
      new THREE.Vector2(0, -0.125),
    ],
    8,
  );
  const finialBallGeo = new THREE.SphereGeometry(0.105, 16, 12);

  return {
    rosetteGeo,
    chainLinkGeo,
    crownRingGeo,
    balusterStemGeo,
    mainRingGeo,
    crystalBasinGeo,
    armGeo,
    bobecheGeo,
    candleGeo,
    flameGeo,
    swagArcGeo,
    pendeloqueGeo,
    finialBallGeo,
  };
}

export function buildGrandOrnateChandelier(
  styler: CafeAssetStyler,
  scale = 1.0,
  sharedPack?: ChandelierGeoPack,
): THREE.Group {
  const ch = new THREE.Group();
  ch.name = 'GrandOrnateCrystalChandelier';
  const geo = sharedPack ?? createChandelierGeoPack();

  addPart(ch, styler, geo.rosetteGeo, '#e7c667', 0, 0.02, 0, 0.003, {
    roughness: 0.32,
    metalness: 0.68,
  });
  // Interlocking Brass Chain Links from Rosette -> Crown Tier
  for (let li = 0; li < 6; li++) {
    const link = addPart(ch, styler, geo.chainLinkGeo, '#c89d3c', 0, -0.11 - li * 0.055, 0, 0, {
      metalness: 0.86,
      roughness: 0.22,
    });
    if (li % 2 === 1) link.rotation.y = Math.PI * 0.5;
  }

  addPart(ch, styler, geo.crownRingGeo, '#d4af37', 0, -0.44, 0, 0.002, {
    metalness: 0.86,
    roughness: 0.22,
  }).rotation.x = Math.PI * 0.5;
  addPart(ch, styler, geo.balusterStemGeo, '#eef7ff', 0, -0.44, 0, 0.002, {
    roughness: 0.12,
    clearcoat: 0.92,
    emissiveHex: '#fff4d6',
    emissiveIntensity: 0.34,
  });

  addPart(ch, styler, geo.mainRingGeo, '#d4af37', 0, -1.18, 0, 0.002, {
    metalness: 0.88,
    roughness: 0.20,
  }).rotation.x = Math.PI * 0.5;
  addPart(ch, styler, geo.crystalBasinGeo, '#fff8e7', 0, -1.18, 0, 0.002, {
    roughness: 0.14,
    clearcoat: 0.90,
    emissiveHex: '#ffe7a6',
    emissiveIntensity: 0.45,
  });

  const armCount = 12;
  for (let i = 0; i < armCount; i++) {
    const a = (i / armCount) * Math.PI * 2;
    const armGrp = new THREE.Group();
    armGrp.rotation.y = a;

    addPart(armGrp, styler, geo.armGeo, '#d4af37', 0, 0, 0, 0.001, {
      metalness: 0.86,
      roughness: 0.22,
    });
    addPart(armGrp, styler, geo.bobecheGeo, '#e7c667', 0, -1.12, 0.74, 0, {
      metalness: 0.86,
      roughness: 0.22,
    });
    addPart(armGrp, styler, geo.candleGeo, '#fffdf5', 0, -1.03, 0.74, 0);
    addPart(armGrp, styler, geo.flameGeo, '#fff5cc', 0, -0.96, 0.74, 0, {
      emissiveHex: '#ffd166',
      emissiveIntensity: 1.65,
      roughness: 0.18,
    });
    addPart(armGrp, styler, geo.swagArcGeo, '#f8fcff', 0, 0, 0, 0, {
      emissiveHex: '#fff5d6',
      emissiveIntensity: 0.38,
      roughness: 0.12,
    });
    addPart(armGrp, styler, geo.pendeloqueGeo, '#ffffff', 0, -1.14, 0.74, 0, {
      emissiveHex: '#ffe9b8',
      emissiveIntensity: 0.45,
      roughness: 0.1,
    });
    ch.add(armGrp);
  }

  addPart(ch, styler, geo.finialBallGeo, '#ffffff', 0, -1.54, 0, 0.002, {
    emissiveHex: '#fff0c2',
    emissiveIntensity: 0.50,
    roughness: 0.1,
  });

  ch.scale.setScalar(scale);
  return ch;
}

// =============================================================================
// BLUEPRINT #2: CASHIER CAGE & CHIP EXCHANGE BOOTH (350cm W x 280cm H, 1:1 Sculpted)
// =============================================================================

export function buildCashierCageBooth(
  styler: CafeAssetStyler,
  tex: CasinoTexturePack,
): THREE.Group {
  const g = new THREE.Group();
  g.name = 'CashierCageChipExchangeBooth';

  const W = 3.55;
  const H = 2.82;
  const D = 2.25;
  const frontZ = D * 0.5 - 0.18;

  // 1. Interior Floor & Stepped Lower Mahogany Enclosure Sides/Back (0..1.05m solid base + open upper side security grilles)
  const boothFloorZMin = -D * 0.5 + 0.07;
  const boothFloorZMax = frontZ - 0.24;
  addPart(g, styler, new RoundedBoxGeometry(W - 0.16, 0.04, boothFloorZMax - boothFloorZMin, 2, 0.015), '#3a2216', 0, 0.02, (boothFloorZMin + boothFloorZMax) * 0.5, 0.003);
  addPart(g, styler, new RoundedBoxGeometry(W + 0.16, H, 0.14, 2, 0.02), '#4d2312', 0, H * 0.5, -D * 0.5, 0.005, {
    tex: tex.mahoganyWood,
    roughness: 0.42,
  });
  const sideWainscotZMin = -D * 0.5 + 0.07;
  const sideWainscotZMax = frontZ - 0.24;
  const sideWainscotLen = sideWainscotZMax - sideWainscotZMin;
  const sideWainscotMidZ = (sideWainscotZMin + sideWainscotZMax) * 0.5;
  const sideSillZMax = D * 0.5 - 0.47;
  const sideSillZMin = -D * 0.5 + 0.07;
  // Left & Right Side Lower Mahogany Wainscots + Secure Side Door Pilasters
  for (const side of [-1, 1]) {
    const sx = side * (W * 0.5);
    addPart(g, styler, new RoundedBoxGeometry(0.16, 1.04, sideWainscotLen, 3, 0.02), '#4d2312', sx, 0.52, sideWainscotMidZ, 0.004, {
      tex: tex.mahoganyWood,
      roughness: 0.42,
    });
    // Side Carrara Marble Sill Ledge abutting front marble ledge cleanly
    addPart(g, styler, new RoundedBoxGeometry(0.28, 0.08, sideSillZMax - sideSillZMin, 3, 0.02), '#f4f0e8', sx, 1.08, (sideSillZMin + sideSillZMax) * 0.5, 0.003, {
      tex: tex.carraraMarble,
      roughness: 0.22,
      clearcoat: 0.48,
    });
    // Side Upper Corner Posts & Gilded Filigree Transom + Brass Security Bars
    addPart(g, styler, new RoundedBoxGeometry(0.18, 1.48, 0.18, 3, 0.02), '#522512', sx, 1.85, -D * 0.5 + 0.16, 0.003, {
      tex: tex.mahoganyWood,
    });
    addPart(g, styler, new RoundedBoxGeometry(0.16, 0.24, D - 0.16, 2, 0.015), '#b5892e', sx, 2.38, 0, 0.002, {
      tex: tex.giltFiligree,
      metalness: 0.65,
      roughness: 0.28,
    });
    addPart(g, styler, new RoundedBoxGeometry(0.28, 0.34, D + 0.24, 3, 0.03), '#4a2111', sx, 2.68, 0, 0.004, {
      tex: tex.mahoganyWood,
    });
  }

  // Side Brass Security Bars (matching 3/4 Isometric View in screen_ba437caf.png)
  const sideBarGeo = new THREE.CylinderGeometry(0.013, 0.013, 1.18, 8);
  for (const side of [-1, 1]) {
    const sx = side * (W * 0.5);
    for (let si = -7; si <= 7; si++) {
      addPart(g, styler, sideBarGeo, '#d4af37', sx, 1.70, si * 0.12, 0, {
        metalness: 0.85,
        roughness: 0.22,
      });
    }
  }

  // 2. Heavy Front Mahogany Lower Paneled Counter w/ Stepped Base Plinth & Raised Beveled Panels
  addPart(g, styler, new RoundedBoxGeometry(W + 0.14, 0.14, 0.56, 3, 0.02), '#3e1a0d', 0, 0.07, frontZ, 0.004);
  addPart(g, styler, new RoundedBoxGeometry(W + 0.08, 0.91, 0.48, 3, 0.022), '#4d2312', 0, 0.595, frontZ, 0.005, {
    tex: tex.mahoganyWood,
    roughness: 0.42,
  });
  // 3 Raised Beveled Front Panels w/ Inner Carved Molding + Gold Trim Border
  const panelFrameGeo = new RoundedBoxGeometry(0.92, 0.68, 0.04, 3, 0.012);
  const panelCoreGeo = new RoundedBoxGeometry(0.76, 0.52, 0.05, 3, 0.014);
  for (const px of [-1.06, 0, 1.06]) {
    addPart(g, styler, panelFrameGeo, '#3b180b', px, 0.54, frontZ + 0.24, 0.002);
    addPart(g, styler, panelCoreGeo, '#693019', px, 0.54, frontZ + 0.255, 0.003, {
      tex: tex.mahoganyWood,
      roughness: 0.36,
    });
  }

  // Polished White/Grey Carrara Marble Bullnose Customer Ledge (overhanging front w/ molded brackets)
  addPart(
    g,
    styler,
    new RoundedBoxGeometry(W + 0.28, 0.095, 0.68, 4, 0.028),
    '#f4f0e8',
    0,
    1.08,
    D * 0.5 - 0.13,
    0.004,
    { tex: tex.carraraMarble, roughness: 0.22, clearcoat: 0.48 },
  );

  // 3. Twin Arched Teller Pass-Through Windows + Recessed Steel Cash/Chip Bowls + Teller Service Terminals
  const bowlGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.14, 0.002),
      new THREE.Vector2(0.19, 0.018),
      new THREE.Vector2(0.22, 0.028),
      new THREE.Vector2(0.22, 0.036),
      new THREE.Vector2(0, 0.036),
    ],
    20,
  );
  const archMoldingGeo = makeArchedRibbonExtrudeGeo(0.74, 0.36, 0.72, 0.055, 0.06, 0.012);
  const windowCenterArchGeo = new THREE.TorusGeometry(0.32, 0.022, 8, 20, Math.PI);

  for (const wx of [-0.96, 0.96]) {
    // Semi-circular dipped steel transaction tray inset into marble ledge
    addPart(g, styler, bowlGeo, '#cbd5e1', wx, 1.115, D * 0.5 - 0.02, 0.002, {
      metalness: 0.86,
      roughness: 0.20,
    });
    // Arched Teller Window Frame & Brass Transom Arch
    addPart(g, styler, archMoldingGeo, '#5c2a14', wx, 1.13, D * 0.5 - 0.14, 0.003, {
      tex: tex.mahoganyWood,
    });
    addPart(g, styler, windowCenterArchGeo, '#d4af37', wx, 1.84, D * 0.5 - 0.12, 0, {
      metalness: 0.86,
      roughness: 0.22,
    });
    // Teller Monitor & Chip/Cash Sorter Terminal inside counter
    addPart(g, styler, new RoundedBoxGeometry(0.28, 0.22, 0.04, 3, 0.012), '#1e293b', wx + 0.30, 1.24, D * 0.5 - 0.34, 0.003);
    addPart(g, styler, new RoundedBoxGeometry(0.24, 0.16, 0.02, 2, 0.006), '#38bdf8', wx + 0.30, 1.25, D * 0.5 - 0.362, 0, {
      emissiveHex: '#0284c7',
      emissiveIntensity: 0.45,
    });
  }

  // 4. Four Fluted Mahogany-and-Brass Corinthian Cage Columns + Upper Gilded Filigree Transom + Brass Security Bars
  const cageShaftGeo = new THREE.CylinderGeometry(0.085, 0.095, 1.24, 16);
  const cageCapGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.085, 0),
      new THREE.Vector2(0.115, 0.07),
      new THREE.Vector2(0.135, 0.13),
      new THREE.Vector2(0, 0.14),
    ],
    14,
  );
  for (const px of [-1.72, -0.45, 0.45, 1.72]) {
    addPart(g, styler, new RoundedBoxGeometry(0.20, 0.12, 0.20, 3, 0.02), '#462010', px, 1.19, D * 0.5 - 0.14, 0.003);
    addPart(g, styler, cageShaftGeo, '#5c2813', px, 1.84, D * 0.5 - 0.14, 0.003, {
      tex: tex.mahoganyWood,
    });
    addPart(g, styler, cageCapGeo, '#d4af37', px, 2.42, D * 0.5 - 0.14, 0.002, {
      metalness: 0.84,
      roughness: 0.22,
    });
  }

  // Continuous Ornate Gilded Filigree Spandrel Frieze across Top of Cage Windows
  addPart(g, styler, new RoundedBoxGeometry(W - 0.12, 0.28, 0.10, 2, 0.015), '#b5892e', 0, 2.36, D * 0.5 - 0.14, 0.003, {
    tex: tex.giltFiligree,
    metalness: 0.65,
    roughness: 0.28,
  });

  // Vertical Brass Security Bars across front bays (leaving clean pass-through slot under window arches)
  const frontBarGeo = new THREE.CylinderGeometry(0.013, 0.013, 1.28, 8);
  const shortBarGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.96, 8);
  for (let bi = -15; bi <= 15; bi++) {
    const bx = bi * 0.108;
    const nearPilaster = Math.abs(Math.abs(bx) - 1.72) < 0.09 || Math.abs(Math.abs(bx) - 0.45) < 0.09;
    if (nearPilaster) continue;
    const isWindowPass = Math.abs(Math.abs(bx) - 0.96) < 0.25;
    addPart(
      g,
      styler,
      isWindowPass ? shortBarGeo : frontBarGeo,
      '#d4af37',
      bx,
      isWindowPass ? 1.88 : 1.76,
      D * 0.5 - 0.14,
      0,
      { metalness: 0.86, roughness: 0.22 },
    );
  }

  // Stepped Classical Mahogany Crown Entablature & Overhang (`2.52..2.85m H`)
  addPart(g, styler, new RoundedBoxGeometry(W + 0.24, 0.22, 0.44, 3, 0.025), '#4a2111', 0, 2.63, D * 0.5 - 0.16, 0.005, {
    tex: tex.mahoganyWood,
  });
  addPart(g, styler, new RoundedBoxGeometry(W + 0.36, 0.12, 0.56, 3, 0.03), '#3d1a0d', 0, 2.79, D * 0.5 - 0.14, 0.004);
  addPart(g, styler, new RoundedBoxGeometry(W + 0.36, 0.12, D + 0.36, 3, 0.028), '#3d1a0d', 0, 2.79, 0, 0.003);

  // 5. Rear Mahogany Cabinetry, Illuminated Chip/Ledger Shelves & Twin Swivel Teller Stools
  addPart(g, styler, new RoundedBoxGeometry(W - 0.42, 2.25, 0.54, 3, 0.02), '#4d2312', 0, 1.125, -D * 0.5 + 0.34, 0.004, {
    tex: tex.mahoganyWood,
  });
  addPart(g, styler, new RoundedBoxGeometry(W - 0.78, 0.94, 0.10, 2, 0.015), '#fff3d1', 0, 1.66, -D * 0.5 + 0.58, 0, {
    emissiveHex: '#facc15',
    emissiveIntensity: 0.46,
  });
  // Stacked Chip & Voucher Tubes inside Rear Shelving
  const chipStackColors = ['#dc2626', '#2563eb', '#16a34a', '#eab308', '#a855f7'];
  for (let si = 0; si < 5; si++) {
    addPart(
      g,
      styler,
      new THREE.CylinderGeometry(0.042, 0.042, 0.18, 12),
      chipStackColors[si],
      -0.9 + si * 0.45,
      1.32,
      -D * 0.5 + 0.54,
      0.001,
    );
  }

  // Twin Teller Stools inside booth (Side Profile & Top Plan View in screen_ba437caf.png)
  const tellerStoolBaseGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.18, 0),
      new THREE.Vector2(0.16, 0.03),
      new THREE.Vector2(0.035, 0.06),
      new THREE.Vector2(0.032, 0.44),
      new THREE.Vector2(0, 0.45),
    ],
    18,
  );
  const tellerStoolSeatGeo = new THREE.CylinderGeometry(0.18, 0.17, 0.08, 18);
  const tellerStoolBackGeo = makeCurvedStoolBackrestGeo(0.32, 0.24, 0.05, 0.038);
  const tellerSpineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.42, 0.0),
    new THREE.Vector3(0, 0.425, -0.14),
    new THREE.Vector3(0, 0.50, -0.172),
    new THREE.Vector3(0, 0.68, -0.172),
  ]);
  const tellerStoolSpineGeo = new THREE.TubeGeometry(tellerSpineCurve, 14, 0.014, 8, false);
  for (const tx of [-0.96, 0.96]) {
    const stoolG = new THREE.Group();
    stoolG.position.set(tx, 0.04, 0.12);
    addPart(stoolG, styler, tellerStoolBaseGeo, '#cbd5e1', 0, 0, 0, 0.002, { metalness: 0.8 });
    addPart(stoolG, styler, tellerStoolSpineGeo, '#cbd5e1', 0, 0, 0, 0.002, { metalness: 0.8 });
    addPart(stoolG, styler, tellerStoolSeatGeo, '#29262f', 0, 0.47, 0, 0.003, {
      tex: tex.leatherTufted,
      roughness: 0.55,
    });
    const tBack = addPart(stoolG, styler, tellerStoolBackGeo, '#29262f', 0, 0.54, -0.14, 0.003, {
      tex: tex.leatherTufted,
      roughness: 0.55,
    });
    tBack.rotation.y = Math.PI;
    g.add(stoolG);
  }

  // Cashier Teller is spawned dynamically as a 3D animated Plaza female NPC inside BuddiesBlitzArena

  // 6. Front Turned Brass Stanchions & Draped Crimson Velvet Queue Ropes (`screen_ba437caf.png`)
  const ropeZ = D * 0.5 + 0.78;
  const stanchionXs = [-1.52, -0.52, 0.52, 1.52];
  const stanchionBaseGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.16, 0),
      new THREE.Vector2(0.15, 0.025),
      new THREE.Vector2(0.06, 0.055),
      new THREE.Vector2(0.026, 0.085),
      new THREE.Vector2(0.024, 0.90),
      new THREE.Vector2(0.044, 0.92),
      new THREE.Vector2(0.055, 0.965),
      new THREE.Vector2(0.036, 1.005),
      new THREE.Vector2(0, 1.02),
    ],
    18,
  );
  for (const sx of stanchionXs) {
    addPart(g, styler, stanchionBaseGeo, '#d4af37', sx, 0, ropeZ, 0.002, {
      metalness: 0.88,
      roughness: 0.18,
    });
  }
  for (let i = 0; i < stanchionXs.length - 1; i++) {
    const x0 = stanchionXs[i];
    const x1 = stanchionXs[i + 1];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x0, 0.88, ropeZ),
      new THREE.Vector3((x0 + x1) * 0.5, 0.62, ropeZ),
      new THREE.Vector3(x1, 0.88, ropeZ),
    ]);
    addPart(
      g,
      styler,
      new THREE.TubeGeometry(curve, 16, 0.026, 10, false),
      '#8f141d',
      0,
      0,
      0,
      0.002,
      { roughness: 0.72, sheen: 0.45 },
    );
  }

  return g;
}

// =============================================================================
// BLUEPRINT #5: LUXURY CURVED BAR COUNTER & 3-BAY BACK-BAR (400cm W x 320cm H, 1:1 Sculpted)
// =============================================================================

export function buildLuxuryBarCounterAssembly(
  styler: CafeAssetStyler,
  tex: CasinoTexturePack,
): THREE.Group {
  const g = new THREE.Group();
  g.name = 'LuxuryBarCounterAndBackBar';

  const W = 4.0;
  // 1. 3-Bay Arched Illuminated Back-Bar Wall Display (`z = -1.05`, height 3.20m)
  addPart(g, styler, new RoundedBoxGeometry(W, 0.82, 0.66, 3, 0.025), '#4d2312', 0, 0.41, -1.05, 0.005, {
    tex: tex.mahoganyWood,
  });
  addPart(g, styler, new RoundedBoxGeometry(W + 0.10, 0.07, 0.74, 3, 0.022), '#f4f0e8', 0, 0.84, -1.05, 0.003, {
    tex: tex.carraraMarble,
    roughness: 0.22,
    clearcoat: 0.45,
  });
  // Back-Bar Upper Cabinet Core
  addPart(g, styler, new RoundedBoxGeometry(W, 2.18, 0.42, 3, 0.02), '#4d2312', 0, 1.97, -1.20, 0.005, {
    tex: tex.mahoganyWood,
  });

  // Sculpted Liquor Bottle Lathe Geometry & Cocktail Glass Lathe Geometry
  const bottleGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.042, 0),
      new THREE.Vector2(0.044, 0.14),
      new THREE.Vector2(0.020, 0.18),
      new THREE.Vector2(0.016, 0.25),
      new THREE.Vector2(0, 0.255),
    ],
    12,
  );
  const martiniGlassGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.036, 0),
      new THREE.Vector2(0.006, 0.012),
      new THREE.Vector2(0.006, 0.068),
      new THREE.Vector2(0.052, 0.118),
      new THREE.Vector2(0, 0.118),
    ],
    14,
  );

  // 3 Arched Alcove Bays (Center Wide Arch + Twin Side Arches, matching screen_453c839d.png)
  const centerBayArchFrame = makeArchedRibbonExtrudeGeo(1.74, 0.62, 1.24, 0.14, 0.16, 0.014);
  const sideBayArchFrame = makeArchedRibbonExtrudeGeo(0.98, 0.42, 1.38, 0.11, 0.16, 0.014);
  const centerGlowArch = makeHalfArchGeo(1.52, 0.54, 1.22, 20);
  const sideGlowArch = makeHalfArchGeo(0.80, 0.36, 1.34, 16);

  for (const [bx, bw, isCenter] of [
    [-1.34, 0.80, false],
    [0, 1.54, true],
    [1.34, 0.80, false],
  ] as [number, number, boolean][]) {
    addPart(
      g,
      styler,
      isCenter ? centerGlowArch : sideGlowArch,
      '#ffe8b3',
      bx,
      isCenter ? 0.92 : 0.926,
      -0.98,
      0,
      { emissiveHex: '#fbbf24', emissiveIntensity: 0.65, roughness: 0.28 },
    );
    addPart(
      g,
      styler,
      isCenter ? centerBayArchFrame : sideBayArchFrame,
      '#5c2a14',
      bx,
      isCenter ? 0.92 : 0.926,
      -0.96,
      0.003,
      { tex: tex.mahoganyWood },
    );

    // 3 Back-Bar Shelves stocked with turned bottles
    for (const sy of [1.22, 1.58, 1.94]) {
      addPart(g, styler, new RoundedBoxGeometry(bw - 0.04, 0.04, 0.24, 2, 0.01), '#69341b', bx, sy, -0.90, 0.002);
      const count = isCenter ? 7 : 4;
      for (let bi = 0; bi < count; bi++) {
        const lx = bx - bw * 0.38 + (bi / Math.max(1, count - 1)) * (bw * 0.76);
        const bottleHex = bi % 3 === 0 ? '#15803d' : bi % 3 === 1 ? '#b45309' : '#f59e0b';
        addPart(g, styler, bottleGeo, bottleHex, lx, sy + 0.02, -0.90, 0.001, {
          roughness: 0.16,
          clearcoat: 0.82,
        });
      }
    }
  }

  // 4 Turned Fluted Back-Bar Columns w/ Gilded Corinthian Capitals + Molded Crown Cornice
  const barColGeo = new THREE.CylinderGeometry(0.08, 0.09, 1.88, 16);
  const barCapGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.085, 0),
      new THREE.Vector2(0.115, 0.08),
      new THREE.Vector2(0.14, 0.15),
      new THREE.Vector2(0, 0.16),
    ],
    14,
  );
  for (const cx of [-1.92, -0.92, 0.92, 1.92]) {
    addPart(g, styler, barColGeo, '#5e2c16', cx, 1.84, -0.92, 0.003, { tex: tex.mahoganyWood });
    addPart(g, styler, barCapGeo, '#d4af37', cx, 2.74, -0.92, 0.002, {
      metalness: 0.85,
      roughness: 0.22,
    });
  }
  addPart(g, styler, new RoundedBoxGeometry(W + 0.22, 0.22, 0.56, 3, 0.025), '#4a2111', 0, 3.00, -1.08, 0.004, {
    tex: tex.mahoganyWood,
  });
  addPart(g, styler, new RoundedBoxGeometry(W + 0.34, 0.10, 0.68, 3, 0.03), '#3d1a0d', 0, 3.14, -1.06, 0.004);

  // 2. Continuous U-Shaped Curved Mahogany Front Bar Counter (`1.05m H`) + Continuous Carrara Marble Top
  const drawUBarShape = (s: THREE.Shape, expand = 0) => {
    const outX = 2.04 + expand;
    const inX = 1.44 - expand;
    const backZ = -0.38 - expand;
    const frontZ = 1.22 + expand;
    const inFrontZ = 0.68 - expand;
    const crOut = 0.62 + expand;
    const crIn = Math.max(0.12, 0.24 - expand * 0.4);

    // Note: y_shape = -z_world so rotateX(-PI/2) produces exact world XZ coordinates
    s.moveTo(-outX, -backZ);
    s.lineTo(-outX, -(frontZ - crOut));
    s.quadraticCurveTo(-outX, -frontZ, -(outX - crOut), -frontZ);
    s.lineTo(outX - crOut, -frontZ);
    s.quadraticCurveTo(outX, -frontZ, outX, -(frontZ - crOut));
    s.lineTo(outX, -backZ);
    s.lineTo(inX, -backZ);
    s.lineTo(inX, -(inFrontZ - crIn));
    s.quadraticCurveTo(inX, -inFrontZ, inX - crIn, -inFrontZ);
    s.lineTo(-(inX - crIn), -inFrontZ);
    s.quadraticCurveTo(-inX, -inFrontZ, -inX, -(inFrontZ - crIn));
    s.lineTo(-inX, -backZ);
    s.closePath();
  };

  const uBarBodyGeo = makeExtrudeTopMappedGeo((s) => drawUBarShape(s, 0), 1.01, 0.015, 3, 22);
  const uBarMarbleTopGeo = makeExtrudeTopMappedGeo((s) => drawUBarShape(s, 0.075), 0.08, 0.024, 4, 24);
  addPart(g, styler, uBarBodyGeo, '#4d2312', 0, 0.01, 0, 0.005, {
    tex: tex.mahoganyWood,
    roughness: 0.40,
  });
  addPart(g, styler, uBarMarbleTopGeo, '#f4f0e8', 0, 1.01, 0, 0.004, {
    tex: tex.carraraMarble,
    roughness: 0.20,
    clearcoat: 0.52,
  });

  // Front Raised Mahogany Apron Panels along Bar Face
  for (const px of [-0.95, 0, 0.95]) {
    addPart(g, styler, new RoundedBoxGeometry(0.80, 0.66, 0.05, 3, 0.014), '#693019', px, 0.52, 1.22, 0.003, {
      tex: tex.mahoganyWood,
      roughness: 0.36,
    });
  }

  // Continuous Curved Brushed Brass Footrest Rail sweeping around U-bar customer perimeter
  const footrestCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.14, 0.15, -0.20),
    new THREE.Vector3(-2.14, 0.15, 0.65),
    new THREE.Vector3(-1.98, 0.15, 1.18),
    new THREE.Vector3(-1.35, 0.15, 1.34),
    new THREE.Vector3(0, 0.15, 1.34),
    new THREE.Vector3(1.35, 0.15, 1.34),
    new THREE.Vector3(1.98, 0.15, 1.18),
    new THREE.Vector3(2.14, 0.15, 0.65),
    new THREE.Vector3(2.14, 0.15, -0.20),
  ]);
  addPart(g, styler, new THREE.TubeGeometry(footrestCurve, 44, 0.022, 10, false), '#d4af37', 0, 0, 0, 0.002, {
    metalness: 0.88,
    roughness: 0.20,
  });
  for (const [fx, fz] of [
    [-2.14, 0.18],
    [-1.42, 1.34],
    [-0.48, 1.34],
    [0.48, 1.34],
    [1.42, 1.34],
    [2.14, 0.18],
  ] as [number, number][]) {
    addPart(g, styler, new THREE.CylinderGeometry(0.018, 0.022, 0.15, 8), '#d4af37', fx, 0.075, fz, 0, {
      metalness: 0.86,
    });
  }

  // Crystal Martini Glasses on Marble Top + Stainless Bartender Ice Well / Sink + Standing Bartender NPC
  addPart(g, styler, new RoundedBoxGeometry(0.64, 0.03, 0.34, 2, 0.008), '#cbd5e1', 0.72, 0.90, 0.72, 0.002, {
    metalness: 0.84,
    roughness: 0.24,
  });
  for (const gx of [-0.94, -0.76, 0.78, 0.96]) {
    addPart(g, styler, martiniGlassGeo, '#e0f2fe', gx, 1.09, 0.96, 0, {
      roughness: 0.1,
      clearcoat: 0.92,
    });
  }
  // Bartender is spawned dynamically as a 3D animated Plaza female NPC inside BuddiesBlitzArena

  return g;
}

// =============================================================================
// BLUEPRINT #6: ELECTRONIC SLOT MACHINE & SWIVEL CHAIR (60cm W x 190cm H, 1:1 Rounded)
// =============================================================================

function makeSmoothRoundedSideExtrude(
  drawShape: (shape: THREE.Shape) => void,
  thicknessX: number,
  bevel = 0.01,
  bevelSegments = 4,
  curveSegments = 16,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  drawShape(shape);
  const innerDepth = Math.max(0.004, thicknessX - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: innerDepth,
    curveSegments,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments,
  });
  geo.translate(0, 0, -innerDepth * 0.5);
  // 2D (shape.x -> +Z, shape.y -> +Y, depth -> centered around X=0)
  geo.rotateY(-Math.PI / 2);
  return geo;
}

function makeRoundedStadiumShape(w: number, h: number, r: number): THREE.Shape {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const cr = Math.min(r, hw - 0.002, hh - 0.002);
  const s = new THREE.Shape();
  s.moveTo(-hw + cr, -hh);
  s.lineTo(hw - cr, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + cr);
  s.lineTo(hw, hh - cr);
  s.quadraticCurveTo(hw, hh, hw - cr, hh);
  s.lineTo(-hw + cr, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - cr);
  s.lineTo(-hw, -hh + cr);
  s.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);
  s.closePath();
  return s;
}

function makeNormalizedShapeGeo(shape: THREE.Shape, w: number, h: number, curveSegments = 18): THREE.BufferGeometry {
  const geo = new THREE.ShapeGeometry(shape, curveSegments);
  const pos = geo.getAttribute('position');
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uvs[i * 2] = Math.max(0, Math.min(1, pos.getX(i) / w + 0.5));
    uvs[i * 2 + 1] = Math.max(0, Math.min(1, pos.getY(i) / h + 0.5));
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geo;
}

function makeCurvedReelScreenGeo(
  width: number,
  radius: number,
  halfAngleRad: number,
  cols = 8,
  rows = 14,
): THREE.BufferGeometry {
  const verts: number[] = [];
  const norms: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const zBack = radius * Math.cos(halfAngleRad);

  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const theta = -halfAngleRad + v * (halfAngleRad * 2);
    const y = radius * Math.sin(theta);
    const z = radius * Math.cos(theta) - zBack;
    const ny = Math.sin(theta);
    const nz = Math.cos(theta);
    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      const x = (u - 0.5) * width;
      verts.push(x, y, z);
      norms.push(0, ny, nz);
      uvs.push(u, v);
    }
  }

  const stride = cols + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i00 = r * stride + c;
      const i10 = i00 + 1;
      const i01 = i00 + stride;
      const i11 = i01 + 1;
      indices.push(i00, i10, i11, i00, i11, i01);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function makeCurvedStoolBackrestGeo(
  width: number,
  height: number,
  thickness: number,
  curveDepth: number,
): THREE.BufferGeometry {
  // Smooth crescent in X-Z extruded along Y with plush 4-segment bevel, then tapered gently at top/bottom
  const hw = width * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.quadraticCurveTo(0, -curveDepth, hw, 0);
  shape.quadraticCurveTo(hw + 0.015, thickness * 0.5, hw, thickness);
  shape.quadraticCurveTo(0, thickness - curveDepth * 0.88, -hw, thickness);
  shape.quadraticCurveTo(-hw - 0.015, thickness * 0.5, -hw, 0);
  shape.closePath();

  const bevel = 0.022;
  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 6,
    depth: Math.max(0.05, height - bevel * 2),
    curveSegments: 18,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
  });
  // Extrusion depth was +Z; rotate so extrusion is along +Y (vertical backrest height)
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);

  // Taper width slightly toward top & bottom into an ergonomic shield contour
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const yNorm = Math.max(0, Math.min(1, pos.getY(i) / height));
    const widthScale = 0.86 + 0.16 * Math.sin(yNorm * Math.PI * 0.92);
    pos.setX(i, pos.getX(i) * widthScale);
  }
  geo.computeBoundingBox();
  return geo;
}

export interface SlotMachineGeoPack {
  // Cabinet primary sculpted components
  weightedBaseGeo: THREE.BufferGeometry;
  waistCollarGeo: THREE.BufferGeometry;
  baseFrontRecessGeo: THREE.BufferGeometry;
  baseTrimStripGeo: THREE.BufferGeometry;
  sideCheekGeo: THREE.BufferGeometry;
  coreCabinetGeo: THREE.BufferGeometry;
  cheekNeonTrimGeo: THREE.BufferGeometry;
  cheekGoldTrimGeo: THREE.BufferGeometry;
  rosetteDiscGeo: THREE.BufferGeometry;
  // Front interactive bays
  upperScreenFrameGeo: THREE.BufferGeometry;
  upperScreenBezelGeo: THREE.BufferGeometry;
  upperScreenFaceGeo: THREE.BufferGeometry;
  reelDrumScreenGeo: THREE.BufferGeometry;
  reelDividerGeo: THREE.BufferGeometry;
  reelHoodBarGeo: THREE.BufferGeometry;
  buttonDeckBolsterGeo: THREE.BufferGeometry;
  buttonDeckPlateGeo: THREE.BufferGeometry;
  buttonDeckFiligreeGeo: THREE.BufferGeometry;
  buttonCollarGeo: THREE.BufferGeometry;
  buttonCapGeo: THREE.BufferGeometry;
  buttonLedStripGeo: THREE.BufferGeometry;
  underDeckGlowGeo: THREE.BufferGeometry;
  payoutHoodGeo: THREE.BufferGeometry;
  payoutBowlGeo: THREE.BufferGeometry;
  payoutLipGeo: THREE.BufferGeometry;
  // Crown JACKPOT marquee & finial (total height = 1.90m)
  marqueeNeckGeo: THREE.BufferGeometry;
  marqueeShellGeo: THREE.BufferGeometry;
  marqueeInnerRimGeo: THREE.BufferGeometry;
  marqueeFaceGeo: THREE.BufferGeometry;
  marqueeTopBeaconGeo: THREE.BufferGeometry;
  // Side Pull Lever & Rear Service Door / Louvers / Cable Inlet
  leverHubGeo: THREE.BufferGeometry;
  leverArmGeo: THREE.BufferGeometry;
  leverGripGeo: THREE.BufferGeometry;
  rearDoorGeo: THREE.BufferGeometry;
  rearDoorHandleGeo: THREE.BufferGeometry;
  rearKeyEscutcheonGeo: THREE.BufferGeometry;
  rearKeySlotGeo: THREE.BufferGeometry;
  rearVentLouverGeo: THREE.BufferGeometry;
  rearSwitchPlateGeo: THREE.BufferGeometry;
  rearSwitchRockerGeo: THREE.BufferGeometry;
  cablePortGeo: THREE.BufferGeometry;
  cableCordGeo: THREE.BufferGeometry;
  // Adjustable Swivel Stool (1:1 curved cushion, backrest, trumpet base & 4 footrest spokes)
  stoolPedestalGeo: THREE.BufferGeometry;
  stoolFootrestRingGeo: THREE.BufferGeometry;
  stoolFootrestSpokeGeo: THREE.BufferGeometry;
  stoolAdjustLeverGeo: THREE.BufferGeometry;
  stoolAdjustKnobGeo: THREE.BufferGeometry;
  stoolCushionSkirtGeo: THREE.BufferGeometry;
  stoolCushionTopGeo: THREE.BufferGeometry;
  stoolPipingRingGeo: THREE.BufferGeometry;
  stoolBackSpineGeo: THREE.BufferGeometry;
  stoolBackrestGeo: THREE.BufferGeometry;
  stoolBackrestWeltGeo: THREE.BufferGeometry;
}

export function createSlotMachineGeoPack(): SlotMachineGeoPack {
  // 1. Weighted Lower Base Plinth (0..0.45m H, flared curved front foot)
  const weightedBaseGeo = makeSmoothRoundedSideExtrude(
    (s) => {
      s.moveTo(-0.222, 0.010);
      s.lineTo(-0.222, 0.440);
      s.quadraticCurveTo(-0.222, 0.452, -0.205, 0.452);
      s.lineTo(0.205, 0.452);
      s.quadraticCurveTo(0.222, 0.452, 0.222, 0.435);
      s.lineTo(0.222, 0.115);
      s.quadraticCurveTo(0.226, 0.052, 0.272, 0.032);
      s.quadraticCurveTo(0.282, 0.022, 0.274, 0.010);
      s.closePath();
    },
    0.60,
    0.012,
    4,
    14,
  );
  const waistCollarGeo = new RoundedBoxGeometry(0.588, 0.036, 0.444, 4, 0.014);
  const baseFrontRecessGeo = new RoundedBoxGeometry(0.45, 0.27, 0.024, 3, 0.008);
  const baseTrimStripGeo = new RoundedBoxGeometry(0.49, 0.018, 0.022, 3, 0.006);

  // 2. Sculpted Ergonomic Sloping Side Cheeks & Central Cabinet Spine (0.44 .. 1.63m H)
  const drawSlopingCabinetProfile = (s: THREE.Shape, expandZ = 0) => {
    const r = -0.222 - expandZ * 0.5;
    s.moveTo(r, 0.435);
    s.lineTo(r, 1.525);
    s.quadraticCurveTo(r, 1.545, r + 0.025, 1.552);
    // Ergonomic sloping crown rising toward the front
    s.lineTo(0.105 + expandZ * 0.3, 1.632 + expandZ * 0.4);
    s.quadraticCurveTo(0.145 + expandZ, 1.636 + expandZ * 0.4, 0.152 + expandZ, 1.592);
    // Angled upper screen rim
    s.lineTo(0.184 + expandZ, 1.185);
    // Smooth convex 3-reel drum bulge
    s.quadraticCurveTo(0.244 + expandZ, 1.005, 0.192 + expandZ, 0.835);
    // Cantilevered ergonomic button deck nose
    s.lineTo(0.342 + expandZ, 0.778);
    s.quadraticCurveTo(0.382 + expandZ, 0.742, 0.348 + expandZ, 0.694);
    s.lineTo(0.205, 0.688);
    // Recessed knee & payout tray cove
    s.quadraticCurveTo(0.130, 0.605, 0.148, 0.475);
    s.lineTo(0.215, 0.442);
    s.closePath();
  };

  const sideCheekGeo = makeSmoothRoundedSideExtrude((s) => drawSlopingCabinetProfile(s, 0), 0.056, 0.011, 4, 16);
  const coreCabinetGeo = makeSmoothRoundedSideExtrude((s) => drawSlopingCabinetProfile(s, -0.014), 0.506, 0.008, 3, 14);

  // Continuous neon purple trim tube hugging front cheek contour
  const cheekNeonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.50, 0.158),
    new THREE.Vector3(0, 0.61, 0.145),
    new THREE.Vector3(0, 0.695, 0.225),
    new THREE.Vector3(0, 0.742, 0.376),
    new THREE.Vector3(0, 0.802, 0.280),
    new THREE.Vector3(0, 0.865, 0.202),
    new THREE.Vector3(0, 1.005, 0.240),
    new THREE.Vector3(0, 1.185, 0.194),
    new THREE.Vector3(0, 1.40, 0.178),
    new THREE.Vector3(0, 1.595, 0.156),
    new THREE.Vector3(0, 1.628, 0.105),
  ]);
  const cheekNeonTrimGeo = new THREE.TubeGeometry(cheekNeonCurve, 34, 0.011, 10, false);

  // Gold filigree side trim rail sweeping smoothly across cheek side
  const cheekGoldCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.56, -0.08),
    new THREE.Vector3(0, 0.72, 0.08),
    new THREE.Vector3(0, 0.94, 0.14),
    new THREE.Vector3(0, 1.24, 0.11),
    new THREE.Vector3(0, 1.48, 0.05),
  ]);
  const cheekGoldTrimGeo = new THREE.TubeGeometry(cheekGoldCurve, 22, 0.008, 8, false);

  const rosetteDiscGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.052, 0),
      new THREE.Vector2(0.052, 0.009),
      new THREE.Vector2(0.042, 0.014),
      new THREE.Vector2(0.030, 0.014),
      new THREE.Vector2(0.026, 0.020),
      new THREE.Vector2(0, 0.022),
    ],
    20,
  );
  rosetteDiscGeo.rotateZ(-Math.PI / 2);

  // 3. Upper Multi-Tier LED Bonus Screen + Curved 3-Reel Showcase Drum
  const upperScreenFrameGeo = new RoundedBoxGeometry(0.49, 0.365, 0.046, 4, 0.016);
  const upperScreenBezelGeo = new RoundedBoxGeometry(0.465, 0.34, 0.036, 4, 0.014);
  const upperScreenFaceGeo = makeNormalizedShapeGeo(makeRoundedStadiumShape(0.435, 0.31, 0.022), 0.435, 0.31, 12);

  const reelDrumScreenGeo = makeCurvedReelScreenGeo(0.445, 0.28, 0.50, 10, 16);
  const reelDividerArc = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.132, 0.002),
    new THREE.Vector3(0, -0.068, 0.029),
    new THREE.Vector3(0, 0, 0.039),
    new THREE.Vector3(0, 0.068, 0.029),
    new THREE.Vector3(0, 0.132, 0.002),
  ]);
  const reelDividerGeo = new THREE.TubeGeometry(reelDividerArc, 14, 0.006, 8, false);
  const reelHoodBarGeo = new RoundedBoxGeometry(0.485, 0.034, 0.056, 3, 0.014);

  // 4. Cantilevered Bullnose Ergonomic Button Deck + Illuminated Buttons
  const buttonDeckBolsterGeo = new RoundedBoxGeometry(0.555, 0.092, 0.235, 4, 0.036);
  const buttonDeckPlateGeo = new RoundedBoxGeometry(0.495, 0.042, 0.185, 4, 0.016);
  const buttonDeckFiligreeGeo = new RoundedBoxGeometry(0.055, 0.030, 0.145, 3, 0.010);
  const buttonCollarGeo = new THREE.CylinderGeometry(0.022, 0.025, 0.012, 16);
  const buttonCapGeo = new THREE.CylinderGeometry(0.017, 0.019, 0.016, 16);
  const buttonLedStripGeo = new RoundedBoxGeometry(0.28, 0.018, 0.028, 3, 0.006);

  // 5. Recessed Under-Deck Glow & Rounded Chrome Payout Coin Tray
  const underDeckGlowGeo = new RoundedBoxGeometry(0.46, 0.065, 0.045, 3, 0.014);
  const payoutHoodGeo = new RoundedBoxGeometry(0.45, 0.11, 0.065, 4, 0.020);
  const payoutBowlGeo = new RoundedBoxGeometry(0.40, 0.052, 0.105, 4, 0.018);
  const payoutLipGeo = new RoundedBoxGeometry(0.43, 0.032, 0.036, 4, 0.014);

  // 6. Arched Stadium JACKPOT Marquee & Brass Beacon Topper (reaches exact y = 1.90m!)
  const marqueeNeckGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.075, 0),
      new THREE.Vector2(0.075, 0.018),
      new THREE.Vector2(0.054, 0.035),
      new THREE.Vector2(0.054, 0.065),
      new THREE.Vector2(0.068, 0.080),
      new THREE.Vector2(0, 0.080),
    ],
    20,
  );
  const marqueeShape = makeRoundedStadiumShape(0.435, 0.195, 0.078);
  const marqueeShellGeo = new THREE.ExtrudeGeometry(marqueeShape, {
    steps: 1,
    depth: 0.095,
    curveSegments: 18,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.014,
    bevelSegments: 4,
  });
  marqueeShellGeo.translate(0, 0, -0.0475);

  const marqueeInnerShape = makeRoundedStadiumShape(0.405, 0.168, 0.065);
  const marqueeInnerRimGeo = new THREE.ExtrudeGeometry(marqueeInnerShape, {
    steps: 1,
    depth: 0.116,
    curveSegments: 16,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 3,
  });
  marqueeInnerRimGeo.translate(0, 0, -0.058);

  const marqueeFaceGeo = makeNormalizedShapeGeo(makeRoundedStadiumShape(0.382, 0.148, 0.056), 0.382, 0.148, 16);

  const marqueeTopBeaconGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.042, 0),
      new THREE.Vector2(0.042, 0.014),
      new THREE.Vector2(0.030, 0.022),
      new THREE.Vector2(0.030, 0.046),
      new THREE.Vector2(0.022, 0.058),
      new THREE.Vector2(0, 0.062),
    ],
    18,
  );

  // 7. Swept Side Pull Lever & Rear Lockable Service Door
  const leverHubGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.046, 0),
      new THREE.Vector2(0.046, 0.014),
      new THREE.Vector2(0.034, 0.022),
      new THREE.Vector2(0.034, 0.038),
      new THREE.Vector2(0.020, 0.046),
      new THREE.Vector2(0, 0.046),
    ],
    18,
  );
  leverHubGeo.rotateZ(-Math.PI / 2);

  const leverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.022, 0, 0),
    new THREE.Vector3(0.068, 0.05, 0.015),
    new THREE.Vector3(0.074, 0.22, 0.072),
    new THREE.Vector3(0.056, 0.38, 0.125),
  ]);
  const leverArmGeo = new THREE.TubeGeometry(leverCurve, 22, 0.011, 10, false);

  const leverGripGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.016, 0.005),
      new THREE.Vector2(0.022, 0.025),
      new THREE.Vector2(0.034, 0.058),
      new THREE.Vector2(0.036, 0.088),
      new THREE.Vector2(0.024, 0.112),
      new THREE.Vector2(0, 0.122),
    ],
    18,
  );

  const rearDoorGeo = new RoundedBoxGeometry(0.44, 0.98, 0.024, 3, 0.008);
  const rearDoorHandleGeo = new RoundedBoxGeometry(0.024, 0.14, 0.024, 2, 0.006);
  const rearKeyEscutcheonGeo = new THREE.CylinderGeometry(0.022, 0.024, 0.016, 16);
  const rearKeySlotGeo = new RoundedBoxGeometry(0.008, 0.026, 0.018, 1, 0.002);
  const rearVentLouverGeo = new RoundedBoxGeometry(0.135, 0.012, 0.014, 2, 0.004);
  const rearSwitchPlateGeo = new RoundedBoxGeometry(0.095, 0.062, 0.016, 2, 0.005);
  const rearSwitchRockerGeo = new RoundedBoxGeometry(0.032, 0.024, 0.018, 2, 0.004);
  const cablePortGeo = new THREE.CylinderGeometry(0.022, 0.026, 0.024, 14);
  const cableCordCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -0.08, -0.025),
    new THREE.Vector3(0.04, -0.18, -0.015),
  ]);
  const cableCordGeo = new THREE.TubeGeometry(cableCordCurve, 12, 0.009, 8, false);

  // 8. 1:1 Adjustable Height Swivel Stool (Trumpet Brass Base, 4-Spoke Footrest, Crowned Cushion & Curved Shield Backrest)
  const stoolPedestalGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.212, 0),
      new THREE.Vector2(0.212, 0.016),
      new THREE.Vector2(0.195, 0.028),
      new THREE.Vector2(0.115, 0.044),
      new THREE.Vector2(0.056, 0.072),
      new THREE.Vector2(0.042, 0.095),
      new THREE.Vector2(0.038, 0.245),
      new THREE.Vector2(0.045, 0.255),
      new THREE.Vector2(0.034, 0.265),
      new THREE.Vector2(0.034, 0.415),
      new THREE.Vector2(0.075, 0.440),
      new THREE.Vector2(0, 0.445),
    ],
    26,
  );
  const stoolFootrestRingGeo = new THREE.TorusGeometry(0.165, 0.013, 10, 28);
  const stoolFootrestSpokeGeo = new THREE.CylinderGeometry(0.009, 0.010, 0.145, 8);
  const stoolAdjustLeverGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.12, 8);
  const stoolAdjustKnobGeo = new RoundedBoxGeometry(0.042, 0.018, 0.024, 2, 0.006);

  const stoolCushionSkirtGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.195, 0),
      new THREE.Vector2(0.212, 0.014),
      new THREE.Vector2(0.216, 0.048),
      new THREE.Vector2(0.208, 0.062),
      new THREE.Vector2(0, 0.062),
    ],
    28,
  );
  const stoolCushionTopGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.208, 0),
      new THREE.Vector2(0.214, 0.018),
      new THREE.Vector2(0.202, 0.036),
      new THREE.Vector2(0.155, 0.048),
      new THREE.Vector2(0.075, 0.054),
      new THREE.Vector2(0, 0.056),
    ],
    28,
  );
  const stoolPipingRingGeo = new THREE.TorusGeometry(0.214, 0.0065, 8, 28);

  const stoolSpineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.43, 0.02),
    new THREE.Vector3(0, 0.445, 0.14),
    new THREE.Vector3(0, 0.51, 0.215),
    new THREE.Vector3(0, 0.69, 0.215),
  ]);
  const stoolBackSpineGeo = new THREE.TubeGeometry(stoolSpineCurve, 18, 0.016, 10, false);
  const stoolBackrestGeo = makeCurvedStoolBackrestGeo(0.36, 0.29, 0.055, 0.045);

  const backrestWeltCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-0.158, 0.022, 0.005),
      new THREE.Vector3(0, 0.012, 0.048),
      new THREE.Vector3(0.158, 0.022, 0.005),
      new THREE.Vector3(0.178, 0.145, 0.005),
      new THREE.Vector3(0.155, 0.268, 0.005),
      new THREE.Vector3(0, 0.280, 0.048),
      new THREE.Vector3(-0.155, 0.268, 0.005),
      new THREE.Vector3(-0.178, 0.145, 0.005),
    ],
    true,
  );
  const stoolBackrestWeltGeo = new THREE.TubeGeometry(backrestWeltCurve, 32, 0.006, 8, true);

  return {
    weightedBaseGeo,
    waistCollarGeo,
    baseFrontRecessGeo,
    baseTrimStripGeo,
    sideCheekGeo,
    coreCabinetGeo,
    cheekNeonTrimGeo,
    cheekGoldTrimGeo,
    rosetteDiscGeo,
    upperScreenFrameGeo,
    upperScreenBezelGeo,
    upperScreenFaceGeo,
    reelDrumScreenGeo,
    reelDividerGeo,
    reelHoodBarGeo,
    buttonDeckBolsterGeo,
    buttonDeckPlateGeo,
    buttonDeckFiligreeGeo,
    buttonCollarGeo,
    buttonCapGeo,
    buttonLedStripGeo,
    underDeckGlowGeo,
    payoutHoodGeo,
    payoutBowlGeo,
    payoutLipGeo,
    marqueeNeckGeo,
    marqueeShellGeo,
    marqueeInnerRimGeo,
    marqueeFaceGeo,
    marqueeTopBeaconGeo,
    leverHubGeo,
    leverArmGeo,
    leverGripGeo,
    rearDoorGeo,
    rearDoorHandleGeo,
    rearKeyEscutcheonGeo,
    rearKeySlotGeo,
    rearVentLouverGeo,
    rearSwitchPlateGeo,
    rearSwitchRockerGeo,
    cablePortGeo,
    cableCordGeo,
    stoolPedestalGeo,
    stoolFootrestRingGeo,
    stoolFootrestSpokeGeo,
    stoolAdjustLeverGeo,
    stoolAdjustKnobGeo,
    stoolCushionSkirtGeo,
    stoolCushionTopGeo,
    stoolPipingRingGeo,
    stoolBackSpineGeo,
    stoolBackrestGeo,
    stoolBackrestWeltGeo,
  };
}

export function buildElectronicSlotMachineAndStool(
  styler: CafeAssetStyler,
  tex: CasinoTexturePack,
  stoolOffsetZ: number,
  sharedGeoPack?: SlotMachineGeoPack,
  cabinetTheme: CasinoSlotCabinetTheme = CASINO_SLOT_CABINET_THEMES.lucky_draw,
): THREE.Group {
  const g = new THREE.Group();
  g.name = 'ElectronicSlotMachineAndStool';
  const geo = sharedGeoPack ?? createSlotMachineGeoPack();

  // 1. Weighted Charcoal-Slate Base Pedestal w/ Curved Flared Foot & Recessed Front Panel (0 .. 0.45m)
  addPart(g, styler, geo.weightedBaseGeo, '#2a2b34', 0, 0, 0, 0.004, {
    roughness: 0.56,
    metalness: 0.28,
  });
  addPart(g, styler, geo.waistCollarGeo, '#202129', 0, 0.452, 0.006, 0.003, {
    roughness: 0.46,
    metalness: 0.34,
  });
  addPart(g, styler, geo.baseFrontRecessGeo, '#1b1d25', 0, 0.24, 0.218, 0.002, {
    roughness: 0.62,
    metalness: 0.2,
  });
  addPart(g, styler, geo.baseTrimStripGeo, '#d4af37', 0, 0.405, 0.220, 0, {
    metalness: 0.85,
    roughness: 0.22,
  });

  // 2. Sculpted Rounded Sloping Cabinet Body & Side Cheeks (0.45 .. 1.63m)
  addPart(g, styler, geo.coreCabinetGeo, cabinetTheme.coreBodyHex, 0, 0, 0, 0.004, {
    roughness: 0.44,
    metalness: 0.26,
    clearcoat: 0.25,
  });
  for (const side of [-1, 1]) {
    addPart(g, styler, geo.sideCheekGeo, cabinetTheme.sideCheekHex, side * 0.278, 0, 0, 0.004, {
      roughness: 0.42,
      metalness: 0.28,
      clearcoat: 0.3,
    });
    // Glowing Bank-Colored Neon Cheek Frame
    addPart(g, styler, geo.cheekNeonTrimGeo, cabinetTheme.neonTrimHex, side * 0.263, 0, 0, 0, {
      emissiveHex: cabinetTheme.neonEmissiveHex,
      emissiveIntensity: 0.68,
      roughness: 0.2,
    });
    // Gold Filigree Side Molding Rail & Rosette Medallion
    addPart(g, styler, geo.cheekGoldTrimGeo, '#d4af37', side * 0.304, 0, 0, 0, {
      metalness: 0.86,
      roughness: 0.22,
    });
    const rosette = addPart(g, styler, geo.rosetteDiscGeo, '#d4af37', side * 0.304, 0.78, 0.04, 0.002, {
      metalness: 0.88,
      roughness: 0.20,
    });
    if (side < 0) rosette.rotation.y = Math.PI;
  }

  // 3. Angled Upper Multi-Tier LED Bonus Screen (y = 1.19 .. 1.56m)
  const upperBay = new THREE.Group();
  upperBay.position.set(0, 1.375, 0.162);
  upperBay.rotation.x = -0.105;
  g.add(upperBay);
  addPart(upperBay, styler, geo.upperScreenFrameGeo, cabinetTheme.frameHex, 0, 0, -0.006, 0.003, {
    roughness: 0.34,
    metalness: 0.25,
    emissiveHex: cabinetTheme.frameEmissiveHex,
    emissiveIntensity: 0.24,
  });
  addPart(upperBay, styler, geo.upperScreenBezelGeo, '#181424', 0, 0, 0.005, 0.002, {
    roughness: 0.32,
  });
  addPart(upperBay, styler, geo.upperScreenFaceGeo, '#ffffff', 0, 0, 0.0255, 0, {
    tex: tex.slotUpperBonus,
    emissiveHex: cabinetTheme.frameEmissiveHex,
    emissiveIntensity: 0.36,
    roughness: 0.18,
    clearcoat: 0.72,
  });

  // 4. Convex Curved 3-Reel Showcase Drum + Gilt Dividers + Top/Bottom Rounded Hoods (y = 0.85 .. 1.15m)
  addPart(g, styler, geo.reelHoodBarGeo, '#262136', 0, 1.162, 0.194, 0.003, {
    metalness: 0.38,
    roughness: 0.34,
  });
  addPart(g, styler, geo.reelHoodBarGeo, '#262136', 0, 0.848, 0.196, 0.003, {
    metalness: 0.38,
    roughness: 0.34,
  });
  addPart(g, styler, geo.reelDrumScreenGeo, '#ffffff', 0, 1.005, 0.198, 0, {
    tex: tex.slotLowerReels,
    emissiveHex: '#fde047',
    emissiveIntensity: 0.30,
    roughness: 0.14,
    clearcoat: 0.85,
  });
  for (const dx of [-0.224, -0.075, 0.075, 0.224]) {
    addPart(g, styler, geo.reelDividerGeo, '#d4af37', dx, 1.005, 0.199, 0, {
      metalness: 0.88,
      roughness: 0.2,
    });
  }

  // 5. Cantilevered Bullnose Ergonomic Button Deck + Illuminated Push Buttons + Gold Filigree Wings
  const deckGrp = new THREE.Group();
  deckGrp.position.set(0, 0.738, 0.252);
  deckGrp.rotation.x = 0.19;
  g.add(deckGrp);
  addPart(deckGrp, styler, geo.buttonDeckBolsterGeo, cabinetTheme.deckBolsterHex, 0, -0.008, 0.005, 0.003, {
    roughness: 0.38,
    metalness: 0.18,
    clearcoat: 0.45,
    emissiveHex: cabinetTheme.deckEmissiveHex,
    emissiveIntensity: 0.20,
  });
  addPart(deckGrp, styler, geo.buttonDeckPlateGeo, '#231934', 0, 0.025, -0.004, 0.002, {
    roughness: 0.30,
    metalness: 0.25,
  });
  for (const side of [-1, 1]) {
    addPart(deckGrp, styler, geo.buttonDeckFiligreeGeo, '#d4af37', side * 0.242, 0.016, 0.012, 0.002, {
      metalness: 0.88,
      roughness: 0.22,
    });
  }
  addPart(deckGrp, styler, geo.buttonLedStripGeo, '#fbbf24', 0, 0.044, -0.056, 0, {
    emissiveHex: '#f59e0b',
    emissiveIntensity: 0.75,
  });
  const btnSpec: Array<[number, number, string]> = [
    [-0.165, 0.026, '#38bdf8'],
    [-0.105, 0.036, '#38bdf8'],
    [-0.035, 0.036, cabinetTheme.neonTrimHex],
    [0.035, 0.036, '#facc15'],
    [0.105, 0.036, '#facc15'],
    [0.168, 0.022, '#f8fafc'],
  ];
  for (const [bx, bz, colHex] of btnSpec) {
    addPart(deckGrp, styler, geo.buttonCollarGeo, '#18181b', bx, 0.048, bz, 0);
    addPart(deckGrp, styler, geo.buttonCapGeo, colHex, bx, 0.055, bz, 0, {
      emissiveHex: colHex,
      emissiveIntensity: 0.78,
      roughness: 0.2,
    });
  }

  // 6. Recessed Knee Cove Glow & Rounded Chrome Coin Payout Tray (y = 0.46 .. 0.67m)
  addPart(g, styler, geo.underDeckGlowGeo, cabinetTheme.underGlowHex, 0, 0.652, 0.162, 0, {
    emissiveHex: cabinetTheme.underGlowHex,
    emissiveIntensity: 0.72,
    roughness: 0.2,
  });
  addPart(g, styler, geo.payoutHoodGeo, '#262733', 0, 0.562, 0.158, 0.003, {
    roughness: 0.48,
    metalness: 0.35,
  });
  addPart(g, styler, geo.payoutBowlGeo, '#cbd5e1', 0, 0.482, 0.205, 0.002, {
    metalness: 0.86,
    roughness: 0.22,
  });
  addPart(g, styler, geo.payoutLipGeo, '#e2e8f0', 0, 0.495, 0.252, 0.002, {
    metalness: 0.90,
    roughness: 0.18,
  });

  // 7. Rounded Stadium JACKPOT Crown Marquee + Brass Neck + Top Beacon Finial (reaches 1.90m H)
  addPart(g, styler, geo.marqueeNeckGeo, '#d4af37', 0, 1.578, -0.025, 0.002, {
    metalness: 0.86,
    roughness: 0.22,
  });
  addPart(g, styler, geo.marqueeShellGeo, cabinetTheme.frameHex, 0, 1.750, -0.025, 0.003, {
    roughness: 0.34,
    metalness: 0.25,
    clearcoat: 0.4,
  });
  addPart(g, styler, geo.marqueeInnerRimGeo, '#d4af37', 0, 1.750, -0.025, 0.002, {
    metalness: 0.88,
    roughness: 0.20,
  });
  addPart(g, styler, geo.marqueeFaceGeo, '#ffffff', 0, 1.750, 0.042, 0, {
    tex: tex.slotMarquee,
    emissiveHex: '#facc15',
    emissiveIntensity: 0.46,
    roughness: 0.18,
    clearcoat: 0.75,
  });
  const backMarquee = addPart(g, styler, geo.marqueeFaceGeo, '#ffffff', 0, 1.750, -0.092, 0, {
    tex: tex.slotMarquee,
    emissiveHex: '#facc15',
    emissiveIntensity: 0.46,
    roughness: 0.18,
    clearcoat: 0.75,
  });
  backMarquee.rotation.y = Math.PI;
  addPart(g, styler, geo.marqueeTopBeaconGeo, cabinetTheme.neonTrimHex, 0, 1.842, -0.025, 0.002, {
    metalness: 0.84,
    roughness: 0.20,
    emissiveHex: cabinetTheme.neonEmissiveHex,
    emissiveIntensity: 0.62,
  });

  // 8. Sculpted Right-Side Pull Lever (Hub + Swept Chrome Tube + Turned Grip Knob)
  addPart(g, styler, geo.leverHubGeo, '#cbd5e1', 0.296, 0.78, 0.04, 0.002, {
    metalness: 0.88,
    roughness: 0.2,
  });
  addPart(g, styler, geo.leverArmGeo, '#e2e8f0', 0.298, 0.78, 0.04, 0.001, {
    metalness: 0.90,
    roughness: 0.16,
  });
  const grip = addPart(g, styler, geo.leverGripGeo, cabinetTheme.leverGripHex, 0.352, 1.155, 0.165, 0.002, {
    roughness: 0.20,
    clearcoat: 0.88,
    metalness: 0.22,
  });
  grip.rotation.x = 0.28;

  // 9. Rear Elevation Details (Lockable Service Door, Upper/Lower Vent Slots, Cam Lock, Red Power Switch, Cable Inlet)
  addPart(g, styler, geo.rearDoorGeo, '#2a2b34', 0, 0.96, -0.222, 0.003, {
    roughness: 0.52,
    metalness: 0.28,
  });
  addPart(g, styler, geo.rearDoorHandleGeo, '#94a3b8', 0.165, 1.12, -0.238, 0.002, {
    metalness: 0.8,
    roughness: 0.25,
  });
  addPart(g, styler, geo.rearKeyEscutcheonGeo, '#cbd5e1', 0, 1.18, -0.234, 0.001, {
    metalness: 0.85,
  }).rotation.x = Math.PI * 0.5;
  addPart(g, styler, geo.rearKeySlotGeo, '#0f172a', 0, 1.18, -0.238, 0);

  for (const lx of [-0.11, 0.11]) {
    for (let vi = 0; vi < 4; vi++) {
      addPart(g, styler, geo.rearVentLouverGeo, '#14151c', lx, 1.32 + vi * 0.028, -0.234, 0);
    }
    for (let vi = 0; vi < 3; vi++) {
      addPart(g, styler, geo.rearVentLouverGeo, '#14151c', lx, 0.52 + vi * 0.026, -0.234, 0);
    }
  }
  addPart(g, styler, geo.rearSwitchPlateGeo, '#14151c', 0, 0.72, -0.234, 0.001);
  addPart(g, styler, geo.rearSwitchRockerGeo, '#ef4444', 0, 0.72, -0.238, 0, {
    emissiveHex: '#dc2626',
    emissiveIntensity: 0.65,
  });
  // Cable Inlet port & cord on lower left-side / rear flank
  addPart(g, styler, geo.cablePortGeo, '#18181f', -0.296, 0.70, -0.10, 0.001).rotation.z = Math.PI * 0.5;
  addPart(g, styler, geo.cableCordGeo, '#18181f', -0.305, 0.70, -0.10, 0);

  // 10. Adjustable Height Swivel Stool (Trumpet Brass Base, 4-Spoke Footrest, Crowned Cushion & Curved Shield Backrest)
  const stool = new THREE.Group();
  stool.position.set(0, 0, stoolOffsetZ);

  addPart(stool, styler, geo.stoolPedestalGeo, '#d4af37', 0, 0, 0, 0.003, {
    metalness: 0.86,
    roughness: 0.22,
  });
  addPart(stool, styler, geo.stoolFootrestRingGeo, '#d4af37', 0, 0.20, 0, 0.002, {
    metalness: 0.88,
    roughness: 0.20,
  }).rotation.x = Math.PI * 0.5;
  for (let si = 0; si < 4; si++) {
    const a = (si / 4) * Math.PI * 2 + Math.PI * 0.25;
    const spoke = addPart(
      stool,
      styler,
      geo.stoolFootrestSpokeGeo,
      '#c89d3c',
      Math.cos(a) * 0.098,
      0.185,
      Math.sin(a) * 0.098,
      0,
      { metalness: 0.85, roughness: 0.24 },
    );
    spoke.rotation.order = 'YXZ';
    spoke.rotation.y = -a;
    spoke.rotation.z = Math.PI * 0.5 - 0.18;
  }

  // Hydraulic Seat Height Adjust Lever
  const lever = addPart(stool, styler, geo.stoolAdjustLeverGeo, '#cbd5e1', 0.095, 0.415, 0.03, 0, {
    metalness: 0.85,
  });
  lever.rotation.z = Math.PI * 0.5 - 0.12;
  addPart(stool, styler, geo.stoolAdjustKnobGeo, '#18181b', 0.155, 0.405, 0.03, 0.001);

  // Contoured Circular Upholstered Charcoal Leather Cushion (45cm seat base) + Gold Filigree Trim Rings
  addPart(stool, styler, geo.stoolCushionSkirtGeo, '#26252d', 0, 0.445, 0, 0.003, {
    roughness: 0.60,
    sheen: 0.25,
  });
  addPart(stool, styler, geo.stoolCushionTopGeo, '#33313b', 0, 0.505, 0, 0.003, {
    roughness: 0.54,
    sheen: 0.35,
  });
  addPart(stool, styler, geo.stoolPipingRingGeo, '#c89d3c', 0, 0.458, 0, 0, {
    metalness: 0.78,
    roughness: 0.28,
  }).rotation.x = Math.PI * 0.5;
  addPart(stool, styler, geo.stoolPipingRingGeo, '#d4af37', 0, 0.506, 0, 0, {
    metalness: 0.82,
    roughness: 0.25,
  }).rotation.x = Math.PI * 0.5;

  // Curved Brass/Dark Spine Bar + Wrap-Around Contoured Shield Leather Backrest
  addPart(stool, styler, geo.stoolBackSpineGeo, '#c89d3c', 0, 0, 0, 0.002, {
    metalness: 0.84,
    roughness: 0.24,
  });
  addPart(stool, styler, geo.stoolBackrestGeo, '#312f39', 0, 0.585, 0.155, 0.003, {
    roughness: 0.54,
    sheen: 0.32,
  });
  addPart(stool, styler, geo.stoolBackrestWeltGeo, '#c89d3c', 0, 0.585, 0.155, 0, {
    metalness: 0.72,
    roughness: 0.30,
  });

  g.add(stool);

  return g;
}

// =============================================================================
// BLUEPRINT #7: BLACKJACK & BACCARAT TABLE + ARMCHAIRS (240cm W x 76cm H, 1:1 Sculpted)
// =============================================================================

export function buildBlackjackBaccaratTable(
  styler: CafeAssetStyler,
  tex: CasinoTexturePack,
): THREE.Group {
  const g = new THREE.Group();
  g.name = 'BlackjackBaccaratTable';

  // 1. Turned Fluted Mahogany Twin Pedestal Columns, Sledge Feet, H-Stretcher & Rear Footwell w/ Brass Drop Box Lock
  const pedestalColGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.165, 0),
      new THREE.Vector2(0.165, 0.04),
      new THREE.Vector2(0.135, 0.08),
      new THREE.Vector2(0.115, 0.20),
      new THREE.Vector2(0.132, 0.36),
      new THREE.Vector2(0.105, 0.52),
      new THREE.Vector2(0.145, 0.62),
      new THREE.Vector2(0, 0.64),
    ],
    18,
  );
  const footGeo = new RoundedBoxGeometry(0.36, 0.065, 0.62, 3, 0.022);
  for (const px of [-0.62, 0.62]) {
    addPart(g, styler, footGeo, '#451d0e', px, 0.032, 0, 0.004, { tex: tex.mahoganyWood });
    addPart(g, styler, pedestalColGeo, '#522512', px, 0.06, 0, 0.004, {
      tex: tex.mahoganyWood,
      roughness: 0.40,
    });
  }
  addPart(g, styler, new RoundedBoxGeometry(1.24, 0.07, 0.11, 3, 0.02), '#522512', 0, 0.18, 0, 0.003, {
    tex: tex.mahoganyWood,
  });
  // Rear Dealer Modesty Panel (Footwell) + Under-Table Cash Drawer + Brass Drop Box Lock
  addPart(g, styler, new RoundedBoxGeometry(1.24, 0.52, 0.06, 2, 0.014), '#481f10', 0, 0.44, -0.26, 0.003, {
    tex: tex.mahoganyWood,
  });
  addPart(g, styler, new RoundedBoxGeometry(0.56, 0.12, 0.06, 2, 0.012), '#5e2a14', -0.22, 0.63, -0.32, 0.002);
  addPart(g, styler, new THREE.CylinderGeometry(0.018, 0.018, 0.04, 12), '#d4af37', -0.22, 0.63, -0.355, 0, {
    metalness: 0.88,
  }).rotation.x = Math.PI * 0.5;
  addPart(g, styler, new RoundedBoxGeometry(0.16, 0.09, 0.05, 2, 0.012), '#d4af37', 0.36, 0.62, -0.312, 0.001, {
    metalness: 0.86,
    roughness: 0.22,
  });

  // 2. True D-Shaped Mahogany Under-Apron + Crisp Planar-Mapped Green Baize Felt Bed (`0.76m H`)
  const drawDTable = (s: THREE.Shape, R: number, backOffset = 0) => {
    const yStraight = 0.24 + backOffset;
    s.moveTo(-R, yStraight);
    s.absarc(0, 0.24, R, Math.PI, Math.PI * 2, false);
    s.lineTo(R, yStraight);
    s.closePath();
  };
  const bjApronGeo = makeExtrudeTopMappedGeo((s) => drawDTable(s, 1.18, 0.14), 0.075, 0.018, 3, 28);
  const bjFeltGeo = makeExtrudeTopMappedGeo((s) => drawDTable(s, 1.14, 0.04), 0.036, 0.006, 2, 28);
  addPart(g, styler, bjApronGeo, '#4d2312', 0, 0.69, 0, 0.004, { tex: tex.mahoganyWood });
  addPart(g, styler, bjFeltGeo, '#ffffff', 0, 0.742, 0, 0, {
    tex: tex.blackjackFelt,
    roughness: 0.86,
  });

  // Padded Dark Leather D-Arc Armrest Bolster + Twin Brass Hand-Rest Bars + Rear Straight Bolster
  addPart(
    g,
    styler,
    new THREE.TorusGeometry(1.18, 0.068, 12, 32, Math.PI),
    '#27201c',
    0,
    0.765,
    -0.24,
    0.004,
    { roughness: 0.42, sheen: 0.32 },
  ).rotation.set(Math.PI * 0.5, 0, 0);
  addPart(g, styler, new RoundedBoxGeometry(2.44, 0.10, 0.20, 4, 0.042), '#27201c', 0, 0.765, -0.34, 0.004, {
    roughness: 0.42,
    sheen: 0.3,
  });
  // Curved Brass Cup/Rail Inlay Strips on Front Player Edge
  for (const sideAng of [-0.62, 0.62]) {
    const bx = Math.sin(sideAng) * 1.18;
    const bz = -0.24 + Math.cos(sideAng) * 1.18;
    const rail = addPart(g, styler, new THREE.CylinderGeometry(0.012, 0.012, 0.24, 10), '#d4af37', bx, 0.814, bz, 0, {
      metalness: 0.88,
      roughness: 0.2,
    });
    rail.rotation.order = 'YXZ';
    rail.rotation.y = sideAng;
    rail.rotation.z = Math.PI * 0.5;
  }

  // 3. Recessed Mahogany Dealer Chip Rack Tray, Angled Dealing Card Shoe, Discard Rack & Chip Stacks
  addPart(g, styler, new RoundedBoxGeometry(0.72, 0.036, 0.20, 3, 0.012), '#3f2012', 0, 0.785, -0.18, 0.002);
  const chipCols = ['#dc2626', '#2563eb', '#16a34a', '#18181b', '#eab308', '#a855f7'];
  const chipStackGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.042, 12);
  for (let c = 0; c < chipCols.length; c++) {
    addPart(g, styler, chipStackGeo, chipCols[c], -0.25 + c * 0.10, 0.802, -0.18, 0);
  }
  // Angled Card Shoe on Left/Right & Transparent Discard Rack
  const shoe = addPart(g, styler, new RoundedBoxGeometry(0.13, 0.095, 0.23, 3, 0.016), '#1f2937', 0.74, 0.815, -0.14, 0.002, {
    roughness: 0.28,
    clearcoat: 0.6,
  });
  shoe.rotation.y = -0.32;
  addPart(g, styler, new RoundedBoxGeometry(0.11, 0.11, 0.08, 2, 0.01), '#cbd5e1', -0.78, 0.82, -0.15, 0.001, {
    roughness: 0.14,
    clearcoat: 0.85,
  }).rotation.y = 0.25;

  // 4. Three Curved Tufted Dark Leather Casino Armchairs at Exact Seat Spots (`CASINO_INTERIOR_SEAT_SPOTS`)
  const chairBaseGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.22, 0),
      new THREE.Vector2(0.21, 0.024),
      new THREE.Vector2(0.06, 0.055),
      new THREE.Vector2(0.042, 0.085),
      new THREE.Vector2(0.040, 0.43),
      new THREE.Vector2(0.09, 0.45),
      new THREE.Vector2(0, 0.455),
    ],
    22,
  );
  const chairSeatGeo = new RoundedBoxGeometry(0.46, 0.105, 0.44, 4, 0.042);
  const chairBackGeo = makeCurvedStoolBackrestGeo(0.44, 0.34, 0.065, 0.055);
  const chairArmCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.21, 0.66, -0.16),
    new THREE.Vector3(0.23, 0.62, 0.02),
    new THREE.Vector3(0.22, 0.53, 0.15),
    new THREE.Vector3(0.20, 0.48, 0.10),
  ]);
  const chairArmGeo = new THREE.TubeGeometry(chairArmCurve, 14, 0.026, 8, false);

  for (const ang of [-0.72, 0.0, 0.72]) {
    const cx = Math.sin(ang) * 1.58;
    const cz = -0.24 + Math.cos(ang) * 1.58;
    const chair = new THREE.Group();
    chair.position.set(cx, 0, cz);
    chair.rotation.y = ang + Math.PI;
    addPart(chair, styler, chairBaseGeo, '#d4af37', 0, 0, 0, 0.002, {
      metalness: 0.85,
      roughness: 0.22,
    });
    addPart(chair, styler, chairSeatGeo, '#332f38', 0, 0.48, 0, 0.003, {
      tex: tex.leatherTufted,
      roughness: 0.54,
      sheen: 0.3,
    });
    const back = addPart(chair, styler, chairBackGeo, '#332f38', 0, 0.51, -0.19, 0.003, {
      tex: tex.leatherTufted,
      roughness: 0.54,
      sheen: 0.3,
    });
    back.rotation.y = Math.PI;
    addPart(chair, styler, chairArmGeo, '#2a262e', 0, 0, 0, 0.002, { roughness: 0.48 });
    const leftArm = addPart(chair, styler, chairArmGeo, '#2a262e', 0, 0, 0, 0.002, { roughness: 0.48 });
    leftArm.scale.x = -1;
    g.add(chair);
  }

  // Standing Blackjack Dealer is spawned dynamically as a 3D animated Plaza female NPC inside BuddiesBlitzArena

  return g;
}

// =============================================================================
// BLUEPRINT #8: LUXURY ROULETTE TABLE & SPINNING WHEEL (270cm L x 85cm H, 1:1 Sculpted)
// =============================================================================

export interface RouletteTableHandle {
  group: THREE.Group;
  wheelRotor: THREE.Group;
}

export function buildLuxuryRouletteTable(
  styler: CafeAssetStyler,
  tex: CasinoTexturePack,
): RouletteTableHandle {
  const g = new THREE.Group();
  g.name = 'LuxuryRouletteTableAndWheel';

  // 1. Sculpted Carved Lyre/Hourglass Mahogany Pedestal Legs + Beveled Sledge Feet + Cross Stretcher (screen_3cc6b11f.png)
  const lyrePedestalGeo = makeSmoothRoundedSideExtrude(
    (s) => {
      s.moveTo(-0.28, 0.06);
      s.lineTo(-0.24, 0.14);
      s.quadraticCurveTo(-0.14, 0.38, -0.22, 0.62);
      s.lineTo(-0.28, 0.72);
      s.lineTo(0.28, 0.72);
      s.lineTo(0.22, 0.62);
      s.quadraticCurveTo(0.14, 0.38, 0.24, 0.14);
      s.lineTo(0.28, 0.06);
      s.closePath();
    },
    0.20,
    0.016,
    4,
    16,
  );
  const sledgeFootGeo = new RoundedBoxGeometry(0.32, 0.075, 0.78, 3, 0.025);
  for (const px of [-0.88, 0.88]) {
    addPart(g, styler, sledgeFootGeo, '#3e1a0d', px, 0.037, 0, 0.004, { tex: tex.mahoganyWood });
    addPart(g, styler, lyrePedestalGeo, '#4d2312', px, 0, 0, 0.004, {
      tex: tex.mahoganyWood,
      roughness: 0.40,
    });
  }
  addPart(g, styler, new RoundedBoxGeometry(1.76, 0.085, 0.12, 3, 0.02), '#4d2312', 0, 0.21, 0, 0.003, {
    tex: tex.mahoganyWood,
  });

  // 2. Contoured Roulette Table Bed w/ Curved Wheel-End Bulge + Continuous Padded Leather Rail (`Top Plan Layout`)
  const drawRoulettePlan = (s: THREE.Shape, expand = 0) => {
    const leftX = -1.32 - expand;
    const rightX = 1.36 + expand;
    const topFrontZ = 0.62 + expand; // player side (+Z) -> y_shape = -topFrontZ
    const backGridZ = -0.60 - expand; // dealer side (-Z) -> y_shape = -backGridZ
    const backWheelZ = -0.74 - expand; // wider bulge behind wheel
    const r = 0.22 + expand * 0.5;
    const rWheel = 0.52 + expand * 0.5;

    s.moveTo(leftX + r, -topFrontZ);
    s.lineTo(rightX - rWheel, -topFrontZ);
    s.quadraticCurveTo(rightX, -topFrontZ, rightX, -(topFrontZ - rWheel));
    s.lineTo(rightX, -(backWheelZ + rWheel));
    s.quadraticCurveTo(rightX, -backWheelZ, rightX - rWheel, -backWheelZ);
    s.lineTo(0.46, -backWheelZ);
    s.quadraticCurveTo(0.30, -backWheelZ, 0.22, -backGridZ);
    s.lineTo(leftX + r, -backGridZ);
    s.quadraticCurveTo(leftX, -backGridZ, leftX, -(backGridZ + r));
    s.lineTo(leftX, -(topFrontZ - r));
    s.quadraticCurveTo(leftX, -topFrontZ, leftX + r, -topFrontZ);
    s.closePath();
  };

  const rouletteBedGeo = makeExtrudeTopMappedGeo((s) => drawRoulettePlan(s, 0), 0.115, 0.024, 4, 20);
  addPart(g, styler, rouletteBedGeo, '#4d2312', 0, 0.72, 0, 0.005, {
    tex: tex.mahoganyWood,
    roughness: 0.40,
  });

  // Continuous Padded Dark Leather Armrest Bolster hugging the contoured table outline
  const railCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-1.12, 0.845, 0.64),
      new THREE.Vector3(0.0, 0.845, 0.64),
      new THREE.Vector3(0.92, 0.845, 0.64),
      new THREE.Vector3(1.32, 0.845, 0.46),
      new THREE.Vector3(1.38, 0.845, 0.0),
      new THREE.Vector3(1.30, 0.845, -0.56),
      new THREE.Vector3(0.92, 0.845, -0.76),
      new THREE.Vector3(0.40, 0.845, -0.76),
      new THREE.Vector3(0.22, 0.845, -0.62),
      new THREE.Vector3(-1.12, 0.845, -0.62),
      new THREE.Vector3(-1.34, 0.845, -0.44),
      new THREE.Vector3(-1.34, 0.845, 0.46),
    ],
    true,
  );
  addPart(g, styler, new THREE.TubeGeometry(railCurve, 64, 0.058, 12, true), '#26201c', 0, 0, 0, 0.004, {
    roughness: 0.44,
    sheen: 0.3,
  });

  // Inner Green Emerald Felt Bed covering entire tabletop interior
  const feltBaseGeo = makeExtrudeTopMappedGeo((s) => drawRoulettePlan(s, -0.095), 0.04, 0.006, 2, 18);
  addPart(g, styler, feltBaseGeo, '#145a36', 0, 0.815, 0, 0, { roughness: 0.88 });

  // Crisp European Roulette Bet Grid Panel cleanly inset on left section
  addPart(g, styler, new RoundedBoxGeometry(1.66, 0.025, 1.04, 2, 0.008), '#ffffff', -0.40, 0.848, 0.01, 0, {
    tex: tex.rouletteFelt,
    roughness: 0.86,
  });

  // Colorful Stacked Casino Chips & Dealer Rake Marker beside Wheel
  const chipCols = ['#dc2626', '#2563eb', '#facc15', '#16a34a', '#a855f7'];
  for (let i = 0; i < chipCols.length; i++) {
    addPart(
      g,
      styler,
      new THREE.CylinderGeometry(0.032, 0.032, 0.075 + (i % 2) * 0.035, 12),
      chipCols[i],
      0.46 + (i % 2) * 0.08,
      0.895,
      -0.38 + i * 0.15,
      0,
    );
  }
  addPart(g, styler, new RoundedBoxGeometry(0.28, 0.022, 0.045, 2, 0.008), '#d4af37', 0.86, 0.87, 0.48, 0.001, {
    metalness: 0.82,
  });

  // 3. Sculpted Turned Mahogany Wheel Bowl Housing (`80cm` diameter at `x = +0.86`) w/ Brass Deflectors
  const wheelBowlGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.49, 0),
      new THREE.Vector2(0.49, 0.06),
      new THREE.Vector2(0.47, 0.13),
      new THREE.Vector2(0.455, 0.165),
      new THREE.Vector2(0.415, 0.175),
      new THREE.Vector2(0.395, 0.135),
      new THREE.Vector2(0.385, 0.085),
      new THREE.Vector2(0, 0.085),
    ],
    32,
  );
  addPart(g, styler, wheelBowlGeo, '#4d2312', 0.86, 0.842, 0, 0.004, {
    tex: tex.mahoganyWood,
    roughness: 0.34,
    clearcoat: 0.45,
  });
  // Diamond Brass Canoe Ball Deflectors inside Ball Track
  const deflectorGeo = new RoundedBoxGeometry(0.024, 0.012, 0.045, 2, 0.004);
  for (let di = 0; di < 8; di++) {
    const a = (di / 8) * Math.PI * 2;
    const def = addPart(
      g,
      styler,
      deflectorGeo,
      '#e7c667',
      0.86 + Math.cos(a) * 0.41,
      0.982,
      Math.sin(a) * 0.41,
      0,
      { metalness: 0.9, roughness: 0.18 },
    );
    def.rotation.y = -a;
  }

  // 4. Spinning Rotor (37-Pocket Wheel Disc + Turned Brass Turret Spindle + Cross Handles + Ivory Ball)
  const wheelRotor = new THREE.Group();
  wheelRotor.position.set(0.86, 0.957, 0);
  addPart(wheelRotor, styler, new THREE.CylinderGeometry(0.385, 0.385, 0.028, 32), '#ffffff', 0, 0, 0, 0, {
    tex: tex.rouletteWheelDisc,
    roughness: 0.22,
    clearcoat: 0.60,
  });
  const spindleGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.082, 0),
      new THREE.Vector2(0.072, 0.035),
      new THREE.Vector2(0.044, 0.095),
      new THREE.Vector2(0.056, 0.145),
      new THREE.Vector2(0.036, 0.195),
      new THREE.Vector2(0.052, 0.232),
      new THREE.Vector2(0.026, 0.258),
      new THREE.Vector2(0, 0.265),
    ],
    22,
  );
  addPart(wheelRotor, styler, spindleGeo, '#d4af37', 0, 0.014, 0, 0.002, {
    metalness: 0.90,
    roughness: 0.16,
  });
  // Cross Turret Spoke Handles w/ Turned Ball Grips + Ivory Ball
  const turretHandleGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.22, 10);
  const turretKnobGeo = new THREE.SphereGeometry(0.020, 10, 8);
  addPart(wheelRotor, styler, turretHandleGeo, '#e7c667', 0, 0.155, 0, 0, { metalness: 0.88 }).rotation.z =
    Math.PI * 0.5;
  addPart(wheelRotor, styler, turretHandleGeo, '#e7c667', 0, 0.162, 0, 0, { metalness: 0.88 }).rotation.x =
    Math.PI * 0.5;
  for (const [kx, ky, kz] of [[-0.115, 0.155, 0], [0.115, 0.155, 0], [0, 0.162, -0.115], [0, 0.162, 0.115]] as [number, number, number][]) {
    addPart(wheelRotor, styler, turretKnobGeo, '#f5dc82', kx, ky, kz, 0, { metalness: 0.9 });
  }
  addPart(wheelRotor, styler, new THREE.SphereGeometry(0.021, 12, 10), '#fffbeb', 0.285, 0.028, 0, 0, {
    roughness: 0.12,
    clearcoat: 0.92,
  });
  g.add(wheelRotor);

  // 5. Three Tufted Dark Leather Casino Stools along Player Betting Side (+Z)
  const rStoolBaseGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.195, 0),
      new THREE.Vector2(0.185, 0.024),
      new THREE.Vector2(0.055, 0.055),
      new THREE.Vector2(0.038, 0.085),
      new THREE.Vector2(0.036, 0.44),
      new THREE.Vector2(0.085, 0.46),
      new THREE.Vector2(0, 0.465),
    ],
    20,
  );
  const rStoolRingGeo = new THREE.TorusGeometry(0.175, 0.011, 8, 22);
  const rStoolSeatGeo = new RoundedBoxGeometry(0.44, 0.105, 0.42, 4, 0.042);
  const rStoolBackGeo = makeCurvedStoolBackrestGeo(0.40, 0.30, 0.06, 0.048);
  const rStoolSpineGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.44, 0),
      new THREE.Vector3(0, 0.445, -0.16),
      new THREE.Vector3(0, 0.52, -0.21),
      new THREE.Vector3(0, 0.70, -0.21),
    ]),
    14,
    0.015,
    8,
    false,
  );

  for (const rx of [-0.78, -0.25, 0.28]) {
    const stool = new THREE.Group();
    stool.position.set(rx, 0, 1.04);
    stool.rotation.y = Math.PI;
    addPart(stool, styler, rStoolBaseGeo, '#d4af37', 0, 0, 0, 0.002, {
      metalness: 0.85,
      roughness: 0.22,
    });
    addPart(stool, styler, rStoolSpineGeo, '#d4af37', 0, 0, 0, 0.002, {
      metalness: 0.85,
      roughness: 0.22,
    });
    const footRing = addPart(stool, styler, rStoolRingGeo, '#d4af37', 0, 0.20, 0, 0, {
      metalness: 0.85,
      roughness: 0.22,
    });
    footRing.rotation.x = Math.PI * 0.5;
    addPart(stool, styler, rStoolSeatGeo, '#332f38', 0, 0.49, 0, 0.003, {
      tex: tex.leatherTufted,
      roughness: 0.54,
      sheen: 0.3,
    });
    const sBack = addPart(stool, styler, rStoolBackGeo, '#332f38', 0, 0.52, -0.18, 0.003, {
      tex: tex.leatherTufted,
      roughness: 0.54,
      sheen: 0.3,
    });
    sBack.rotation.y = Math.PI;
    g.add(stool);
  }

  // Standing Roulette Croupier is spawned dynamically as a 3D animated Plaza female NPC inside BuddiesBlitzArena

  return { group: g, wheelRotor };
}

/**
 * Convenience composition helper placing all furniture & static blueprint assemblies cleanly inside a parent Group.
 */
export function populateCasinoInteriorProps(
  staticParent: THREE.Object3D,
  dynamicParent: THREE.Object3D,
  styler: CafeAssetStyler,
  tex: CasinoTexturePack,
): { rouletteRotor: THREE.Group; slotCabinets: THREE.Group[] } {
  // 1. Grand Hall Architectural Shell (Floor, Walls, Pilasters, Mirrors, Doors, Coffered Ceiling, Mansard Cutaway)
  buildCasinoSingleStoryCutawayHall(staticParent, styler, tex);

  // 2. Ceiling Chandeliers (`screen_305d9272.png`: 1 giant centerpiece + 3 wing chandeliers sharing geometry pack)
  const sharedChandelierPack = createChandelierGeoPack();
  const centerChandelier = buildGrandOrnateChandelier(styler, 1.38, sharedChandelierPack);
  centerChandelier.position.set(0.0, 5.05, 0.15);
  staticParent.add(centerChandelier);

  for (const [cx, cz, cs] of [
    [-5.65, -0.5, 0.94],
    [5.65, -0.5, 0.94],
    [0.0, -4.4, 0.82],
  ] as [number, number, number][]) {
    const wc = buildGrandOrnateChandelier(styler, cs, sharedChandelierPack);
    wc.position.set(cx, 5.05, cz);
    staticParent.add(wc);
  }

  // 3. Cashier Cage & Chip Exchange Booth (`screen_ba437caf.png`)
  const cashier = buildCashierCageBooth(styler, tex);
  cashier.position.set(CASINO_CASHIER_BOOTH.x, 0, CASINO_CASHIER_BOOTH.z);
  cashier.rotation.y = CASINO_CASHIER_BOOTH.rotY;
  staticParent.add(cashier);

  // 4. Luxury Bar Counter & 3-Bay Back-Bar (`screen_453c839d.png`)
  const bar = buildLuxuryBarCounterAssembly(styler, tex);
  bar.position.set(CASINO_LUXURY_BAR.x, 0, CASINO_LUXURY_BAR.z);
  bar.rotation.y = CASINO_LUXURY_BAR.rotY;
  staticParent.add(bar);

  // 5. All 20 Electronic Slot Machines & Swivel Stools (4 distinct color-coded game banks, +0 draw calls)
  const slotCabinets: THREE.Group[] = [];
  const sharedSlotGeoPack = createSlotMachineGeoPack();
  for (const sp of CASINO_SLOT_PLACEMENTS) {
    const slotTheme = getCasinoSlotCabinetTheme(getCasinoSlotGameVariantForPlacementId(sp.id));
    const slotGrp = buildElectronicSlotMachineAndStool(
      styler,
      tex,
      sp.stoolOffsetZ,
      sharedSlotGeoPack,
      slotTheme,
    );
    slotGrp.position.set(sp.x, 0, sp.z);
    slotGrp.rotation.y = sp.rotY;
    staticParent.add(slotGrp);
    slotCabinets.push(slotGrp);
  }

  // 6. All 3 Blackjack & Baccarat Tables + Curved Armchairs + Dealers (`screen_68a3f939.png`)
  for (const bt of CASINO_BLACKJACK_TABLES) {
    const bjGrp = buildBlackjackBaccaratTable(styler, tex);
    bjGrp.position.set(bt.x, 0, bt.z);
    bjGrp.rotation.y = bt.rotY;
    staticParent.add(bjGrp);
  }

  // 7. Grand Luxury Roulette Table + Dynamic Spinning Wheel Rotor (`screen_3cc6b11f.png`)
  const roulette = buildLuxuryRouletteTable(styler, tex);
  roulette.group.position.set(CASINO_ROULETTE_TABLE.x, 0, CASINO_ROULETTE_TABLE.z);
  roulette.group.rotation.y = CASINO_ROULETTE_TABLE.rotY;
  roulette.group.remove(roulette.wheelRotor);
  roulette.wheelRotor.position.set(
    CASINO_ROULETTE_TABLE.x + Math.cos(CASINO_ROULETTE_TABLE.rotY) * 0.86,
    0.95,
    CASINO_ROULETTE_TABLE.z - Math.sin(CASINO_ROULETTE_TABLE.rotY) * 0.86,
  );
  dynamicParent.add(roulette.wheelRotor);
  staticParent.add(roulette.group);

  void createBlitzStrokeMesh;

  return { rouletteRotor: roulette.wheelRotor, slotCabinets };
}
