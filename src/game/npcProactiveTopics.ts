import type { ClosenessBand, NpcId } from './npcClosenessEngine';
import type { NpcEmotionTag } from './npcPersonaRegistry';
import type { NpcChatSituation } from './npcTextChat';

/**
 * Natural Proactive Topic Initiation Engine
 * =========================================
 * Gives Cerria's 8 named NPCs organic, persona-grounded, situation-aware
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
          ? `Catching a quiet moment near ${place} with you actually feels like a real break. Have you noticed any little corners of town lately that made you stop and look twice?`
          : `It is nice taking a breather around ${place} instead of rushing between errands. Where do you usually like to wander when you have a free afternoon?`,
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
          ? `Okay, walking through ${place} with you is officially better than any rehearsal break. If we detour for snacks right now, iced drink or something sweet?`
          : `Love stretching my legs past ${place} between Beach Club dance sets! Anything around here catch your eye today?`,
        emotion: 'laugh',
      },
      nadia: {
        text: close
          ? `The light around ${place} is weirdly flattering right now—don't laugh, I can't turn my stylist brain off. What kind of mood have you been in today?`
          : `Taking a breather around ${place} is honestly the best way to notice everyday details. Anything fun happen in your week so far?`,
        emotion: 'proud',
      },
      tari: {
        text: close
          ? `Walking around ${place} with you beats every cafe break I have ever taken. Be honest—are we grabbing pastries next or just wandering wherever the breeze goes?`
          : `So nice getting fresh air around ${place} outside Glasshouse Cafe! What kind of afternoon vibe are you in today?`,
        emotion: 'laugh',
      },
      bima: {
        text: close
          ? `Good to stretch our legs around ${place} together. If we keep roaming town right now, north shops, south avenues, or somewhere quiet?`
          : `Streets feel clean and calm around ${place} today. Easy walk—got anywhere particular in mind, or just taking it slow?`,
        emotion: 'happy',
      },
      kenji: {
        text: close
          ? `Walking past ${place} with you makes every block of the city feel quieter in the best way. Tell me—what has been on your mind today?`
          : `Taking the footpaths around ${place} is always a pleasant change of pace. Do you have a favorite shopping street or park in Cerria?`,
        emotion: 'happy',
      },
      raka: {
        text: close
          ? `Walking away from the Beach Club gate with you is honestly the best break I could ask for. Where do you feel like heading next?`
          : `Good pace around ${place}. Nice getting off the boardwalk for a bit—what have you been up to today?`,
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
        text: `The breeze past ${place} feels amazing! Keep this smooth pace—where are you heading next?`,
        emotion: 'happy',
      },
      kai: {
        text: `Not bad at all—almost feels like cutting across a calm harbor swell. You always take the corners around ${place} this clean?`,
        emotion: 'laugh',
      },
      mira: {
        text: `Haha, wind in my hair and the whole coast rushing past! Can we loop by the Beach Club shoreline after ${place}?`,
        emotion: 'laugh',
      },
      nadia: {
        text: `Hold steady—I'm trying to keep my hair intact while actually enjoying the view past ${place}. Where's our next stop?`,
        emotion: 'shy',
      },
      tari: {
        text: `Oh, this breeze around ${place} is unreal! Way better than wiping down espresso cups—keep cruising!`,
        emotion: 'laugh',
      },
      bima: {
        text: `Suspension handles the avenues near ${place} nicely. Smooth throttle work—want to loop past the north and south shops next?`,
        emotion: 'proud',
      },
      kenji: {
        text: `Have to admit, cruising past ${place} with you is wonderfully relaxing. Just keep an eye on the crosswalks, alright?`,
        emotion: 'happy',
      },
      raka: {
        text: `Haha, riding passenger past ${place} beats standing watch all afternoon! Nice handling—where to next?`,
        emotion: 'laugh',
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
        text: `Okay, sitting down for five minutes after dancing feels heavenly. Quick question while we chill in ${place}: what song has been stuck in your head lately?`,
        emotion: 'happy',
      },
      nadia: {
        text: `A quiet bench in ${place} is prime people-watching territory. Tell me something random you've been curious about lately.`,
        emotion: 'neutral',
      },
      tari: {
        text: `My favorite West Plaza break right here in ${place}! Tell me a good story from your week while we catch the breeze.`,
        emotion: 'laugh',
      },
      bima: {
        text: `Nice to just sit and listen to ${place} hum for a minute. You got plans for the rest of the day, or winging it?`,
        emotion: 'happy',
      },
      kenji: {
        text: `A quiet bench in ${place} is always welcome after walking half the city. How are things treating you today?`,
        emotion: 'happy',
      },
      raka: {
        text: `Rare moment of sitting down off patrol in ${place}! Feels good—tell me what has been the best part of your day so far.`,
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
      mira: `Rain along the Beach Club palms gives the whole shoreline such a moody dance-video vibe! Do you love rainy evenings or wish the sun was out?`,
      nadia: `Rain makes the whole street glow completely differently. Outside of staying dry, what is your favorite rainy-day comfort ritual?`,
      tari: `Rainy weather ALWAYS doubles the cinnamon roll cravings at Glasshouse Cafe! Tell me honestly—are you a hot mocha person or iced coffee even in the rain?`,
      bima: `Wet pavement around ${place} slows the whole city down in a nice way. Good excuse for a strong coffee, though—how's your day holding up?`,
      kenji: `Rain makes the shopping avenues and parks smell remarkably fresh. Staying warm and dry on your walk today?`,
      raka: `Rain keeps the Beach Club boardwalk super calm—just waves and neon reflections. You mind getting caught in a coastal shower?`,
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
      mira: close
        ? `Sunset lights at the Beach Club always wake my favorite part of the day up—especially when you're here. Wanna swap favorite late-night hangout spots?`
        : `Once the evening lights hit the Beach Club deck, the whole mood lifts! Are you more of a music-and-dancing night person or quiet-stroll kind of evening?`,
      nadia: `Evening light around ${place} softens the whole plaza completely. Forget work for a second—doing anything relaxing tonight?`,
      tari: `Evening lights make the Glasshouse Cafe windows glow so cozy! Between us, are you a night owl or an early-morning sunrise type?`,
      bima: `Streets around ${place} get calmer after dusk—honestly my favorite window for wandering town. How'd your day go?`,
      kenji: `Evening walks across the city are much quieter once the afternoon bustle fades. Been a good day for you so far?`,
      raka: close
        ? `Beach Club breeze cools down right after sunset—always makes me glad when you drop by. How did your day turn out?`
        : `Evening lights along the Beach Club shore are hard to beat. Winding down for the night or just getting your evening started?`,
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
          ? `I was just daydreaming about quiet getaways and wondered—if you had a whole free weekend with zero obligations, what would you do first?`
          : `Taking a tiny mental break from plaza errands—if you could design your ideal relaxing afternoon anywhere in town, what would it look like?`,
        emotion: 'happy',
      },
      {
        key: 'hana_plaza_ritual',
        text: warm
          ? `Funny thing—I noticed everyone in ${place} has one tiny daily habit, like the bench they always pick or the snack they crave first. What's yours?`
          : `Central and West Plaza both have hidden little corners once you slow down. Have you stumbled onto a favorite spot in town yet?`,
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
          ? `Serious harbor question for you: fresh grilled catch by the sea breeze, or a club sandwich with a strong espresso?`
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
        key: 'mira_dance_vibe',
        text: close
          ? `I've been working out a new sunset dance routine down at the Beach Club, and I keep catching myself wondering what song you'd pick for us. Upbeat or slow and dreamy?`
          : `The sea breeze has such a good rhythm at the Beach Club today! Are you more into lively crowd energy or a chill sunset walk by the waves?`,
        emotion: 'laugh',
      },
      {
        key: 'mira_spontaneous',
        text: warm
          ? `Be honest with me—if you had a totally free evening after my set, are we grabbing iced drinks, dancing by the shore, or cruising around town?`
          : `Hey! Always fun catching fresh energy around the Beach Club—what's been the highlight of your day so far?`,
        emotion: 'happy',
      },
      {
        key: 'mira_playlist',
        text: `Half the fun of dancing at the Beach Club is finding that one track nobody can sit still to. What kind of music always puts you in a good mood?`,
        emotion: 'happy',
      },
    ],
    nadia: [
      {
        key: 'nadia_off_work',
        text: close
          ? `Can I step away from boutique talk for a second? Tell me honestly—what is something random you've been really into lately, music, food, anything?`
          : `Good light out here in ${place} today, though I promise I won't lecture you on jackets. What has been keeping your week interesting lately?`,
        emotion: 'happy',
      },
      {
        key: 'nadia_details',
        text: warm
          ? `I swear, one great playlist or a quiet iced latte can flip my whole mood in five minutes. What's your instant mood-lifter?`
          : `Even when the plaza gets lively, I love hearing what folks around town are up to. Exploring anywhere fun today?`,
        emotion: 'happy',
      },
      {
        key: 'nadia_break',
        text: `Even perfectionists need five minutes away from work. How's your week been treating you outside the usual rush?`,
        emotion: 'neutral',
      },
    ],
    tari: [
      {
        key: 'tari_coffee_vibe',
        text: close
          ? `Okay, I just stepped out of Glasshouse Cafe with a fresh latte and saved half my break hoping you'd wander past West Plaza. Tell me—what's been making you smile lately?`
          : `I'm testing a theory at Glasshouse Cafe that you can tell someone's whole mood by their afternoon craving. Coffee, warm pastry, or straight-up fresh air?`,
        emotion: 'laugh',
      },
      {
        key: 'tari_west_plaza',
        text: warm
          ? `Sitting out on the West Plaza benches between cafe runs gives you the best stories—everyone's always on a mission. What's your mission today?`
          : `Hey! Always fun seeing friendly faces around West Plaza and Glasshouse Cafe—anything fun on your radar today?`,
        emotion: 'happy',
      },
      {
        key: 'tari_playlist',
        text: `I've been trying to refresh my after-shift playlist for relaxing out on the plaza benches. What kind of tracks do you put on when you want a good vibe?`,
        emotion: 'happy',
      },
    ],
    bima: [
      {
        key: 'bima_routes',
        text: close
          ? `Walked from the north shops all the way down toward the south avenues today, and honestly the best part is still running into you. Where's your favorite stretch of town to clear your head?`
          : `Just looping across town between the shopping districts and the plazas. Do you prefer cruising around on a scooter, or taking the avenues slow on foot?`,
        emotion: 'happy',
      },
      {
        key: 'bima_craft',
        text: warm
          ? `Funny how wandering every block makes you notice all the tiny details—good street snacks, quiet benches, sunset angles. Found any hidden gems in Cerria lately?`
          : `Good weather for roaming around town today. Everything running smoothly on your end?`,
        emotion: 'neutral',
      },
      {
        key: 'bima_espresso',
        text: `Debating whether it's a double-espresso afternoon or a slow walk by Oasis Lake later. How's your energy holding up today?`,
        emotion: 'happy',
      },
    ],
    kenji: [
      {
        key: 'kenji_quiet_spot',
        text: close
          ? `Off the record, after strolling past the north and south shopping rows I love finding a quiet bench just to breathe—especially with you. Where do you go in town when you want peace and quiet?`
          : `The north and south shopping avenues are wonderfully lively today, while the parks stay calm. Have you explored all the districts around Cerria yet?`,
        emotion: 'happy',
      },
      {
        key: 'kenji_food',
        text: warm
          ? `After a long city walk, a warm bowl of ramen or a crisp croissant with strong coffee always feels earned. What's your go-to meal after a full day?`
          : `Good day around ${place}. Do you like planning your stops out in order, or just wandering wherever looks interesting?`,
        emotion: 'neutral',
      },
      {
        key: 'kenji_pace',
        text: `I used to rush everywhere on a strict schedule, but strolling the city at an easy pace has grown on me. How has the rhythm of your day been?`,
        emotion: 'happy',
      },
    ],
    raka: [
      {
        key: 'raka_beach_watch',
        text: close
          ? `Keeping watch at the Beach Club is easy when the waves are calm, though I admit I check the entrance twice whenever I think you might stop by. How's your day going?`
          : `Breeze off the Beach Club boardwalk is solid today. Came down for the ocean view, the music, or just getting away from the busy avenues?`,
        emotion: 'happy',
      },
      {
        key: 'raka_off_duty',
        text: warm
          ? `Between rounds I'm always thinking about what to eat after my shift—something spicy or a huge late-night snack. What's your go-to comfort food?`
          : `Quiet stretch along the Beach Club deck right now. Anything interesting happen around town today?`,
        emotion: 'laugh',
      },
      {
        key: 'raka_sunset',
        text: `Best perk of Beach Club security is getting front-row seats to every ocean sunset. You more of a beach person or a city-plaza person?`,
        emotion: 'proud',
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
