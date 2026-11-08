import React, { useState } from 'react';
import { LUAU_SCRIPTS, BUDDIES_ASSET_MANIFEST } from '../data/buddiesBlueprints';
import {
  BUDDY_BLITZ_EXPLORER_TREE,
  BUDDY_BLITZ_LUAU_SCRIPTS,
} from '../data/buddyBlitzLuauSuite';
import { BUDDIES_CONSTANTS } from '../game/buddiesBlitzRules';
import { soundEngine } from '../game/audio';

interface BuddiesBlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BuddiesBlueprintModal: React.FC<BuddiesBlueprintModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<string>('phase1-arena-builder');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (id: string, text: string) => {
    soundEngine.playUiClick();
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  const handleDownload = (filename: string, content: string) => {
    soundEngine.playUiClick();
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentGddScript = BUDDY_BLITZ_LUAU_SCRIPTS.find((s) => s.id === activeTab);
  const currentBuddiesScript = LUAU_SCRIPTS.find((s) => s.id === activeTab);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="buddies-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-auto"
      style={{ backgroundColor: 'rgba(17, 18, 26, 0.88)' }}
    >
      <div className="w-full max-w-6xl max-h-[90vh] flex flex-col bg-[#191b24] border-4 border-[#11121a] rounded-2xl comic-sticker-shadow-lg overflow-hidden text-white">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-[#272935] border-b-4 border-[#11121a]">
          <div>
            <h2 id="buddies-modal-title" className="text-xl sm:text-2xl font-black tracking-tight text-[#b8ff3c]">
              BUDDY BLITZ GDD (4 LUAU PHASES) &amp; BUDDIES BLITZ SUITE
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            aria-label="Close"
            className="px-4 py-2 bg-[#f42f4c] hover:bg-[#f6556d] text-white font-black text-sm rounded-lg border-2 border-[#11121a] comic-sticker-shadow transition-transform active:translate-y-0.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            Close
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-3 bg-[#11121a] border-b-2 border-[#272935]">
          {BUDDY_BLITZ_LUAU_SCRIPTS.map((script) => (
            <button
              key={script.id}
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab(script.id);
              }}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-lg border-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === script.id
                  ? 'bg-[#b8ff3c] text-[#11121a] border-[#11121a]'
                  : 'bg-[#272935] text-[#dfdfe2] border-[#393b49] hover:text-white'
              }`}
            >
              {script.phase}: {script.id === 'phase1-arena-builder' ? 'Arena Map' : script.id === 'phase1-grass-and-camera' ? 'Grass & Camera' : script.id === 'phase2-crate-stacking' ? 'Stacking Pad' : script.id === 'phase3-vehicle-combat' ? 'Tank & Weapons' : 'AI & HUD'}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              setActiveTab('buddies-report');
            }}
            className={`px-3 py-1.5 text-xs font-extrabold rounded-lg border-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'buddies-report'
                ? 'bg-[#fec83e] text-[#11121a] border-[#11121a]'
                : 'bg-[#272935] text-[#dfdfe2] border-[#393b49] hover:text-white'
            }`}
          >
            BUDDIES Report
          </button>
          {LUAU_SCRIPTS.map((script) => (
            <button
              key={script.id}
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab(script.id);
              }}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-lg border-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === script.id
                  ? 'bg-[#fec83e] text-[#11121a] border-[#11121a]'
                  : 'bg-[#272935] text-[#dfdfe2] border-[#393b49] hover:text-white'
              }`}
            >
              {script.title.split('.')[0]}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 select-text">
          {currentGddScript ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#272935] border-2 border-[#393b49] rounded-xl">
                <div>
                  <div className="text-xs font-mono-tabular text-[#b8ff3c] font-bold">
                    {currentGddScript.phase} · {currentGddScript.path}
                  </div>
                  <div className="text-sm font-black text-white mt-1">{currentGddScript.title}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(currentGddScript.id, currentGddScript.code)}
                    className="px-4 py-2 bg-[#b8ff3c] hover:bg-[#c7ff72] text-[#11121a] font-black text-xs rounded-lg border-2 border-[#11121a] comic-sticker-shadow cursor-pointer whitespace-nowrap"
                  >
                    {copiedId === currentGddScript.id ? 'Copied' : 'Copy Code'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleDownload(`${currentGddScript.id}.lua`, currentGddScript.code)
                    }
                    className="px-4 py-2 bg-[#fec83e] hover:bg-[#fee763] text-[#11121a] font-black text-xs rounded-lg border-2 border-[#11121a] comic-sticker-shadow cursor-pointer whitespace-nowrap"
                  >
                    Download Lua
                  </button>
                </div>
              </div>

              <div className="p-3 bg-[#11121a] border border-[#393b49] rounded-xl">
                <pre className="text-[11px] font-mono-tabular text-[#fec83e] overflow-x-auto leading-snug">
                  {BUDDY_BLITZ_EXPLORER_TREE}
                </pre>
              </div>

              <pre className="p-4 bg-[#11121a] border-2 border-[#393b49] rounded-xl text-xs font-mono-tabular text-[#dfdfe2] overflow-x-auto leading-relaxed max-h-[46vh]">
                <code>{currentGddScript.code}</code>
              </pre>
            </div>
          ) : activeTab === 'buddies-report' ? (
            <div className="space-y-6">
              <div className="p-4 bg-[#11121a] border-2 border-[#393b49] rounded-xl">
                <h3 className="text-base font-black text-[#fec83e] mb-2">
                  Roblox Studio Explorer Structure
                </h3>
                <pre className="text-xs font-mono-tabular text-[#dfdfe2] leading-relaxed overflow-x-auto">
                  {BUDDY_BLITZ_EXPLORER_TREE}
                </pre>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="p-4 bg-[#272935] border-2 border-[#393b49] rounded-xl space-y-2">
                  <h4 className="text-sm font-black text-[#b8ff3c]">
                    1. Camera (CQl67Veh.js)
                  </h4>
                  <ul className="text-xs font-mono-tabular space-y-1.5 text-[#dfdfe2]">
                    <li>WebGL FOV: {BUDDIES_CONSTANTS.camera.fov}° · Top-Down Pitch: -48°</li>
                    <li>Roblox Isometric FOV: {BUDDIES_CONSTANTS.camera.robloxPseudoOrthoFov}°</li>
                    <li>Offset: Vector3(4, 14, 8) (d = 16.61m)</li>
                    <li>Spring Follow: smoothTime = 0.18..0.22s</li>
                    <li>Aim Lead: 1 - math.exp(-10 * dt)</li>
                  </ul>
                </div>

                <div className="p-4 bg-[#272935] border-2 border-[#393b49] rounded-xl space-y-2">
                  <h4 className="text-sm font-black text-[#b8ff3c]">
                    2. Physics &amp; Stacking Pad
                  </h4>
                  <ul className="text-xs font-mono-tabular space-y-1.5 text-[#dfdfe2]">
                    <li>Gravity: (0, -9.81, 0) · dt = 1/60s</li>
                    <li>Tank Speed: 8.0 m/s · Boost: 1.9x (15.2 m/s)</li>
                    <li>Red Crate Drop: 4s · Super Crate Drop: 15s</li>
                    <li>Merged Crates: &gt;= 2 crates merged on Pad</li>
                    <li>Super Rule: +1 Blue = Tier 2 SUPER Craft</li>
                  </ul>
                </div>

                <div className="p-4 bg-[#272935] border-2 border-[#393b49] rounded-xl space-y-2">
                  <h4 className="text-sm font-black text-[#b8ff3c]">
                    3. Blitz Palette &amp; Outline
                  </h4>
                  <ul className="text-xs font-mono-tabular space-y-1.5 text-[#dfdfe2]">
                    <li>Grass: #5ec932 · Blade: #6cd938</li>
                    <li>Dirt Road: #d89c60 · Border: #c28348</li>
                    <li>Tree Trunk: #8c4a27 · Canopy: #1d1f8c</li>
                    <li>Ink Outline: #12121e / #17110f</li>
                    <li>Comic Neon: #b4ff39 · Sky: #9ad9ea</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 bg-[#272935] border-2 border-[#393b49] rounded-xl space-y-3">
                <h4 className="text-sm font-black text-[#fec83e]">
                  4. 3D Asset Manifest
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {BUDDIES_ASSET_MANIFEST.map((group) => (
                    <div key={group.category} className="p-3 bg-[#11121a] rounded-lg border border-[#393b49]">
                      <div className="text-xs font-black text-[#b8ff3c] mb-1">{group.category}</div>
                      <ul className="text-xs font-mono-tabular text-[#dfdfe2] space-y-1">
                        {group.files.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : currentBuddiesScript ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#272935] border-2 border-[#393b49] rounded-xl">
                <div>
                  <div className="text-xs font-mono-tabular text-[#fec83e] font-bold">
                    {currentBuddiesScript.scriptType} · {currentBuddiesScript.robloxPath}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(currentBuddiesScript.id, currentBuddiesScript.code)}
                    className="px-4 py-2 bg-[#b8ff3c] hover:bg-[#c7ff72] text-[#11121a] font-black text-xs rounded-lg border-2 border-[#11121a] comic-sticker-shadow cursor-pointer whitespace-nowrap"
                  >
                    {copiedId === currentBuddiesScript.id ? 'Copied' : 'Copy Code'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleDownload(
                        currentBuddiesScript.robloxPath.split('/').pop() || 'script.lua',
                        currentBuddiesScript.code,
                      )
                    }
                    className="px-4 py-2 bg-[#fec83e] hover:bg-[#fee763] text-[#11121a] font-black text-xs rounded-lg border-2 border-[#11121a] comic-sticker-shadow cursor-pointer whitespace-nowrap"
                  >
                    Download Lua
                  </button>
                </div>
              </div>

              <pre className="p-4 bg-[#11121a] border-2 border-[#393b49] rounded-xl text-xs font-mono-tabular text-[#dfdfe2] overflow-x-auto leading-relaxed max-h-[54vh]">
                <code>{currentBuddiesScript.code}</code>
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

