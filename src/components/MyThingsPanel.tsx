import React, { useEffect, useMemo, useState } from 'react';
import { Bike, Fish, Gift, Home, Shirt, Sparkles, X } from 'lucide-react';
import { filterGiftPickerItems } from '../game/npcGiftEngine';
import { soundEngine } from '../game/audio';
import type { CaughtFishItem, FishNftMarketplaceListing } from '../game/buddiesFishingMarket';
import type { UrbanScooterKind } from '../game/buddiesUrbanScooterRules';
import type { RecruitedFamilyMemberAgent } from '../lib/nearClient';
import { Fish3dThumbnail, type Fish3dPreviewSpec } from './Fish3dPreviewModal';
import { Furniture3dThumbnail } from './Furniture3dThumbnail';
import { WalletAssetPortraitCard } from './WalletAssetPortraitCard';
import {
  getCachedWardrobeItemThumbnail,
  renderWardrobeItemThumbnail,
} from './wardrobe3dThumbnailRasterizer';
import {
  MY_THINGS_SECTIONS,
  partitionMyThingsInventory,
  sanitizeOwnedItemLabel,
  type MyThingsSectionId,
  type OwnedClothingCardItem,
} from './myThingsRules';

export interface MyThingsHouseAccountSummary {
  ready: string;
  earned: string;
  paid: string;
  history: ReadonlyArray<{ epoch: number; amount: string }>;
}

export interface MyThingsPanelProps {
  embeddedInPhone: boolean;
  onClose?: () => void;
  activeSection: MyThingsSectionId;
  onSelectSection: (section: MyThingsSectionId) => void;
  characterGender: 'male' | 'female';
  isWarzone: boolean;
  isFishingRodEquipped: boolean;
  onToggleFishingRod: () => void;
  ownedMerchantItemIds: readonly string[];
  ownedGiftItemIds?: readonly string[];
  placedFurnitureCounts: Record<string, number>;
  ownedApparelIds: readonly string[];
  onOpenWardrobe: () => void;
  ownedScooterIds: readonly string[];
  equippedScooterKind: UrbanScooterKind | null;
  onToggleScooter: (kind: UrbanScooterKind) => void;
  getScooterPortraitUrl: (kind: UrbanScooterKind) => string;
  hasHouseOwnership: boolean;
  houseTitle: string;
  houseImageSrc: string;
  houseStyleKey: string;
  houseAccountBadgeLabel: string;
  houseAccountSummary: MyThingsHouseAccountSummary | null;
  isLoadingHouseAccount: boolean;
  isHouseAccountBusy: boolean;
  canAddToHouseAccount: boolean;
  canCollectHouseAccount: boolean;
  houseAccountFeedback: {
    type: 'success' | 'error';
    text: string;
    receiptUrl?: string;
  } | null;
  onAddHouseAccountFunds: () => void;
  onCollectHouseAccount: () => void;
  onSyncHouseAccount: () => void;
  onEnterOwnHouse?: () => void;
  caughtFishBucket: readonly CaughtFishItem[];
  playerListedFish: readonly FishNftMarketplaceListing[];
  recruitedFamilyMembers: readonly RecruitedFamilyMemberAgent[];
  onPreviewFish: (spec: Fish3dPreviewSpec) => void;
  onReleaseFish: (fishId: string) => void;
  placedLotIdByBuildingForm?: Partial<Record<string, string>>;
  hasActiveRentedLot?: boolean;
  onPlaceShopBuilding?: (buildingFormId: string) => void;
  onRemoveShopBuilding?: (buildingFormId: string) => void;
  onUploadShopBillboardLogo?: (buildingFormId: string, logoUrl: string | null) => void;
}

const ClothingCardVisual: React.FC<{ item: OwnedClothingCardItem }> = ({ item }) => {
  const [renderedThumb, setRenderedThumb] = useState<string | null>(() =>
    item.thumbUrl ? item.thumbUrl : getCachedWardrobeItemThumbnail(item.glbPath),
  );

  useEffect(() => {
    if (item.thumbUrl) {
      setRenderedThumb(item.thumbUrl);
      return;
    }
    const cached = getCachedWardrobeItemThumbnail(item.glbPath);
    if (cached) {
      setRenderedThumb(cached);
      return;
    }
    if (!item.glbPath) return;
    let cancelled = false;
    void renderWardrobeItemThumbnail(item.glbPath).then((url) => {
      if (!cancelled && url) {
        setRenderedThumb(url);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [item.glbPath, item.thumbUrl]);

  if (renderedThumb) {
    return (
      <img
        src={renderedThumb}
        alt={item.name}
        draggable={false}
        className={`w-full h-full object-contain p-2 transition-transform duration-200 group-hover/card:scale-105 pointer-events-none ${
          item.thumbFlipY ? '-scale-y-100' : ''
        }`}
      />
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500">
      <div className="w-12 h-12 rounded-2xl bg-neutral-900/[0.06] flex items-center justify-center text-neutral-700">
        <Shirt className="w-6 h-6 stroke-[1.8]" aria-hidden="true" />
      </div>
    </div>
  );
};

export const MyThingsPanel: React.FC<MyThingsPanelProps> = ({
  embeddedInPhone,
  onClose,
  activeSection,
  onSelectSection,
  characterGender,
  isWarzone,
  isFishingRodEquipped,
  onToggleFishingRod,
  ownedMerchantItemIds,
  ownedGiftItemIds = [],
  placedFurnitureCounts,
  ownedApparelIds,
  onOpenWardrobe,
  ownedScooterIds,
  equippedScooterKind,
  onToggleScooter,
  getScooterPortraitUrl,
  hasHouseOwnership,
  houseTitle,
  houseImageSrc,
  houseStyleKey,
  houseAccountBadgeLabel,
  houseAccountSummary,
  isLoadingHouseAccount,
  isHouseAccountBusy,
  canAddToHouseAccount,
  canCollectHouseAccount,
  houseAccountFeedback,
  onAddHouseAccountFunds,
  onCollectHouseAccount,
  onSyncHouseAccount,
  onEnterOwnHouse,
  caughtFishBucket,
  playerListedFish,
  recruitedFamilyMembers,
  onPreviewFish,
  onReleaseFish,
  placedLotIdByBuildingForm,
  hasActiveRentedLot,
  onPlaceShopBuilding,
  onRemoveShopBuilding,
  onUploadShopBillboardLogo,
}) => {
  const inventory = useMemo(
    () =>
      partitionMyThingsInventory({
        ownedMerchantItemIds,
        ownedApparelIds,
        ownedScooterIds,
        hasHouseOwnership,
        caughtFishCount: caughtFishBucket.length,
        listedFishCount: playerListedFish.length,
        recruitedCompanionsCount: recruitedFamilyMembers.length,
        characterGender,
      }),
    [
      ownedMerchantItemIds,
      ownedApparelIds,
      ownedScooterIds,
      hasHouseOwnership,
      caughtFishBucket.length,
      playerListedFish.length,
      recruitedFamilyMembers.length,
      characterGender,
    ],
  );

  return (
    <div
      data-my-things-modal={embeddedInPhone ? 'true' : undefined}
      className={
        embeddedInPhone
          ? 'relative w-full h-full flex-1 flex flex-col bg-transparent p-3 text-white overflow-hidden min-h-0'
          : 'relative flex-1 flex flex-col rounded-[32px] bg-gradient-to-b from-[#171d2c]/86 via-[#111622]/84 to-[#0c101a]/88 border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_24px_70px_rgba(0,0,0,0.58)] p-4 text-white overflow-hidden min-h-0'
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/15 shrink-0">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-white truncate">
            My Things
          </h2>
          <p className="text-[10.5px] text-white/70 truncate">
            {inventory.totalCount} {inventory.totalCount === 1 ? 'thing' : 'things'} owned
          </p>
        </div>

        {!embeddedInPhone && onClose && (
          <button
            type="button"
            data-close-my-things-btn="true"
            onClick={() => {
              soundEngine.playUiCancel();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-[#eef0f4]/90 hover:bg-white border border-white/80 text-slate-700 hover:text-rose-600 shadow-sm flex items-center justify-center transition-colors cursor-pointer active:scale-95 shrink-0"
            aria-label="Close My Things"
          >
            <X className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* 4-Section Frosted Segmented Bar: Items · Vehicles · Properties · Collectibles */}
      <div
        role="tablist"
        aria-label="My Things Sections"
        className="grid grid-cols-4 gap-1 p-1 mt-2.5 rounded-2xl bg-[#eef0f4]/92 border border-white/80 shadow-[0_6px_16px_rgba(15,23,42,0.14)] shrink-0"
      >
        {MY_THINGS_SECTIONS.map((section) => {
          const isSelected = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              data-my-things-tab={section.id}
              onClick={() => {
                soundEngine.playUiClick();
                onSelectSection(section.id);
              }}
              className={`py-1.5 px-1.5 rounded-xl text-[10.5px] font-semibold whitespace-nowrap truncate transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.1)]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/55'
              }`}
            >
              {section.label}
            </button>
          );
        })}
      </div>

      {/* Hang-Tag Card Grid Body */}
      <div className="@container flex-1 overflow-y-auto overflow-x-hidden pr-0.5 mt-2.5 min-h-0">
        {activeSection === 'items' && (
          <div
            data-my-things-section="items"
            className="grid grid-cols-2 @[460px]:grid-cols-3 gap-x-3 gap-y-4 pt-2.5 pb-2"
          >
            {/* Giftable items grouped under a tidy "Gifts" header inside the same single bag */}
            {(() => {
              const giftItems = filterGiftPickerItems(ownedGiftItemIds);
              if (giftItems.length === 0) return null;
              const counts = new Map<string, { name: string; count: number }>();
              for (const g of giftItems) {
                const prev = counts.get(g.itemId);
                counts.set(g.itemId, { name: g.name, count: (prev?.count ?? 0) + 1 });
              }
              return (
                <>
                  <div className="col-span-full flex items-center gap-1.5 px-1 pt-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <Gift className="w-3.5 h-3.5 text-rose-500" aria-hidden="true" />
                    <span>Gifts ({giftItems.length})</span>
                  </div>
                  {Array.from(counts.entries()).map(([itemId, info]) => (
                    <WalletAssetPortraitCard
                      key={`gift_${itemId}`}
                      dataAttrs={{ 'data-my-things-gift-item': itemId }}
                      brandLabel="Gift"
                      badgeLabel={info.count > 1 ? `×${info.count}` : undefined}
                      badgeTone="neutral"
                      title={info.name}
                      statusLabel="In Bag"
                      statusTone="emerald"
                      visual={
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-14 h-14 rounded-2xl bg-rose-500/12 border border-rose-500/20 text-rose-600 flex items-center justify-center shadow-xs">
                            <Gift className="w-7 h-7 stroke-[1.9]" aria-hidden="true" />
                          </div>
                        </div>
                      }
                    />
                  ))}
                </>
              );
            })()}

            {/* Starter Fishing Rod */}
            <WalletAssetPortraitCard
              dataAttrs={{ 'data-my-things-item': 'fishing_rod' }}
              brandLabel="Tool"
              title="Fishing Rod"
              statusLabel={isFishingRodEquipped ? 'Equipped' : 'Ready'}
              statusTone={isFishingRodEquipped ? 'emerald' : 'neutral'}
              visual={
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-sky-500/12 border border-sky-500/20 text-sky-700 flex items-center justify-center shadow-xs">
                    <Fish className="w-7 h-7 stroke-[1.9]" aria-hidden="true" />
                  </div>
                </div>
              }
              extraFooter={
                <button
                  type="button"
                  data-my-things-toggle-fishing-rod="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onToggleFishingRod();
                  }}
                  className={`w-full py-1.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer active:scale-95 ${
                    isFishingRodEquipped
                      ? 'bg-rose-100 hover:bg-rose-200 text-rose-700'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-white'
                  }`}
                >
                  {isFishingRodEquipped ? 'Unequip' : 'Equip'}
                </button>
              }
            />

            {/* Owned Fishing Gear & Tackle */}
            {inventory.ownedFishingGear.map((gear) => {
              const qty = inventory.ownedMerchantCounts[gear.id] ?? 1;
              const cleanName = sanitizeOwnedItemLabel(gear.name);
              return (
                <WalletAssetPortraitCard
                  key={gear.id}
                  dataAttrs={{ 'data-my-things-item': gear.id }}
                  brandLabel="Fishing Gear"
                  badgeLabel={qty > 1 ? `×${qty}` : undefined}
                  badgeTone="neutral"
                  title={cleanName}
                  statusLabel={
                    gear.isEquippableRod
                      ? isFishingRodEquipped
                        ? 'Equipped'
                        : 'Ready'
                      : 'Owned'
                  }
                  statusTone={
                    gear.isEquippableRod && isFishingRodEquipped ? 'emerald' : 'neutral'
                  }
                  visual={
                    <Furniture3dThumbnail
                      catalogId={gear.id}
                      name={cleanName}
                      iconEmoji={gear.iconEmoji}
                      size="portrait"
                      variant="studio"
                    />
                  }
                  extraFooter={
                    gear.isEquippableRod ? (
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          onToggleFishingRod();
                        }}
                        className={`w-full py-1.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer active:scale-95 ${
                          isFishingRodEquipped
                            ? 'bg-rose-100 hover:bg-rose-200 text-rose-700'
                            : 'bg-neutral-900 hover:bg-neutral-800 text-white'
                        }`}
                      >
                        {isFishingRodEquipped ? 'Unequip' : 'Equip'}
                      </button>
                    ) : undefined
                  }
                />
              );
            })}

            {/* Owned Clothing (tapping opens Wardrobe — NO Wear / Take Off buttons) */}
            {inventory.ownedClothing.map((clothing) => (
              <WalletAssetPortraitCard
                key={clothing.id}
                dataAttrs={{ 'data-my-things-clothing': clothing.id }}
                brandLabel={clothing.categoryLabel}
                title={clothing.name}
                statusLabel={isWarzone ? 'In Wardrobe' : 'Open Wardrobe'}
                statusTone="neutral"
                onClick={
                  isWarzone
                    ? undefined
                    : () => {
                        soundEngine.playUiClick();
                        onOpenWardrobe();
                      }
                }
                ariaLabel={`Open Wardrobe for ${clothing.name}`}
                visual={<ClothingCardVisual item={clothing} />}
              />
            ))}
          </div>
        )}

        {activeSection === 'vehicles' && (
          <div
            data-my-things-section="vehicles"
            className="grid grid-cols-2 @[460px]:grid-cols-3 gap-x-3 gap-y-4 pt-2.5 pb-2"
          >
            {inventory.ownedVehicles.map((vehicle) => {
              const isRiding = equippedScooterKind === vehicle.kind;
              const scooterPortrait = getScooterPortraitUrl(vehicle.kind);
              const cleanName = sanitizeOwnedItemLabel(vehicle.name);
              return (
                <WalletAssetPortraitCard
                  key={vehicle.id}
                  dataAttrs={{ 'data-my-things-vehicle': vehicle.id }}
                  brandLabel="Vehicle"
                  title={cleanName}
                  statusLabel={isRiding ? 'Riding' : 'Parked'}
                  statusTone={isRiding ? 'emerald' : 'neutral'}
                  visual={
                    scooterPortrait ? (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <div
                          aria-hidden="true"
                          className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[60%] h-2.5 rounded-full bg-black/[0.08] blur-[5px] pointer-events-none"
                        />
                        <img
                          src={scooterPortrait}
                          alt={cleanName}
                          className="relative z-10 w-full h-full object-contain p-2 drop-shadow-[0_6px_10px_rgba(15,23,42,0.14)] group-hover/card:scale-105 transition-transform duration-200 pointer-events-none"
                          draggable={false}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/12 border border-amber-500/20 text-amber-700 flex items-center justify-center">
                          <Bike className="w-7 h-7 stroke-[1.9]" aria-hidden="true" />
                        </div>
                      </div>
                    )
                  }
                  extraFooter={
                    <button
                      type="button"
                      data-my-things-ride-btn={vehicle.id}
                      onClick={() => {
                        soundEngine.playUiClick();
                        onToggleScooter(vehicle.kind);
                      }}
                      className={`w-full py-1.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer active:scale-95 ${
                        isRiding
                          ? 'bg-rose-100 hover:bg-rose-200 text-rose-700'
                          : 'bg-neutral-900 hover:bg-neutral-800 text-white'
                      }`}
                    >
                      {isRiding ? 'Get Off' : 'Ride'}
                    </button>
                  }
                />
              );
            })}

            {inventory.ownedVehicles.length === 0 && (
              <div className="col-span-full py-8 px-4 text-center rounded-2xl bg-[#eef0f4]/92 border border-white/80 shadow-[0_8px_22px_rgba(15,23,42,0.16)] text-slate-700 text-xs space-y-1">
                <div className="font-semibold text-slate-900">No vehicles yet</div>
                <div className="text-[11px] text-slate-500">
                  Scooters you own will appear here so you can ride them around the city.
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'properties' && (
          <div
            data-my-things-section="properties"
            className="grid grid-cols-2 @[460px]:grid-cols-3 gap-x-3 gap-y-4 pt-2.5 pb-2"
          >
            {/* Owned House */}
            {hasHouseOwnership && (
              <WalletAssetPortraitCard
                dataAttrs={{ 'data-my-things-house': houseStyleKey }}
                brandLabel="House"
                title={sanitizeOwnedItemLabel(houseTitle)}
                statusLabel="Owned"
                statusTone="emerald"
                visual={
                  houseImageSrc ? (
                    <img
                      src={houseImageSrc}
                      alt={houseTitle}
                      className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Home className="w-8 h-8 text-neutral-600" aria-hidden="true" />
                    </div>
                  )
                }
                extraFooter={
                  <div
                    data-house-account-panel="true"
                    className="p-2.5 rounded-xl bg-neutral-900 text-white space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] font-semibold text-sky-300 truncate">
                        House Account
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[8.5px] font-mono font-medium text-emerald-300 shrink-0">
                        {houseAccountBadgeLabel}
                      </span>
                    </div>

                    {houseAccountSummary ? (
                      <>
                        <div className="grid grid-cols-3 gap-1 text-[8.5px] font-mono tabular-nums">
                          <div className="p-1 rounded-md bg-white/[0.07] min-w-0">
                            <div className="text-slate-400 truncate">Ready</div>
                            <div className="text-emerald-300 font-semibold truncate">
                              {houseAccountSummary.ready}
                            </div>
                          </div>
                          <div className="p-1 rounded-md bg-white/[0.07] min-w-0">
                            <div className="text-slate-400 truncate">Earned</div>
                            <div className="text-violet-300 font-semibold truncate">
                              {houseAccountSummary.earned}
                            </div>
                          </div>
                          <div className="p-1 rounded-md bg-white/[0.07] min-w-0">
                            <div className="text-slate-400 truncate">Paid</div>
                            <div className="text-sky-300 font-semibold truncate">
                              {houseAccountSummary.paid}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 pt-0.5">
                          <button
                            type="button"
                            data-deed-fund-btn="true"
                            disabled={isHouseAccountBusy || !canAddToHouseAccount}
                            onClick={() => {
                              soundEngine.playUiClick();
                              onAddHouseAccountFunds();
                            }}
                            className={`flex-1 py-1 rounded-full text-[9px] font-semibold transition-colors ${
                              !isHouseAccountBusy && canAddToHouseAccount
                                ? 'bg-violet-500 hover:bg-violet-400 text-white cursor-pointer'
                                : 'bg-white/10 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {isHouseAccountBusy ? 'Wait...' : 'Add 5 R'}
                          </button>

                          <button
                            type="button"
                            data-deed-claim-btn="true"
                            disabled={isHouseAccountBusy || !canCollectHouseAccount}
                            onClick={() => {
                              soundEngine.playUiClick();
                              onCollectHouseAccount();
                            }}
                            className={`flex-1 py-1 rounded-full text-[9px] font-semibold transition-colors ${
                              !isHouseAccountBusy && canCollectHouseAccount
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer'
                                : 'bg-white/10 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            Collect
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between gap-1.5 text-[9px] text-slate-300">
                        <span className="truncate">
                          {isLoadingHouseAccount ? 'Loading...' : 'Account ready'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            onSyncHouseAccount();
                          }}
                          className="px-2 py-0.5 rounded-full bg-sky-500 hover:bg-sky-400 text-white font-semibold cursor-pointer transition-colors shrink-0"
                        >
                          Sync
                        </button>
                      </div>
                    )}

                    {onEnterOwnHouse && (
                      <button
                        type="button"
                        data-enter-apartment-btn="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          onEnterOwnHouse();
                        }}
                        className="w-full py-1.5 rounded-full text-[10px] font-bold bg-indigo-500 hover:bg-indigo-400 text-white cursor-pointer transition-colors"
                      >
                        Enter Apartment
                      </button>
                    )}

                    {houseAccountFeedback && (
                      <div
                        className={`text-[9px] font-medium leading-tight ${
                          houseAccountFeedback.type === 'success'
                            ? 'text-emerald-300'
                            : 'text-rose-300'
                        }`}
                      >
                        <span>{houseAccountFeedback.text}</span>
                        {houseAccountFeedback.receiptUrl && (
                          <>
                            {' '}
                            <a
                              href={houseAccountFeedback.receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="underline text-sky-300"
                            >
                              Receipt
                            </a>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                }
              />
            )}

            {/* Owned Furniture, House Themes & Shop Buildings */}
            {inventory.ownedPropertyItems.map((item) => {
              const qty = inventory.ownedMerchantCounts[item.id] ?? 1;
              const placedQty = placedFurnitureCounts[item.id] ?? 0;
              const cleanName = sanitizeOwnedItemLabel(item.name);
              const isShopBuilding = item.category === 'nft_shop_building' && Boolean(item.buildingFormId);
              const formId = item.buildingFormId;
              const placedLotId = formId ? placedLotIdByBuildingForm?.[formId] : undefined;
              const categoryLabel = isShopBuilding
                ? 'Shop Building'
                : item.category === 'nft_house_theme'
                  ? 'House Theme'
                  : 'Furniture';
              return (
                <WalletAssetPortraitCard
                  key={item.id}
                  dataAttrs={{ 'data-my-things-property-item': item.id }}
                  brandLabel={categoryLabel}
                  badgeLabel={qty > 1 ? `×${qty}` : item.footprintLabel}
                  badgeTone="neutral"
                  title={cleanName}
                  statusLabel={
                    isShopBuilding
                      ? placedLotId
                        ? 'Placed on Lot'
                        : 'In My Things'
                      : placedQty > 0
                        ? `In Room ×${placedQty}`
                        : 'Owned'
                  }
                  statusTone="emerald"
                  visual={
                    isShopBuilding && item.renderImagePath ? (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-200/80 p-2">
                        <img
                          src={item.renderImagePath}
                          alt={cleanName}
                          className="w-full h-full object-contain drop-shadow-[0_10px_14px_rgba(15,23,42,0.18)]"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <Furniture3dThumbnail
                        catalogId={item.id}
                        name={cleanName}
                        iconEmoji={item.iconEmoji}
                        size="portrait"
                        variant="studio"
                      />
                    )
                  }
                  extraFooter={
                    isShopBuilding && formId ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {placedLotId ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                soundEngine.playUiClick();
                                onRemoveShopBuilding?.(formId);
                              }}
                              className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                            >
                              Remove
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                soundEngine.playUiClick();
                                const url = window.prompt('Paste your shop sign logo image URL (leave blank to clear):');
                                if (url === null) return;
                                const trimmed = url.trim();
                                onUploadShopBillboardLogo?.(formId, trimmed ? trimmed : null);
                              }}
                              className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                            >
                              Sign Logo
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={!hasActiveRentedLot}
                            onClick={() => {
                              soundEngine.playUiClick();
                              onPlaceShopBuilding?.(formId);
                            }}
                            className={`w-full px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                              hasActiveRentedLot
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {hasActiveRentedLot ? 'Place on Lot' : 'Rent a Lot First'}
                          </button>
                        )}
                      </div>
                    ) : undefined
                  }
                />
              );
            })}

            {!hasHouseOwnership && inventory.ownedPropertyItems.length === 0 && (
              <div className="col-span-full py-8 px-4 text-center rounded-2xl bg-[#eef0f4]/92 border border-white/80 shadow-[0_8px_22px_rgba(15,23,42,0.16)] text-slate-700 text-xs space-y-1">
                <div className="font-semibold text-slate-900">No properties yet</div>
                <div className="text-[11px] text-slate-500">
                  Houses, room themes, and furniture you own will appear here.
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'collectibles' && (
          <div
            data-my-things-section="collectibles"
            className="grid grid-cols-2 @[460px]:grid-cols-3 gap-x-3 gap-y-4 pt-2.5 pb-2"
          >
            {/* Recruited Companions */}
            {recruitedFamilyMembers.map((member) => (
              <WalletAssetPortraitCard
                key={member.agentId}
                dataAttrs={{ 'data-my-things-companion': member.agentId }}
                brandLabel="Companion"
                badgeLabel={member.planLabel}
                badgeTone="amber"
                title={sanitizeOwnedItemLabel(member.name)}
                statusLabel="Active"
                statusTone="emerald"
                visual={
                  <div className="relative w-full h-full flex flex-col items-center justify-center text-center p-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/12 border border-amber-500/20 flex items-center justify-center text-lg font-bold text-amber-700 shadow-xs">
                      {member.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="mt-2 text-[10px] font-semibold text-neutral-600 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-600" aria-hidden="true" />
                      <span>Companion</span>
                    </div>
                  </div>
                }
              />
            ))}

            {/* Caught Fish (all catches in bucket) */}
            {caughtFishBucket.map((fish) => {
              const openFishPreview = () => {
                onPreviewFish({
                  speciesId: fish.speciesId,
                  speciesName: fish.speciesName,
                  rarity: fish.rarity,
                  weightKg: fish.weightKg,
                  lengthCm: fish.lengthCm,
                  waterZoneLabel: fish.waterZoneLabel,
                  colorHex: fish.colorHex,
                  isTrophy: fish.isTrophy,
                  isMintedNft: fish.isMintedNft,
                  nftTokenId: fish.nftTokenId,
                  valueLabel: `${fish.weightKg.toFixed(2)} kg`,
                  ownerOrSellerLabel: fish.caughtByAccount
                    ? `Angler: ${fish.caughtByAccount}`
                    : undefined,
                });
              };
              return (
                <WalletAssetPortraitCard
                  key={fish.id}
                  dataAttrs={{ 'data-my-things-fish': fish.speciesId }}
                  brandLabel="Catch"
                  badgeLabel={fish.rarity}
                  badgeTone="sky"
                  title={fish.speciesName}
                  statusLabel={`${fish.weightKg.toFixed(2)} kg`}
                  statusTone="emerald"
                  headerAction={
                    <button
                      type="button"
                      data-my-things-fish-view-btn={fish.id}
                      onClick={() => {
                        soundEngine.playUiClick();
                        openFishPreview();
                      }}
                      className="px-2 py-0.5 rounded-full bg-neutral-900 hover:bg-neutral-700 text-white text-[9.5px] font-semibold transition-colors cursor-pointer"
                    >
                      View
                    </button>
                  }
                  visual={
                    <Fish3dThumbnail
                      speciesId={fish.speciesId}
                      speciesName={fish.speciesName}
                      colorHex={fish.colorHex}
                      variant="studio"
                      onInspect={openFishPreview}
                    />
                  }
                  extraFooter={
                    !fish.isMintedNft ? (
                      <button
                        type="button"
                        data-my-things-release-fish-btn={fish.id}
                        onClick={() => {
                          soundEngine.playUiClick();
                          onReleaseFish(fish.id);
                        }}
                        className="w-full py-1.5 rounded-xl bg-neutral-200/90 hover:bg-neutral-300/90 text-neutral-700 text-[10.5px] font-semibold transition-colors cursor-pointer"
                      >
                        Release
                      </button>
                    ) : undefined
                  }
                />
              );
            })}

            {/* Player's Listed Fish at Kai's Market */}
            {playerListedFish.map((listing) => {
              const openListedPreview = () => {
                onPreviewFish({
                  speciesId: listing.speciesId,
                  speciesName: listing.speciesName,
                  rarity: listing.rarity,
                  weightKg: listing.weightKg,
                  lengthCm: listing.lengthCm,
                  waterZoneLabel: listing.waterZoneLabel,
                  colorHex: listing.colorHex,
                  isTrophy: listing.isTrophy,
                  isMintedNft: true,
                  nftTokenId: listing.nftTokenId,
                  valueLabel: `${listing.weightKg.toFixed(2)} kg`,
                  ownerOrSellerLabel: `At Kai's Market`,
                });
              };
              return (
                <WalletAssetPortraitCard
                  key={listing.listingId}
                  dataAttrs={{ 'data-my-things-listed-fish': listing.speciesId }}
                  brandLabel="At Kai's"
                  badgeLabel={listing.rarity}
                  badgeTone="amber"
                  title={listing.speciesName}
                  statusLabel="At Kai's Market"
                  statusTone="amber"
                  headerAction={
                    <button
                      type="button"
                      data-my-things-listed-fish-view-btn={listing.listingId}
                      onClick={() => {
                        soundEngine.playUiClick();
                        openListedPreview();
                      }}
                      className="px-2 py-0.5 rounded-full bg-neutral-900 hover:bg-neutral-700 text-white text-[9.5px] font-semibold transition-colors cursor-pointer"
                    >
                      View
                    </button>
                  }
                  visual={
                    <Fish3dThumbnail
                      speciesId={listing.speciesId}
                      speciesName={listing.speciesName}
                      colorHex={listing.colorHex}
                      variant="studio"
                      onInspect={openListedPreview}
                    />
                  }
                />
              );
            })}

            {recruitedFamilyMembers.length === 0 &&
              caughtFishBucket.length === 0 &&
              playerListedFish.length === 0 && (
                <div className="col-span-full py-8 px-4 text-center rounded-2xl bg-[#eef0f4]/92 border border-white/80 shadow-[0_8px_22px_rgba(15,23,42,0.16)] text-slate-700 text-xs space-y-1">
                  <div className="font-semibold text-slate-900">No collectibles yet</div>
                  <div className="text-[11px] text-slate-500">
                    Fish you catch and companions you recruit will appear here.
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};
