import * as THREE from 'three';
import type { CafeMenuItemId } from './buddiesCafeRules';

export type CafePropAddPartFn = (
  parent: THREE.Group,
  geo: THREE.BufferGeometry,
  colorHex: string,
  pos: [number, number, number],
  rot?: [number, number, number],
  scale?: [number, number, number],
  strokeWidth?: number,
) => THREE.Mesh;

export interface CafeHeldFoodRigHandle {
  root: THREE.Group;
  propAnchor: THREE.Group;
  itemGroups: Map<CafeMenuItemId, THREE.Group>;
  rightBiteAnchor: THREE.Group;
  activeItemId: CafeMenuItemId | null;
  setActiveItem: (itemId: CafeMenuItemId | null) => void;
}

const DEFAULT_FOOD_HAND_SCALE = 2.05;

function defaultAddFoodPart(
  parent: THREE.Group,
  geo: THREE.BufferGeometry,
  colorHex: string,
  pos: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.42,
    metalness: 0.06,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.raycast = () => {};
  parent.add(mesh);
  return mesh;
}

function addPorcelainPlate(
  parent: THREE.Group,
  addPart: CafePropAddPartFn,
  tintHex = '#f8fafc',
  rimHex = '#e2e8f0',
) {
  addPart(
    parent,
    new THREE.CylinderGeometry(0.078, 0.056, 0.011, 20),
    tintHex,
    [0, 0.006, 0],
    [0, 0, 0],
    [1, 1, 1],
    0.008,
  );
  addPart(
    parent,
    new THREE.TorusGeometry(0.072, 0.0055, 8, 20),
    rimHex,
    [0, 0.012, 0],
    [Math.PI / 2, 0, 0],
    [1, 1, 1],
    0.004,
  );
}

function addWoodCoaster(parent: THREE.Group, addPart: CafePropAddPartFn) {
  addPart(
    parent,
    new THREE.CylinderGeometry(0.056, 0.052, 0.01, 18),
    '#b45309',
    [0, 0.005, 0],
    [0, 0, 0],
    [1, 1, 1],
    0.007,
  );
}

function addCeramicMugBase(
  parent: THREE.Group,
  addPart: CafePropAddPartFn,
  cupColor: string,
  liquidColor: string,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  baseY: number,
) {
  addPart(
    parent,
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 20),
    cupColor,
    [0, baseY + height * 0.5, 0],
    [0, 0, 0],
    [1, 1, 1],
    0.008,
  );
  // Liquid surface disc slightly recessed near rim
  addPart(
    parent,
    new THREE.CylinderGeometry(radiusTop * 0.87, radiusTop * 0.87, 0.006, 18),
    liquidColor,
    [0, baseY + height - 0.005, 0],
    [0, 0, 0],
    [1, 1, 1],
    0.003,
  );
  // Curved ear handle
  addPart(
    parent,
    new THREE.TorusGeometry(height * 0.25, 0.0065, 8, 16, Math.PI * 1.1),
    cupColor,
    [-radiusTop * 0.96, baseY + height * 0.54, 0],
    [0, 0, Math.PI * 0.45],
    [1, 1, 1],
    0.005,
  );
}

function buildLatteGroup(addPart: CafePropAddPartFn): THREE.Group {
  const g = new THREE.Group();
  addPorcelainPlate(g, addPart);
  addCeramicMugBase(g, addPart, '#fef3c7', '#c27834', 0.044, 0.032, 0.088, 0.011);
  // Steamed milk rosetta foam dome
  addPart(
    g,
    new THREE.SphereGeometry(0.034, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    '#fffbeb',
    [0, 0.095, 0],
    [0, 0, 0],
    [1, 0.35, 1],
    0.003,
  );
  // Caramel drizzle dot & spoon on saucer
  addPart(
    g,
    new THREE.CylinderGeometry(0.012, 0.012, 0.004, 12),
    '#d97706',
    [0.006, 0.106, 0.004],
    [0, 0, 0],
    [1, 1, 1],
    0,
  );
  addPart(
    g,
    new THREE.CylinderGeometry(0.003, 0.003, 0.068, 8),
    '#cbd5e1',
    [0.038, 0.016, 0.034],
    [Math.PI / 2, 0, 0.55],
    [1, 1, 1],
    0.003,
  );
  return g;
}

function buildEspressoGroup(addPart: CafePropAddPartFn): THREE.Group {
  const g = new THREE.Group();
  addPorcelainPlate(g, addPart, '#f1f5f9', '#cbd5e1');
  addCeramicMugBase(g, addPart, '#451a03', '#3f1d0b', 0.034, 0.024, 0.056, 0.011);
  // Golden crema foam ring
  addPart(
    g,
    new THREE.CylinderGeometry(0.026, 0.026, 0.005, 16),
    '#b45309',
    [0, 0.065, 0],
    [0, 0, 0],
    [1, 1, 1],
    0,
  );
  return g;
}

function buildIcedLatteGroup(addPart: CafePropAddPartFn): THREE.Group {
  const g = new THREE.Group();
  addWoodCoaster(g, addPart);
  // Tall translucent clear cup with coffee + cream layers
  addPart(
    g,
    new THREE.CylinderGeometry(0.038, 0.029, 0.062, 18),
    '#92400e',
    [0, 0.041, 0],
    [0, 0, 0],
    [1, 1, 1],
    0.007,
  );
  addPart(
    g,
    new THREE.CylinderGeometry(0.042, 0.038, 0.056, 18),
    '#fef3c7',
    [0, 0.098, 0],
    [0, 0, 0],
    [1, 1, 1],
    0.007,
  );
  // Domed clear botanical lid & green straw
  addPart(
    g,
    new THREE.SphereGeometry(0.042, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    '#e0f2fe',
    [0, 0.125, 0],
    [0, 0, 0],
    [1, 0.65, 1],
    0.005,
  );
  addPart(
    g,
    new THREE.CylinderGeometry(0.004, 0.004, 0.072, 8),
    '#22c55e',
    [0.01, 0.168, 0.005],
    [0.14, 0, -0.18],
    [1, 1, 1],
    0.004,
  );
  return g;
}

function buildHotMochaGroup(addPart: CafePropAddPartFn): THREE.Group {
  const g = new THREE.Group();
  addPorcelainPlate(g, addPart);
  addCeramicMugBase(g, addPart, '#991b1b', '#451a03', 0.044, 0.033, 0.088, 0.011);
  // Whipped cream cloud dome
  addPart(
    g,
    new THREE.SphereGeometry(0.035, 14, 12),
    '#ffffff',
    [0, 0.105, 0],
    [0, 0, 0],
    [1, 0.72, 1],
    0.005,
  );
  addPart(
    g,
    new THREE.ConeGeometry(0.016, 0.026, 12),
    '#ffffff',
    [0, 0.129, 0],
    [0, 0, 0],
    [1, 1, 1],
    0.003,
  );
  // Rich chocolate drizzle dot
  addPart(
    g,
    new THREE.SphereGeometry(0.009, 10, 8),
    '#451a03',
    [0.006, 0.132, 0.008],
    [0, 0, 0],
    [1, 0.7, 1],
    0,
  );
  return g;
}

function buildCroissantGroup(addPart: CafePropAddPartFn): THREE.Group {
  const g = new THREE.Group();
  addPorcelainPlate(g, addPart);
  const segColors = ['#d97706', '#e09f4e', '#f59e0b', '#e09f4e', '#d97706'];
  for (let seg = -2; seg <= 2; seg++) {
    const rad = 0.028 - Math.abs(seg) * 0.0055;
    const ang = seg * 0.44;
    addPart(
      g,
      new THREE.SphereGeometry(rad, 12, 10),
      segColors[seg + 2],
      [Math.sin(ang) * 0.046, 0.026, Math.cos(ang) * 0.02 - 0.014],
      [0, -ang * 0.5, 0],
      [1.15, 0.9, 1.05],
      0.006,
    );
  }
  return g;
}

function buildClubSandwichGroup(addPart: CafePropAddPartFn): THREE.Group {
  const g = new THREE.Group();
  addPorcelainPlate(g, addPart);
  // Bottom toasted bread slice
  addPart(
    g,
    new THREE.CylinderGeometry(0.056, 0.056, 0.013, 3),
    '#eab308',
    [0, 0.018, 0.004],
    [0, 0.35, 0],
    [1.05, 1, 1.05],
    0.006,
  );
  // Crisp botanical lettuce & red tomato slice
  addPart(
    g,
    new THREE.CylinderGeometry(0.057, 0.057, 0.007, 3),
    '#4ade80',
    [0, 0.029, 0.004],
    [0, 0.35, 0],
    [1.05, 1, 1.05],
    0.004,
  );
  addPart(
    g,
    new THREE.CylinderGeometry(0.054, 0.054, 0.008, 3),
    '#ef4444',
    [0, 0.037, 0.004],
    [0, 0.35, 0],
    [1.02, 1, 1.02],
    0.003,
  );
  // Top golden toasted bread slice + wooden skewer pick
  addPart(
    g,
    new THREE.CylinderGeometry(0.055, 0.055, 0.013, 3),
    '#d97706',
    [0, 0.048, 0.004],
    [0, 0.35, 0],
    [1.04, 1, 1.04],
    0.006,
  );
  addPart(
    g,
    new THREE.CylinderGeometry(0.0025, 0.0025, 0.036, 8),
    '#fef3c7',
    [0, 0.068, 0.004],
    [0, 0, 0],
    [1, 1, 1],
    0.002,
  );
  return g;
}

function buildCinnamonRollGroup(addPart: CafePropAddPartFn): THREE.Group {
  const g = new THREE.Group();
  addPorcelainPlate(g, addPart);
  addPart(
    g,
    new THREE.CylinderGeometry(0.048, 0.051, 0.04, 18),
    '#d97706',
    [0, 0.031, 0],
    [0, 0, 0],
    [1, 1, 1],
    0.007,
  );
  addPart(
    g,
    new THREE.TorusGeometry(0.025, 0.009, 8, 18),
    '#fef3c7',
    [0, 0.051, 0],
    [Math.PI / 2, 0, 0],
    [1, 1, 1],
    0.004,
  );
  addPart(
    g,
    new THREE.CylinderGeometry(0.011, 0.011, 0.007, 12),
    '#78350f',
    [0, 0.052, 0],
    [0, 0, 0],
    [1, 1, 1],
    0,
  );
  return g;
}

function buildDonutGroup(addPart: CafePropAddPartFn): THREE.Group {
  const g = new THREE.Group();
  addPorcelainPlate(g, addPart);
  // Warm dough base
  addPart(
    g,
    new THREE.TorusGeometry(0.036, 0.018, 12, 22),
    '#e09f4e',
    [0, 0.028, 0],
    [Math.PI / 2, 0, 0],
    [1, 1, 1],
    0.007,
  );
  // Strawberry glaze topping
  addPart(
    g,
    new THREE.TorusGeometry(0.036, 0.0165, 10, 22),
    '#f472b6',
    [0, 0.033, 0],
    [Math.PI / 2, 0, 0],
    [1, 1, 0.85],
    0.004,
  );
  // Confetti sugar sprinkles
  const sprinkleColors = ['#ffffff', '#38bdf8', '#fde047', '#4ade80'];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    addPart(
      g,
      new THREE.CapsuleGeometry(0.0028, 0.006, 4, 6),
      sprinkleColors[i % sprinkleColors.length],
      [Math.cos(a) * 0.036, 0.048, Math.sin(a) * 0.036],
      [Math.PI / 2, 0, a],
      [1, 1, 1],
      0,
    );
  }
  return g;
}

function buildMuffinGroup(addPart: CafePropAddPartFn): THREE.Group {
  const g = new THREE.Group();
  addPorcelainPlate(g, addPart);
  // Fluted paper liner cup
  addPart(
    g,
    new THREE.CylinderGeometry(0.043, 0.034, 0.038, 16),
    '#60a5fa',
    [0, 0.03, 0],
    [0, 0, 0],
    [1, 1, 1],
    0.006,
  );
  // Golden domed top
  addPart(
    g,
    new THREE.SphereGeometry(0.046, 16, 12),
    '#f59e0b',
    [0, 0.052, 0],
    [0, 0, 0],
    [1, 0.72, 1],
    0.007,
  );
  // Studded blueberry dots
  const berries: Array<[number, number, number]> = [
    [0.018, 0.078, 0.012],
    [-0.02, 0.075, -0.014],
    [0.005, 0.083, -0.02],
    [-0.016, 0.076, 0.021],
  ];
  for (const [bx, by, bz] of berries) {
    addPart(g, new THREE.SphereGeometry(0.0085, 8, 8), '#1e3a8a', [bx, by, bz], [0, 0, 0], [1, 1, 1], 0.002);
  }
  return g;
}

const ITEM_GROUP_BUILDERS: Record<CafeMenuItemId, (addPart: CafePropAddPartFn) => THREE.Group> = {
  latte: buildLatteGroup,
  espresso: buildEspressoGroup,
  iced_latte: buildIcedLatteGroup,
  hot_mocha: buildHotMochaGroup,
  croissant: buildCroissantGroup,
  sandwich: buildClubSandwichGroup,
  cinnamon_roll: buildCinnamonRollGroup,
  donut: buildDonutGroup,
  muffin: buildMuffinGroup,
};

export function createCafeHeldFoodGroup(
  addPart: CafePropAddPartFn = defaultAddFoodPart,
): CafeHeldFoodRigHandle {
  const root = new THREE.Group();
  root.name = 'CafeHeldFoodGroup';
  root.visible = false;

  const propAnchor = new THREE.Group();
  propAnchor.name = 'CafeHeldFoodAnchor';
  propAnchor.scale.setScalar(DEFAULT_FOOD_HAND_SCALE);
  root.add(propAnchor);

  const itemGroups = new Map<CafeMenuItemId, THREE.Group>();
  for (const itemId of Object.keys(ITEM_GROUP_BUILDERS) as CafeMenuItemId[]) {
    const itemGroup = ITEM_GROUP_BUILDERS[itemId](addPart);
    itemGroup.name = `CafeHeld_${itemId}`;
    itemGroup.visible = false;
    propAnchor.add(itemGroup);
    itemGroups.set(itemId, itemGroup);
  }

  // Optional tiny bite-sized golden morsel shown when Right Hand brings a bite toward the mouth
  const rightBiteAnchor = new THREE.Group();
  rightBiteAnchor.name = 'CafeRightHandBiteAnchor';
  rightBiteAnchor.scale.setScalar(DEFAULT_FOOD_HAND_SCALE);
  rightBiteAnchor.visible = false;
  addPart(
    rightBiteAnchor,
    new THREE.SphereGeometry(0.017, 10, 8),
    '#f59e0b',
    [0, 0, 0],
    [0, 0, 0],
    [1.1, 0.85, 1.0],
    0.004,
  );
  root.add(rightBiteAnchor);

  const handle: CafeHeldFoodRigHandle = {
    root,
    propAnchor,
    itemGroups,
    rightBiteAnchor,
    activeItemId: null,
    setActiveItem(itemId: CafeMenuItemId | null) {
      if (handle.activeItemId === itemId) {
        root.visible = Boolean(itemId);
        return;
      }
      if (handle.activeItemId) {
        const prevGrp = itemGroups.get(handle.activeItemId);
        if (prevGrp) prevGrp.visible = false;
      }
      handle.activeItemId = itemId;
      if (itemId) {
        const nextGrp = itemGroups.get(itemId);
        if (nextGrp) nextGrp.visible = true;
        root.visible = true;
      } else {
        rightBiteAnchor.visible = false;
        root.visible = false;
      }
    },
  };

  return handle;
}
