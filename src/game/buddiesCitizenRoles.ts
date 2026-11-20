import type { CityTransitStationId } from './buddiesBlitzRules';
import type { CaughtFishItem, FishRarityTier, FishingWaterZoneId } from './buddiesFishingMarket';

/**
 * Canonical citizen IDs for Coral Island-inspired villagers across Blitz City.
 * Includes core merchants (Hana, Kai) and interactive district citizens.
 */
export type CitizenId =
  | 'npc_hana'
  | 'npc_kai'
  | 'city_plaza_raka'
  | 'city_plaza_nadia'
  | 'citizen_mira'
  | 'citizen_bima'
  | 'citizen_tari'
  | 'citizen_kenji';

export type CitizenRoleKey =
  | 'cafe_barista'
  | 'fish_merchant'
  | 'city_guide'
  | 'park_photographer'
  | 'fashion_stylist'
  | 'scooter_mechanic'
  | 'oasis_angler'
  | 'arena_quartermaster';

export type CitizenDistrictKey =
  | 'central_plaza'
  | 'glasshouse_cafe'
  | 'beachfront_pier'
  | 'nw_fishing_lake'
  | 'warzone_gate';

export type CitizenGiftReactionTier = 'loved' | 'liked' | 'neutral';

export type CitizenRoleActionType =
  | 'open_cafe_work'
  | 'open_kai_market'
  | 'open_fashion_boutique'
  | 'open_scooter_shop'
  | 'open_guide_map'
  | 'open_transit_park'
  | 'open_transit_oasis'
  | 'open_transit_warzone';

export interface CitizenAppearanceModularSpec {
  /** Base locomotion rig gender ('male' | 'female'). */
  modelVariant: 'male' | 'female';
  /** Optional base GLB override ('player' uses fuller skin mesh coverage for shorts/crop tops). */
  baseGlbVariant?: 'default' | 'player';
  /** Reserved slot for future dedicated citizen .glb mesh without breaking Stage 1 presets. */
  customModelUrl?: string;
  /** Optional modular full-costume .glb overlay applied over PelvisRoot skeleton. */
  equippedCostumeUrl?: string;
  /** Optional modular hair .glb overlay applied over PelvisRoot skeleton. */
  equippedHairUrl?: string;
  /** Optional modular upper-body apparel .glb overlay applied over PelvisRoot skeleton. */
  equippedTorsoUrl?: string;
  /** Optional modular shorts/legs .glb overlay applied over PelvisRoot skeleton. */
  equippedLegsUrl?: string;
  /** Optional modular shoes/feet .glb overlay applied over PelvisRoot skeleton. */
  equippedFeetUrl?: string;
  /** Non-skin, non-outline clothing material tint hex so each citizen reads uniquely in 3D. */
  clothingTintHex: string;
  /** Reserved clip name for future per-NPC idle pose/animation overrides. */
  idleOverrideClip?: string;
  /** Optional clip name overriding shared walk locomotion for this citizen. */
  walkOverrideClip?: string;
  /** Optional clip name overriding shared run/jog locomotion for this citizen. */
  runOverrideClip?: string;
  /** Optional clip name overriding shared sit animation for this citizen. */
  sitOverrideClip?: string;
}

export interface CitizenGiftOption {
  id: string;
  label: string;
  emoji: string;
  category: 'drink' | 'craft' | 'gear';
  description: string;
}

export interface CitizenDialogueBank {
  greetings: {
    day: readonly string[];
    evening: readonly string[];
    night: readonly string[];
    rainy: readonly string[];
  };
  deepTalks: readonly string[];
  roleTips: readonly string[];
  giftReactions: Record<CitizenGiftReactionTier, readonly string[]>;
}

export interface CitizenProfile {
  id: CitizenId;
  name: string;
  title: string;
  roleKey: CitizenRoleKey;
  roleBadge: string;
  districtKey: CitizenDistrictKey;
  districtLabel: string;
  accentColor: string;
  portraitEmoji: string;
  bio: string;
  scheduleSummary: string;
  favoriteTags: readonly string[];
  lovedGiftIds: readonly string[];
  likedGiftIds: readonly string[];
  lovedFishZones: readonly FishingWaterZoneId[];
  perkAtTwoHearts: string;
  perkAtFourHearts: string;
  roleActionLabel: string;
  roleActionDescription: string;
  roleActionType: CitizenRoleActionType;
  roleActionStationId?: CityTransitStationId;
  homeCoords: { x: number; z: number };
  stationId: CityTransitStationId;
  appearance: CitizenAppearanceModularSpec;
  dialogues: CitizenDialogueBank;
}

export interface CitizenFriendshipRecord {
  points: number;
  lastTalkDate: string | null;
  lastGiftDate: string | null;
  totalTalks: number;
  totalGifts: number;
  lastGiftLabel: string | null;
}

export interface CitizenFriendshipStore {
  version: 1;
  records: Record<CitizenId, CitizenFriendshipRecord>;
}

export interface CitizenHeartProgress {
  points: number;
  hearts: number;
  maxHearts: number;
  nextHeartPoints: number;
  percentToNextHeart: number;
  tierLabel: string;
}

export interface CitizenDirectoryEntry {
  profile: CitizenProfile;
  record: CitizenFriendshipRecord;
  progress: CitizenHeartProgress;
  talkedToday: boolean;
  giftedToday: boolean;
}

export const CITIZEN_FRIENDSHIP_STORAGE_KEY = 'buddies_blitz_citizen_friendship_v1';
export const CITIZEN_MAX_HEARTS = 5;
export const CITIZEN_POINTS_PER_HEART = 100;
export const CITIZEN_MAX_FRIENDSHIP_POINTS = CITIZEN_MAX_HEARTS * CITIZEN_POINTS_PER_HEART;
export const CITIZEN_DAILY_TALK_BONUS_POINTS = 25;

export const CITIZEN_GIFT_REACTION_POINTS: Record<CitizenGiftReactionTier, number> = {
  loved: 75,
  liked: 45,
  neutral: 25,
};

const FISH_RARITY_BONUS_POINTS: Record<FishRarityTier, number> = {
  Common: 0,
  Uncommon: 10,
  Rare: 20,
  Mythic: 35,
};

export const CITIZEN_DAILY_GIFT_CATALOG: readonly CitizenGiftOption[] = [
  {
    id: 'iced_matcha',
    label: 'Iced Matcha Latte',
    emoji: '🍵',
    category: 'drink',
    description: 'Chilled ceremonial matcha from Hana Glasshouse Cafe.',
  },
  {
    id: 'roasted_beans',
    label: 'Single-Origin Beans',
    emoji: '☕',
    category: 'drink',
    description: 'Freshly roasted aromatic beans for long plaza shifts.',
  },
  {
    id: 'sea_shell_charm',
    label: 'Tidal Shell Charm',
    emoji: '🐚',
    category: 'craft',
    description: 'Polished harbor shell keepsake braided with neon cord.',
  },
  {
    id: 'chrome_wrench',
    label: 'Chrome Hex Wrench',
    emoji: '🔧',
    category: 'gear',
    description: 'Balanced alloy multi-wrench tuned for urban scooters.',
  },
  {
    id: 'lure_feather',
    label: 'Iridescent Fly Lure',
    emoji: '🪶',
    category: 'craft',
    description: 'Hand-tied shimmer lure built for murky oasis & surf bites.',
  },
  {
    id: 'tactical_patch',
    label: 'Blitz Squad Emblem',
    emoji: '🛡️',
    category: 'gear',
    description: 'Woven district crest worn by Warzone perimeter defenders.',
  },
];

export const CITIZEN_PROFILES: readonly CitizenProfile[] = [
  {
    id: 'npc_hana',
    name: 'Hana',
    title: 'Glasshouse Head Barista',
    roleKey: 'cafe_barista',
    roleBadge: 'CAFE OWNER',
    districtKey: 'glasshouse_cafe',
    districtLabel: 'Glasshouse Cafe · South Plaza',
    accentColor: '#f59e0b',
    portraitEmoji: '☕',
    bio: 'Runs the sunlit Glasshouse Cafe at the southern edge of Central Plaza. Knows every commuter order by heart.',
    scheduleSummary: 'Behind the Glasshouse espresso bar all day & late evening.',
    favoriteTags: ['Roasted Espresso', 'Iced Matcha', 'Freshwater Fish'],
    lovedGiftIds: ['roasted_beans', 'iced_matcha'],
    likedGiftIds: ['sea_shell_charm', 'lure_feather'],
    lovedFishZones: ['central_oasis'],
    perkAtTwoHearts: 'Unlocks Barista Backstory & Secret Latte Notes',
    perkAtFourHearts: 'Close Confidant Status & Town Cafe VIP Mention',
    roleActionLabel: 'Open Glasshouse Cafe',
    roleActionDescription: 'Brew shifts, craft drinks, or collect shift pay at Hana Cafe.',
    roleActionType: 'open_cafe_work',
    stationId: 'central_plaza',
    homeCoords: { x: -91.5, z: 21.0 },
    appearance: {
      modelVariant: 'female',
      clothingTintHex: '#f59e0b',
    },
    dialogues: {
      greetings: {
        day: [
          'Morning rush just cleared! Pull up a stool whenever you need caffeine or shift work.',
          'Welcome back to the Glasshouse! The skylight hits the counter just right at this hour.',
        ],
        evening: [
          'Golden hour through the glasshouse roof is my favorite part of the day.',
          'Nothing beats a warm pour-over once the plaza lanterns flicker on.',
        ],
        night: [
          'Running the late shift for night-owl anglers and arena fighters. Need a pick-me-up?',
          'The plaza gets wonderfully quiet at night—best time to dial in a new roast.',
        ],
        rainy: [
          'Rain drumming on the glass roof makes every cup taste twice as cozy!',
          'Step inside out of the drizzle—I kept the steamer warm for you.',
        ],
      },
      deepTalks: [
        'Between you and me, Raka always sneaks extra cinnamon when he thinks I am not looking.',
        'Someday I want to host a full Blitz City tasting night with fresh Harbor seafood and Mira styling the venue.',
      ],
      roleTips: [
        'Espresso shifts pay steadily if you want coins before visiting Mira or Bima.',
        'Bring freshwater catches from Tari lake if you want a cheerful kitchen reaction.',
      ],
      giftReactions: {
        loved: ['Oh!! Single-origin perfection—how did you know my exact roast craving?!'],
        liked: ['Aww, thank you! That will look lovely right beside the espresso grinder.'],
        neutral: ['That is thoughtful of you, friend! Thanks for thinking of the cafe.'],
      },
    },
  },
  {
    id: 'npc_kai',
    name: 'Kai',
    title: 'Harbor Master & Angler',
    roleKey: 'fish_merchant',
    roleBadge: 'FISH MARKET',
    districtKey: 'beachfront_pier',
    districtLabel: 'Beachfront Harbor · East Coast',
    accentColor: '#0284c7',
    portraitEmoji: '🐟',
    bio: 'Seasoned coastal merchant running the east boardwalk stall. Trades rare catches and watches every tide table.',
    scheduleSummary: 'Stationed at Kai Fish Market Pier facing the ocean surf.',
    favoriteTags: ['Fly Lures', 'Shell Charms', 'East Beach Catch'],
    lovedGiftIds: ['lure_feather', 'sea_shell_charm'],
    likedGiftIds: ['iced_matcha', 'chrome_wrench'],
    lovedFishZones: ['east_beach'],
    perkAtTwoHearts: 'Unlocks Secret Surf Casting Windows',
    perkAtFourHearts: 'Harbor First-Mate Honor & Deep Sea Stories',
    roleActionLabel: 'Open Kai Fish Market',
    roleActionDescription: 'Sell catches, inspect prices, or manage your fish bucket.',
    roleActionType: 'open_kai_market',
    roleActionStationId: 'kai_fish_market',
    stationId: 'kai_fish_market',
    homeCoords: { x: 84.85, z: 65.65 },
    appearance: {
      modelVariant: 'male',
      clothingTintHex: '#0284c7',
    },
    dialogues: {
      greetings: {
        day: [
          'Salt breeze is crisp today! Got anything heavy biting out past the timber pier?',
          'Fresh ice is stocked in the stall—bring me your best coastal haul!',
        ],
        evening: [
          'Dusk brings the silver shoals closer to shore. Keep an eye on the ripples!',
          'Sunset paints the whole boardwalk copper when the tide pulls out.',
        ],
        night: [
          'Lantern light lures the shy deep-water swimmers right up to the pilings.',
          'Still awake? The midnight tide hides the strangest silhouettes in the surf.',
        ],
        rainy: [
          'Heavy rain stirs up bottom feeders—anglers who brave the storm catch legends!',
          'Oilskin coat stays on all week when clouds roll over East Beach.',
        ],
      },
      deepTalks: [
        'Tari knows freshwater ecology better than anyone, though I still tease her that ocean swells win for drama.',
        'Every time you reel in a trophy catch, even Bima hears the cheers back on Central Plaza.',
      ],
      roleTips: [
        'East Beach catches fetch strong value here, and I never say no to an ocean gift.',
        'Hop the Coastal Pier Halte tram if you want to bounce swiftly back to Central Plaza.',
      ],
      giftReactions: {
        loved: ['Whoa, look at the craftsmanship on this! Worth its weight in trophy marlin!'],
        liked: ['Ha, right on! Always useful out on a windy boardwalk shift.'],
        neutral: ['Appreciate the kindness, buddy. Fair winds to you!'],
      },
    },
  },
  {
    id: 'city_plaza_raka',
    name: 'Raka',
    title: 'West Plaza Explorer & Cafe Regular',
    roleKey: 'city_guide',
    roleBadge: 'WEST EXPLORER',
    districtKey: 'central_plaza',
    districtLabel: 'Central Plaza · Shops, Cafe & Casino',
    accentColor: '#2563eb',
    portraitEmoji: '🧭',
    bio: 'Strolls through Central Plaza browsing the Scooter & Interior studios, grabbing glazed donuts at Glasshouse Cafe, visiting Grand Casino, and passing the Tennis Club.',
    scheduleSummary: 'Walks calmly between Plaza shops, Glasshouse Cafe patio, Grand Casino benches, and Tennis Club.',
    favoriteTags: ['Roasted Beans', 'Mechanical Tools', 'Tram Schedules'],
    lovedGiftIds: ['roasted_beans', 'chrome_wrench'],
    likedGiftIds: ['iced_matcha', 'tactical_patch'],
    lovedFishZones: [],
    perkAtTwoHearts: 'Shares Shortcut & District Landmarks',
    perkAtFourHearts: 'Honorary Plaza Steward Pin',
    roleActionLabel: 'Open Halte Transit Map',
    roleActionDescription: 'Fast-travel between Plaza, Harbor, Oasis Lake, and Warzone.',
    roleActionType: 'open_guide_map',
    roleActionStationId: 'central_plaza',
    stationId: 'central_plaza',
    homeCoords: { x: -75.25, z: -6.0 },
    appearance: {
      modelVariant: 'male',
      baseGlbVariant: 'player',
      equippedHairUrl: '/assets/outfit/raka/blitz_hair_valbotq_12_18181D54.glb',
      equippedTorsoUrl: '/assets/outfit/raka/blitz_torso_colorpop_bunny_club_1_7DF6EF18.glb',
      equippedLegsUrl: '/assets/outfit/raka/blitz_legs_festive_1_2_FB88CC4F.glb',
      equippedFeetUrl: '/assets/outfit/bima/blitz_feet_warrior_trainers_1_36A44F38.glb',
      clothingTintHex: '#2563eb',
      idleOverrideClip: 'raka_idle.001',
      walkOverrideClip: 'raka_walk.001',
      runOverrideClip: 'raka_run.001',
      sitOverrideClip: 'raka_sit.001',
    },
    dialogues: {
      greetings: {
        day: [
          'Plaza lanes are clear and both tram loops are humming right on schedule!',
          'Need bearings? Boutiques are west, Warzone Gate is southeast, and Hana Cafe waits down south.',
        ],
        evening: [
          'Evening commuters love the neon tramway view along the North Residence ridge.',
          'Wrapped up my tenth inspection lap—nothing keeps the heart steady like a plaza walk.',
        ],
        night: [
          'Streetlamps along the central spine stay bright till dawn. Safe travels across town!',
          'Night trams glide effortlessly past Taman Ria under the harbor glow.',
        ],
        rainy: [
          'Checked the Halte canopy drains—everyone stays dry waiting at the tram shelters!',
          'Wet stone adds extra shine to the scooter lane, so watch your braking distance.',
        ],
      },
      deepTalks: [
        'People think walking the same promenade gets repetitive, but every day someone new races past with a grin.',
        'Bima tuned the tram signal bells last month—now they chime almost musically.',
      ],
      roleTips: [
        'Tap the Halte Transit action below if you want a quick overview of all city stations.',
        'Kenji guards the southeastern gate—check in with him before jumping into Warzone.',
      ],
      giftReactions: {
        loved: ['Spot on! Between patrol laps, this is literally my favorite thing in Blitz City!'],
        liked: ['Hey, much obliged! That makes my shift feel twice as smooth.'],
        neutral: ['Oh, thank you! Always nice bumping into friendly faces on the walk.'],
      },
    },
  },
  {
    id: 'city_plaza_nadia',
    name: 'Nadia',
    title: 'West District Columnist & Boutique Regular',
    roleKey: 'park_photographer',
    roleBadge: 'FASHION & PRESS',
    districtKey: 'central_plaza',
    districtLabel: 'West Quarter · Boutique, Cafe & Casino',
    accentColor: '#ec4899',
    portraitEmoji: '📷',
    bio: 'Wanders the West promenade in chic trousers and heels, window-shopping the Fashion Boutique and Interior Studio, sipping Caramel Latte at Glasshouse Patio, and visiting Grand Casino.',
    scheduleSummary: 'Strolls calmly between Fashion Boutique, Interior Showroom, Glasshouse Patio, Grand Casino, and Plaza Benches.',
    favoriteTags: ['Caramel Latte', 'Boutique Looks', 'Grand Casino'],
    lovedGiftIds: ['iced_matcha', 'sea_shell_charm'],
    likedGiftIds: ['roasted_beans', 'lure_feather'],
    lovedFishZones: ['central_oasis'],
    perkAtTwoHearts: 'Reveals Best Golden-Hour Photo Angles',
    perkAtFourHearts: 'Featured Cover Story in Blitz Zine',
    roleActionLabel: 'Open Streetwear Boutique',
    roleActionDescription: 'Preview Plaza boutique looks Nadia features in her column.',
    roleActionType: 'open_fashion_boutique',
    roleActionStationId: 'central_plaza',
    stationId: 'central_plaza',
    homeCoords: { x: -94.8, z: 5.8 },
    appearance: {
      modelVariant: 'female',
      clothingTintHex: '#ec4899',
      idleOverrideClip: 'nadia_idle.001',
      walkOverrideClip: 'nadia_walk.001',
      runOverrideClip: 'nadia_run.001',
      sitOverrideClip: 'nadia_sit.001',
    },
    dialogues: {
      greetings: {
        day: [
          'Hold that pose—actually, the light off the Plaza pavement looks super crisp right now!',
          'Documenting every shopfront for this season’s community zine. Seen Mira’s new drop yet?',
        ],
        evening: [
          'Sunset reflections along East Harbor beat every studio softbox on earth.',
          'My camera roll is 80% scooters mid-drift and 20% stray seagulls.',
        ],
        night: [
          'Long exposures around the Glasshouse lanterns turn the city into pure synthwave.',
          'Quiet nights are great for framing silhouettes near the oasis water.',
        ],
        rainy: [
          'Puddles double every neon sign—rainy days are secret goldmines for street photography!',
          'Keeping my lens hood wiped dry between bursts today.',
        ],
      },
      deepTalks: [
        'I moved here for one weekend feature on the harbor and never boarded the return train.',
        'Mira lets me borrow jackets for shoots whenever I promise to credit her kiosk in the zine!',
      ],
      roleTips: [
        'Head down to Beachfront Harbor around golden hour for the prettiest boardwalk backdrop.',
        'Give villagers their favorite gifts daily—each friend unlocks closer stories at 2 and 4 hearts.',
      ],
      giftReactions: {
        loved: ['No way!! This is aesthetic perfection—let me snap a photo before using it!'],
        liked: ['Ooh, super cute! Definitely going straight into my camera bag.'],
        neutral: ['Wait, for me? Thank you so much—that genuinely brightened my shoot!'],
      },
    },
  },
  {
    id: 'citizen_mira',
    name: 'Mira',
    title: 'Urban Illustrator & Streetwear Artist',
    roleKey: 'fashion_stylist',
    roleBadge: 'ARTIST',
    districtKey: 'central_plaza',
    districtLabel: 'Glasshouse Cafe',
    accentColor: '#c026d3',
    portraitEmoji: '🎨',
    bio: 'Free-spirited island illustrator who orders Iced Matcha at Glasshouse Cafe, sketches looks by Fashion & Interior studios, and relaxes on Oasis & Grand Casino benches.',
    scheduleSummary: 'Walks calmly between Glasshouse Cafe, Oasis Lake benches, Fashion & Interior shops, and Grand Casino.',
    favoriteTags: ['Iced Matcha', 'Tidal Shells', 'DropScience Streetwear'],
    lovedGiftIds: ['iced_matcha', 'sea_shell_charm'],
    likedGiftIds: ['roasted_beans', 'lure_feather'],
    lovedFishZones: ['central_oasis'],
    perkAtTwoHearts: 'Shares Sketchbook Palettes & Silhouette Tips',
    perkAtFourHearts: 'Custom Lookbook Feature Buddy',
    roleActionLabel: 'Open Streetwear Catalog',
    roleActionDescription: 'Preview & mix outfits from the town streetwear collection Mira loves sketching.',
    roleActionType: 'open_fashion_boutique',
    stationId: 'central_plaza',
    homeCoords: { x: -85.2, z: 16.2 },
    appearance: {
      modelVariant: 'female',
      baseGlbVariant: 'player',
      equippedHairUrl: '/assets/outfit/mira/blitz_hair_draped_hair_1_43391F7E.glb',
      equippedTorsoUrl: '/assets/outfit/mira/blitz_torso_resort_modern_6_5DC8FAA4.glb',
      equippedLegsUrl: '/assets/outfit/mira/blitz_legs_dspastelgothdistressed_shorts_DDA37A46.glb',
      equippedFeetUrl: '/assets/outfit/mira/blitz_feet_elska_sneakers_705A72B0.glb',
      clothingTintHex: '#c026d3',
      idleOverrideClip: 'mira_idle.001',
      walkOverrideClip: 'mira_walk.001',
      runOverrideClip: 'mira_run.001',
      sitOverrideClip: 'mira_sit.001',
    },
    dialogues: {
      greetings: {
        day: [
          'Spotted three amazing jacket colorways between the Plaza and North Residence already!',
          'Always chasing good sunlight—park benches and the Glasshouse terrace beat being stuck indoors.',
        ],
        evening: [
          'Highlighter magenta and sunset amber along East Beach make my sketchbook look electric.',
          'Catching a breeze on the beach chairs before heading back up the Plaza stairs.',
        ],
        night: [
          'Late-night stroll across town! City streetlamps reflect off the fountains so cleanly.',
          'Wrapping up today’s sketches near the warm Glasshouse patio.',
        ],
        rainy: [
          'Water-repellent streetwear lets me keep sketching even when coastal showers pass through!',
          'Always duck into Hana’s Glasshouse terrace when the drizzle picks up.',
        ],
      },
      deepTalks: [
        'I hated feeling cooped up in one corner—wandering the whole island with a sketchbook keeps every piece fresh.',
        'Seeing neighbors wave from North Residence clear across to Harbor Pier makes this town feel alive.',
      ],
      roleTips: [
        'Need fresh outfit inspiration? Open the Streetwear Catalog below anytime!',
        'You can find me sketching on park benches, down at the beach chairs, or unwinding at the Cafe terrace.',
      ],
      giftReactions: {
        loved: ['Obsessed!! Look at that vibe—you have seriously elevated taste!'],
        liked: ['Ooh, chic pick! That matches tomorrow’s sketchbook palette effortlessly.'],
        neutral: ['Sweet of you to track me down across town with a gift—thank you!'],
      },
    },
  },
  {
    id: 'citizen_bima',
    name: 'Bima',
    title: 'Scooter & Tennis Club Fan',
    roleKey: 'scooter_mechanic',
    roleBadge: 'RIDER',
    districtKey: 'central_plaza',
    districtLabel: 'West Side · Scooter Kiosk, Tennis & Oasis',
    accentColor: '#ea580c',
    portraitEmoji: '⚡',
    bio: 'Inspects new bikes at the Urban Scooter Showroom, watches matches by the Tennis Club, grabs Double Espresso at Glasshouse Cafe, and walks by NW Oasis and Grand Casino.',
    scheduleSummary: 'Strolls between Scooter Showroom, Glasshouse Cafe, Oasis Lake benches, Tennis Club, and Grand Casino.',
    favoriteTags: ['Hex Wrenches', 'Double Espresso', 'Custom Scooters'],
    lovedGiftIds: ['chrome_wrench', 'roasted_beans'],
    likedGiftIds: ['tactical_patch', 'iced_matcha'],
    lovedFishZones: [],
    perkAtTwoHearts: 'Reveals Fast Cross-Island Shortcuts',
    perkAtFourHearts: 'Official Morning Run Pace Partner',
    roleActionLabel: 'View Urban Scooter Garage',
    roleActionDescription: 'Browse urban scooters if you want to cruise the island faster than jogging.',
    roleActionType: 'open_scooter_shop',
    stationId: 'central_plaza',
    homeCoords: { x: -84.5, z: 19.0 },
    appearance: {
      modelVariant: 'male',
      equippedHairUrl: '/assets/outfit/bima/blitz_hair_trend_autumn_edit_2_9582695C.glb',
      equippedTorsoUrl: '/assets/outfit/bima/blitz_torso_sport_goth_top_2_A2601584.glb',
      equippedLegsUrl: '/assets/outfit/bima/blitz_legs_urban_2_9A943FA4.glb',
      equippedFeetUrl: '/assets/outfit/bima/blitz_feet_warrior_trainers_1_36A44F38.glb',
      clothingTintHex: '#ea580c',
      idleOverrideClip: 'bima_idle.001',
      walkOverrideClip: 'bima_walk.001',
      runOverrideClip: 'bima_run.001',
      sitOverrideClip: 'bima_sit.001',
    },
    dialogues: {
      greetings: {
        day: [
          'Just finished a crisp lap past Oasis Lake—nothing wakes the legs up like jogging the whole island!',
          'Always hopping between Hana’s espresso patio, the park benches, and the Harbor boardwalk.',
        ],
        evening: [
          'Golden hour breeze off Beachfront Harbor feels unreal after a South Avenue run!',
          'Another full circuit across town complete—checking out sunset before calling it a day.',
        ],
        night: [
          'Cool night air is prime weather for pacing long avenues cleanly.',
          'Grabbed an espresso shot from Hana earlier, so I still have legs for one more bench circuit!',
        ],
        rainy: [
          'Careful taking fast corners on wet brick—even on foot, slick pavement keeps you alert!',
          'A bit of coastal mist never stops my island jog circuit.',
        ],
      },
      deepTalks: [
        'Turns out I enjoy actually riding and running across the whole map way more than standing around a storefront!',
        'Raka and I always cross paths near North Park—he keeps the tramway ticking while I race my lap split.',
      ],
      roleTips: [
        'Grabbing a scooter from the garage menu cuts cross-island travel time in half!',
        'Follow the main stairs off Central Plaza down into the Park if you want the fastest scenic route to the Oasis.',
      ],
      giftReactions: {
        loved: ['Yo!! Now THAT is top-tier kit—made my whole cross-town run worth it!'],
        liked: ['Awesome, thanks! Always comes in clutch on long island loops.'],
        neutral: ['Hey, appreciate you catching up with me out here! See you around the Plaza!'],
      },
    },
  },
  {
    id: 'citizen_tari',
    name: 'Tari',
    title: 'Boutique Patron & Grand Casino Socialite',
    roleKey: 'fashion_stylist',
    roleBadge: 'BOUTIQUE & CASINO',
    districtKey: 'central_plaza',
    districtLabel: 'West Quarter · Boutique, Cafe & Casino',
    accentColor: '#0d9488',
    portraitEmoji: '👜',
    bio: 'Strolls gracefully in formal couture heels browsing Fashion Boutique dresses, sipping Iced Latte at Glasshouse benches, unwinding at Grand Casino Lounge, and resting by Oasis Lake.',
    scheduleSummary: 'Walks calmly between Fashion Boutique, Glasshouse Cafe, Plaza Vintage Bench, Grand Casino Lounge, and Oasis Bench.',
    favoriteTags: ['Iced Latte', 'Couture Heels', 'Casino Lounge'],
    lovedGiftIds: ['iced_matcha', 'sea_shell_charm'],
    likedGiftIds: ['roasted_beans', 'lure_feather'],
    lovedFishZones: ['central_oasis'],
    perkAtTwoHearts: 'Shares Boutique & Cafe Lounge Spots',
    perkAtFourHearts: 'Grand Casino VIP Lounge Regular',
    roleActionLabel: 'Open Streetwear Boutique',
    roleActionDescription: 'Preview Boutique collections beside Central Plaza.',
    roleActionType: 'open_fashion_boutique',
    roleActionStationId: 'central_plaza',
    stationId: 'central_plaza',
    homeCoords: { x: -78.59, z: -56.6 },
    appearance: {
      modelVariant: 'female',
      baseGlbVariant: 'player',
      equippedCostumeUrl: '/assets/outfit/tari/tari-costume.glb',
      clothingTintHex: '#0d9488',
      idleOverrideClip: 'tari_idle.001',
      walkOverrideClip: 'tari_walk.001',
      runOverrideClip: 'tari_run.001',
      sitOverrideClip: 'tari_sit.001',
    },
    dialogues: {
      greetings: {
        day: [
          'The new window silhouettes at the Fashion Boutique match this afternoon light wonderfully!',
          'Grabbed an Iced Latte from Glasshouse Cafe—nothing beats a quiet stroll before the Casino tables open.',
        ],
        evening: [
          'Evening lights across Grand Casino’s Porte-Cochere feel straight out of an old cinema classic.',
          'Catching my breath on the vintage promenade bench before dinner.',
        ],
        night: [
          'Soft lanterns along the West Plaza promenade and the turquoise Oasis look serene tonight.',
          'Even in heels, taking a slow lap past the Clock Tower clears my head.',
        ],
        rainy: [
          'Glasshouse Cafe is my go-to sanctuary whenever coastal rain hits the Plaza cobblestones!',
          'A chilled latte indoors while watching raindrops on the conservatory roof—pure calm.',
        ],
      },
      deepTalks: [
        'Hana always brews Iced Latte for me whenever I swing by Glasshouse Cafe in heels after browsing the Boutique!',
        'Nadia always stops to sketch or snap shots outside the Boutique before we meet at Glasshouse Patio.',
      ],
      roleTips: [
        'Drop by the Fashion Boutique on Central Plaza West or relax at Glasshouse Cafe tables.',
        'Grand Casino and NW Oasis Lake are both an easy calm walk from Central Plaza.',
      ],
      giftReactions: {
        loved: ['Oh, exquisite! That pairs effortlessly with my evening wardrobe—thank you!'],
        liked: ['How thoughtful of you! That made my afternoon stroll even nicer.'],
        neutral: ['Thank you kindly! Fancy seeing you out by the Plaza!'],
      },
    },
  },
  {
    id: 'citizen_kenji',
    name: 'Kenji',
    title: 'Tennis Regular & Oasis Angler',
    roleKey: 'oasis_angler',
    roleBadge: 'TENNIS & LAKE',
    districtKey: 'nw_fishing_lake',
    districtLabel: 'West Side · Tennis Club, Cafe & NW Lake',
    accentColor: '#dc2626',
    portraitEmoji: '🎾',
    bio: 'Wears athletic shorts and trainers to watch rallies at the Tennis Club, grab a croissant at Glasshouse Cafe, and spend relaxed afternoons fishing along NW Oasis Lake.',
    scheduleSummary: 'Strolls calmly between Tennis Club, Glasshouse Cafe, Clock Tower Bench, and NW Fishing Lake.',
    favoriteTags: ['Butter Croissants', 'Hex Wrenches', 'Freshwater Fish'],
    lovedGiftIds: ['lure_feather', 'chrome_wrench'],
    likedGiftIds: ['roasted_beans', 'iced_matcha'],
    lovedFishZones: ['central_oasis'],
    perkAtTwoHearts: 'Unlocks Tactical Warzone & Lake Callouts',
    perkAtFourHearts: 'West District Sportsman Crest',
    roleActionLabel: 'Travel to NW Fishing Lake',
    roleActionDescription: 'Fast-travel to NW Oasis Lake near Kenji’s shoreline spot.',
    roleActionType: 'open_transit_oasis',
    roleActionStationId: 'nw_fishing_lake',
    stationId: 'nw_fishing_lake',
    homeCoords: { x: -42.5, z: -8.5 },
    appearance: {
      modelVariant: 'male',
      clothingTintHex: '#dc2626',
      idleOverrideClip: 'kenji_idle.001',
      walkOverrideClip: 'kenji_walk.001',
      runOverrideClip: 'kenji_run.001',
      sitOverrideClip: 'kenji_sit.001',
    },
    dialogues: {
      greetings: {
        day: [
          'Perimeter check clear. Crossing south toward Warzone Arena? Stay sharp and watch cover!',
          'Even in peaceful city mode, keeping reflexes warm along this boulevard pays off.',
        ],
        evening: [
          'Evening flare tests along the outer wall make this gate look straight out of an action film.',
          'Grab coffee from Hana before deploying—hydration and caffeine win half the skirmish.',
        ],
        night: [
          'Night watch on the southern approach. Quiet now, loud once squads drop in.',
          'Keep an eye on rooftop sightlines past the outer barricade after dark.',
        ],
        rainy: [
          'Slippery concrete changes rush timing at the gate—plant your boots cleanly.',
          'Rain muffles footsteps across the tarmac, so check corners twice.',
        ],
      },
      deepTalks: [
        'Honestly, I enjoy calm Plaza mornings way more than sirens—our job here is making sure peace holds.',
        'Raka and I trade radio checks every hour; his punctual logbooks keep the gate running smoothly.',
      ],
      roleTips: [
        'Use Warzone Gate Transit below to deploy near combat grounds or team pads.',
        'Coastal fish from Kai pier actually grill up great back at squad mess after a long watch.',
      ],
      giftReactions: {
        loved: ['Salute!! Top-grade gear—that earns an honored spot right on my field vest!'],
        liked: ['Solid supply drop! Much appreciated out on perimeter duty.'],
        neutral: ['Thank you, citizen. Stay safe between the Plaza and the outer wall!'],
      },
    },
  },
];

const CITIZEN_PROFILE_MAP: ReadonlyMap<CitizenId, CitizenProfile> = new Map(
  CITIZEN_PROFILES.map((profile) => [profile.id, profile]),
);

const CITIZEN_ALIAS_MAP: Readonly<Record<string, CitizenId>> = {
  npc_hana: 'npc_hana',
  npc_cafe: 'npc_hana',
  npc_kai: 'npc_kai',
  npc_beach: 'npc_kai',
  city_plaza_raka: 'city_plaza_raka',
  city_plaza_nadia: 'city_plaza_nadia',
  citizen_mira: 'citizen_mira',
  citizen_bima: 'citizen_bima',
  citizen_tari: 'citizen_tari',
  citizen_kenji: 'citizen_kenji',
};

export function resolveCanonicalCitizenId(rawId: string | null | undefined): CitizenId | null {
  if (!rawId) return null;
  const trimmed = rawId.trim();
  return CITIZEN_ALIAS_MAP[trimmed] ?? null;
}

export function getCitizenProfile(rawId: string | null | undefined): CitizenProfile | null {
  const canonical = resolveCanonicalCitizenId(rawId);
  return canonical ? CITIZEN_PROFILE_MAP.get(canonical) ?? null : null;
}

export function getCitizenLocalDateKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createEmptyCitizenFriendshipRecord(): CitizenFriendshipRecord {
  return {
    points: 0,
    lastTalkDate: null,
    lastGiftDate: null,
    totalTalks: 0,
    totalGifts: 0,
    lastGiftLabel: null,
  };
}

export function createDefaultCitizenFriendshipStore(): CitizenFriendshipStore {
  const records = {} as Record<CitizenId, CitizenFriendshipRecord>;
  for (const profile of CITIZEN_PROFILES) {
    records[profile.id] = createEmptyCitizenFriendshipRecord();
  }
  return {
    version: 1,
    records,
  };
}

function sanitizePoints(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(CITIZEN_MAX_FRIENDSHIP_POINTS, Math.round(value)));
}

function sanitizeCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function sanitizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function loadCitizenFriendshipStore(
  storage?: Pick<Storage, 'getItem'> | null,
): CitizenFriendshipStore {
  const fallback = createDefaultCitizenFriendshipStore();
  const targetStorage =
    storage ?? (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);
  if (!targetStorage) return fallback;
  try {
    const raw = targetStorage.getItem(CITIZEN_FRIENDSHIP_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { records?: Record<string, Partial<CitizenFriendshipRecord>> } | null;
    if (!parsed || typeof parsed !== 'object' || !parsed.records) return fallback;
    for (const profile of CITIZEN_PROFILES) {
      const entry = parsed.records[profile.id];
      if (!entry || typeof entry !== 'object') continue;
      fallback.records[profile.id] = {
        points: sanitizePoints(entry.points),
        lastTalkDate: sanitizeOptionalString(entry.lastTalkDate),
        lastGiftDate: sanitizeOptionalString(entry.lastGiftDate),
        totalTalks: sanitizeCount(entry.totalTalks),
        totalGifts: sanitizeCount(entry.totalGifts),
        lastGiftLabel: sanitizeOptionalString(entry.lastGiftLabel),
      };
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function saveCitizenFriendshipStore(
  store: CitizenFriendshipStore,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  const targetStorage =
    storage ?? (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);
  if (!targetStorage) return;
  try {
    targetStorage.setItem(CITIZEN_FRIENDSHIP_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota or private browsing write failures cleanly.
  }
}

export function getCitizenFriendshipRecord(
  store: CitizenFriendshipStore,
  rawCitizenId: string,
): CitizenFriendshipRecord {
  const canonical = resolveCanonicalCitizenId(rawCitizenId);
  if (!canonical) return createEmptyCitizenFriendshipRecord();
  return store.records[canonical] ?? createEmptyCitizenFriendshipRecord();
}

export function getCitizenHeartTierLabel(hearts: number): string {
  if (hearts >= 5) return 'Island Bestie';
  if (hearts >= 4) return 'Trusted Confidant';
  if (hearts >= 3) return 'Close Pal';
  if (hearts >= 2) return 'Town Buddy';
  if (hearts >= 1) return 'Friendly Face';
  return 'Newcomer';
}

export function getCitizenHeartProgress(points: number): CitizenHeartProgress {
  const clamped = sanitizePoints(points);
  const hearts = Math.min(CITIZEN_MAX_HEARTS, Math.floor(clamped / CITIZEN_POINTS_PER_HEART));
  const nextHeartPoints =
    hearts >= CITIZEN_MAX_HEARTS
      ? CITIZEN_MAX_FRIENDSHIP_POINTS
      : (hearts + 1) * CITIZEN_POINTS_PER_HEART;
  const withinHeart = clamped - hearts * CITIZEN_POINTS_PER_HEART;
  const percentToNextHeart =
    hearts >= CITIZEN_MAX_HEARTS
      ? 100
      : Math.min(100, Math.max(0, Math.round((withinHeart / CITIZEN_POINTS_PER_HEART) * 100)));

  return {
    points: clamped,
    hearts,
    maxHearts: CITIZEN_MAX_HEARTS,
    nextHeartPoints,
    percentToNextHeart,
    tierLabel: getCitizenHeartTierLabel(hearts),
  };
}

export function evaluateGiftReaction(rawCitizenId: string, giftId: string): CitizenGiftReactionTier {
  const profile = getCitizenProfile(rawCitizenId);
  if (!profile) return 'neutral';
  if (profile.lovedGiftIds.includes(giftId)) return 'loved';
  if (profile.likedGiftIds.includes(giftId)) return 'liked';
  return 'neutral';
}

export function evaluateCaughtFishGiftReaction(
  rawCitizenId: string,
  fish: Pick<CaughtFishItem, 'waterZone' | 'rarity' | 'isTrophy'>,
): { tier: CitizenGiftReactionTier; points: number } {
  const profile = getCitizenProfile(rawCitizenId);
  if (!profile) return { tier: 'neutral', points: CITIZEN_GIFT_REACTION_POINTS.neutral };

  let tier: CitizenGiftReactionTier = 'neutral';
  if (profile.lovedFishZones.includes(fish.waterZone)) {
    tier = 'loved';
  } else if (fish.rarity === 'Rare' || fish.rarity === 'Mythic') {
    tier = 'liked';
  }

  const rarityBonus = FISH_RARITY_BONUS_POINTS[fish.rarity] ?? 0;
  const trophyBonus = fish.isTrophy ? 10 : 0;
  return {
    tier,
    points: CITIZEN_GIFT_REACTION_POINTS[tier] + rarityBonus + trophyBonus,
  };
}

export function recordCitizenDailyTalk(
  store: CitizenFriendshipStore,
  rawCitizenId: string,
  dateKey: string = getCitizenLocalDateKey(),
): {
  store: CitizenFriendshipStore;
  pointsAwarded: number;
  awardedTodayBonus: boolean;
  progress: CitizenHeartProgress;
} {
  const canonical = resolveCanonicalCitizenId(rawCitizenId);
  if (!canonical) {
    return {
      store,
      pointsAwarded: 0,
      awardedTodayBonus: false,
      progress: getCitizenHeartProgress(0),
    };
  }
  const prev = getCitizenFriendshipRecord(store, canonical);
  const alreadyTalkedToday = prev.lastTalkDate === dateKey;
  const rawGain = alreadyTalkedToday ? 0 : CITIZEN_DAILY_TALK_BONUS_POINTS;
  const nextPoints = Math.min(CITIZEN_MAX_FRIENDSHIP_POINTS, prev.points + rawGain);
  const pointsAwarded = nextPoints - prev.points;
  const nextRecord: CitizenFriendshipRecord = {
    ...prev,
    points: nextPoints,
    lastTalkDate: dateKey,
    totalTalks: prev.totalTalks + 1,
  };
  const nextStore: CitizenFriendshipStore = {
    version: 1,
    records: {
      ...store.records,
      [canonical]: nextRecord,
    },
  };
  return {
    store: nextStore,
    pointsAwarded,
    awardedTodayBonus: !alreadyTalkedToday,
    progress: getCitizenHeartProgress(nextPoints),
  };
}

export type CitizenGiftPayload =
  | { kind: 'catalog'; giftId: string; giftLabel?: string }
  | { kind: 'fish'; fish: CaughtFishItem };

export function recordCitizenDailyGift(
  store: CitizenFriendshipStore,
  rawCitizenId: string,
  gift: CitizenGiftPayload,
  dateKey: string = getCitizenLocalDateKey(),
): {
  store: CitizenFriendshipStore;
  accepted: boolean;
  reason?: 'already_gifted_today' | 'unknown_citizen';
  tier: CitizenGiftReactionTier;
  pointsAwarded: number;
  reactionLine: string;
  progress: CitizenHeartProgress;
} {
  const canonical = resolveCanonicalCitizenId(rawCitizenId);
  const profile = canonical ? getCitizenProfile(canonical) : null;
  if (!canonical || !profile) {
    return {
      store,
      accepted: false,
      reason: 'unknown_citizen',
      tier: 'neutral',
      pointsAwarded: 0,
      reactionLine: 'Thank you!',
      progress: getCitizenHeartProgress(0),
    };
  }

  const prev = getCitizenFriendshipRecord(store, canonical);
  if (prev.lastGiftDate === dateKey) {
    return {
      store,
      accepted: false,
      reason: 'already_gifted_today',
      tier: 'neutral',
      pointsAwarded: 0,
      reactionLine: `${profile.name} already received a gift from you today. Come back tomorrow!`,
      progress: getCitizenHeartProgress(prev.points),
    };
  }

  let tier: CitizenGiftReactionTier;
  let basePoints: number;
  let giftLabel: string;

  if (gift.kind === 'fish') {
    const evalFish = evaluateCaughtFishGiftReaction(canonical, gift.fish);
    tier = evalFish.tier;
    basePoints = evalFish.points;
    giftLabel = `${gift.fish.speciesName} (${gift.fish.weightKg.toFixed(1)}kg)`;
  } else {
    tier = evaluateGiftReaction(canonical, gift.giftId);
    basePoints = CITIZEN_GIFT_REACTION_POINTS[tier];
    const catalogItem = CITIZEN_DAILY_GIFT_CATALOG.find((item) => item.id === gift.giftId);
    giftLabel = gift.giftLabel?.trim() || catalogItem?.label || gift.giftId;
  }

  const nextPoints = Math.min(CITIZEN_MAX_FRIENDSHIP_POINTS, prev.points + basePoints);
  const pointsAwarded = nextPoints - prev.points;
  const reactionPool = profile.dialogues.giftReactions[tier];
  const reactionLine = reactionPool[prev.totalGifts % reactionPool.length] ?? 'Thank you!';

  const nextRecord: CitizenFriendshipRecord = {
    ...prev,
    points: nextPoints,
    lastGiftDate: dateKey,
    totalGifts: prev.totalGifts + 1,
    lastGiftLabel: giftLabel,
  };
  const nextStore: CitizenFriendshipStore = {
    version: 1,
    records: {
      ...store.records,
      [canonical]: nextRecord,
    },
  };

  return {
    store: nextStore,
    accepted: true,
    tier,
    pointsAwarded,
    reactionLine,
    progress: getCitizenHeartProgress(nextPoints),
  };
}

export function pickCitizenContextualDialogue(params: {
  citizenId: string;
  hearts: number;
  timePhase?: 'day' | 'evening' | 'night';
  isRaining?: boolean;
  talkedCount?: number;
}): {
  greeting: string;
  roleTip: string;
  deepTalk: string | null;
} {
  const profile = getCitizenProfile(params.citizenId);
  if (!profile) {
    return {
      greeting: 'Nice to see you around Blitz City!',
      roleTip: 'Explore the Plaza, Harbor Pier, and Oasis Shoreline.',
      deepTalk: null,
    };
  }
  const index = Math.max(0, Math.floor(params.talkedCount ?? 0));
  const pool = params.isRaining
    ? profile.dialogues.greetings.rainy
    : profile.dialogues.greetings[params.timePhase ?? 'day'];
  const greeting = pool[index % pool.length] ?? profile.dialogues.greetings.day[0];
  const roleTip =
    profile.dialogues.roleTips[index % profile.dialogues.roleTips.length] ??
    profile.roleActionDescription;
  const deepTalk =
    params.hearts >= 2 && profile.dialogues.deepTalks.length > 0
      ? profile.dialogues.deepTalks[index % profile.dialogues.deepTalks.length]
      : null;

  return { greeting, roleTip, deepTalk };
}

export function listCitizenDirectory(
  store: CitizenFriendshipStore,
  dateKey: string = getCitizenLocalDateKey(),
): CitizenDirectoryEntry[] {
  return CITIZEN_PROFILES.map((profile) => {
    const record = getCitizenFriendshipRecord(store, profile.id);
    const progress = getCitizenHeartProgress(record.points);
    return {
      profile,
      record,
      progress,
      talkedToday: record.lastTalkDate === dateKey,
      giftedToday: record.lastGiftDate === dateKey,
    };
  });
}

export function getCitizenQuickPrompts(rawCitizenId: string): readonly string[] {
  const profile = getCitizenProfile(rawCitizenId);
  if (!profile) {
    return ['What do you do here?', 'What gifts do you like?', 'Any tips around town?'];
  }
  switch (profile.roleKey) {
    case 'fashion_stylist':
      return ['Open Streetwear Catalog', 'What gifts do you like?', 'Where do you hang out?'];
    case 'scooter_mechanic':
      return ['Check Scooter Garage', 'What gifts do you like?', 'Where are you jogging today?'];
    case 'oasis_angler':
      return ['Any fishing tips?', 'What fish do you love?', 'Tell me about NW Lake'];
    case 'arena_quartermaster':
      return ['Inspect Warzone Gate', 'What gifts do you like?', 'Any patrol stories?'];
    case 'city_guide':
      return ['Open Halte Transit Map', 'Where does everyone hang out?', 'What gifts do you like?'];
    case 'park_photographer':
      return ['Best photo spots?', 'Visit Coastal Harbor', 'Tell me a town story'];
    default:
      return [`About ${profile.districtLabel}`, 'What gifts do you like?', 'Any town stories?'];
  }
}

export function generateCitizenChatReply(params: {
  citizenId: string;
  userText: string;
  hearts: number;
  timePhase?: 'day' | 'evening' | 'night';
  isRaining?: boolean;
  talkedCount?: number;
}): {
  reply: string;
  suggestRoleAction: boolean;
} {
  const profile = getCitizenProfile(params.citizenId);
  if (!profile) {
    return {
      reply: 'Always good seeing a friendly face around Blitz City!',
      suggestRoleAction: false,
    };
  }

  const lower = params.userText.toLowerCase();
  const contextual = pickCitizenContextualDialogue({
    citizenId: profile.id,
    hearts: params.hearts,
    timePhase: params.timePhase,
    isRaining: params.isRaining,
    talkedCount: params.talkedCount,
  });

  if (/(gift|like|love|hadiah|suka|favorit)/.test(lower)) {
    return {
      reply: `If you want my honest favorites: ${profile.favoriteTags.join(', ')} always brighten my whole shift! Open the GIFT tab anytime when you have something to share.`,
      suggestRoleAction: false,
    };
  }

  if (
    /(open|buka|show|boutique|scooter|showroom|shop|toko|cafe|market|transit|halte|warzone|harbor|travel)/.test(
      lower,
    )
  ) {
    return {
      reply: profile.roleActionDescription,
      suggestRoleAction: true,
    };
  }

  if (/(story|cerita|secret|rahasia|heart|teman|friend|neighbor|warga)/.test(lower)) {
    if (contextual.deepTalk) {
      return {
        reply: contextual.deepTalk,
        suggestRoleAction: false,
      };
    }
    return {
      reply: `${profile.bio} Reach 2 Hearts with me (chat daily & bring a favorite gift) and I'll share more personal town stories!`,
      suggestRoleAction: false,
    };
  }

  if (/(where|dimana|lokasi|district|schedule|jadwal|who|siapa|role|kerja)/.test(lower)) {
    return {
      reply: `I'm ${profile.name}, ${profile.title} at ${profile.districtLabel}. ${profile.scheduleSummary}`,
      suggestRoleAction: false,
    };
  }

  if (/(fish|ikan|mancing|lake|danau|rod|ang)/.test(lower)) {
    const fishHint =
      profile.lovedFishZones.length > 0
        ? `I actually have a soft spot for fresh catch from ${profile.lovedFishZones.join(' & ')}!`
        : `Tari out at NW Fishing Lake and Kai at East Harbor are the true pros if you're hunting Rare or Trophy catches.`;
    return {
      reply: `${fishHint} ${contextual.roleTip}`,
      suggestRoleAction: profile.roleKey === 'oasis_angler' || profile.roleKey === 'fish_merchant',
    };
  }

  if (/(tip|tips|guide|cara|saran|weather|rain|hujan|malam|night)/.test(lower)) {
    return {
      reply: `${contextual.greeting} ${contextual.roleTip}`,
      suggestRoleAction: false,
    };
  }

  return {
    reply: `${contextual.greeting} ${contextual.roleTip}`,
    suggestRoleAction: false,
  };
}
