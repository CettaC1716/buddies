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
    title: 'West Plaza Commercial & Lifestyle Manager',
    roleKey: 'cafe_barista',
    roleBadge: 'WEST PLAZA MANAGER',
    districtKey: 'glasshouse_cafe',
    districtLabel: 'West Plaza · Boutique, Real Estate & Mobility',
    accentColor: '#f59e0b',
    portraitEmoji: '🏛️',
    bio: 'Major NPC Manager overseeing West Plaza’s unified Fashion Boutique, Real Estate & Commercial Lot Leasing (N-01..S-08), and Urban Scooter Mobility Showroom.',
    scheduleSummary: 'Stationed at the West Plaza Commercial Promenade welcoming citizens & store owners.',
    favoriteTags: ['Roasted Espresso', 'Iced Matcha', 'Freshwater Fish'],
    lovedGiftIds: ['roasted_beans', 'iced_matcha'],
    likedGiftIds: ['sea_shell_charm', 'lure_feather'],
    lovedFishZones: ['central_oasis'],
    perkAtTwoHearts: 'Unlocks Commercial Avenue Leasing Insights & VIP Styling Notes',
    perkAtFourHearts: 'Close Confidant Status & West Plaza Flagship Patron Honor',
    roleActionLabel: 'Open West Plaza Catalog',
    roleActionDescription: 'Browse West Plaza Fashion Boutique, Real Estate Deeds, and Urban Mobility Scooters.',
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
        'Hop the Coastal Pier tram if you want to bounce swiftly back to Central Plaza.',
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
    title: 'Beach Club Security Guard',
    roleKey: 'arena_quartermaster',
    roleBadge: 'SECURITY',
    districtKey: 'beachfront_pier',
    districtLabel: 'Beach Club',
    accentColor: '#2563eb',
    portraitEmoji: '🛡️',
    bio: 'Dependable, easygoing Beach Club security guard who patrols the oceanfront promenade, lounge deck, and palm entrance keeping guests and performers safe.',
    scheduleSummary: 'Patrols the Beach Club south entrance, lounge deck, center boardwalk, and north palm promenade.',
    favoriteTags: ['Double Espresso', 'Iced Latte', 'Ocean Breeze'],
    lovedGiftIds: ['roasted_beans', 'chrome_wrench'],
    likedGiftIds: ['iced_matcha', 'tactical_patch'],
    lovedFishZones: [],
    perkAtTwoHearts: 'Shares Beach Club Security Tips & Best Sunset Spots',
    perkAtFourHearts: 'VIP Beach Club Promenade Pass',
    roleActionLabel: 'Travel to Beachfront Harbor',
    roleActionDescription: 'Fast-travel to the beachfront near Raka’s Beach Club patrol.',
    roleActionType: 'open_guide_map',
    roleActionStationId: 'beachfront_harbor',
    stationId: 'beachfront_harbor',
    homeCoords: { x: 86.0, z: 6.0 },
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
          'Coast is clear and the Beach Club deck is wide open—enjoy the sea breeze!',
          'Doing my morning round along the palms. Everything at the Beach Club stays relaxed on my watch.',
        ],
        evening: [
          'Sunset crowd is rolling in and Mira is warming up for her dance set—best hour at the Beach Club.',
          'Golden hour breeze off the shore makes standing watch down here easy.',
        ],
        night: [
          'Night lights along the Beach Club boardwalk keep the whole shore calm and safe.',
          'Quiet surf, steady music, clear perimeter—couldn’t ask for a better evening shift.',
        ],
        rainy: [
          'Boardwalk gets slick in coastal rain, so watch your footing along the Beach Club deck.',
          'Rain clears out the loud crowd, leaving just the sound of waves.',
        ],
      },
      deepTalks: [
        'People expect security to be stern, but half the job at the Beach Club is just making sure everyone feels welcome and safe.',
        'Looking out for the guests and dancers during busy evening sets is honestly a great way to spend the night.',
      ],
      roleTips: [
        'Drop by the Beach Club palm promenade anytime—I patrol from the south entrance to the north lounge.',
        'Need directions back to town? Open the City Transit map anytime.',
      ],
      giftReactions: {
        loved: ['Spot on! Between Beach Club patrols, this is literally my favorite thing in Cerria!'],
        liked: ['Hey, much obliged! That makes my beachfront watch feel twice as smooth.'],
        neutral: ['Oh, thank you! Always nice bumping into friendly faces at the Beach Club.'],
      },
    },
  },
  {
    id: 'city_plaza_nadia',
    name: 'Nadia',
    title: 'Central Plaza Hospitality & Community Manager',
    roleKey: 'park_photographer',
    roleBadge: 'CENTRAL PLAZA MANAGER',
    districtKey: 'central_plaza',
    districtLabel: 'Central Plaza · Vintage Cafe, Cozy Bites & Fountain Hub',
    accentColor: '#ec4899',
    portraitEmoji: '☕',
    bio: 'Major NPC Manager of Central Plaza. Hosts the Vintage Cafe & Roastery, Cozy Bites Pavilion, and Central Cascade Fountain social gatherings while curating the Central Plaza Flagship Catalog.',
    scheduleSummary: 'Hosts visitors around the Central Plaza Vintage Cafe, Cozy Bites Pavilion, and Civic Cascade Fountain.',
    favoriteTags: ['Caramel Latte', 'Single-Origin Roasts', 'Plaza Social Events'],
    lovedGiftIds: ['iced_matcha', 'sea_shell_charm'],
    likedGiftIds: ['roasted_beans', 'lure_feather'],
    lovedFishZones: ['central_oasis'],
    perkAtTwoHearts: 'Reveals Central Plaza Hospitality Secrets & Social Schedule',
    perkAtFourHearts: 'Featured Community Patron in Central Plaza Zine',
    roleActionLabel: 'Open Central Plaza Catalog',
    roleActionDescription: 'Order Artisan Roastery Coffee, Patisserie & Social Gifts from the Central Plaza Catalog.',
    roleActionType: 'open_fashion_boutique',
    roleActionStationId: 'central_plaza',
    stationId: 'central_plaza',
    homeCoords: { x: 20.8, z: 0.0 },
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
          'Welcome to Central Plaza! The Vintage Cafe roastery and Cozy Bites patio are in full swing right around the fountain.',
          'Looking for specialty coffee, patisserie gifts, or a place to meet friends? You can open the Central Plaza Catalog right from my menu!',
        ],
        evening: [
          'Golden hour around the Central Cascade Fountain is when the whole city gathers for espresso and evening strolls.',
          'The warm lights on the Vintage Cafe terrace and Cozy Bites pavilion make Central Plaza come alive every sunset.',
        ],
        night: [
          'Central Plaza stays warm and inviting all night—grab a reserve roast or check out the late crowd heading toward Grand Casino.',
          'Quiet evenings by the fountain and Wisteria Pond are the best time to unwind.',
        ],
        rainy: [
          'Rainy weather makes a hot pour-over from the Central Plaza Roastery taste twice as comforting!',
          'Step near the Vintage Cafe awning—I kept the terrace lanterns glowing through the drizzle.',
        ],
      },
      deepTalks: [
        'Being Central Plaza Manager means I get to watch everyone’s story intersect—from Hana’s entrepreneurs in West Plaza to Kai’s anglers returning from East Beach.',
        'Hana handles all the commercial lots and real estate over in West Plaza, while I keep Central Plaza’s cafes, hospitality, and community events thriving!',
      ],
      roleTips: [
        'Tap "Open Central Plaza Catalog" to browse our 3D roastery carafes, ceremonial matcha kits, and social gifts.',
        'Need to swap NEAR, RESPITE, or CerBucks? You can now do all currency exchanges directly inside your Smartphone Wallet!',
      ],
      giftReactions: {
        loved: ['No way!! This is hospitality perfection—thank you for bringing this to Central Plaza!'],
        liked: ['Ooh, super thoughtful! Definitely sharing this at the Vintage Cafe table.'],
        neutral: ['Wait, for me? Thank you so much—that genuinely brightened my Central Plaza shift!'],
      },
    },
  },
  {
    id: 'citizen_mira',
    name: 'Mira',
    title: 'Beach Club Dancer',
    roleKey: 'fashion_stylist',
    roleBadge: 'DANCER',
    districtKey: 'beachfront_pier',
    districtLabel: 'Beach Club',
    accentColor: '#c026d3',
    portraitEmoji: '💃',
    bio: 'Expressive Beach Club dancer who warms up along the palm promenade, rehearses choreography by the oceanfront lounge deck, and lights up golden-hour dance sets.',
    scheduleSummary: 'Rehearses, dances, and strolls along the Beach Club south entrance, lounge walk, center promenade, and north palms.',
    favoriteTags: ['Iced Latte', 'Beach Club Beats', 'Dance Choreography'],
    lovedGiftIds: ['iced_matcha', 'sea_shell_charm'],
    likedGiftIds: ['roasted_beans', 'lure_feather'],
    lovedFishZones: ['central_oasis'],
    perkAtTwoHearts: 'Shares Favorite Beach Club Playlists & Rhythm Tips',
    perkAtFourHearts: 'Sunset Beachfront Dance Partner',
    roleActionLabel: 'Open Streetwear Catalog',
    roleActionDescription: 'Preview & mix outfits Mira loves wearing for Beach Club sets.',
    roleActionType: 'open_fashion_boutique',
    stationId: 'beachfront_harbor',
    homeCoords: { x: 84.5, z: -14.0 },
    appearance: {
      modelVariant: 'female',
      baseGlbVariant: 'player',
      clothingTintHex: '#c026d3',
      idleOverrideClip: 'mira_idle.001',
      walkOverrideClip: 'mira_walk.001',
      runOverrideClip: 'mira_run.001',
      sitOverrideClip: 'mira_sit.001',
    },
    dialogues: {
      greetings: {
        day: [
          'Ocean breeze along the Beach Club palms is the best warmup before rehearsal!',
          'Just working through a new footwork combo down by the lounge deck—care to watch?',
        ],
        evening: [
          'Sunset amber over the water makes the whole Beach Club dance floor feel electric.',
          'Catching my breath between sets along the boardwalk—best view in town.',
        ],
        night: [
          'Moonlit waves and soft lounge beats after the evening set—this is my favorite hour.',
          'Strolling the quiet Beach Club shore to cool down after dancing.',
        ],
        rainy: [
          'A little sea mist never stops a good rhythm—just keeps the boardwalk dramatic!',
          'Rainy beats by the ocean give every routine a cool new mood.',
        ],
      },
      deepTalks: [
        'Dancing out by the ocean feels completely free—every sunset brings a fresh tempo and new faces.',
        'Raka keeps an eye on the boardwalk while I rehearse, so the Beach Club always feels like home.',
      ],
      roleTips: [
        'Swing by the Beach Club palm promenade anytime to catch my sets or go for a shore walk!',
        'Need fresh outfit inspiration? Open the Streetwear Catalog anytime!',
      ],
      giftReactions: {
        loved: ['Obsessed!! Look at that vibe—you seriously know how to spoil a Beach Club dancer!'],
        liked: ['Ooh, sweet pick! That is going to keep my energy high through rehearsal.'],
        neutral: ['Sweet of you to come all the way down to the Beach Club with a gift—thank you!'],
      },
    },
  },
  {
    id: 'citizen_bima',
    name: 'Bima',
    title: 'City Citizen',
    roleKey: 'scooter_mechanic',
    roleBadge: 'CITIZEN',
    districtKey: 'central_plaza',
    districtLabel: 'Cerria City · North & South Shops',
    accentColor: '#ea580c',
    portraitEmoji: '⚡',
    bio: 'Easygoing Cerria citizen who roams every corner of the city—strolling through the North and South Shopping Districts, grabbing espresso at Glasshouse Cafe, and relaxing by Oasis Lake.',
    scheduleSummary: 'Roams citywide between Glasshouse Cafe, North Shopping Avenue, Central Plaza, South Shopping Avenue, Oasis Lake, and the waterfront.',
    favoriteTags: ['Double Espresso', 'City Walks', 'North & South Shops'],
    lovedGiftIds: ['chrome_wrench', 'roasted_beans'],
    likedGiftIds: ['tactical_patch', 'iced_matcha'],
    lovedFishZones: [],
    perkAtTwoHearts: 'Shares Fast Cross-City Shortcuts & Shop Spots',
    perkAtFourHearts: 'Favorite Evening Stroll & Ride Companion',
    roleActionLabel: 'View Urban Scooter Garage',
    roleActionDescription: 'Browse urban scooters if you want to cruise the city faster than walking.',
    roleActionType: 'open_scooter_shop',
    stationId: 'central_plaza',
    homeCoords: { x: -52.4, z: -70.3 },
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
          'Just finished a crisp walk past the North Shopping Avenue—every block in Cerria has its own rhythm.',
          'Roaming from Glasshouse Cafe through Central Plaza down to the South Shops today.',
        ],
        evening: [
          'Golden hour breeze across the South Shopping District feels unreal after a full city loop!',
          'Another full circuit across town complete—checking out sunset before calling it a day.',
        ],
        night: [
          'Cool night air is prime weather for wandering the lit avenues cleanly.',
          'Grabbed an espresso earlier, so I still have energy for one more walk across town!',
        ],
        rainy: [
          'Careful on wet brick around the shopping avenues—rain keeps the city shining though.',
          'A bit of coastal drizzle never stops my city loop.',
        ],
      },
      deepTalks: [
        'I love roaming every block of the city—from quiet benches by Oasis Lake to the lively North and South shop rows.',
        'Kenji and I keep crossing paths along the shopping boulevards—good company makes the city feel even better.',
      ],
      roleTips: [
        'Grabbing a scooter from the garage menu cuts cross-city travel time in half!',
        'Take a walk down both the North and South Shopping Avenues whenever you want to see what is new in town.',
      ],
      giftReactions: {
        loved: ['Yo!! Now THAT is top-tier—made my whole cross-city walk worth it!'],
        liked: ['Awesome, thanks! Always comes in clutch on long city loops.'],
        neutral: ['Hey, appreciate you catching up with me out here! See you around town!'],
      },
    },
  },
  {
    id: 'citizen_tari',
    name: 'Tari',
    title: 'Glasshouse Cafe Staff',
    roleKey: 'cafe_barista',
    roleBadge: 'CAFE STAFF',
    districtKey: 'glasshouse_cafe',
    districtLabel: 'Glasshouse Cafe · West Plaza',
    accentColor: '#0d9488',
    portraitEmoji: '☕',
    bio: 'Warm, upbeat staff member at Glasshouse Cafe in West Plaza who steps in and out of the cafe counter, picks up fresh pastries and iced lattes, and relaxes on the West Plaza benches.',
    scheduleSummary: 'Works inside Glasshouse Cafe and walks in and out to West Plaza terrace, pastry counter, and sunlit plaza benches.',
    favoriteTags: ['Iced Latte', 'Fresh Croissants', 'West Plaza Benches'],
    lovedGiftIds: ['iced_matcha', 'roasted_beans'],
    likedGiftIds: ['sea_shell_charm', 'lure_feather'],
    lovedFishZones: ['central_oasis'],
    perkAtTwoHearts: 'Shares Glasshouse Cafe Specials & Cozy West Plaza Seats',
    perkAtFourHearts: 'Favorite West Plaza Coffee Date Companion',
    roleActionLabel: 'Open Glasshouse Cafe',
    roleActionDescription: 'Visit Glasshouse Cafe in West Plaza for fresh coffee and warm pastries.',
    roleActionType: 'open_cafe_work',
    roleActionStationId: 'central_plaza',
    stationId: 'central_plaza',
    homeCoords: { x: -87.45, z: 16.2 },
    appearance: {
      modelVariant: 'female',
      baseGlbVariant: 'player',
      clothingTintHex: '#0d9488',
      idleOverrideClip: 'tari_idle.001',
      walkOverrideClip: 'tari_walk.001',
      runOverrideClip: 'tari_run.001',
      sitOverrideClip: 'tari_sit.001',
    },
    dialogues: {
      greetings: {
        day: [
          'Just stepped out of Glasshouse Cafe with a fresh croissant—West Plaza looks so bright today!',
          'Welcome around West Plaza! Grab an iced latte or come sit on the bench with me for a break.',
        ],
        evening: [
          'Evening lights outside Glasshouse Cafe make West Plaza feel super warm and cozy.',
          'Catching my breath on the West Plaza bench with a warm mocha after the afternoon rush.',
        ],
        night: [
          'Soft lanterns along West Plaza and the Clock Tower bench are my favorite way to unwind after a cafe shift.',
          'Always peaceful sitting outside Glasshouse Cafe once the evening settles in.',
        ],
        rainy: [
          'Glasshouse Cafe is the coziest sanctuary whenever coastal rain hits the West Plaza cobblestones!',
          'Watching raindrops on the conservatory roof with a warm latte—pure calm.',
        ],
      },
      deepTalks: [
        'I love stepping in and out of Glasshouse Cafe all day—brewing drinks inside, then sitting on West Plaza benches to chat with neighbors.',
        'Half the fun of working at West Plaza is spotting friendly faces passing by between shifts.',
      ],
      roleTips: [
        'Step inside Glasshouse Cafe anytime for fresh lattes, croissants, and warm cinnamon rolls!',
        'You can usually catch me right inside Glasshouse Cafe or sitting on the West Plaza benches nearby.',
      ],
      giftReactions: {
        loved: ['Oh, amazing! That is going straight to the top of my cafe break list—thank you!'],
        liked: ['How thoughtful of you! That made my West Plaza shift even brighter.'],
        neutral: ['Thank you kindly! Always lovely seeing you around Glasshouse Cafe!'],
      },
    },
  },
  {
    id: 'citizen_kenji',
    name: 'Kenji',
    title: 'City Citizen',
    roleKey: 'city_guide',
    roleBadge: 'CITIZEN',
    districtKey: 'central_plaza',
    districtLabel: 'Cerria City · North & South Shops',
    accentColor: '#dc2626',
    portraitEmoji: '🏙️',
    bio: 'Thoughtful, polite Cerria citizen who roams across every district—strolling the North and South Shopping Boulevards, stopping for croissants in Central Plaza, and relaxing by Oasis Lake.',
    scheduleSummary: 'Roams citywide through the North Shopping Boulevard, Central Plaza, South Shopping Boulevard, West Plaza Clock Tower, and Oasis Lake.',
    favoriteTags: ['Butter Croissants', 'Strong Espresso', 'City Walks'],
    lovedGiftIds: ['roasted_beans', 'lure_feather'],
    likedGiftIds: ['iced_matcha', 'chrome_wrench'],
    lovedFishZones: ['central_oasis'],
    perkAtTwoHearts: 'Shares Peaceful Scenic Walking Routes Across Town',
    perkAtFourHearts: 'Trusted Evening Stroll & Coffee Date Partner',
    roleActionLabel: 'Open City Transit Map',
    roleActionDescription: 'Fast-travel between plazas, shopping avenues, and parks.',
    roleActionType: 'open_guide_map',
    roleActionStationId: 'central_plaza',
    stationId: 'central_plaza',
    homeCoords: { x: 7.6, z: -70.3 },
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
          'Good day. Taking a quiet walk along the North and South shopping avenues—lovely weather across Cerria.',
          'Every district has something worth noticing when you walk through at an unhurried pace.',
        ],
        evening: [
          'Evening lantern light along the Clock Tower and shopping boulevards looks wonderfully calm.',
          'Grabbed a coffee and croissant earlier—now just enjoying a slow sunset stroll.',
        ],
        night: [
          'Night air by Oasis Lake and the avenues is remarkably peaceful.',
          'Always nice crossing paths with a familiar face on an evening walk.',
        ],
        rainy: [
          'Rain softens the whole city—walking under the shop awnings keeps things cozy.',
          'Wet stone reflects the streetlamps nicely along the avenues.',
        ],
      },
      deepTalks: [
        'I enjoy wandering freely around Cerria without rushing—checking out the north and south shops, pausing at cafes, and taking in the breeze.',
        'Honestly, even the nicest walking loop feels twice as good when you share it with someone you care about.',
      ],
      roleTips: [
        'Explore both the North and South Shopping Districts—the wide sidewalks make for a great loop.',
        'If you ever want a quiet break, the Clock Tower and Oasis Lake benches are unbeatable.',
      ],
      giftReactions: {
        loved: ['Oh—thank you very much! That is remarkably thoughtful of you.'],
        liked: ['Very kind of you to bring this along on our walk—much appreciated.'],
        neutral: ['Thank you kindly. Always pleasant crossing paths around the city!'],
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
      return ['Open City Transit Map', 'Where does everyone hang out?', 'What gifts do you like?'];
    case 'park_photographer':
      return ['Open Central Plaza Catalog', 'Where is everyone hanging out?', 'What gifts do you like?'];
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
