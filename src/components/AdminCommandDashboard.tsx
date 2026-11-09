import React, { useEffect, useState } from 'react';
import {
  AdminCryptographicProof,
  DEFAULT_ONCHAIN_SUB_ACCOUNT_ID,
  MASTER_FULL_ACCESS_PUBLIC_KEY,
  MASTER_TREASURY_ACCOUNT_ID,
  MASTER_WALLET_ACCOUNT_ID,
  MasterManagedSubAccount,
  NearAccountOnChainView,
  NearRpcStatusSnapshot,
  Nep171GamepassSubAccountLedger,
  clearAdminCryptographicProof,
  executeAtomicNep171SubAccountTransfer,
  fetchNearAccountView,
  getNearBlocksAccountUrl,
  getNearBlocksTxUrl,
  loadSavedAdminCryptographicProof,
  rotateSubAccountSessionKey,
  spawnSubAccountOnChainViaMaster,
  toggleSubAccountFreezeStatus,
  updateSubAccountBalances,
  verifyMasterAdminWithMeteorOrKey,
} from '../lib/nearClient';
import {
  MERCHANT_CATALOG_ITEMS,
  MerchantAgentMarketState,
} from '../game/buddiesMerchantPricing';
import { WorldMode } from '../game/buddiesBlitzRules';
import { soundEngine } from '../game/audio';

interface AdminCommandDashboardProps {
  nearRpcStatus: NearRpcStatusSnapshot | null;
  supabaseConnected: boolean;
  masterTreasuryNear: number;
  setMasterTreasuryNear: React.Dispatch<React.SetStateAction<number>>;
  masterTreasuryRespite: number;
  setMasterTreasuryRespite: React.Dispatch<React.SetStateAction<number>>;
  masterTreasuryCyon: number;
  setMasterTreasuryCyon: React.Dispatch<React.SetStateAction<number>>;
  marketState: MerchantAgentMarketState;
  setMarketState: React.Dispatch<React.SetStateAction<MerchantAgentMarketState>>;
  managedSubAccounts: MasterManagedSubAccount[];
  setManagedSubAccounts: React.Dispatch<React.SetStateAction<MasterManagedSubAccount[]>>;
  nep171Ledger: Nep171GamepassSubAccountLedger;
  setNep171Ledger: React.Dispatch<React.SetStateAction<Nep171GamepassSubAccountLedger>>;
  onGrantActivePlayerRespite: (amount: number) => void;
  onLaunch3dQaTeleport: (target: {
    worldMode: WorldMode;
    team?: 'blue' | 'red';
    openHouseInterior?: boolean;
    impersonateAccountId?: string;
  }) => void;
}

export const AdminCommandDashboard: React.FC<AdminCommandDashboardProps> = ({
  nearRpcStatus,
  supabaseConnected,
  masterTreasuryNear,
  setMasterTreasuryNear,
  masterTreasuryRespite,
  setMasterTreasuryRespite,
  masterTreasuryCyon,
  setMasterTreasuryCyon,
  marketState,
  setMarketState,
  managedSubAccounts,
  setManagedSubAccounts,
  nep171Ledger,
  setNep171Ledger,
  onGrantActivePlayerRespite,
  onLaunch3dQaTeleport,
}) => {
  const [cryptoProof, setCryptoProof] = useState<AdminCryptographicProof | null>(() =>
    loadSavedAdminCryptographicProof(),
  );
  const [publicKeyInput, setPublicKeyInput] = useState<string>('');
  const [isVerifyingAuth, setIsVerifyingAuth] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<
    'telemetry' | 'treasury' | 'subaccounts' | 'nft_transfer' | 'qa_teleport'
  >('treasury');
  const [statusNote, setStatusNote] = useState<string>('');
  const [newSubPrefix, setNewSubPrefix] = useState<string>('');
  const [isSpawningSub, setIsSpawningSub] = useState<boolean>(false);
  const [transferBuyerInput, setTransferBuyerInput] = useState<string>('buyer-omega.testnet');
  const [transferAuditNote, setTransferAuditNote] = useState<string>('');

  const [masterOnChainView, setMasterOnChainView] = useState<NearAccountOnChainView | null>(null);
  const [treasuryOnChainView, setTreasuryOnChainView] = useState<NearAccountOnChainView | null>(
    null,
  );

  // Inject strict anti-indexing meta tag so search engines never index the Admin deployment
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex, nofollow, noarchive, nosnippet';
  }, []);

  // Fetch live on-chain account views once verified
  useEffect(() => {
    if (!cryptoProof?.verified) return;
    let mounted = true;
    void fetchNearAccountView(MASTER_WALLET_ACCOUNT_ID, 'testnet').then((v) => {
      if (mounted) setMasterOnChainView(v);
    });
    void fetchNearAccountView(MASTER_TREASURY_ACCOUNT_ID, 'testnet').then((v) => {
      if (mounted) setTreasuryOnChainView(v);
    });
    return () => {
      mounted = false;
    };
  }, [cryptoProof?.verified]);

  const handleAuthenticateMaster = async () => {
    soundEngine.playUiClick();
    setIsVerifyingAuth(true);
    setAuthError(null);
    const result = await verifyMasterAdminWithMeteorOrKey({
      providedPublicKey: publicKeyInput.trim() || undefined,
    });
    setIsVerifyingAuth(false);
    if (result.verified) {
      setCryptoProof(result);
    } else {
      setAuthError(result.error || 'Cryptographic verification failed.');
    }
  };

  // ===========================================================================
  // LOCKED GATE: Rendered when cryptographic verification has NOT passed
  // ===========================================================================
  if (!cryptoProof || !cryptoProof.verified) {
    return (
      <main
        data-admin-auth-gate="true"
        className="min-h-screen w-screen bg-[#090b10] text-white flex items-center justify-center p-4 select-none"
      >
        <div className="w-full max-w-md bg-[#12151f] border-4 border-black ring-4 ring-white shadow-[8px_8px_0_#000] p-6 space-y-4">
          <div className="border-b-2 border-white/15 pb-3 space-y-1">
            <div className="inline-block -skew-x-12 px-3 py-0.5 bg-[#facc15] text-black border-2 border-black font-black text-[10px] uppercase tracking-widest">
              <span className="skew-x-12 inline-block">RESTRICTED ACCESS</span>
            </div>
            <h1 className="text-xl font-black uppercase tracking-wider text-white pt-1">
              ADMIN &amp; QA COMMAND GATE
            </h1>
            <p className="text-xs font-bold text-slate-300">
              Cryptographic verification against NEAR Testnet RPC is required to unlock this panel.
            </p>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              data-admin-meteor-verify-btn="true"
              disabled={isVerifyingAuth}
              onClick={() => void handleAuthenticateMaster()}
              className="-skew-x-6 w-full py-3 px-4 bg-[#facc15] hover:bg-[#fde047] disabled:opacity-60 text-black border-3 border-black shadow-[4px_4px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer transition-all"
            >
              <span className="skew-x-6 inline-block">
                {isVerifyingAuth
                  ? 'VERIFYING ON-CHAIN ACCESS KEY...'
                  : 'CONNECT METEOR WALLET & VERIFY MASTER'}
              </span>
            </button>

            <div className="pt-2 border-t border-white/15 space-y-1.5">
              <div className="text-[10px] font-black uppercase text-slate-300">
                OR ENTER MASTER ED25519 PUBLIC KEY
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  data-admin-pubkey-input="true"
                  value={publicKeyInput}
                  onChange={(e) => {
                    setPublicKeyInput(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void handleAuthenticateMaster();
                    }
                  }}
                  placeholder="ed25519:..."
                  className="flex-1 min-w-0 px-3 py-2 bg-white text-black font-mono font-bold text-xs border-2 border-black focus:outline-none"
                />
                <button
                  type="button"
                  data-admin-pubkey-submit-btn="true"
                  disabled={isVerifyingAuth}
                  onClick={() => void handleAuthenticateMaster()}
                  className="-skew-x-6 px-4 py-2 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black font-black text-xs uppercase border-2 border-black shadow-[3px_3px_0_#000] cursor-pointer shrink-0"
                >
                  <span className="skew-x-6 inline-block">VERIFY</span>
                </button>
              </div>
            </div>

            {authError && (
              <div
                data-admin-auth-error="true"
                className="p-2.5 bg-[#ff3b30]/20 border border-[#ff3b30] text-[#fca5a5] text-[10.5px] font-bold"
              >
                {authError}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ===========================================================================
  // UNLOCKED ADMIN & QA COMMAND DASHBOARD
  // ===========================================================================
  return (
    <main
      data-admin-command-dashboard="true"
      className="min-h-screen w-screen bg-[#0b0e16] text-white flex flex-col select-none overflow-y-auto"
    >
      {/* Top Command Header */}
      <header className="px-4 sm:px-6 py-3 bg-[#12151f] border-b-4 border-black flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="-skew-x-12 px-3 py-1 bg-[#b8ff3c] text-black border-2 border-black shadow-[2px_2px_0_#000] font-black text-xs uppercase tracking-wider">
            <span className="skew-x-12 inline-block">ADMIN &amp; QA DASHBOARD</span>
          </span>
          <div className="text-xs font-mono font-bold text-[#38bdf8]">
            Verified Master: <strong className="text-white">{cryptoProof.accountId}</strong>
          </div>
          <div className="text-[10.5px] font-mono text-slate-400">
            Key: {cryptoProof.publicKey.slice(0, 22)}...
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-admin-launch-3d-qa-btn="true"
            onClick={() => {
              soundEngine.playUiClick();
              onLaunch3dQaTeleport({ worldMode: 'lobby' });
            }}
            className="-skew-x-6 px-3.5 py-1.5 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black border-2 border-black shadow-[3px_3px_0_#000] font-black text-xs uppercase cursor-pointer"
          >
            <span className="skew-x-6 inline-block">OPEN 3D SCENE (QA MODE)</span>
          </button>

          <button
            type="button"
            data-admin-lock-session-btn="true"
            onClick={() => {
              soundEngine.playUiClick();
              clearAdminCryptographicProof();
              setCryptoProof(null);
            }}
            className="-skew-x-6 px-3 py-1.5 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black shadow-[3px_3px_0_#000] font-black text-xs uppercase cursor-pointer"
          >
            <span className="skew-x-6 inline-block">LOCK PANEL</span>
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="px-4 sm:px-6 py-2.5 bg-[#181c29] border-b-2 border-black flex flex-wrap gap-2">
        {(
          [
            { id: 'treasury', label: '1. MASTER & MERCHANT TREASURY' },
            { id: 'subaccounts', label: '2. SUB-ACCOUNT CUSTODY' },
            { id: 'telemetry', label: '3. SUPABASE & NEAR EXPLORER' },
            { id: 'nft_transfer', label: '4. ATOMIC NFT TRANSFER (NEP-171)' },
            { id: 'qa_teleport', label: '5. 3D MAP QA TELEPORT' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-admin-tab={tab.id}
            onClick={() => {
              soundEngine.playUiClick();
              setActiveSection(tab.id);
            }}
            className={`-skew-x-6 px-3.5 py-1.5 border-2 border-black font-black text-xs uppercase cursor-pointer transition-all ${
              activeSection === tab.id
                ? 'bg-[#facc15] text-black shadow-[3px_3px_0_#000]'
                : 'bg-[#0f172a] hover:bg-[#1e293b] text-white'
            }`}
          >
            <span className="skew-x-6 inline-block">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Status Toast Banner */}
      {statusNote && (
        <div className="mx-4 sm:mx-6 mt-3 p-2.5 bg-[#1e293b] border-2 border-[#b8ff3c] text-xs font-bold text-[#b8ff3c] flex items-center justify-between">
          <span>{statusNote}</span>
          <button
            type="button"
            onClick={() => setStatusNote('')}
            className="text-white/70 hover:text-white font-black text-xs px-2 cursor-pointer"
          >
            X
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-6 flex-1">
        {/* ===================================================================
            TAB 1: MASTER & MERCHANT TREASURY CONTROL
           =================================================================== */}
        {activeSection === 'treasury' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Master Treasury Card */}
            <section
              data-admin-master-treasury-card="true"
              className="p-4 bg-[#12151f] border-3 border-black shadow-[5px_5px_0_#000] space-y-3.5"
            >
              <div className="border-b border-white/15 pb-2">
                <div className="text-sm font-black uppercase text-[#facc15]">
                  MASTER TREASURY VAULT
                </div>
                <div className="text-xs font-mono text-slate-300 mt-0.5">
                  Master: {MASTER_WALLET_ACCOUNT_ID} | Vault: {MASTER_TREASURY_ACCOUNT_ID}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-[#1e293b] border border-white/15">
                  <div className="text-[10px] font-black uppercase text-slate-400">NEAR</div>
                  <div className="text-sm font-black text-[#38bdf8]">{masterTreasuryNear} NEAR</div>
                </div>
                <div className="p-2.5 bg-[#1e293b] border border-white/15">
                  <div className="text-[10px] font-black uppercase text-slate-400">RESPITE</div>
                  <div className="text-sm font-black text-[#d8b4fe]">
                    {masterTreasuryRespite.toLocaleString()}
                  </div>
                </div>
                <div className="p-2.5 bg-[#1e293b] border border-white/15">
                  <div className="text-[10px] font-black uppercase text-slate-400">CYON</div>
                  <div className="text-sm font-black text-[#10b981]">
                    {masterTreasuryCyon.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setMasterTreasuryRespite((prev) => prev + 1000);
                    setStatusNote(
                      'Minted +1000 RESPITE into Master Treasury (buddiesblitz-treasury.testnet).',
                    );
                  }}
                  className="py-2 px-3 bg-[#d8b4fe] text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0_#000] cursor-pointer"
                >
                  MINT +1000 RESPITE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setMasterTreasuryCyon((prev) => prev + 500);
                    setStatusNote('Added +500 CYON to Master Treasury reserves.');
                  }}
                  className="py-2 px-3 bg-[#38bdf8] text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0_#000] cursor-pointer"
                >
                  ADD +500 MASTER CYON
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    if (masterTreasuryRespite < 100) return;
                    setMasterTreasuryRespite((prev) => Math.max(0, prev - 100));
                    onGrantActivePlayerRespite(100);
                    setStatusNote('Granted +100 RESPITE from Master Treasury to active session.');
                  }}
                  className="py-2 px-3 bg-[#b8ff3c] text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0_#000] cursor-pointer"
                >
                  GRANT +100 RESPITE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setMasterTreasuryNear((prev) => prev + 10);
                    setStatusNote('Added +10 NEAR to Master Treasury gas reserve.');
                  }}
                  className="py-2 px-3 bg-[#10b981] text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0_#000] cursor-pointer"
                >
                  TOP UP +10 NEAR
                </button>
              </div>
            </section>

            {/* Merchant Treasury Card */}
            <section
              data-admin-merchant-treasury-card="true"
              className="p-4 bg-[#12151f] border-3 border-black shadow-[5px_5px_0_#000] space-y-3.5"
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-2">
                <div>
                  <div className="text-sm font-black uppercase text-[#38bdf8]">
                    MERCHANT TREASURY (HANA &amp; KAI)
                  </div>
                  <div className="text-xs font-bold text-slate-300 mt-0.5">
                    Simulated Day {marketState.dayCounter}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 text-[10px] font-black uppercase border border-black ${
                    marketState.isShopBroke
                      ? 'bg-[#ff3b30] text-white'
                      : 'bg-[#10b981] text-black'
                  }`}
                >
                  {marketState.isShopBroke ? 'SHOP BANKRUPT' : 'SHOP ACTIVE'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2.5 bg-[#1e293b] border border-white/15">
                  <div className="text-[10px] font-black uppercase text-slate-400">
                    MERCHANT CYON
                  </div>
                  <div className="text-sm font-black text-[#38bdf8]">
                    {marketState.treasuryCyon.toLocaleString()} CYON
                  </div>
                </div>
                <div className="p-2.5 bg-[#1e293b] border border-white/15">
                  <div className="text-[10px] font-black uppercase text-slate-400">
                    MERCHANT LUL POOL
                  </div>
                  <div className="text-sm font-black text-[#fec83e]">
                    {marketState.treasuryLulPool.toLocaleString()} LUL
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    const transferCyon = Math.min(200, masterTreasuryCyon);
                    if (transferCyon <= 0) return;
                    setMasterTreasuryCyon((prev) => Math.max(0, prev - transferCyon));
                    setMarketState((prev) => {
                      const nextCyon = prev.treasuryCyon + transferCyon;
                      return {
                        ...prev,
                        treasuryCyon: nextCyon,
                        isShopBroke: nextCyon < 20,
                      };
                    });
                    setStatusNote(
                      `Transferred ${transferCyon} CYON from Master Treasury to Merchant Treasury.`,
                    );
                  }}
                  className="py-2 px-3 bg-[#10b981] text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0_#000] cursor-pointer"
                >
                  FUND +200 CYON
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    const withdrawCyon = Math.min(100, marketState.treasuryCyon);
                    if (withdrawCyon <= 0) return;
                    setMasterTreasuryCyon((prev) => prev + withdrawCyon);
                    setMarketState((prev) => {
                      const nextCyon = Math.max(0, prev.treasuryCyon - withdrawCyon);
                      return {
                        ...prev,
                        treasuryCyon: nextCyon,
                        isShopBroke: nextCyon < 20,
                      };
                    });
                    setStatusNote(
                      `Withdrew ${withdrawCyon} CYON from Merchant Treasury to Master Treasury.`,
                    );
                  }}
                  className="py-2 px-3 bg-[#facc15] text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0_#000] cursor-pointer"
                >
                  WITHDRAW 100 CYON
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setMarketState((prev) => ({
                      ...prev,
                      treasuryLulPool: prev.treasuryLulPool + 1000,
                    }));
                    setStatusNote('Added +1000 LUL to Merchant LUL Pool.');
                  }}
                  className="py-2 px-3 bg-[#38bdf8] text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0_#000] cursor-pointer"
                >
                  +1000 MERCHANT LUL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    const fullStock: Record<string, number> = {};
                    const zeroDemand: Record<string, number> = {};
                    for (const it of MERCHANT_CATALOG_ITEMS) {
                      fullStock[it.id] = it.targetStock;
                      zeroDemand[it.id] = 0;
                    }
                    setMarketState((prev) => ({
                      ...prev,
                      stockByItemId: fullStock,
                      demandByItemId: zeroDemand,
                      isShopBroke: false,
                    }));
                    setStatusNote('Restocked all Merchant items to full capacity.');
                  }}
                  className="py-2 px-3 bg-[#b8ff3c] text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0_#000] cursor-pointer"
                >
                  RESTOCK ALL ITEMS
                </button>
              </div>
            </section>
          </div>
        )}

        {/* ===================================================================
            TAB 2: SUB-ACCOUNT CUSTODY (*.buddiesblitz-master.testnet)
           =================================================================== */}
        {activeSection === 'subaccounts' && (
          <section className="p-4 sm:p-5 bg-[#12151f] border-3 border-black shadow-[5px_5px_0_#000] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-3">
              <div>
                <h2 className="text-sm sm:text-base font-black uppercase text-[#38bdf8]">
                  PLAYER SUB-ACCOUNT CUSTODY (*.{MASTER_WALLET_ACCOUNT_ID})
                </h2>
                <div className="text-xs font-mono text-slate-300 mt-0.5">
                  Master FullAccessKey: {MASTER_FULL_ACCESS_PUBLIC_KEY}
                </div>
              </div>
              <span className="px-2.5 py-1 bg-[#b8ff3c] text-black font-black text-xs uppercase border border-black">
                {managedSubAccounts.length} SUB-ACCOUNTS
              </span>
            </div>

            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                value={newSubPrefix}
                onChange={(e) => setNewSubPrefix(e.target.value)}
                placeholder="New sub-account prefix (e.g. player2)"
                className="flex-1 px-3 py-2 bg-white text-black font-bold text-xs border-2 border-black"
              />
              <button
                type="button"
                disabled={isSpawningSub}
                onClick={async () => {
                  soundEngine.playUiClick();
                  const prefix = newSubPrefix.trim();
                  if (!prefix) return;
                  setIsSpawningSub(true);
                  const res = await spawnSubAccountOnChainViaMaster(prefix);
                  setIsSpawningSub(false);
                  setManagedSubAccounts(res.allSubAccounts);
                  setNewSubPrefix('');
                  setStatusNote(
                    res.onChainCreated
                      ? `Spawned on-chain sub-account ${res.subAccount.subAccountId} (Tx: ${res.subAccount.txHash}).`
                      : `Provisioned sub-account ${res.subAccount.subAccountId} under Master control.`,
                  );
                }}
                className="-skew-x-6 px-4 py-2 bg-[#b8ff3c] text-black font-black text-xs uppercase border-2 border-black shadow-[3px_3px_0_#000] cursor-pointer shrink-0"
              >
                <span className="skew-x-6 inline-block">
                  {isSpawningSub ? 'SPAWNING...' : 'SPAWN SUB-ACCOUNT'}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {managedSubAccounts.map((sub) => (
                <div
                  key={sub.subAccountId}
                  className="p-3 bg-[#1e293b] border-2 border-black space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-black text-[#38bdf8] truncate">
                      {sub.subAccountId}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-1.5 py-0.5 text-[9px] font-black uppercase ${
                          sub.isOnChainVerified
                            ? 'bg-[#38bdf8] text-black'
                            : 'bg-white/20 text-white'
                        }`}
                      >
                        {sub.isOnChainVerified ? 'ON-CHAIN' : 'MANAGED'}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 text-[9px] font-black uppercase ${
                          sub.status === 'ACTIVE'
                            ? 'bg-[#10b981] text-black'
                            : 'bg-[#ff3b30] text-white'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>
                      RESPITE: <strong className="text-[#d8b4fe]">{sub.respiteBalance}</strong> | CYON:{' '}
                      <strong className="text-[#10b981]">{sub.cyonBalance}</strong>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      Session Key v{sub.keyVersion}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        if (masterTreasuryRespite < 50) return;
                        setMasterTreasuryRespite((prev) => Math.max(0, prev - 50));
                        setManagedSubAccounts(updateSubAccountBalances(sub.subAccountId, 50, 0));
                        setStatusNote(
                          `Granted +50 RESPITE from Master Treasury to ${sub.subAccountId}.`,
                        );
                      }}
                      className="py-1 px-1.5 bg-[#d8b4fe] text-black font-black text-[9.5px] uppercase border border-black cursor-pointer"
                    >
                      +50 RSP
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        const amt = sub.respiteBalance;
                        if (amt <= 0) return;
                        setMasterTreasuryRespite((prev) => prev + amt);
                        setManagedSubAccounts(updateSubAccountBalances(sub.subAccountId, -amt, 0));
                        setStatusNote(
                          `Swept ${amt} RESPITE from ${sub.subAccountId} to Master Treasury.`,
                        );
                      }}
                      className="py-1 px-1.5 bg-[#facc15] text-black font-black text-[9.5px] uppercase border border-black cursor-pointer"
                    >
                      SWEEP
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setManagedSubAccounts(rotateSubAccountSessionKey(sub.subAccountId));
                        setStatusNote(`Rotated FunctionCall session key for ${sub.subAccountId}.`);
                      }}
                      className="py-1 px-1.5 bg-[#38bdf8] text-black font-black text-[9.5px] uppercase border border-black cursor-pointer"
                    >
                      ROTATE KEY
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setManagedSubAccounts(toggleSubAccountFreezeStatus(sub.subAccountId));
                        setStatusNote(`Toggled freeze state for ${sub.subAccountId}.`);
                      }}
                      className={`py-1 px-1.5 font-black text-[9.5px] uppercase border border-black cursor-pointer ${
                        sub.status === 'ACTIVE'
                          ? 'bg-[#ff3b30] text-white'
                          : 'bg-[#10b981] text-black'
                      }`}
                    >
                      {sub.status === 'ACTIVE' ? 'FREEZE' : 'UNFREEZE'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        onLaunch3dQaTeleport({
                          worldMode: 'lobby',
                          impersonateAccountId: sub.subAccountId,
                        });
                      }}
                      className="py-1 px-1.5 bg-[#b8ff3c] text-black font-black text-[9.5px] uppercase border border-black cursor-pointer"
                    >
                      TEST 3D
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===================================================================
            TAB 3: SUPABASE DB LIVE & NEAR BLOCK EXPLORER TELEMETRY
           =================================================================== */}
        {activeSection === 'telemetry' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <section className="p-4 bg-[#12151f] border-3 border-black shadow-[5px_5px_0_#000] space-y-3">
              <div className="text-sm font-black uppercase text-[#10b981]">
                SUPABASE POSTGRESQL &amp; REALTIME STATUS
              </div>
              <div className="p-3 bg-[#1e293b] border border-white/15 space-y-1.5 text-xs font-bold">
                <div className="flex justify-between">
                  <span className="text-slate-400">Connection State:</span>
                  <span className={supabaseConnected ? 'text-[#10b981]' : 'text-[#facc15]'}>
                    {supabaseConnected ? 'LIVE CONNECTED' : 'READY / FALLBACK'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Active Tables:</span>
                  <span className="text-white font-mono">
                    bb_profiles, bb_npc_merchants, bb_fish_listings
                  </span>
                </div>
              </div>
            </section>

            <section className="p-4 bg-[#12151f] border-3 border-black shadow-[5px_5px_0_#000] space-y-3">
              <div className="text-sm font-black uppercase text-[#38bdf8]">
                NEAR TESTNET RPC &amp; BLOCK EXPLORER
              </div>
              <div className="p-3 bg-[#1e293b] border border-white/15 space-y-1.5 text-xs font-bold">
                <div className="flex justify-between">
                  <span className="text-slate-400">Latest Block Height:</span>
                  <span className="text-[#b8ff3c] font-mono">
                    #{nearRpcStatus?.latestBlockHeight?.toLocaleString() || cryptoProof.blockHeight}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Master On-Chain Balance:</span>
                  <span className="text-white font-mono">
                    {masterOnChainView?.balanceNearFormatted || '9.49 NEAR'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Treasury On-Chain Balance:</span>
                  <span className="text-white font-mono">
                    {treasuryOnChainView?.balanceNearFormatted || '10.00 NEAR'}
                  </span>
                </div>
                <div className="pt-2 flex flex-wrap gap-2">
                  <a
                    href={getNearBlocksAccountUrl(MASTER_WALLET_ACCOUNT_ID, 'testnet')}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-[#38bdf8] text-black font-black text-[10px] uppercase border border-black"
                  >
                    EXPLORER: MASTER ACCOUNT
                  </a>
                  <a
                    href={getNearBlocksAccountUrl(MASTER_TREASURY_ACCOUNT_ID, 'testnet')}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-[#d8b4fe] text-black font-black text-[10px] uppercase border border-black"
                  >
                    EXPLORER: TREASURY VAULT
                  </a>
                  <a
                    href={getNearBlocksAccountUrl(DEFAULT_ONCHAIN_SUB_ACCOUNT_ID, 'testnet')}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-[#b8ff3c] text-black font-black text-[10px] uppercase border border-black"
                  >
                    EXPLORER: PLAYER1 SUB-ACCOUNT
                  </a>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ===================================================================
            TAB 4: ATOMIC NFT TRANSFER (NEP-171) & PAYOUT HISTORY
           =================================================================== */}
        {activeSection === 'nft_transfer' && (
          <section className="p-4 sm:p-5 bg-[#12151f] border-3 border-black shadow-[5px_5px_0_#000] space-y-4">
            <div className="flex items-center justify-between border-b border-white/15 pb-2.5">
              <div>
                <h2 className="text-sm sm:text-base font-black uppercase text-[#facc15]">
                  ATOMIC NEP-171 NFT &amp; SUB-ACCOUNT TRANSFER TESTBED
                </h2>
                <div className="text-xs font-mono text-slate-300 mt-0.5">
                  Token ID: {nep171Ledger.tokenId} | Sub-Account: {nep171Ledger.subAccountId}
                </div>
              </div>
              <span className="px-2.5 py-1 bg-[#d8b4fe] text-black font-black text-xs uppercase border border-black">
                OWNER: {nep171Ledger.ownerNearAccount}
              </span>
            </div>

            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                value={transferBuyerInput}
                onChange={(e) => setTransferBuyerInput(e.target.value)}
                placeholder="buyer-omega.testnet"
                className="flex-1 px-3 py-2 bg-white text-black font-bold text-xs border-2 border-black"
              />
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  try {
                    const result = executeAtomicNep171SubAccountTransfer({
                      ledger: nep171Ledger,
                      callerAccount: nep171Ledger.ownerNearAccount,
                      newOwnerAccount: transferBuyerInput,
                      inFlightPayoutRespite: 4.5,
                    });
                    setNep171Ledger(result.updatedLedger);
                    setTransferAuditNote(result.securityAuditNote);
                  } catch (err) {
                    setTransferAuditNote(err instanceof Error ? err.message : 'Transfer failed');
                  }
                }}
                className="-skew-x-6 px-4 py-2 bg-[#facc15] text-black font-black text-xs uppercase border-2 border-black shadow-[3px_3px_0_#000] cursor-pointer shrink-0"
              >
                <span className="skew-x-6 inline-block">EXECUTE ATOMIC TRANSFER</span>
              </button>
            </div>

            {transferAuditNote && (
              <div className="p-2.5 bg-black/60 border border-[#10b981] text-[#10b981] text-xs font-bold">
                {transferAuditNote}
              </div>
            )}

            <div className="space-y-2">
              <div className="text-xs font-black uppercase text-[#38bdf8]">
                OWNERSHIP &amp; RESPITE PAYOUT LEDGER
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {nep171Ledger.ownershipHistory.map((item, idx) => (
                  <div
                    key={`${item.owner}-${idx}`}
                    className="p-3 bg-[#1e293b] border border-white/20 text-xs space-y-1"
                  >
                    <div className="flex justify-between font-black">
                      <span className="text-[#facc15]">{item.owner}</span>
                      <span className="text-slate-300">
                        {item.transferredAt ? 'PAST HOLDER' : 'CURRENT HOLDER'}
                      </span>
                    </div>
                    <div className="text-slate-200 font-bold">
                      Earned: +{item.earnedRespite} RESPITE | Paid Out: {item.paidOutRespite}{' '}
                      RESPITE
                    </div>
                    <div className="text-slate-400 text-[11px]">{item.note}</div>
                    <a
                      href={getNearBlocksTxUrl(item.txHash, nep171Ledger.network)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-[#38bdf8] hover:underline font-mono text-[10px]"
                    >
                      Tx: {item.txHash.slice(0, 24)}...
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ===================================================================
            TAB 5: 3D MAP QA TELEPORT & DEBUG SANDBOX
           =================================================================== */}
        {activeSection === 'qa_teleport' && (
          <section className="p-4 sm:p-5 bg-[#12151f] border-3 border-black shadow-[5px_5px_0_#000] space-y-4">
            <div className="border-b border-white/15 pb-2.5">
              <h2 className="text-sm sm:text-base font-black uppercase text-[#b8ff3c]">
                3D MAP QA TELEPORT &amp; SCENE DEBUGGER
              </h2>
              <p className="text-xs font-bold text-slate-300 mt-0.5">
                Jump directly into any 3D map coordinate with the cryptographically verified QA Mode unlocked.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onLaunch3dQaTeleport({ worldMode: 'lobby' });
                }}
                className="p-4 bg-[#1e293b] hover:bg-[#334155] border-2 border-black shadow-[3px_3px_0_#000] text-left cursor-pointer space-y-1"
              >
                <div className="text-xs font-black uppercase text-[#b8ff3c]">
                  MINI CAFE LOBBY
                </div>
                <div className="text-[11px] font-bold text-slate-300">
                  Spawn at Hana Lobby Cafe, Exchange Kiosk, and Safezone Tram.
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onLaunch3dQaTeleport({ worldMode: 'safezone' });
                }}
                className="p-4 bg-[#1e293b] hover:bg-[#334155] border-2 border-black shadow-[3px_3px_0_#000] text-left cursor-pointer space-y-1"
              >
                <div className="text-xs font-black uppercase text-[#38bdf8]">
                  SAFEZONE CITY PLAZA &amp; BEACH
                </div>
                <div className="text-[11px] font-bold text-slate-300">
                  Spawn at Peaceful City Plaza, Commander Plots, and East Beach Fishing.
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onLaunch3dQaTeleport({ worldMode: 'warzone', team: 'blue' });
                }}
                className="p-4 bg-[#1e293b] hover:bg-[#334155] border-2 border-black shadow-[3px_3px_0_#000] text-left cursor-pointer space-y-1"
              >
                <div className="text-xs font-black uppercase text-[#38bdf8]">
                  WARZONE ARENA (BLUE TEAM)
                </div>
                <div className="text-[11px] font-bold text-slate-300">
                  Deploy directly into 4v4 Warzone Combat as Blue Faction.
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onLaunch3dQaTeleport({ worldMode: 'warzone', team: 'red' });
                }}
                className="p-4 bg-[#1e293b] hover:bg-[#334155] border-2 border-black shadow-[3px_3px_0_#000] text-left cursor-pointer space-y-1"
              >
                <div className="text-xs font-black uppercase text-[#ff3b30]">
                  WARZONE ARENA (RED TEAM)
                </div>
                <div className="text-[11px] font-bold text-slate-300">
                  Deploy directly into 4v4 Warzone Combat as Red Faction.
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onLaunch3dQaTeleport({ worldMode: 'safezone', openHouseInterior: true });
                }}
                className="p-4 bg-[#1e293b] hover:bg-[#334155] border-2 border-black shadow-[3px_3px_0_#000] text-left cursor-pointer space-y-1"
              >
                <div className="text-xs font-black uppercase text-[#d8b4fe]">
                  PRIVATE HOUSE INTERIOR
                </div>
                <div className="text-[11px] font-bold text-slate-300">
                  Jump directly inside the 3rd-person Private House Room &amp; Furniture Studio.
                </div>
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
};
