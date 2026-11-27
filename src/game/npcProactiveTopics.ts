import type { ClosenessBand, NpcId } from './npcClosenessEngine';
import type { NpcEmotionTag } from './npcPersonaRegistry';
import type { NpcChatSituation } from './npcTextChat';

/**
 * Natural Proactive Topic Initiation Engine
 * =========================================
 * Gives Cerria's 7 named NPCs organic, persona-grounded, situation-aware
 * conversation starters so they don't passively wait for the player to carry
 * every chat.
 *
 * Used in two places:
 * 1. Instant local fallback when opening a fresh chat, resuming after a natural
 *    idle stretch, or when offline / without an active LLM key.
 * 2. Companion to `/api/npc-chat` (`mode: 'proactive_opener'`) so online Gemini
 *    starters stay grounded in the same sensory context and anti-repetition rules.
 *
 * STRICT RULE: Never expose closeness numbers, meters, hearts, or tier labels.
 */

export type ProactiveTopicTriggerReason =
  | 'chat_opened'
  | 'idle_pause'
  | 'activity_change'
  | 'qa_manual';

export interface ProactiveTopicRequestContext {
  npcId: NpcId;
  closenessBand: ClosenessBand;
  situation: NpcChatSituation;
  playerName?: string;
  recentOpenings?: readonly string[];
  triggerReason?: ProactiveTopicTriggerReason;
  seed?: number;
}

export interface ProactiveTopicResult {
  reply: string;
  emotion: NpcEmotionTag;
  topicKey: string;
}

interface TopicCandidate {
  key: string;
  text: string;
  emotion: NpcEmotionTag;
  /** Higher weight when situation matches. */
  weight: number;
}

function normalizeClauseKey(text: string): string {
  const clause = text.replace(/\s+/g, ' ').trim().split(/[.!?—\n]/)[0] ?? '';
  return clause
    .toLowerCase()
    .split(' ')
    .slice(0, 5)
    .join(' ');
}

function isWarmBand(band: ClosenessBand): boolean {
  return band === 'friendly' || band === 'close' || band === 'trusted';
}

function isCloseOrTrusted(band: ClosenessBand): boolean {
  return band === 'close' || band === 'trusted';
}

function buildPersonaCandidates(ctx: ProactiveTopicRequestContext): TopicCandidate[] {
  const { npcId, closenessBand: band, situation } = ctx;
  const place = (situation.placeLabel || 'Central Plaza').trim();
  const rainy = /rain|storm|drizzle/i.test(situation.weather || '');
  const evening = situation.timePhase === 'evening';
  const night = situation.timePhase === 'night';
  const activity = situation.activity;
  const warm = isWarmBand(band);
  const close = isCloseOrTrusted(band);
  const candidates: TopicCandidate[] = [];

  // Shared-activity situational starters (highest priority when hanging out together)
  if (activity === 'walking_with_player') {
    const walkMap: Record<NpcId, { text: string; emotion: NpcEmotionTag }> = {
      hana: {
        text: close
          ? `Walking past ${place} at this pace actually feels like a real break. Have you noticed any little corners of town lately that made you stop and look twice?`
          : `It is nice taking a slow lap around ${place} instead of rushing between errands. Where do you usually like to wander when you have a free afternoon?`,
        emotion: 'happy',
      },
      kai: {
        text: close
          ? `Walking off the pier with you is a solid change of scenery. Think we should swing by the water after ${place}, or see where the breeze takes us?`
          : `Good pace. Beats standing still on wet planks all day—got a favorite route around ${place}?`,
        emotion: 'happy',
      },
      mira: {
        text: close
          ? `Okay, walking through ${place} with you is officially better than my afternoon coffee break. If we detour for snacks right now, sweet or savory?`
          : `Love getting out from behind the espresso counter for a walk! Anything around ${place} catch your eye today?`,
        emotion: 'laugh',
      },
      nadia: {
        text: close
          ? `The light around ${place} is weirdly flattering right now—don't laugh, I can't turn my stylist brain off. What kind of look have you been wanting to try next?`
          : `Strolling through ${place} is honestly the best way to spot new street-style ideas. Notice any colors around here you'd actually wear?`,
        emotion: 'proud',
      },
      tari: {
        text: close
          ? `Walking around ${place} with you has me humming a totally new melody already. Be honest—are we keeping it chill today or looking for a bit of trouble?`
          : `The vibe out here around ${place} is too good to stay indoors! What kind of music matches a walk like this for you?`,
        emotion: 'laugh',
      },
      bima: {
        text: close
          ? `Good to stretch our legs away from the showroom. If you weren't wandering ${place} right now, where would you be heading?`
          : `Pavement's clean around ${place} today. Easy walk—got anywhere particular in mind, or just taking it slow?`,
        emotion: 'happy',
      },
      kenji: {
        text: close
          ? `Walking past ${place} without checking a timetable feels strangely liberating. Tell me—what has been on your mind today?`
          : `Taking the footpaths around ${place} is a nice change from watching the tram loop. Do you usually explore on foot or take the tram?`,
        emotion: 'happy',
      },
    };
    candidates.push({
      key: `${npcId}_walk_${place}`,
      text: walkMap[npcId].text,
      emotion: walkMap[npcId].emotion,
      weight: 5,
    });
  }

  if (activity === 'riding_as_passenger') {
    const rideMap: Record<NpcId, { text: string; emotion: NpcEmotionTag }> = {
      hana: {
        text: `The breeze past ${place} feels amazing from back here! Keep this smooth pace—where are you taking us next?`,
        emotion: 'happy',
      },
      kai: {
        text: `Not bad at all—almost feels like cutting across a calm harbor swell. You always take the corners around ${place} this clean?`,
        emotion: 'laugh',
      },
      mira: {
        text: `Haha, wind in my hair and zero espresso spills to worry about! Can we loop past the waterfront after ${place}?`,
        emotion: 'laugh',
      },
      nadia: {
        text: `Hold steady—I'm trying to keep my hair intact while actually enjoying the view past ${place}. Where's our next stop?`,
        emotion: 'shy',
      },
      tari: {
        text: `Oh, this breeze around ${place} is unreal! Feels like the opening scene of a music video—keep cruising!`,
        emotion: 'laugh',
      },
      bima: {
        text: `Suspension handles the bumps near ${place} nicely. Smooth throttle work—want to take the coastal loop next?`,
        emotion: 'proud',
      },
      kenji: {
        text: `Have to admit, cruising past ${place} with you beats waiting for the next tram arrival. Just keep an eye on the crosswalks, alright?`,
        emotion: 'happy',
      },
    };
    candidates.push({
      key: `${npcId}_ride_${place}`,
      text: rideMap[npcId].text,
      emotion: rideMap[npcId].emotion,
      weight: 6,
    });
  }

  if (activity === 'seated_on_bench') {
    const sitMap: Record<NpcId, { text: string; emotion: NpcEmotionTag }> = {
      hana: {
        text: close
          ? `Sitting here by ${place} with you makes the whole afternoon slow down in the best way. How has your day really been feeling?`
          : `This is one of my favorite spots near ${place} to catch a breath. Do you get many quiet pauses like this?`,
        emotion: 'happy',
      },
      kai: {
        text: `Good bench, solid view. Sometimes the smartest move in ${place} is just sitting back for five minutes—what's been keeping you busy lately?`,
        emotion: 'happy',
      },
      mira: {
        text: `Okay, sitting down for five minutes feels heavenly. Quick question while we people-watch in ${place}: if you could invent a drink for today's mood, what's in it?`,
        emotion: 'happy',
      },
      nadia: {
        text: `A quiet bench in ${place} is prime people-watching territory. Tell me something random you've been curious about lately.`,
        emotion: 'neutral',
      },
      tari: {
        text: `Rare moment of me sitting still in ${place}! Tell me a good story from your week before I start tapping a rhythm on the bench.`,
        emotion: 'laugh',
      },
      bima: {
        text: `Nice to just sit and listen to ${place} hum for a minute. You got plans for the rest of the day, or winging it?`,
        emotion: 'happy',
      },
      kenji: {
        text: `Even a station officer has to sit down now and then. How are things treating you around ${place} today?`,
        emotion: 'happy',
      },
    };
    candidates.push({
      key: `${npcId}_sit_${place}`,
      text: sitMap[npcId].text,
      emotion: sitMap[npcId].emotion,
      weight: 5,
    });
  }

  // Weather & time-of-day sensory starters
  if (rainy) {
    const rainLines: Record<NpcId, string> = {
      hana: close
        ? `Listen to that rain against the plaza awnings. Makes me want two warm mugs and a long talk—do you like rainy weather or prefer clear skies?`
        : `The rain makes ${place} look like a watercolor painting today. Are you staying dry out there, or do you actually enjoy walking in a drizzle?`,
      kai: `Rain on the water always shifts the bite window—half the harbor clears out, which honestly makes it peaceful. You mind getting caught in a shower?`,
      mira: `Rainy weather ALWAYS doubles the cinnamon roll cravings at Glasshouse Cafe! Tell me honestly—are you a hot mocha person or iced coffee even in the rain?`,
      nadia: `Rain is the ultimate stress test for a jacket silhouette. Have you noticed how much sharper the street colors look in ${place} when the pavement's wet?`,
      tari: `Rainy air gives the whole waterfront such a cozy acoustic-set mood! Makes me want to play something mellow—what's your go-to rainy-day song?`,
      bima: `Wet pavement around ${place} means taking turns a little wider on scooters. Good excuse to slow down with a strong coffee, though—how's your day holding up?`,
      kenji: `Rain always slows commuters down around the tram platform, so I'm keeping an extra eye on the timings. Staying warm and dry out here?`,
    };
    candidates.push({
      key: `${npcId}_rain`,
      text: rainLines[npcId],
      emotion: warm ? 'happy' : 'neutral',
      weight: 4,
    });
  } else if (evening || night) {
    const lateLines: Record<NpcId, string> = {
      hana: close
        ? `The warm lamp glow around ${place} at this hour is my favorite part of town. Did today turn out the way you hoped?`
        : `Everything in ${place} softens once the streetlamps flick on. Are you winding down for the evening or just getting started?`,
      kai: `Harbor air cools off fast after sunset—best time to hear the water without the daytime rush. Had a good day out there?`,
      mira: `Evening lights make the cafe windows glow so cozy! Between us, are you a night owl or an early-morning sunrise type?`,
      nadia: `Evening light around ${place} changes every fabric color completely—warm gold makes neutrals pop. Heading anywhere fun tonight?`,
      tari: close
        ? `The evening breeze always wakes my favorite part of the day up—especially when you're around. Wanna swap favorite late-night hangout spots?`
        : `Once the evening lights hit the waterfront, the whole mood lifts! Are you more of a live-music night person or quiet-stroll kind of evening?`,
      bima: `Streets around ${place} get calmer after dusk—honestly my favorite window for a smooth loop. How'd your day go?`,
      kenji: `Evening shift is quieter once the rush clears; I like hearing the last tram bells echo across ${place}. Been a busy day for you?`,
    };
    candidates.push({
      key: `${npcId}_${situation.timePhase}`,
      text: lateLines[npcId],
      emotion: close ? 'happy' : 'neutral',
      weight: 3.5,
    });
  }

  // Persona signature curiosity / conversation-starting topics scaled by closeness band
  const personaTopicBank: Record<NpcId, Array<{ key: string; text: string; emotion: NpcEmotionTag; minWarm?: boolean }>> = {
    hana: [
      {
        key: 'hana_cozy_corner',
        text: close
          ? `I was just sketching out a cozy sunlit reading nook and wondered what your dream room would look like. Big windows, warm wood, or something sleek and modern?`
          : `I've been helping folks picture their ideal corner in town today—if you could design your own little space from scratch, what vibe would you go for first?`,
        emotion: 'happy',
      },
      {
        key: 'hana_plaza_ritual',
        text: warm
          ? `Funny thing—I noticed everyone in ${place} has one tiny daily habit, like the bench they always pick or the coffee they order first. What's yours?`
          : `Central Plaza has a lot of hidden little shortcuts once you know where to look. Have you stumbled onto a favorite spot in town yet?`,
        emotion: 'happy',
      },
      {
        key: 'hana_pastries',
        text: `The bakery breeze drifting across ${place} today is dangerously distracting. If you had to pick one comfort snack for a slow afternoon, what wins?`,
        emotion: 'laugh',
      },
    ],
    kai: [
      {
        key: 'kai_tide_story',
        text: close
          ? `Spotted a huge shadow cruising past the reef line earlier—nearly dropped my coffee reaching for a rod. Ever have a moment in town that caught you totally off guard?`
          : `Water's unusually clear off the pier today—makes reading the current easy. You spend much time down by the coast, or mostly up in the plaza?`,
        emotion: 'proud',
      },
      {
        key: 'kai_food_banter',
        text: warm
          ? `Serious harbor question for you: fresh grilled catch by the sea breeze, or one of Hana's club sandwiches with an espresso?`
          : `Quiet stretch at the harbor right now. What brought you wandering down this way today?`,
        emotion: 'happy',
      },
      {
        key: 'kai_lake_vs_sea',
        text: `People always argue whether Oasis Lake or East Beach has the better view. Where do you land on that debate?`,
        emotion: 'neutral',
      },
    ],
    mira: [
      {
        key: 'mira_coffee_vibe',
        text: close
          ? `Okay, I tried pouring a leaf pattern on a caramel latte earlier and it turned out looking suspiciously like a tiny cloud. Tell me—what's been making you smile lately?`
          : `I'm testing a theory that you can tell someone's whole mood by what they crave in the afternoon. Coffee, something sweet, or straight-up fresh air?`,
        emotion: 'laugh',
      },
      {
        key: 'mira_people_watch',
        text: warm
          ? `Watching the plaza crowd from Glasshouse Cafe gives you the best stories—everyone's always on a mission. What's your mission today?`
          : `Welcome by! Between espresso shots I love hearing what folks around ${place} are up to—anything fun on your radar today?`,
        emotion: 'happy',
      },
      {
        key: 'mira_playlist',
        text: `I've been trying to refresh the afternoon cafe playlist without putting everyone to sleep. What kind of tracks do you put on when you want a good vibe?`,
        emotion: 'happy',
      },
    ],
    nadia: [
      {
        key: 'nadia_palette',
        text: close
          ? `Can I get your honest eye on something? I'm torn between warm earth tones and crisp coastal blues for next week's boutique display—which mood feels more right to you?`
          : `Good eye-level light out here in ${place} today. Tell me—do you dress for comfort first, or do you like making a bold statement?`,
        emotion: 'proud',
      },
      {
        key: 'nadia_details',
        text: warm
          ? `I swear, one well-chosen jacket or pair of shoes can flip someone's whole posture. What's one piece in your wardrobe you never get tired of?`
          : `People underestimate how much color balance changes a walk through the plaza. Have you browsed any new looks around town lately?`,
        emotion: 'happy',
      },
      {
        key: 'nadia_break',
        text: `Even perfectionists need five minutes away from fixing collars. How's your week been treating you outside the usual rush?`,
        emotion: 'neutral',
      },
    ],
    tari: [
      {
        key: 'tari_new_hook',
        text: close
          ? `I've had half an acoustic chorus stuck in my head since sunrise—something warm and breezy. Want to help me pick the vibe: sunset-nostalgic or upbeat beach party?`
          : `The sea breeze has such a good rhythm today! Are you more into lively crowd energy or a chill sunset spot by the pier?`,
        emotion: 'laugh',
      },
      {
        key: 'tari_spontaneous',
        text: warm
          ? `Be honest with me—if you had a totally free evening with zero plans, are we chasing live music, grabbing iced drinks, or taking a spontaneous coastal ride?`
          : `Hey! Always fun catching new energy around the waterfront—what's been the highlight of your day so far?`,
        emotion: 'happy',
      },
      {
        key: 'tari_crowd_story',
        text: `Half the fun of hosting at the beach club is seeing which song gets even the shyest person tapping their foot. What song gets you every time?`,
        emotion: 'happy',
      },
    ],
    bima: [
      {
        key: 'bima_routes',
        text: close
          ? `Tuned up two scooters before lunch and now I'm itching for a clean road loop. What's your favorite stretch of town when you just want to clear your head?`
          : `Quiet stretch outside the showroom. Do you prefer cruising around town on wheels, or taking the plaza footpaths slow?`,
        emotion: 'happy',
      },
      {
        key: 'bima_craft',
        text: warm
          ? `Funny how a squeaky brake or loose bolt bugs me until I fix it, even off shift. You got any little thing like that you're particular about?`
          : `Good weather for keeping tires gripping cleanly. Everything running smoothly on your end today?`,
        emotion: 'neutral',
      },
      {
        key: 'bima_espresso',
        text: `Debating whether it's a double-espresso afternoon or a quiet tennis-court walk later. How's your energy holding up today?`,
        emotion: 'happy',
      },
    ],
    kenji: [
      {
        key: 'kenji_quiet_spot',
        text: close
          ? `Off the record, once the commuter rush clears I like finding the quietest bench near the clock tower just to breathe. Where do you go in town when you want peace and quiet?`
          : `The tram loop is running right on the minute today, which leaves a rare quiet pocket. Have you explored all the districts along the line yet?`,
        emotion: 'happy',
      },
      {
        key: 'kenji_food',
        text: warm
          ? `After a tidy shift at the kiosk, a hot bowl of ramen or strong coffee feels earned. What's your go-to meal after a long day?`
          : `Good day around ${place}. Do you like planning your stops out in order, or just wandering wherever looks interesting?`,
        emotion: 'neutral',
      },
      {
        key: 'kenji_clock',
        text: `I check the clock tower out of habit, though I suppose not everyone lives by a timetable. How has the pace of your day been?`,
        emotion: 'happy',
      },
    ],
  };

  for (const item of personaTopicBank[npcId]) {
    candidates.push({
      key: item.key,
      text: item.text,
      emotion: item.emotion,
      weight: 2.0,
    });
  }

  return candidates;
}

/**
 * Selects a fresh, non-repeating proactive conversation starter grounded in
 * the NPC's persona, current world situation, and internal closeness band.
 */
export function buildLocalProactiveTopic(
  ctx: ProactiveTopicRequestContext,
): ProactiveTopicResult {
  const candidates = buildPersonaCandidates(ctx);
  const recentSet = new Set(
    (ctx.recentOpenings ?? []).map((op) => normalizeClauseKey(op)).filter(Boolean),
  );

  // Filter out any candidate whose opening clause matches a recent NPC opening.
  const fresh = candidates.filter((c) => !recentSet.has(normalizeClauseKey(c.text)));
  const pool = fresh.length > 0 ? fresh : candidates;

  // Sort highest situational weight first, then pick deterministically via seed within top band.
  const sorted = [...pool].sort((a, b) => b.weight - a.weight);
  const maxWeight = sorted[0]?.weight ?? 1;
  const topTier = sorted.filter((c) => c.weight >= maxWeight - 0.75);
  const seed = Math.abs(Math.floor(ctx.seed ?? Date.now() / 1000));
  const picked = topTier[seed % topTier.length] ?? sorted[0];

  return {
    reply: picked.text,
    emotion: picked.emotion,
    topicKey: picked.key,
  };
}
