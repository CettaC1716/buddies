import React from 'react';
import { Building2, DoorOpen, Globe, Lock, ShoppingBag, Users } from 'lucide-react';
import { soundEngine } from '../game/audio';
import type { ApartmentVisitPermission } from '../game/buddiesPrivacySettings';

export interface MyApartmentPhoneAppProps {
  hasOwnedHouse: boolean;
  ownerDisplayName: string;
  architectureTitle: string;
  architectureImageSrc: string;
  deedBadgeLabel?: string | null;
  visitPermission: ApartmentVisitPermission;
  onChangeVisitPermission: (next: ApartmentVisitPermission) => void;
  onEnterMyApartment: () => void;
  onOpenApartmentsCatalog: () => void;
}

const PRIVACY_OPTIONS: ReadonlyArray<{
  id: ApartmentVisitPermission;
  label: string;
  subtitle: string;
  icon: typeof Globe;
}> = [
  {
    id: 'everyone',
    label: 'Public (Open House)',
    subtitle: 'Listed in Public Apartment at every City Transit Kiosk',
    icon: Globe,
  },
  {
    id: 'friends',
    label: 'Friends Only',
    subtitle: 'Only friends can visit your apartment',
    icon: Users,
  },
  {
    id: 'only_me',
    label: 'Private (Only Me)',
    subtitle: 'Hidden from public listings — personal sanctuary',
    icon: Lock,
  },
];

export const MyApartmentPhoneApp: React.FC<MyApartmentPhoneAppProps> = ({
  hasOwnedHouse,
  ownerDisplayName,
  architectureTitle,
  architectureImageSrc,
  deedBadgeLabel,
  visitPermission,
  onChangeVisitPermission,
  onEnterMyApartment,
  onOpenApartmentsCatalog,
}) => {
  const isPublic = visitPermission === 'everyone';

  return (
    <div
      data-my-apartment-phone-app="true"
      className="flex-1 min-h-0 flex flex-col text-white overflow-hidden"
    >
      {/* App Header */}
      <div className="px-4 pt-2 pb-3 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-400 to-orange-500 flex items-center justify-center shadow-sm shrink-0">
            <Building2 className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-tight text-white truncate">My Apartment</h2>
            <p className="text-[10.5px] text-white/60 truncate">
              {hasOwnedHouse ? `${ownerDisplayName}'s Residence` : 'Private City Residence'}
            </p>
          </div>
        </div>
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
            hasOwnedHouse
              ? isPublic
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/35'
                : 'bg-sky-500/20 text-sky-200 border-sky-400/35'
              : 'bg-white/10 text-white/65 border-white/15'
          }`}
        >
          {hasOwnedHouse ? (isPublic ? 'PUBLIC' : visitPermission === 'friends' ? 'FRIENDS' : 'PRIVATE') : 'NO DEED'}
        </span>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 space-y-3.5">
        {/* Residence Hero Card */}
        <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-slate-900 shadow-lg">
          <div className="relative h-36 w-full overflow-hidden">
            <img
              src={architectureImageSrc || '/assets/kiosk/glass_modern_exterior.jpg'}
              alt={architectureTitle}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/92 via-slate-950/35 to-transparent" />
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-950/75 border border-white/20 text-[10px] font-bold uppercase tracking-wider text-white">
                {deedBadgeLabel || 'RESIDENCE'}
              </span>
            </div>
            <div className="absolute bottom-2.5 left-3 right-3">
              <div className="text-sm font-extrabold tracking-tight text-white leading-tight">
                {hasOwnedHouse ? architectureTitle : 'No Apartment Owned Yet'}
              </div>
              <p className="text-[11px] text-white/75 mt-0.5 leading-snug">
                {hasOwnedHouse
                  ? 'Enter your private apartment directly from your phone anytime.'
                  : 'Purchase an Apartment Deed from Hana at West Plaza Commercial Hub.'}
              </p>
            </div>
          </div>

          <div className="p-3 bg-white/[0.04] border-t border-white/10">
            {hasOwnedHouse ? (
              <button
                type="button"
                data-smartphone-enter-my-apartment-btn="true"
                onClick={() => {
                  soundEngine.playUiConfirm();
                  onEnterMyApartment();
                }}
                className="w-full py-2.5 px-4 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all cursor-pointer"
              >
                <DoorOpen className="w-4 h-4" aria-hidden="true" />
                <span>Enter My Apartment</span>
              </button>
            ) : (
              <button
                type="button"
                data-smartphone-buy-apartment-btn="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  onOpenApartmentsCatalog();
                }}
                className="w-full py-2.5 px-4 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" aria-hidden="true" />
                <span>Browse Apartments at West Plaza</span>
              </button>
            )}
          </div>
        </div>

        {/* Visitor Access / Public Kiosk Listing Setting */}
        <div className="rounded-2xl bg-white/[0.06] border border-white/12 p-3.5 space-y-2.5">
          <div>
            <div className="text-xs font-bold text-white">Visitor Access &amp; Kiosk Listing</div>
            <p className="text-[11px] text-white/60 mt-0.5 leading-snug">
              Choose who can enter your apartment. Public apartments appear in the{' '}
              <strong className="text-white/85">Public Apartment</strong> directory at every Transit Kiosk.
            </p>
          </div>

          <div className="space-y-1.5">
            {PRIVACY_OPTIONS.map((opt) => {
              const active = visitPermission === opt.id;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-my-apartment-privacy-option={opt.id}
                  onClick={() => {
                    soundEngine.playUiClick();
                    onChangeVisitPermission(opt.id);
                  }}
                  className={`w-full px-3 py-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                    active
                      ? 'bg-emerald-500/20 border-emerald-400/60 text-white'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-white/80'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      active ? 'bg-emerald-400 text-slate-950' : 'bg-white/10 text-white/70'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold leading-tight">{opt.label}</div>
                    <div className="text-[10.5px] text-white/60 leading-snug mt-0.5">
                      {opt.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
