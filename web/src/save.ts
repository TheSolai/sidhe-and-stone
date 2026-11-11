/**
 * Persistence.
 *
 * Saves live in `localStorage` as JSON, versioned. Two details make the
 * round trip faithful:
 *
 *   * the RNG state is a uint64 and is stored as a STRING, because JSON
 *     numbers are doubles and would quietly corrupt the sequence;
 *   * the Godot save format is MIGRATED forward, so a player who already
 *     has a museum keeps it.
 *
 * The write is atomic in spirit: the payload is serialised and validated
 * before it replaces the stored one, so a crash mid-write cannot leave a
 * half-written save behind.
 */

import type { GameState } from './sim/game-state.ts';
import type { GameStateSnapshot } from './sim/game-state.ts';

const SAVE_KEY = 'sidhe-and-stone/save';
const SETTINGS_KEY = 'sidhe-and-stone/settings';

/** The version this build writes. */
export const SAVE_VERSION = 2;

interface SaveEnvelope {
  version: number;
  savedAt: string;
  payload: GameStateSnapshot;
}

/**
 * Migrate an older payload to the current shape.
 *
 * Version 1 was the Godot save format: `sim` held dictionaries with
 * string-keyed ints and no `ready_day` on in-progress digs. The migration
 * fills in the missing dig timers, which is why the Godot snapshot had to
 * keep them in the first place.
 */
function migrate(payload: unknown, fromVersion: number): GameStateSnapshot | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;

  if (fromVersion < 2) {
    const sim = (p.sim ?? {}) as Record<string, unknown>;
    const digging = (sim.digging ?? {}) as Record<string, unknown>;

    // Version 1 stored digs as {dig, ready_day} already, but as a nested
    // dictionary keyed by string site index. Normalise both shapes.
    const normalised: Record<string, { dig: string; ready_day: number }> = {};
    for (const [site, info] of Object.entries(digging)) {
      if (info && typeof info === 'object') {
        const d = info as { dig?: string; ready_day?: number };
        normalised[site] = {
          dig: String(d.dig ?? 'test_pit'),
          ready_day: Number(d.ready_day ?? 0),
        };
      }
    }
    sim.digging = normalised;

    // Older saves had no ledger entries beyond a plain array.
    if (!Array.isArray(p.ledger)) p.ledger = [];
  }

  if (!('sim' in p)) return null;
  return p as unknown as GameStateSnapshot;
}

/** Save the game. Returns true on success. */
export function saveGame(state: GameState): boolean {
  try {
    const envelope: SaveEnvelope = {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      payload: state.toDict(),
    };
    const body = JSON.stringify(envelope);

    // Validate the round trip before it replaces the stored save: a save
    // that cannot be read back is worse than no save at all.
    const check = JSON.parse(body) as SaveEnvelope;
    if (!check.payload || !check.payload.sim) return false;

    localStorage.setItem(SAVE_KEY, body);
    return true;
  } catch {
    // A failed save is a warning, not a crash. The player has other things
    // to do, and localStorage can be full or blocked.
    return false;
  }
}

/** Load the game into `state`. Returns true if a game was loaded. */
export function loadGame(state: GameState): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const envelope = JSON.parse(raw) as Partial<SaveEnvelope>;
    if (!envelope || typeof envelope !== 'object') return false;

    const version = Number(envelope.version ?? 0);
    if (version > SAVE_VERSION) {
      // A save from a newer build. Refuse rather than half-load it.
      return false;
    }

    const migrated = migrate(envelope.payload, version);
    if (!migrated) return false;

    state.fromDict(migrated);
    return true;
  } catch {
    return false;
  }
}

/** Is there a save to continue from? */
export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Delete the save slot. A fresh start must be genuinely fresh. */
export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do -- a save we cannot remove is not worth crashing over.
  }
}

export interface Settings {
  sound: boolean;
  music: boolean;
  /** Reduced motion: the reel stops spinning fast and the scene stops drifting. */
  reducedMotion: boolean;
  /** High-contrast mode: heavier outlines and stronger text contrast. */
  highContrast: boolean;
  showTutorial: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  sound: true,
  music: false,
  reducedMotion: false,
  highContrast: false,
  showTutorial: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Settings are a convenience; failing to persist them is not fatal.
  }
}
