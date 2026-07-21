/**
 * Storage.js
 * ---------------------------------------------------------------------------
 * Thin, defensive wrapper over LocalStorage for persisting user settings.
 * Falls back to in-memory defaults if storage is unavailable (private mode,
 * file:// restrictions, etc.) so the game never crashes.
 * ---------------------------------------------------------------------------
 */
import { STORAGE_KEY, DEFAULT_SETTINGS } from './constants.js';

export const Storage = {
  /** Load persisted settings merged over the defaults. */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  },

  /** Persist a settings object (best-effort). */
  save(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* ignore write failures */
    }
  },
};
