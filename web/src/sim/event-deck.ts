/**
 * The event deck -- the day's weather.
 *
 * A literal transcription of `sim/event_deck.gd`.
 *
 * The EV RULE: events must not, on average, make the player richer or
 * poorer. Demand, theft and curation are chosen in symmetric pairs around
 * their neutral values, so events change the SHAPE of a day without
 * changing the SLOPE of a campaign. Charms are the one deliberate exception
 * -- a small flat windfall, asserted to stay under 0.25 charms a day.
 *
 * The REACTION RULE: an event is only interesting if the player can do
 * something about it, so each one changes a number the player already sees.
 *
 * ORDERING IS LOAD-BEARING: the draw walks the event table in declaration
 * order, so the table is an explicitly ordered array.
 */

import type { GodotRandom } from './rng.ts';

export interface EventDef {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly weight: number;
  readonly demand: number;
  readonly theft: number;
  readonly curation: number;
  readonly charm: number;
}

/** The deck. Order matters: it is the order the draw walks. */
export const EVENTS: readonly EventDef[] = [
  {
    id: 'fair_day',
    title: 'Fair Day',
    text: 'The village fair has come to town. Half the county is queueing at the door.',
    weight: 10,
    demand: 1.4,
    theft: 1.3,
    curation: 0,
    charm: 0,
  },
  {
    id: 'rain',
    title: 'Rain on the Cobbles',
    text: 'Rain all afternoon. The queue never formed, but the pickpockets loved it.',
    weight: 10,
    demand: 0.6,
    theft: 0.7,
    curation: 0,
    charm: 0,
  },
  {
    id: 'warded_night',
    title: "The Wardens Walk",
    text: 'The wardens patrol the galleries tonight. Nothing will go missing.',
    weight: 8,
    demand: 1.0,
    theft: 0.4,
    curation: 0,
    charm: 0,
  },
  {
    id: 'thief_moon',
    title: "Thief's Moon",
    text: 'There is a low red moon over the dig, and the town feels untrustworthy.',
    weight: 8,
    demand: 1.0,
    theft: 1.6,
    curation: 0,
    charm: 0,
  },
  {
    id: 'curator_holiday',
    title: "Curator's Holiday",
    text: 'One of the curators has taken the day. The storeroom will have to wait.',
    weight: 7,
    demand: 1.0,
    theft: 1.0,
    curation: -1,
    charm: 0,
  },
  {
    id: 'extra_hands',
    title: 'An Extra Pair of Hands',
    text: 'A volunteer has turned up to help catalogue. Twice the usual work.',
    weight: 7,
    demand: 1.0,
    theft: 1.0,
    curation: 1,
    charm: 0,
  },
  {
    id: 'museum_notice',
    title: 'A Notice in the Paper',
    text: 'A piece about the museum ran in the county paper. People are charmed by it.',
    weight: 8,
    demand: 1.0,
    theft: 1.0,
    curation: 0,
    charm: 2,
  },
  {
    id: 'quiet_day',
    title: 'An Ordinary Day',
    text: 'Nothing out of the ordinary. The gallery opens, and it opens again.',
    weight: 22,
    demand: 1.0,
    theft: 1.0,
    curation: 0,
    charm: 0,
  },
];

/** A rolled event, as the simulation sees it. */
export interface GameEvent {
  id: string;
  title: string;
  text: string;
  demand: number;
  theft: number;
  curation: number;
  charm: number;
}

/** Total weight of the deck. Used for the EV assertion. */
export function totalWeight(): number {
  let total = 0;
  for (const e of EVENTS) total += e.weight;
  return total;
}

/** Draw the next event, using the caller's RNG. */
export function rollEvent(rng: GodotRandom): GameEvent {
  const total = totalWeight();
  if (total <= 0) return describe('quiet_day');
  const pick = rng.randiRange(1, total);
  let acc = 0;
  for (const e of EVENTS) {
    acc += e.weight;
    if (pick <= acc) return describe(e.id);
  }
  return describe('quiet_day');
}

/** The event's multipliers, with the keys the simulation expects. */
export function describe(id: string): GameEvent {
  const def = EVENTS.find((e) => e.id === id) as EventDef;
  return {
    id: def.id,
    title: def.title,
    text: def.text,
    demand: def.demand,
    theft: def.theft,
    curation: def.curation,
    charm: def.charm,
  };
}

/**
 * A do-nothing event, used when the deck is switched off.
 *
 * "Off" has to mean "the ordinary day", not "some arbitrary different
 * event", or the deck's worth cannot be measured honestly.
 */
export function neutralEvent(): GameEvent {
  return {
    id: 'neutral',
    title: 'An Ordinary Day',
    text: 'Nothing out of the ordinary.',
    demand: 1.0,
    theft: 1.0,
    curation: 0,
    charm: 0,
  };
}

/**
 * Expected value of every multiplier across the whole deck.
 *
 * This is the number the balance harness asserts on. If the deck's expected
 * demand is not 1.0, events are quietly rebalancing the economy, and every
 * balance number measured through them is a number about the wrong game.
 */
export function expectedMultipliers(): {
  demand: number;
  theft: number;
  curation: number;
  charm: number;
} {
  const out = { demand: 0.0, theft: 0.0, curation: 0.0, charm: 0.0 };
  let total = 0;
  for (const e of EVENTS) {
    const w = e.weight;
    total += w;
    out.demand += e.demand * w;
    out.theft += e.theft * w;
    out.curation += e.curation * w;
    out.charm += e.charm * w;
  }
  if (total > 0) {
    out.demand /= total;
    out.theft /= total;
    out.curation /= total;
    out.charm /= total;
  }
  return out;
}
