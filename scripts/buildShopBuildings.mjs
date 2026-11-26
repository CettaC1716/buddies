import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Phase 1 (B1/B2/B3) — Builds all 3 Shop Building GLBs 1:1 with the owner's concept sheets
 * in form, geometry, color & avatar-balanced scale (3.30m player avatar):
 *   1. Glass Corner 3-Story          (9.2 x 9.2 x ~16.2 m — clearly taller 3-story tower)
 *   2. Canopy Storefront 2-Story     (9.2 x 9.2 x ~11.8 m — 2-story cream limestone + cantilevered canopy)
 *   3. Brick Block with Rooftop Deck (9.2 x 9.2 x ~12.0 m — 2-story concrete + red brick + timber roof deck)
 *
 * Requirements enforced:
 * - Form & color ONLY: completely empty neutral interiors, zero logos, zero merchandise displays
 * - Separate named rooftop billboard mesh (`rooftop_billboard_face`) with replaceable
 *   material (`rooftop_billboard_mat`) and blank neutral default surface
 * - Avatar-balanced floor heights (~4.2–4.5m per story, 3.55m entrance doors for 3.30m avatar)
 * - Footprint strictly <= 9.6 x 9.6 m
 * - Every GLB verified with the repo's own three.js `GLTFLoader`.
 */

const OUT_DIR = path.resolve(process.cwd(), 'public/assets/buildings');
fs.mkdirSync(OUT_DIR, { recursive: true });

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class NodeFileReader {
    result = null;
    onloadend = null;
    onload = null;
    onerror = null;
    readAsArrayBuffer(blob) {
      blob
        .arrayBuffer()
        .then((buf) => {
          this.result = buf;
          if (this.onload) this.onload({ target: this });
          if (this.onloadend) this.onloadend({ target: this });
        })
        .catch((err) => {
          if (this.onerror) this.onerror(err);
        });
    }
    readAsDataURL(blob) {
      blob
        .arrayBuffer()
        .then((buf) => {
          const b64 = Buffer.from(buf).toString('base64');
          this.result = `data:${blob.type || 'application/octet-stream'};base64,${b64}`;
          if (this.onload) this.onload({ target: this });
          if (this.onloadend) this.onloadend({ target: this });
        })
        .catch((err) => {
          if (this.onerror) this.onerror(err);
        });
    }
  };
}

function makeMat(name, colorHex, opts = {}) {
  return new THREE.MeshStandardMaterial({
    name,
    color: new THREE.Color(colorHex),
    roughness: opts.roughness ?? 0.9,
    metalness: opts.metalness ?? 0.04,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1.0,
    side: opts.side ?? THREE.FrontSide,
  });
}

function addBox(parent, w, h, d, x, y, z, mat, name) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  if (name) mesh.name = name;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, rt, rb, h, x, y, z, mat, segs = 10, name) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), mat);
  if (name) mesh.name = name;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function addOutlineEdges(parent, w, h, d, x, y, z, outlineMat, thickness = 0.08) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const hd = d * 0.5;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(parent, thickness, h + thickness, thickness, x + sx * hw, y, z + sz * hd, outlineMat);
    }
  }
  for (const sy of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(parent, w + thickness, thickness, thickness, x, y + sy * hh, z + sz * hd, outlineMat);
    }
    for (const sx of [-1, 1]) {
      addBox(parent, thickness, thickness, d + thickness, x + sx * hw, y + sy * hh, z, outlineMat);
    }
  }
}

/**
 * Adds a rooftop steel-truss billboard assembly + separate replaceable-texture mesh `rooftop_billboard_face`.
 */
function addRooftopBillboard(parent, { width, height, centerY, zPos, trimMat, outlineMat, spots = 4, truss = true }) {
  const billboardGroup = new THREE.Group();
  billboardGroup.name = 'rooftop_billboard_assembly';
  parent.add(billboardGroup);

  // Steel backing & perimeter frame
  addBox(billboardGroup, width + 0.36, height + 0.36, 0.24, 0, centerY, zPos - 0.14, trimMat, 'billboard_frame');
  addOutlineEdges(billboardGroup, width + 0.38, height + 0.38, 0.26, 0, centerY, zPos - 0.14, outlineMat, 0.06);

  // Lower truss chord + diagonal bracing if requested
  const baseY = centerY - height * 0.5 - 0.55;
  if (truss) {
    addBox(billboardGroup, width + 0.42, 0.12, 0.26, 0, baseY + 0.18, zPos - 0.14, trimMat);
    const cols = 5;
    for (let i = 0; i < cols; i++) {
      const tx = -width * 0.44 + (i / (cols - 1)) * width * 0.88;
      addBox(billboardGroup, 0.12, 0.72, 0.12, tx, baseY + 0.22, zPos - 0.14, trimMat);
      const rearBrace = addBox(billboardGroup, 0.1, 1.3, 0.1, tx, centerY - height * 0.25, zPos - 0.62, trimMat);
      rearBrace.rotation.x = 0.52;
    }
  } else {
    for (const sx of [-width * 0.36, 0, width * 0.36]) {
      addBox(billboardGroup, 0.14, 0.65, 0.14, sx, baseY + 0.25, zPos - 0.14, trimMat);
    }
  }

  // Overhead gooseneck spotlight arms
  for (let i = 0; i < spots; i++) {
    const sx = spots === 1 ? 0 : -width * 0.38 + (i / (spots - 1)) * width * 0.76;
    addBox(billboardGroup, 0.08, 0.22, 0.08, sx, centerY + height * 0.5 + 0.24, zPos - 0.12, trimMat);
    addBox(billboardGroup, 0.08, 0.08, 0.55, sx, centerY + height * 0.5 + 0.34, zPos + 0.12, trimMat);
    addBox(billboardGroup, 0.18, 0.1, 0.16, sx, centerY + height * 0.5 + 0.28, zPos + 0.38, trimMat);
  }

  // Separate named billboard face mesh with blank neutral material (`rooftop_billboard_mat`)
  const billboardMat = new THREE.MeshStandardMaterial({
    name: 'rooftop_billboard_mat',
    color: new THREE.Color('#e5e7eb'),
    roughness: 0.78,
    metalness: 0.02,
  });
  const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), billboardMat);
  faceMesh.name = 'rooftop_billboard_face';
  faceMesh.position.set(0, centerY, zPos + 0.01);
  billboardGroup.add(faceMesh);
}

/**
 * B1: Glass Corner 3-Story — Avatar-balanced 3-story modern glass & concrete corner tower (~16.2m tall)
 * Concept Sheet #3 (form & colors ONLY: empty neutral interior, blank neutral billboard, zero logos/displays)
 */
function buildGlassCorner3Story() {
  const root = new THREE.Group();
  root.name = 'shop_glass_corner_3story';

  const concreteMat = makeMat('concrete_wall', '#ddd6ca');
  const warmConcreteMat = makeMat('warm_concrete', '#cfc6b8');
  const woodAccentMat = makeMat('wood_slat_accent', '#9c6e4b');
  const darkSteelMat = makeMat('dark_steel', '#2b303a', { roughness: 0.55, metalness: 0.25 });
  const glassMat = makeMat('storefront_glass', '#9fd7f5', { roughness: 0.18, metalness: 0.12, transparent: true, opacity: 0.72 });
  const interiorMat = makeMat('neutral_interior', '#e8e2d8');
  const roofMat = makeMat('roof_slab', '#68707c');
  const hvacMat = makeMat('hvac_metal', '#94a3b8', { roughness: 0.7, metalness: 0.2 });
  const solarMat = makeMat('solar_panel', '#274c77', { roughness: 0.3, metalness: 0.3 });
  const outlineMat = makeMat('cel_outline', '#14171f', { roughness: 1.0, metalness: 0.0 });

  // Ground plinth (9.2 x 0.28 x 9.2)
  addBox(root, 9.2, 0.28, 9.2, 0, 0.14, 0, roofMat, 'plinth');
  addOutlineEdges(root, 9.2, 0.28, 9.2, 0, 0.14, 0, outlineMat, 0.06);

  // Neutral empty interior floors & solid rear/west core walls (3 stories: 0.3..4.5, 4.5..8.6, 8.6..12.6)
  for (const fy of [0.34, 4.54, 8.64]) {
    addBox(root, 8.6, 0.14, 8.6, 0, fy, 0, interiorMat);
  }
  addBox(root, 9.0, 12.4, 0.45, 0, 6.48, -4.3, concreteMat, 'rear_wall');
  addBox(root, 0.45, 12.4, 9.0, -4.3, 6.48, 0, concreteMat, 'west_wall');
  // Subtle industrial wood-slat accent panel on upper-right side corner (matches concept sheet #3)
  addBox(root, 0.16, 4.0, 2.2, 4.44, 6.6, -2.6, woodAccentMat, 'wood_slat_panel');
  addBox(root, 0.16, 4.0, 2.2, -4.44, 10.6, 2.6, woodAccentMat, 'west_wood_panel');

  // 3 structural horizontal floor slab bands (y = 4.45, 8.55, 12.65)
  for (const sy of [4.45, 8.55, 12.65]) {
    addBox(root, 9.16, 0.42, 9.16, 0, sy, 0, warmConcreteMat, `floor_slab_${sy}`);
    addOutlineEdges(root, 9.18, 0.44, 9.18, 0, sy, 0, outlineMat, 0.065);
  }

  // Structural corner & storefront mullion columns (full 12.5m height)
  for (const cx of [-4.4, -1.65, 1.65, 4.4]) {
    addBox(root, 0.38, 12.45, 0.38, cx, 6.5, 4.4, darkSteelMat);
  }
  for (const cz of [-4.4, -1.5, 1.5, 4.4]) {
    addBox(root, 0.38, 12.45, 0.38, 4.4, 6.5, cz, darkSteelMat);
  }

  // Horizontal window transoms & panoramic corner glazing across all 3 floors (completely empty interior behind glass!)
  const floorWindows = [
    { cy: 2.35, h: 3.75 }, // Floor 1 (4.2m floor-to-floor, balanced for 3.30m avatar)
    { cy: 6.5, h: 3.65 },  // Floor 2
    { cy: 10.6, h: 3.65 }, // Floor 3
  ];
  for (let i = 0; i < floorWindows.length; i++) {
    const fw = floorWindows[i];
    addBox(root, 8.4, fw.h, 0.1, 0, fw.cy, 4.35, glassMat, `front_glass_f${i + 1}`);
    addBox(root, 0.1, fw.h, 8.4, 4.35, fw.cy, 0, glassMat, `side_glass_f${i + 1}`);
    // Mid-height slender steel transom bar on upper floors
    if (i > 0) {
      addBox(root, 8.6, 0.1, 0.16, 0, fw.cy + 0.85, 4.38, darkSteelMat);
      addBox(root, 0.16, 0.1, 8.6, 4.38, fw.cy + 0.85, 0, darkSteelMat);
    }
  }

  // Main double entrance door frame (3.55m tall for 3.30m avatar!) + blank neutral fascia bar above door
  addBox(root, 2.7, 3.65, 0.24, 0, 2.1, 4.42, darkSteelMat, 'entrance_frame');
  addBox(root, 2.35, 3.45, 0.14, 0, 2.02, 4.48, glassMat, 'entrance_doors');
  addBox(root, 0.08, 3.45, 0.18, 0, 2.02, 4.5, darkSteelMat, 'door_divider');
  addBox(root, 3.2, 0.56, 0.24, 0, 4.02, 4.52, darkSteelMat, 'blank_fascia_bar');

  // Front safety bollards along plinth edge
  for (const bx of [-4.2, -2.5, 2.5, 4.2]) {
    addCylinder(root, 0.1, 0.12, 0.95, bx, 0.72, 4.65, darkSteelMat, 8);
  }

  // Side utility conduit pipe & exterior steel fire-escape detail (left/west wall)
  addCylinder(root, 0.08, 0.08, 10.8, -4.52, 5.8, -2.4, darkSteelMat, 8, 'conduit_pipe');
  addBox(root, 0.28, 0.6, 0.45, -4.55, 1.8, -2.4, darkSteelMat, 'meter_box');
  addBox(root, 0.22, 2.2, 1.4, -4.52, 6.8, 1.8, darkSteelMat, 'side_vent_grille');

  // Rooftop concrete parapet + steel perimeter railing (y = 12.85..13.75)
  addBox(root, 9.16, 0.52, 0.24, 0, 13.12, 4.46, concreteMat);
  addBox(root, 9.16, 0.52, 0.24, 0, 13.12, -4.46, concreteMat);
  addBox(root, 0.24, 0.52, 9.16, -4.46, 13.12, 0, concreteMat);
  addBox(root, 0.24, 0.52, 9.16, 4.46, 13.12, 0, concreteMat);
  addBox(root, 9.1, 0.08, 0.08, 0, 13.85, 4.46, darkSteelMat);
  addBox(root, 9.1, 0.08, 0.08, 0, 13.85, -4.46, darkSteelMat);
  addBox(root, 0.08, 0.08, 9.1, -4.46, 13.85, 0, darkSteelMat);
  addBox(root, 0.08, 0.08, 9.1, 4.46, 13.85, 0, darkSteelMat);
  addOutlineEdges(root, 9.2, 13.2, 9.2, 0, 6.76, 0, outlineMat, 0.08);

  // Rooftop HVAC units, angled solar panels & satellite dish (matches concept sheet #3)
  addBox(root, 1.8, 1.1, 1.5, -2.1, 13.4, -1.9, hvacMat, 'rooftop_hvac_1');
  addBox(root, 1.5, 0.9, 1.4, -0.1, 13.3, -2.1, hvacMat, 'rooftop_hvac_2');
  const solar = addBox(root, 2.8, 0.14, 1.8, 2.1, 13.7, -1.7, solarMat, 'rooftop_solar');
  solar.rotation.x = 0.35;
  addCylinder(root, 0.12, 0.12, 0.9, -3.2, 13.4, -3.2, darkSteelMat, 8);
  const dish = addCylinder(root, 0.65, 0.15, 0.25, -3.2, 14.0, -3.2, hvacMat, 12, 'satellite_dish');
  dish.rotation.x = 0.65;

  // Steel-truss rooftop banner billboard (centerY = 14.85m -> total height ~16.2m!)
  addRooftopBillboard(root, {
    width: 6.8,
    height: 2.3,
    centerY: 14.85,
    zPos: 4.18,
    trimMat: darkSteelMat,
    outlineMat,
    spots: 4,
    truss: true,
  });

  return root;
}

/**
 * B2: Canopy Storefront 2-Story — Avatar-balanced 2-story cream limestone + cantilevered steel/glass canopy (~11.8m tall)
 * Concept Sheet #2 (form & colors ONLY: empty neutral interior, blank neutral billboard, zero logos/displays)
 */
function buildCanopyStorefront2Story() {
  const root = new THREE.Group();
  root.name = 'shop_canopy_storefront_2story';

  const limestoneMat = makeMat('limestone_wall', '#efe6d5');
  const corniceMat = makeMat('stone_cornice', '#dfd4be');
  const darkMetalMat = makeMat('dark_metal', '#272c35', { roughness: 0.48, metalness: 0.28 });
  const glassMat = makeMat('storefront_glass', '#a5d8f3', { roughness: 0.18, metalness: 0.1, transparent: true, opacity: 0.72 });
  const canopyGlassMat = makeMat('canopy_glass', '#cbd5e1', { roughness: 0.32, metalness: 0.15 });
  const interiorMat = makeMat('neutral_interior', '#ebe5db');
  const outlineMat = makeMat('cel_outline', '#14171f', { roughness: 1.0, metalness: 0.0 });

  // Ground granite plinth (9.2 x 0.24 x 9.0)
  addBox(root, 9.2, 0.24, 9.0, 0, 0.12, 0, darkMetalMat, 'plinth');

  // Main 2-story cream limestone shell (8.6 x 8.8 x 8.4 -> y = 0.24..9.04)
  addBox(root, 8.6, 8.8, 8.4, 0, 4.64, -0.2, limestoneMat, 'main_body');
  addOutlineEdges(root, 8.62, 8.82, 8.42, 0, 4.64, -0.2, outlineMat, 0.08);
  // Empty neutral interior recess floor
  addBox(root, 8.2, 0.12, 8.0, 0, 0.3, -0.2, interiorMat);

  // Layered classical stone cornice crown (y = 9.04..9.58)
  addBox(root, 8.92, 0.26, 8.72, 0, 9.17, -0.2, corniceMat, 'cornice_lower');
  addBox(root, 9.14, 0.32, 8.94, 0, 9.46, -0.2, corniceMat, 'cornice_crown');
  addOutlineEdges(root, 9.16, 0.34, 8.96, 0, 9.46, -0.2, outlineMat, 0.065);

  // Ground-floor dark steel storefront band (4.35m tall for 3.30m avatar!) + empty display windows
  addBox(root, 8.68, 4.35, 0.22, 0, 2.42, 3.96, darkMetalMat, 'storefront_band');
  // Blank neutral fascia header above doors (zero text!)
  addBox(root, 8.4, 0.68, 0.12, 0, 4.18, 4.06, darkMetalMat, 'blank_fascia');
  // Left & right wide storefront windows + centered 3.55m double entrance door
  addBox(root, 2.35, 3.25, 0.12, -2.85, 2.02, 4.08, glassMat, 'window_left');
  addBox(root, 2.35, 3.25, 0.12, 2.85, 2.02, 4.08, glassMat, 'window_right');
  addBox(root, 2.3, 3.55, 0.14, 0, 2.02, 4.1, glassMat, 'double_entrance');
  addBox(root, 0.08, 3.55, 0.18, 0, 2.02, 4.12, darkMetalMat, 'door_divider');
  // Right-side corner storefront band matching concept sheet #2 isometric view
  addBox(root, 0.22, 4.35, 8.48, 4.26, 2.42, -0.2, darkMetalMat, 'side_storefront_band');
  for (const wz of [-2.4, 0.2, 2.4]) {
    addBox(root, 0.12, 3.25, 2.0, 4.36, 2.02, wz, glassMat);
  }

  // Signature cantilevered dark steel & ribbed frosted-glass canopy wrapping front (+Z) & right (+X)
  const canopyFront = addBox(root, 9.2, 0.22, 1.08, 0.0, 4.72, 4.18, darkMetalMat, 'front_canopy');
  canopyFront.rotation.x = 0.08;
  addBox(root, 8.85, 0.08, 0.86, 0.0, 4.74, 4.18, canopyGlassMat, 'canopy_glass_front');
  // Ribbed steel rafters across canopy
  for (const rx of [-3.9, -2.6, -1.3, 0, 1.3, 2.6, 3.9]) {
    addBox(root, 0.08, 0.24, 1.08, rx, 4.72, 4.18, darkMetalMat);
  }
  // Diagonal tension tie-rods anchoring canopy to upper wall
  for (const tx of [-3.6, -1.2, 1.2, 3.6]) {
    const rod = addBox(root, 0.07, 1.35, 0.07, tx, 5.38, 4.3, darkMetalMat);
    rod.rotation.x = -0.58;
  }

  // 4 framed upper-story rectangular double-hung windows on front (+Z) (matches concept sheet #2 1:1)
  for (const wx of [-3.1, -1.05, 1.05, 3.1]) {
    addBox(root, 1.32, 2.25, 0.18, wx, 7.1, 4.02, darkMetalMat);
    addBox(root, 1.08, 1.98, 0.12, wx, 7.1, 4.08, glassMat);
    addBox(root, 1.12, 0.08, 0.14, wx, 7.1, 4.11, darkMetalMat); // double-hung sash bar
    addBox(root, 1.48, 0.16, 0.26, wx, 5.92, 4.08, corniceMat);  // sill
    addBox(root, 1.48, 0.16, 0.24, wx, 8.28, 4.06, corniceMat);  // header
  }
  // Upper-story windows on both side walls
  for (const sx of [-1, 1]) {
    for (const wz of [-2.3, 1.6]) {
      addBox(root, 0.18, 2.2, 1.32, sx * 4.32, 7.1, wz, darkMetalMat);
      addBox(root, 0.12, 1.95, 1.08, sx * 4.38, 7.1, wz, glassMat);
      addBox(root, 0.14, 0.08, 1.12, sx * 4.41, 7.1, wz, darkMetalMat);
    }
  }

  // Rooftop horizontal billboard (centerY = 10.65m -> total height ~11.8m)
  addRooftopBillboard(root, {
    width: 6.0,
    height: 1.75,
    centerY: 10.65,
    zPos: 3.72,
    trimMat: darkMetalMat,
    outlineMat,
    spots: 3,
    truss: false,
  });

  return root;
}

/**
 * B3: Brick Block with Rooftop Deck — Avatar-balanced 2-story industrial concrete + red brick + timber deck (~12.0m tall)
 * Concept Sheet #1 (form & colors ONLY: empty neutral interior, blank neutral billboard, zero logos/displays)
 */
function buildBrickRooftopDeck() {
  const root = new THREE.Group();
  root.name = 'shop_brick_rooftop_deck';

  const groundConcreteMat = makeMat('ground_concrete', '#d5cfc4');
  const redBrickMat = makeMat('industrial_brick', '#a65440');
  const darkBrickTrimMat = makeMat('dark_brick_trim', '#4a3d39');
  const darkIronMat = makeMat('dark_iron', '#252a33', { roughness: 0.52, metalness: 0.3 });
  const timberDeckMat = makeMat('rooftop_timber', '#c49664', { roughness: 0.85 });
  const doorWoodMat = makeMat('door_wood', '#8a6242', { roughness: 0.78 });
  const glassMat = makeMat('industrial_glass', '#9ecae6', { roughness: 0.2, metalness: 0.12, transparent: true, opacity: 0.74 });
  const sconceGlowMat = makeMat('sconce_glow', '#fef3c7', { roughness: 0.4 });
  const outlineMat = makeMat('cel_outline', '#14171f', { roughness: 1.0, metalness: 0.0 });

  // Ground plinth (9.2 x 0.24 x 9.0)
  addBox(root, 9.2, 0.24, 9.0, 0, 0.12, 0, darkIronMat, 'plinth');

  // Ground floor industrial weathered concrete shell (8.8 x 4.35 x 8.6 -> y = 0.24..4.59)
  addBox(root, 8.8, 4.35, 8.6, 0, 2.415, -0.1, groundConcreteMat, 'ground_floor_shell');
  addOutlineEdges(root, 8.82, 4.37, 8.62, 0, 2.415, -0.1, outlineMat, 0.075);

  // Ground-floor industrial storefront windows + 3.55m timber-and-glass entrance door on +Z (empty interior, zero text!)
  addBox(root, 4.4, 3.25, 0.2, -1.55, 2.02, 4.22, darkIronMat);
  addBox(root, 4.05, 2.95, 0.12, -1.55, 2.02, 4.28, glassMat, 'shop_window_f1');
  // Window mullions matching concept sheet #1
  for (const mx of [-2.85, -1.55, -0.25]) {
    addBox(root, 0.08, 2.95, 0.16, mx, 2.02, 4.31, darkIronMat);
  }
  // Entrance door (3.55m tall for 3.30m avatar)
  addBox(root, 2.25, 3.65, 0.22, 2.55, 2.06, 4.22, darkIronMat);
  addBox(root, 1.9, 3.4, 0.14, 2.55, 2.0, 4.28, doorWoodMat, 'shop_door_f1');
  addBox(root, 1.3, 1.8, 0.16, 2.55, 2.55, 4.31, glassMat, 'shop_door_glass');
  // Blank neutral fascia trim bands above window & door (zero text!)
  addBox(root, 4.4, 0.56, 0.16, -1.55, 4.0, 4.26, darkIronMat);
  addBox(root, 2.25, 0.56, 0.16, 2.55, 4.0, 4.26, darkIronMat);
  // Warm wall sconces flanking storefront
  for (const sx of [-4.05, 4.05]) {
    addBox(root, 0.2, 0.36, 0.22, sx, 2.55, 4.3, darkIronMat);
    addBox(root, 0.14, 0.22, 0.16, sx, 2.55, 4.38, sconceGlowMat);
  }

  // 2nd floor red-terracotta brick loft block (8.8 x 4.15 x 8.6 -> y = 4.59..8.74)
  addBox(root, 8.8, 4.15, 8.6, 0, 6.665, -0.1, redBrickMat, 'brick_upper_shell');
  addOutlineEdges(root, 8.82, 4.17, 8.62, 0, 6.665, -0.1, outlineMat, 0.075);
  // Corner dark-brick pilasters & subtle horizontal masonry courses
  for (const cx of [-4.22, 4.22]) {
    addBox(root, 0.44, 4.16, 0.44, cx, 6.665, 4.18, darkBrickTrimMat);
    addBox(root, 0.44, 4.16, 0.44, cx, 6.665, -4.38, darkBrickTrimMat);
  }
  addBox(root, 9.0, 0.24, 8.8, 0, 8.76, -0.1, darkIronMat, 'roof_cornice_band');

  // 2nd floor wide multi-pane industrial loft window (+Z and right +X)
  addBox(root, 6.2, 2.35, 0.2, 0, 6.75, 4.22, darkIronMat);
  addBox(root, 5.85, 2.05, 0.12, 0, 6.75, 4.28, glassMat, 'industrial_window_f2');
  for (const mx of [-2.0, -0.65, 0.65, 2.0]) {
    addBox(root, 0.08, 2.05, 0.16, mx, 6.75, 4.31, darkIronMat);
  }
  addBox(root, 5.85, 0.08, 0.16, 0, 6.75, 4.31, darkIronMat);
  // Right-side corner loft window
  addBox(root, 0.2, 2.35, 5.6, 4.42, 6.75, -0.1, darkIronMat);
  addBox(root, 0.12, 2.05, 5.25, 4.48, 6.75, -0.1, glassMat, 'side_window_f2');

  // Modern iron balustrade balcony along 2nd floor front (+Z)
  addBox(root, 8.98, 0.2, 0.78, 0, 4.65, 4.5, darkIronMat, 'balcony_slab');
  addBox(root, 8.98, 0.09, 0.09, 0, 5.65, 4.84, darkIronMat, 'balcony_top_rail');
  for (const bx of [-4.4, -2.9, -1.45, 0, 1.45, 2.9, 4.4]) {
    addBox(root, 0.07, 1.0, 0.07, bx, 5.15, 4.84, darkIronMat);
  }

  // Industrial exhaust flue pipe on side wall (matches concept sheet #1 side profile)
  addCylinder(root, 0.18, 0.18, 9.6, -4.58, 5.4, -2.8, darkIronMat, 10, 'industrial_exhaust_flue');

  // Open warm timber-planked rooftop terrace deck + full perimeter industrial balustrade (y = 8.88)
  addBox(root, 8.55, 0.18, 8.35, 0, 8.94, -0.1, timberDeckMat, 'rooftop_timber_deck');
  addBox(root, 8.82, 0.09, 0.09, 0, 9.95, 4.14, darkIronMat);
  addBox(root, 8.82, 0.09, 0.09, 0, 9.95, -4.34, darkIronMat);
  addBox(root, 0.09, 0.09, 8.55, -4.38, 9.95, -0.1, darkIronMat);
  addBox(root, 0.09, 0.09, 8.55, 4.38, 9.95, -0.1, darkIronMat);
  for (const px of [-4.38, -2.18, 0, 2.18, 4.38]) {
    addBox(root, 0.07, 1.02, 0.07, px, 9.44, 4.14, darkIronMat);
    addBox(root, 0.07, 1.02, 0.07, px, 9.44, -4.34, darkIronMat);
  }
  for (const pz of [-2.2, -0.1, 2.0]) {
    addBox(root, 0.07, 1.02, 0.07, -4.38, 9.44, pz, darkIronMat);
    addBox(root, 0.07, 1.02, 0.07, 4.38, 9.44, pz, darkIronMat);
  }

  // Panoramic steel-truss rooftop billboard with 4 overhead spotlights (centerY = 10.65m -> total height ~12.0m)
  addRooftopBillboard(root, {
    width: 6.4,
    height: 1.9,
    centerY: 10.65,
    zPos: 3.92,
    trimMat: darkIronMat,
    outlineMat,
    spots: 4,
    truss: true,
  });

  return root;
}

async function exportAndVerifyGlb(filename, sceneRoot) {
  const exporter = new GLTFExporter();
  const glbBuffer = await new Promise((resolve, reject) => {
    exporter.parse(
      sceneRoot,
      (res) => resolve(Buffer.from(res)),
      (err) => reject(err),
      { binary: true },
    );
  });

  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, glbBuffer);

  const jsonChunkLen = glbBuffer.readUInt32LE(12);
  const jsonStr = glbBuffer.subarray(20, 20 + jsonChunkLen).toString('utf8').replace(/\0+$/, '');
  const gltfJson = JSON.parse(jsonStr);
  const declaredExts = new Set(gltfJson.extensionsUsed ?? []);
  const referencedExts = new Set();
  const scanExts = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    if (obj.extensions && typeof obj.extensions === 'object') {
      for (const k of Object.keys(obj.extensions)) referencedExts.add(k);
    }
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') scanExts(v);
    }
  };
  scanExts(gltfJson);
  for (const ext of referencedExts) {
    if (!declaredExts.has(ext)) {
      throw new Error(`GLB ${filename} uses undeclared extension: ${ext}`);
    }
  }

  const loader = new GLTFLoader();
  const arrayBuf = glbBuffer.buffer.slice(
    glbBuffer.byteOffset,
    glbBuffer.byteOffset + glbBuffer.byteLength,
  );
  const loaded = await new Promise((resolve, reject) => {
    loader.parse(arrayBuf, '', resolve, reject);
  });

  const box = new THREE.Box3().setFromObject(loaded.scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  let billboardFound = false;
  let billboardMatName = '';
  loaded.scene.traverse((obj) => {
    if (obj.isMesh && obj.name === 'rooftop_billboard_face') {
      billboardFound = true;
      billboardMatName = obj.material?.name ?? '';
    }
  });

  if (size.x > 9.61 || size.z > 9.61) {
    throw new Error(`GLB ${filename} exceeds 9.6x9.6m max footprint: ${size.x.toFixed(2)} x ${size.z.toFixed(2)}m`);
  }
  if (!billboardFound || billboardMatName !== 'rooftop_billboard_mat') {
    throw new Error(`GLB ${filename} missing rooftop_billboard_face / rooftop_billboard_mat`);
  }

  console.log(
    `[OK] ${filename}: ${(glbBuffer.length / 1024).toFixed(1)} KB | size=${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)}m | billboard=${billboardMatName} | extensionsUsed=[${[...declaredExts].join(', ')}]`,
  );
}

await exportAndVerifyGlb('shop_glass_corner_3story.glb', buildGlassCorner3Story());
await exportAndVerifyGlb('shop_canopy_storefront_2story.glb', buildCanopyStorefront2Story());
await exportAndVerifyGlb('shop_brick_rooftop_deck.glb', buildBrickRooftopDeck());
