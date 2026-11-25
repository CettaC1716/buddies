import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Check, RotateCw, Shirt, ShoppingBag } from 'lucide-react';
import {
  FASHION_APPAREL_CATALOG_ITEMS,
  type FashionApparelCatalogItem,
} from '../game/buddiesFashionKioskRules';
import { loadModularApparelGltf } from '../game/buddiesBlitzShadersAndAssets';
import { soundEngine } from '../game/audio';
import { TabletDeviceMockupShell } from './TabletDeviceMockupShell';

export interface FashionBoutiqueModalProps {
  isOpen: boolean;
  onClose: () => void;
  lulBalance: number;
  characterGender: 'male' | 'female';
  ownedApparelIds: string[];
  equippedTorsoItemId: string | null;
  onPurchaseApparelToBag: (
    item: FashionApparelCatalogItem,
  ) => { ok: boolean; errorMessage?: string };
  onOpenPersonalBag: () => void;
}

function detectSoftwareWebGl(): boolean {
  if (typeof document === 'undefined') return true;
  const probeCanvas = document.createElement('canvas');
  const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param) || '');
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.28)');
    grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.11)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const Garment3DPreviewCanvas: React.FC<{
  glbPath: string;
  fitPreviewGender: 'male' | 'female';
}> = ({ glbPath, fitPreviewGender }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    dragging: boolean;
    lastX: number;
    targetYaw: number;
    currentYaw: number;
    autoSpinResumeAt: number;
  }>({
    dragging: false,
    lastX: 0,
    targetYaw: 0.36,
    currentYaw: 0.36,
    autoSpinResumeAt: 0,
  });
  const [isModelReady, setIsModelReady] = useState(false);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;

    let cancelled = false;
    setIsModelReady(false);
    const isSoftwareGl = detectSoftwareWebGl();

    const width = Math.max(280, host.clientWidth || 500);
    const height = Math.max(240, host.clientHeight || 340);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eef1f6');

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.05, 30);
    camera.position.set(0, 1.08, 2.15);
    camera.lookAt(0, 1.04, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.domElement.className = 'w-full h-full block cursor-grab active:cursor-grabbing touch-none';

    host.innerHTML = '';
    host.appendChild(renderer.domElement);

    const pmremGen = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGen.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGen.dispose();

    const hemi = new THREE.HemisphereLight('#ffffff', '#cbd5e1', 1.3);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#fffdf8', 1.75);
    keyLight.position.set(2.4, 3.6, 2.8);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#bae6fd', 0.8);
    rimLight.position.set(-2.6, 2.2, -2.2);
    scene.add(rimLight);

    // Subtle boutique display plinth + contact shadow + brushed satin mannequin post
    const turntableGroup = new THREE.Group();
    scene.add(turntableGroup);

    const plinthGeo = new THREE.CylinderGeometry(0.62, 0.66, 0.05, 40);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: '#dce3ee',
      roughness: 0.38,
      metalness: 0.12,
    });
    const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
    plinthMesh.position.y = 0.46;
    turntableGroup.add(plinthMesh);

    const rimGeo = new THREE.TorusGeometry(0.625, 0.008, 12, 48);
    const rimMat = new THREE.MeshStandardMaterial({
      color: fitPreviewGender === 'female' ? '#38bdf8' : '#0ea5e9',
      roughness: 0.3,
      metalness: 0.55,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 0.486;
    turntableGroup.add(rimMesh);

    const standRodGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.56, 18);
    const standRodMat = new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      roughness: 0.28,
      metalness: 0.72,
    });
    const standRod = new THREE.Mesh(standRodGeo, standRodMat);
    standRod.position.y = 0.76;
    turntableGroup.add(standRod);

    const neckCapGeo = new THREE.CylinderGeometry(0.048, 0.056, 0.08, 20);
    const neckCapMat = new THREE.MeshStandardMaterial({
      color: '#64748b',
      roughness: 0.48,
      metalness: 0.18,
    });
    const neckCap = new THREE.Mesh(neckCapGeo, neckCapMat);
    neckCap.position.y = 1.33;
    turntableGroup.add(neckCap);

    const shadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(0.95, 0.95);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.487;
    turntableGroup.add(shadowPlane);

    const garmentHolder = new THREE.Group();
    if (fitPreviewGender === 'female') {
      garmentHolder.scale.set(0.96, 0.98, 0.96);
    }
    turntableGroup.add(garmentHolder);

    const clonedGeometries: THREE.BufferGeometry[] = [];

    void loadModularApparelGltf(glbPath).then((gltf) => {
      if (cancelled || !gltf) return;
      const clonedRoot = SkeletonUtils.clone(gltf.scene) as THREE.Group;
      clonedRoot.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          const m = node as THREE.Mesh;
          if ((m.name || '').toLowerCase().includes('outline')) {
            m.visible = false;
            return;
          }
          m.geometry = m.geometry.clone();
          clonedGeometries.push(m.geometry);
          m.frustumCulled = false;
          m.castShadow = false;
          m.receiveShadow = false;
        }
      });

      // Gently relax mannequin arms downward from horizontal T-pose for a natural boutique display silhouette
      clonedRoot.traverse((node) => {
        if ((node as THREE.Bone).isBone) {
          if (node.name === 'LeftArm') {
            node.rotation.z = -0.72;
          } else if (node.name === 'RightArm') {
            node.rotation.z = 0.72;
          } else if (node.name === 'LeftForeArm') {
            node.rotation.z = -0.15;
          } else if (node.name === 'RightForeArm') {
            node.rotation.z = 0.15;
          }
        }
      });
      clonedRoot.updateMatrixWorld(true);
      garmentHolder.add(clonedRoot);
      setIsModelReady(true);
    });

    const onPointerDown = (e: PointerEvent) => {
      dragStateRef.current.dragging = true;
      dragStateRef.current.lastX = e.clientX;
      dragStateRef.current.autoSpinResumeAt = performance.now() + 2600;
      renderer.domElement.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragStateRef.current.dragging) return;
      const dx = e.clientX - dragStateRef.current.lastX;
      dragStateRef.current.lastX = e.clientX;
      dragStateRef.current.targetYaw += dx * 0.012;
      dragStateRef.current.autoSpinResumeAt = performance.now() + 2600;
    };
    const onPointerUp = (e: PointerEvent) => {
      dragStateRef.current.dragging = false;
      renderer.domElement.releasePointerCapture?.(e.pointerId);
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (!host) return;
      const nw = Math.max(260, host.clientWidth);
      const nh = Math.max(220, host.clientHeight);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh, false);
    };
    const resizeObs =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    resizeObs?.observe(host);

    const clock = new THREE.Clock();
    let frameId = 0;
    let timerId = 0;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (cancelled) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            timerId = window.setTimeout(poll, 6);
          } else {
            if (sync) gl.deleteSync(sync);
            timerId = window.setTimeout(cb, 80);
          }
        };
        timerId = window.setTimeout(poll, 6);
      } else {
        timerId = window.setTimeout(cb, 80);
      }
    };

    const tick = () => {
      if (cancelled) return;
      const dt = Math.min(0.05, clock.getDelta());
      const now = performance.now();
      const st = dragStateRef.current;
      if (!st.dragging && now >= st.autoSpinResumeAt) {
        st.targetYaw += dt * 0.45;
      }
      st.currentYaw = THREE.MathUtils.damp(st.currentYaw, st.targetYaw, 9.5, dt);
      turntableGroup.rotation.y = st.currentYaw;
      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(timerId);
      resizeObs?.disconnect();
      domEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      plinthGeo.dispose();
      plinthMat.dispose();
      rimGeo.dispose();
      rimMat.dispose();
      standRodGeo.dispose();
      standRodMat.dispose();
      neckCapGeo.dispose();
      neckCapMat.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      shadowTex.dispose();
      envTarget.dispose();
      for (const g of clonedGeometries) {
        g.dispose();
      }
      renderer.dispose();
    };
  }, [glbPath, fitPreviewGender]);

  return (
    <div className="relative w-full h-full min-h-[270px] sm:min-h-[330px] bg-[#eef1f6] rounded-xl overflow-hidden">
      <div ref={mountRef} className="w-full h-full min-h-[270px] sm:min-h-[330px]" />
      {!isModelReady && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#eef1f6]/80 text-xs font-medium text-slate-500">
          Loading 3D Garment Mesh...
        </div>
      )}
    </div>
  );
};

export const FashionBoutiqueModal: React.FC<FashionBoutiqueModalProps> = ({
  isOpen,
  onClose,
  lulBalance,
  characterGender,
  ownedApparelIds,
  equippedTorsoItemId,
  onPurchaseApparelToBag,
  onOpenPersonalBag,
}) => {
  const [selectedId, setSelectedId] = useState<string>(
    FASHION_APPAREL_CATALOG_ITEMS[0]?.id ?? 'apparel_torso_dropscience_hiphop_24',
  );
  const [previewGender, setPreviewGender] = useState<'male' | 'female'>(characterGender);
  const [feedbackMsg, setFeedbackMsg] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);

  useEffect(() => {
    setPreviewGender(characterGender);
  }, [characterGender, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setFeedbackMsg(null);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        soundEngine.playUiCancel();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedItem =
    FASHION_APPAREL_CATALOG_ITEMS.find((item) => item.id === selectedId) ??
    FASHION_APPAREL_CATALOG_ITEMS[0];

  const isOwnedInBag = ownedApparelIds.includes(selectedItem.id);
  const isCurrentlyWearing = equippedTorsoItemId === selectedItem.id;
  const canAfford = lulBalance >= selectedItem.priceLul;
  const previewGlbPath =
    previewGender === 'female' ? selectedItem.femaleGlbPath : selectedItem.maleGlbPath;

  const handleBuyClick = () => {
    if (isOwnedInBag) {
      soundEngine.playUiClick();
      onClose();
      onOpenPersonalBag();
      return;
    }
    const res = onPurchaseApparelToBag(selectedItem);
    if (res.ok) {
      soundEngine.playPickup();
      setFeedbackMsg({
        tone: 'ok',
        text: `${selectedItem.name} added to your Wardrobe. Open Wardrobe to wear it.`,
      });
    } else {
      soundEngine.playUiCancel();
      setFeedbackMsg({
        tone: 'err',
        text:
          res.errorMessage ??
          `Insufficient LUL (${lulBalance.toLocaleString()} / ${selectedItem.priceLul} LUL).`,
      });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fashion & Apparel Boutique"
      data-fashion-boutique-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundEngine.playUiCancel();
          onClose();
        }
      }}
      className="fixed inset-0 z-[130] flex items-center justify-center p-2.5 sm:p-5 bg-black/25 pointer-events-auto select-none"
    >
      <TabletDeviceMockupShell
        appLabel="FASHION BOUTIQUE"
        title="Fashion & Apparel Boutique"
        subtitle="Central Plaza Promenade · Modular Avatar Wardrobe"
        headerIcon={<Shirt className="w-5 h-5" />}
        maxWidthClass="max-w-4xl"
        heightClass="max-h-[92vh]"
        onClose={onClose}
        closeAriaLabel="Close Fashion Boutique"
        closeButtonProps={{ 'data-close-fashion-boutique-btn': 'true' }}
        headerRight={
          <div className="flex items-center gap-2 shrink-0">
            <div className="px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold flex items-center gap-2 text-white">
              <span className="text-white/60 font-medium">Balance</span>
              <span className="font-mono font-bold tabular-nums text-white">
                {lulBalance.toLocaleString()} LUL
              </span>
            </div>

            <button
              type="button"
              data-fashion-open-bag-shortcut="true"
              onClick={() => {
                soundEngine.playUiClick();
                onClose();
                onOpenPersonalBag();
              }}
              className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 shadow-xs text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Shirt className="w-3.5 h-3.5 text-emerald-400" />
              <span>Wardrobe ({ownedApparelIds.length})</span>
            </button>
          </div>
        }
        subHeader={
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-white/[0.03] border-b border-white/10 shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white text-slate-950 shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
              >
                Tops &amp; Jackets ({FASHION_APPAREL_CATALOG_ITEMS.length})
              </button>
            </div>

            <div className="text-xs text-white/55">
              <span>Purchases are saved to your Wardrobe</span>
              <span aria-hidden="true"> · </span>
              <span>Wear anytime from Wardrobe</span>
            </div>
          </div>
        }
        footer={
          <footer className="px-4 sm:px-5 py-3 bg-white/[0.04] border-t border-white/[0.12] flex items-center gap-2.5 overflow-x-auto shrink-0">
            {FASHION_APPAREL_CATALOG_ITEMS.map((item) => {
              const active = item.id === selectedItem.id;
              const itemOwned = ownedApparelIds.includes(item.id);
              const itemWearing = equippedTorsoItemId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playSoftTap();
                    setSelectedId(item.id);
                    setFeedbackMsg(null);
                  }}
                  className={`px-3.5 py-2 rounded-2xl border text-left transition-all cursor-pointer shrink-0 flex items-center gap-3 ${
                    active
                      ? 'bg-sky-500/20 border-sky-400/75 ring-1 ring-sky-400/40 text-white shadow-sm'
                      : 'bg-white/[0.06] border-white/12 text-white/85 hover:bg-white/[0.11] hover:border-white/25'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                      active ? 'bg-sky-500/25 text-sky-300' : 'bg-white/10 text-sky-300'
                    }`}
                  >
                    <Shirt className="w-4 h-4 shrink-0" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold whitespace-nowrap">{item.name}</div>
                    <div
                      className={`text-[11px] font-mono tabular-nums whitespace-nowrap ${
                        itemWearing || itemOwned
                          ? 'text-emerald-300'
                          : active
                            ? 'text-white/80'
                            : 'text-white/55'
                      }`}
                    >
                      {itemWearing
                        ? 'Wearing'
                        : itemOwned
                          ? 'In Bag'
                          : `${item.priceLul} LUL`}
                    </div>
                  </div>
                </button>
              );
            })}
          </footer>
        }
      >
        {/* Main 2-Column Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 sm:p-5 items-stretch overflow-y-auto min-h-0 flex-1">
          {/* Left: Interactive 360° 3D Garment Studio */}
          <div className="lg:col-span-7 relative rounded-2xl bg-white/[0.06] border border-white/15 shadow-sm p-2.5 flex flex-col gap-2.5">
            <div className="flex-1 min-h-[260px] sm:min-h-[330px]">
              <Garment3DPreviewCanvas
                glbPath={previewGlbPath}
                fitPreviewGender={previewGender}
              />
            </div>

            {/* Bottom Studio Controls Strip */}
            <div className="flex items-center justify-between gap-3 px-1.5 py-1 text-xs">
              <div className="flex items-center gap-1 p-0.5 rounded-full bg-white/10 border border-white/15">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playSoftTap();
                    setPreviewGender('male');
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    previewGender === 'male'
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Male Fit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playSoftTap();
                    setPreviewGender('female');
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    previewGender === 'female'
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Female Fit
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-white/60">
                <RotateCw className="w-3.5 h-3.5 text-white/50" />
                <span>Drag to rotate 360°</span>
              </div>
            </div>
          </div>

          {/* Right: Bento Product Specification & Purchase Column */}
          <div className="lg:col-span-5 rounded-2xl bg-white/[0.06] border border-white/15 shadow-sm p-5 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              {/* Metadata Pills */}
              <div className="flex items-center flex-wrap gap-1.5 text-[11px]">
                <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 font-medium border border-white/10">
                  {selectedItem.collectionLabel}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 font-medium border border-white/10">
                  Torso Slot
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-semibold ${
                    isCurrentlyWearing || isOwnedInBag
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/35'
                      : 'bg-sky-500/20 text-sky-300 border border-sky-400/35'
                  }`}
                >
                  {isCurrentlyWearing
                    ? 'Wearing Now'
                    : isOwnedInBag
                      ? 'In Your Bag'
                      : 'In Stock'}
                </span>
              </div>

              <div>
                <h3 className="text-xl font-bold tracking-tight text-white">
                  {selectedItem.name}
                </h3>
                <p className="text-xs font-medium text-sky-300 mt-0.5">
                  {selectedItem.subtitle}
                </p>
              </div>

              <p className="text-sm leading-relaxed text-white/65">
                {selectedItem.description}
              </p>

              {/* Spec Grid */}
              <div className="grid grid-cols-2 gap-2">
                {selectedItem.specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="rounded-xl bg-white/[0.05] border border-white/10 px-3 py-2"
                  >
                    <div className="text-[11px] text-white/50">{spec.label}</div>
                    <div className="text-xs font-semibold text-white mt-0.5 tabular-nums">
                      {spec.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Price & Primary Action */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-white/55 font-medium">Boutique Price</span>
                <span className="text-xl font-bold font-mono tabular-nums text-white">
                  {selectedItem.priceLul} LUL
                </span>
              </div>

              {feedbackMsg && (
                <div
                  role="status"
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-medium border ${
                    feedbackMsg.tone === 'ok'
                      ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                      : 'bg-rose-500/15 border-rose-400/35 text-rose-200'
                  }`}
                >
                  {feedbackMsg.text}
                </div>
              )}

              {!isOwnedInBag ? (
                <button
                  type="button"
                  data-buy-fashion-item-btn={selectedItem.id}
                  onClick={handleBuyClick}
                  className={`w-full py-3 px-4 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                    canAfford
                      ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-sm'
                      : 'bg-white/10 hover:bg-white/15 text-white/70 border border-white/15'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                  <span>
                    {canAfford
                      ? `Buy Top — ${selectedItem.priceLul} LUL (Send to Bag)`
                      : `Need ${selectedItem.priceLul} LUL (${lulBalance.toLocaleString()} LUL Available)`}
                  </span>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/35 text-xs font-medium text-emerald-200 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      {isCurrentlyWearing
                        ? 'Wearing now.'
                        : 'Saved in your Wardrobe — open Wardrobe to wear it.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    data-open-bag-after-fashion-buy-btn="true"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onClose();
                      onOpenPersonalBag();
                    }}
                    className="w-full py-3 px-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Shirt className="w-4 h-4 shrink-0" />
                    <span>Open Wardrobe to Wear</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </TabletDeviceMockupShell>
    </div>
  );
};
