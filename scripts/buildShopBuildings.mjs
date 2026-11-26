import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Phase 1 (B1/B2/B3) — Builds all 3 Shop Building GLBs from the owner's neutral concept sheets:
 *   1. Glass Corner 3-Story          (9.2 x 9.2 x 11.4 m)
 *   2. Canopy Storefront 2-Story     (9.2 x 9.0 x  8.6 m)
 *   3. Brick Block with Rooftop Deck (9.2 x 9.0 x  9.2 m)
 *
 * Requirements enforced:
 * - Empty neutral interiors (shell only, zero merchandise)
 * - Separate named rooftop billboard mesh (`rooftop_billboard_face`) with replaceable
 *   material (`rooftop_billboard_mat`) and blank neutral default texture
 * - Cel/toon-friendly flat matte materials + black outline silhouette framing
 * - Footprint strictly <= 9.6 x 9.6 m
 * - Every GLB declares all extensions in `extensionsUsed` and is verified by parsing
 *   with the repo's own three.js `GLTFLoader`.
 */

const OUT_DIR = path.resolve(process.cwd(), 'public/assets/buildings');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Minimal polyfill for FileReader/Blob in Node so Three.js GLTFExporter runs cleanly in binary mode.
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
    roughness: opts.roughness ?? 0.92,
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

/**
 * Adds crisp black architectural edge framing (matching the game's cel-shaded black outline look)
 * around a major building volume.
 */
function addOutlineEdges(parent, w, h, d, x, y, z, outlineMat, thickness = 0.075) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const hd = d * 0.5;
  // 4 vertical corner outlines
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(parent, thickness, h + thickness, thickness, x + sx * hw, y, z + sz * hd, outlineMat);
    }
  }
  // 4 top & bottom horizontal outlines along X and Z
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
 * Adds the rooftop billboard truss/frame + separate replaceable-texture mesh `rooftop_billboard_face`.
 */
function addRooftopBillboard(parent, { width, height, centerY, zPos, trimMat, outlineMat }) {
  const billboardGroup = new THREE.Group();
  billboardGroup.name = 'rooftop_billboard_assembly';
  parent.add(billboardGroup);

  // Steel backing & truss frame
  addBox(billboardGroup, width + 0.34, height + 0.34, 0.22, 0, centerY, zPos - 0.14, trimMat, 'billboard_frame');
  addOutlineEdges(billboardGroup, width + 0.36, height + 0.36, 0.24, 0, centerY, zPos - 0.14, outlineMat, 0.055);

  // Vertical support struts to roof deck
  const strutBottomY = centerY - height * 0.5 - 0.55;
  const strutH = 0.65;
  for (const sx of [-width * 0.36, 0, width * 0.36]) {
    addBox(billboardGroup, 0.14, strutH, 0.14, sx, strutBottomY + strutH * 0.5, zPos - 0.14, trimMat);
    // Rear diagonal brace
    const brace = addBox(billboardGroup, 0.1, 0.9, 0.1, sx, centerY - height * 0.2, zPos - 0.52, trimMat);
    brace.rotation.x = 0.55;
  }

  // Top spotlight arms
  for (const sx of [-width * 0.34, 0, width * 0.34]) {
    addBox(billboardGroup, 0.1, 0.08, 0.45, sx, centerY + height * 0.5 + 0.22, zPos + 0.08, trimMat);
  }

  // Separate named billboard face mesh with replaceable neutral material (`rooftop_billboard_mat`)
  const billboardMat = new THREE.MeshStandardMaterial({
    name: 'rooftop_billboard_mat',
    color: new THREE.Color('#e5e7eb'),
    roughness: 0.78,
    metalness: 0.02,
  });
  const faceGeo = new THREE.PlaneGeometry(width, height);
  const faceMesh = new THREE.Mesh(faceGeo, billboardMat);
  faceMesh.name = 'rooftop_billboard_face';
  faceMesh.position.set(0, centerY, zPos + 0.01);
  billboardGroup.add(faceMesh);
}

/**
 * B1: Glass Corner 3-Story (9.2 x 9.2 x 11.4 m)
 */
function buildGlassCorner3Story() {
  const root = new THREE.Group();
  root.name = 'shop_glass_corner_3story';

  const concreteMat = makeMat('concrete_wall', '#e6e1d8');
  const darkSteelMat = makeMat('dark_steel', '#262b35', { roughness: 0.55, metalness: 0.25 });
  const glassMat = makeMat('storefront_glass', '#9fd7f5', { roughness: 0.18, metalness: 0.12 });
  const interiorFloorMat = makeMat('neutral_interior', '#d5d0c7');
  const roofMat = makeMat('roof_slab', '#5c6470');
  const hvacMat = makeMat('hvac_metal', '#94a3b8', { roughness: 0.7, metalness: 0.2 });
  const solarMat = makeMat('solar_panel', '#1e3a5f', { roughness: 0.3, metalness: 0.3 });
  const outlineMat = makeMat('cel_outline', '#14171f', { roughness: 1.0, metalness: 0.0 });

  // Ground plinth (9.2 x 0.28 x 9.2)
  addBox(root, 9.2, 0.28, 9.2, 0, 0.14, 0, roofMat, 'plinth');
  addOutlineEdges(root, 9.2, 0.28, 9.2, 0, 0.14, 0, outlineMat, 0.06);

  // Neutral empty interior floor & back core
  addBox(root, 8.6, 0.16, 8.6, 0, 0.36, 0, interiorFloorMat, 'interior_floor_1');
  addBox(root, 8.8, 8.2, 1.4, 0, 4.38, -3.7, concreteMat, 'rear_core_wall');
  addBox(root, 1.2, 8.2, 8.8, -3.8, 4.38, 0, concreteMat, 'west_side_wall');

  // 3 horizontal floor slabs (y = 3.1, 5.9, 8.5)
  for (const sy of [3.1, 5.9, 8.5]) {
    addBox(root, 9.1, 0.34, 9.1, 0, sy, 0, concreteMat, `floor_slab_${sy}`);
    addOutlineEdges(root, 9.12, 0.36, 9.12, 0, sy, 0, outlineMat, 0.06);
  }

  // Structural corner & mullion columns
  for (const cx of [-4.35, -1.5, 1.5, 4.35]) {
    addBox(root, 0.36, 8.3, 0.36, cx, 4.4, 4.35, darkSteelMat);
  }
  for (const cz of [-4.35, -1.4, 1.5, 4.35]) {
    addBox(root, 0.36, 8.3, 0.36, 4.35, 4.4, cz, darkSteelMat);
  }

  // Ground & 2nd floor panoramic corner glazing (front +Z and right +X)
  addBox(root, 8.3, 2.5, 0.12, 0, 1.65, 4.32, glassMat, 'front_glass_f1');
  addBox(root, 8.3, 2.3, 0.12, 0, 4.5, 4.32, glassMat, 'front_glass_f2');
  addBox(root, 8.3, 2.1, 0.12, 0, 7.2, 4.32, glassMat, 'front_glass_f3');
  addBox(root, 0.12, 2.5, 8.1, 4.32, 1.65, 0, glassMat, 'side_glass_f1');
  addBox(root, 0.12, 2.3, 8.1, 4.32, 4.5, 0, glassMat, 'side_glass_f2');
  addBox(root, 0.12, 2.1, 8.1, 4.32, 7.2, 0, glassMat, 'side_glass_f3');

  // Main double entrance door frame on +Z
  addBox(root, 2.3, 2.6, 0.22, 0, 1.58, 4.38, darkSteelMat, 'entrance_frame');
  addBox(root, 1.95, 2.35, 0.16, 0, 1.5, 4.43, glassMat, 'entrance_doors');

  // Rooftop parapet wall
  addBox(root, 9.1, 0.55, 0.24, 0, 8.95, 4.42, concreteMat);
  addBox(root, 9.1, 0.55, 0.24, 0, 8.95, -4.42, concreteMat);
  addBox(root, 0.24, 0.55, 9.1, -4.42, 8.95, 0, concreteMat);
  addBox(root, 0.24, 0.55, 9.1, 4.42, 8.95, 0, concreteMat);
  addOutlineEdges(root, 9.12, 8.95, 9.12, 0, 4.72, 0, outlineMat, 0.075);

  // Rooftop HVAC units & angled solar panel
  addBox(root, 1.6, 0.9, 1.3, -2.0, 9.12, -1.8, hvacMat, 'rooftop_hvac_1');
  addBox(root, 1.4, 0.75, 1.2, -0.2, 9.05, -2.1, hvacMat, 'rooftop_hvac_2');
  const solar = addBox(root, 2.6, 0.14, 1.6, 2.0, 9.35, -1.6, solarMat, 'rooftop_solar');
  solar.rotation.x = 0.35;

  // Rooftop billboard assembly (separate named face)
  addRooftopBillboard(root, {
    width: 6.4,
    height: 2.0,
    centerY: 10.1,
    zPos: 4.15,
    trimMat: darkSteelMat,
    outlineMat,
  });

  return root;
}

/**
 * B2: Canopy Storefront 2-Story (9.2 x 9.0 x 8.6 m)
 */
function buildCanopyStorefront2Story() {
  const root = new THREE.Group();
  root.name = 'shop_canopy_storefront_2story';

  const limestoneMat = makeMat('limestone_wall', '#f0e7d6');
  const darkMetalMat = makeMat('dark_metal', '#232832', { roughness: 0.5, metalness: 0.28 });
  const glassMat = makeMat('storefront_glass', '#a5d8f3', { roughness: 0.18, metalness: 0.1 });
  const canopyGlassMat = makeMat('canopy_glass', '#cbd5e1', { roughness: 0.35, metalness: 0.15 });
  const corniceMat = makeMat('stone_cornice', '#dfd4be');
  const outlineMat = makeMat('cel_outline', '#14171f', { roughness: 1.0, metalness: 0.0 });

  // Ground granite plinth (9.2 x 0.24 x 9.0)
  addBox(root, 9.2, 0.24, 9.0, 0, 0.12, 0, darkMetalMat, 'plinth');

  // Main 2-story limestone volume (8.6 x 6.5 x 8.4)
  addBox(root, 8.6, 6.5, 8.4, 0, 3.49, -0.2, limestoneMat, 'main_body');
  addOutlineEdges(root, 8.62, 6.52, 8.42, 0, 3.49, -0.2, outlineMat, 0.075);

  // Classical stone cornice crown at roofline
  addBox(root, 9.0, 0.42, 8.8, 0, 6.85, -0.2, corniceMat, 'cornice_crown');
  addOutlineEdges(root, 9.02, 0.44, 8.82, 0, 6.85, -0.2, outlineMat, 0.06);

  // Ground-floor dark steel storefront band + wide display windows
  addBox(root, 8.68, 3.1, 0.2, 0, 1.78, 3.96, darkMetalMat, 'storefront_band');
  addBox(root, 2.4, 2.35, 0.12, -2.7, 1.55, 4.06, glassMat, 'window_left');
  addBox(root, 2.4, 2.35, 0.12, 2.7, 1.55, 4.06, glassMat, 'window_right');
  addBox(root, 2.0, 2.45, 0.14, 0, 1.52, 4.08, glassMat, 'double_entrance');

  // Signature cantilevered dark steel & frosted-glass canopy (stays within 9.6m max)
  const canopy = addBox(root, 9.1, 0.18, 1.15, 0, 3.45, 4.22, darkMetalMat, 'front_canopy');
  canopy.rotation.x = 0.08;
  addBox(root, 8.7, 0.08, 0.92, 0, 3.47, 4.22, canopyGlassMat, 'canopy_glass_panel');
  // Diagonal steel tie-rods holding canopy
  for (const tx of [-3.6, -1.2, 1.2, 3.6]) {
    const rod = addBox(root, 0.07, 1.15, 0.07, tx, 4.0, 4.35, darkMetalMat);
    rod.rotation.x = -0.62;
  }

  // 4 framed upper-story rectangular windows on front +Z
  for (const wx of [-3.0, -1.0, 1.0, 3.0]) {
    addBox(root, 1.25, 1.7, 0.18, wx, 5.15, 4.02, darkMetalMat);
    addBox(root, 1.02, 1.45, 0.12, wx, 5.15, 4.08, glassMat);
    addBox(root, 1.38, 0.14, 0.24, wx, 4.26, 4.06, corniceMat);
  }
  // 2 side windows on left & right walls
  for (const sx of [-1, 1]) {
    for (const wz of [-1.8, 1.4]) {
      addBox(root, 0.18, 1.65, 1.25, sx * 4.32, 5.15, wz, darkMetalMat);
      addBox(root, 0.12, 1.4, 1.02, sx * 4.38, 5.15, wz, glassMat);
    }
  }

  // Rooftop horizontal billboard
  addRooftopBillboard(root, {
    width: 5.8,
    height: 1.5,
    centerY: 7.82,
    zPos: 3.7,
    trimMat: darkMetalMat,
    outlineMat,
  });

  return root;
}

/**
 * B3: Brick Block with Rooftop Deck (9.2 x 9.0 x 9.2 m)
 */
function buildBrickRooftopDeck() {
  const root = new THREE.Group();
  root.name = 'shop_brick_rooftop_deck';

  const groundConcreteMat = makeMat('ground_concrete', '#d8d2c7');
  const redBrickMat = makeMat('industrial_brick', '#a65440');
  const darkIronMat = makeMat('dark_iron', '#242932', { roughness: 0.55, metalness: 0.3 });
  const timberDeckMat = makeMat('rooftop_timber', '#c29463', { roughness: 0.85 });
  const glassMat = makeMat('industrial_glass', '#9ecae6', { roughness: 0.2, metalness: 0.12 });
  const outlineMat = makeMat('cel_outline', '#14171f', { roughness: 1.0, metalness: 0.0 });

  // Ground plinth (9.2 x 0.24 x 9.0)
  addBox(root, 9.2, 0.24, 9.0, 0, 0.12, 0, darkIronMat, 'plinth');

  // Ground floor brushed concrete volume (8.8 x 3.2 x 8.6)
  addBox(root, 8.8, 3.2, 8.6, 0, 1.84, -0.1, groundConcreteMat, 'ground_floor_shell');
  addOutlineEdges(root, 8.82, 3.22, 8.62, 0, 1.84, -0.1, outlineMat, 0.07);

  // Storefront industrial steel windows & door on ground floor (+Z)
  addBox(root, 4.2, 2.35, 0.18, -1.65, 1.55, 4.22, darkIronMat);
  addBox(root, 3.85, 2.05, 0.12, -1.65, 1.55, 4.28, glassMat, 'shop_window_f1');
  addBox(root, 2.1, 2.5, 0.2, 2.45, 1.52, 4.22, darkIronMat);
  addBox(root, 1.75, 2.25, 0.14, 2.45, 1.5, 4.28, glassMat, 'shop_door_f1');

  // 2nd floor red-brick masonry block (8.8 x 3.25 x 8.6)
  addBox(root, 8.8, 3.25, 8.6, 0, 5.08, -0.1, redBrickMat, 'brick_upper_shell');
  addOutlineEdges(root, 8.82, 3.27, 8.62, 0, 5.08, -0.1, outlineMat, 0.07);

  // 2nd floor multi-pane industrial window & front balcony balustrade
  addBox(root, 5.8, 1.85, 0.2, 0, 5.15, 4.22, darkIronMat);
  addBox(root, 5.4, 1.55, 0.12, 0, 5.15, 4.28, glassMat, 'industrial_window_f2');
  // Balcony ledge & railing
  addBox(root, 8.95, 0.18, 0.72, 0, 3.52, 4.46, darkIronMat, 'balcony_slab');
  addBox(root, 8.95, 0.08, 0.08, 0, 4.35, 4.78, darkIronMat, 'balcony_top_rail');
  for (const bx of [-4.4, -2.2, 0, 2.2, 4.4]) {
    addBox(root, 0.07, 0.85, 0.07, bx, 3.94, 4.78, darkIronMat);
  }

  // Timber-planked rooftop deck + perimeter industrial balustrade (y = 6.72)
  addBox(root, 8.5, 0.18, 8.3, 0, 6.78, -0.1, timberDeckMat, 'rooftop_timber_deck');
  // Perimeter top rails around rooftop deck
  addBox(root, 8.75, 0.08, 0.08, 0, 7.62, 4.12, darkIronMat);
  addBox(root, 8.75, 0.08, 0.08, 0, 7.62, -4.32, darkIronMat);
  addBox(root, 0.08, 0.08, 8.5, -4.35, 7.62, -0.1, darkIronMat);
  addBox(root, 0.08, 0.08, 8.5, 4.35, 7.62, -0.1, darkIronMat);
  for (const px of [-4.35, -2.15, 0, 2.15, 4.35]) {
    addBox(root, 0.07, 0.84, 0.07, px, 7.2, 4.12, darkIronMat);
    addBox(root, 0.07, 0.84, 0.07, px, 7.2, -4.32, darkIronMat);
  }
  for (const pz of [-2.2, -0.1, 2.0]) {
    addBox(root, 0.07, 0.84, 0.07, -4.35, 7.2, pz, darkIronMat);
    addBox(root, 0.07, 0.84, 0.07, 4.35, 7.2, pz, darkIronMat);
  }

  // Panoramic steel-truss rooftop billboard
  addRooftopBillboard(root, {
    width: 6.2,
    height: 1.8,
    centerY: 8.2,
    zPos: 3.92,
    trimMat: darkIronMat,
    outlineMat,
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

  // Verify JSON chunk extensionsUsed and parse back with the repo's own three.js GLTFLoader!
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
