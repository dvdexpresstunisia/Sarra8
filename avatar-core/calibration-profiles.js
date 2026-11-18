/**
 * Named, versioned calibration profiles for the Sarra Studio.
 *
 * The store owns the "HUMAN NATURAL V1" default profile, additional presets,
 * the operator's custom profiles and an automatic backup history. It is pure
 * data: no DOM, no network, no Three.js, so it runs in the browser, in the
 * Electron renderer and in `node --test` with an injected storage object.
 *
 * Rule enforced by the store: a profile flagged `validated` is never overwritten
 * without first archiving an exact copy of the previous values.
 */
import { validateCalibrationParameters } from './calibration-profile.js';

export const PROFILE_STORE_SCHEMA = 'sarra-calibration-store';
export const PROFILE_STORE_VERSION = 1;
export const PROFILE_EXPORT_SCHEMA = 'sarra-calibration-profile-export';
export const HUMAN_NATURAL_V1_ID = 'human-natural-v1';
export const HUMAN_NATURAL_V2_ID = 'human-natural-v2';

const clone = (value) => structuredClone(value);

const freezeRecord = (record) => Object.freeze({
  ...record,
  parameters: Object.freeze({ ...record.parameters }),
  transitions: Object.freeze({ ...record.transitions }),
});

/**
 * HUMAN NATURAL V1 — the reference calibration shipped with the porcelain
 * avatar. Values stay inside the ±20 % safety window enforced by the core.
 * Mouth morphs are only scaled through emotionScales/visemeScales so that
 * emotions can never fight the lip-sync layer.
 */
export const HUMAN_NATURAL_V1 = freezeRecord({
  id: HUMAN_NATURAL_V1_ID,
  label: 'HUMAN NATURAL V1',
  version: 1,
  builtin: true,
  validated: true,
  description:
    'Profil par défaut du visage porcelaine : expressions posées, transitions douces, ' +
    'priorité au lipsync. Aucune émotion ne pilote jawOpen ni les morphs de phonèmes.',
  createdAt: '2026-11-11T00:00:00.000Z',
  parameters: {
    emotionScales: {
      neutre: 1,
      joie: 1,
      tristesse: 0.96,
      colere: 0.94,
      surprise: 0.92,
      peur: 0.9,
      degout: 0.9,
      tendresse: 1,
      concentration: 1,
    },
    visemeScales: { AA: 1.02, IH: 1, OU: 0.98, EE: 1, OH: 1, P: 1, F: 1 },
    jawScale: 1,
    gazeScale: 1,
    blinkScale: 1,
  },
  transitions: {
    emotionScale: 1.05,
    visemeScale: 1,
    gazeSmoothingScale: 1.05,
    blinkDurationScale: 1.05,
  },
});

/**
 * HUMAN NATURAL V2 — slightly more expressive, with softer/slower fades.
 * Kept as a separate record so V1 can always be restored untouched.
 */
export const HUMAN_NATURAL_V2 = freezeRecord({
  id: HUMAN_NATURAL_V2_ID,
  label: 'HUMAN NATURAL V2',
  version: 2,
  builtin: true,
  validated: true,
  description:
    'Variante expressive : sourire et étonnement un peu plus marqués, mâchoire légèrement ' +
    'plus mobile, transitions encore plus progressives.',
  createdAt: '2026-11-11T00:00:00.000Z',
  parameters: {
    emotionScales: {
      neutre: 1,
      joie: 1.06,
      tristesse: 1,
      colere: 0.92,
      surprise: 0.96,
      peur: 0.94,
      degout: 0.92,
      tendresse: 1.04,
      concentration: 0.98,
    },
    visemeScales: { AA: 1.04, IH: 1, OU: 0.96, EE: 1, OH: 1.02, P: 1.02, F: 1.02 },
    jawScale: 1.02,
    gazeScale: 1,
    blinkScale: 0.98,
  },
  transitions: {
    emotionScale: 1.1,
    visemeScale: 1.02,
    gazeSmoothingScale: 1.1,
    blinkDurationScale: 1.08,
  },
});

export const PRESET_PROFILES = Object.freeze([HUMAN_NATURAL_V1, HUMAN_NATURAL_V2]);

export function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

export function slugifyProfileId(label) {
  const base = String(label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'profil';
}

function flatten(value, prefix = '', out = {}) {
  for (const [key, entry] of Object.entries(value || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) flatten(entry, path, out);
    else out[path] = entry;
  }
  return out;
}

function emptyState() {
  return {
    schema: PROFILE_STORE_SCHEMA,
    schemaVersion: PROFILE_STORE_VERSION,
    activeId: null,
    profiles: {},
    backups: {},
  };
}

function seedPresets(state) {
  for (const preset of PRESET_PROFILES) {
    const existing = state.profiles[preset.id];
    // A builtin preset always keeps its shipped values; custom edits are
    // stored under another id so V1 stays a trustworthy reference.
    if (!existing || existing.builtin) state.profiles[preset.id] = clone(preset);
  }
  if (!state.activeId || !state.profiles[state.activeId]) state.activeId = HUMAN_NATURAL_V1_ID;
  return state;
}

export function createProfileStore({
  storage = memoryStorage(),
  key = 'sarra.calibration.profiles.v1',
  now = () => new Date().toISOString(),
  maxBackups = 20,
} = {}) {
  const load = () => {
    let state = emptyState();
    try {
      const raw = storage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.schema === PROFILE_STORE_SCHEMA &&
            parsed.schemaVersion === PROFILE_STORE_VERSION) {
          state = {
            ...emptyState(),
            ...parsed,
            profiles: parsed.profiles && typeof parsed.profiles === 'object' ? parsed.profiles : {},
            backups: parsed.backups && typeof parsed.backups === 'object' ? parsed.backups : {},
          };
        }
      }
    } catch {
      state = emptyState();
    }
    return seedPresets(state);
  };

  let state = load();

  const persist = () => {
    try {
      storage.setItem(key, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  };

  const archive = (record, reason) => {
    const list = state.backups[record.id] || [];
    list.unshift({ archivedAt: now(), reason, record: clone(record) });
    state.backups[record.id] = list.slice(0, maxBackups);
  };

  const buildRecord = (input, { id, validated }) => ({
    id,
    label: String(input.label || input.name || id),
    version: Number.isInteger(input.version) ? input.version : 1,
    builtin: false,
    validated: Boolean(validated),
    description: String(input.description || ''),
    origin: String(input.origin || HUMAN_NATURAL_V1_ID),
    createdAt: input.createdAt || now(),
    updatedAt: now(),
    parameters: clone(input.parameters || {}),
    transitions: clone(input.transitions || {}),
    ...(input.mappings ? { mappings: clone(input.mappings) } : {}),
    ...(Array.isArray(input.results) ? { results: clone(input.results) } : {}),
  });

  return {
    key,

    list() {
      return Object.values(state.profiles)
        .map((record) => ({
          id: record.id,
          label: record.label,
          version: record.version,
          builtin: !!record.builtin,
          validated: !!record.validated,
          updatedAt: record.updatedAt || record.createdAt,
          active: record.id === state.activeId,
        }))
        .sort((a, b) => Number(b.builtin) - Number(a.builtin) || a.label.localeCompare(b.label));
    },

    get(id) {
      const record = state.profiles[id];
      return record ? clone(record) : null;
    },

    active() {
      const record = state.profiles[state.activeId];
      return record ? clone(record) : null;
    },

    setActive(id) {
      if (!state.profiles[id]) return { ok: false, error: 'unknown-profile' };
      state.activeId = id;
      persist();
      return { ok: true, active: clone(state.profiles[id]) };
    },

    /**
     * Save a profile. `validated` marks it as operator-approved; overwriting
     * such a profile requires `overwrite: true` and always archives the
     * previous values first.
     */
    save(input = {}, { overwrite = false, validated = false } = {}) {
      const payload = {
        parameters: input.parameters || {},
        transitions: input.transitions || {},
        mappings: input.mappings || {},
      };
      const validation = validateCalibrationParameters(payload);
      if (!validation.ok) {
        return { ok: false, error: 'invalid-profile-parameters', reasons: validation.reasons };
      }
      const id = String(input.id || slugifyProfileId(input.label || input.name));
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) return { ok: false, error: 'invalid-profile-id' };
      const existing = state.profiles[id];
      if (existing?.builtin) {
        return { ok: false, error: 'builtin-profile-readonly', id };
      }
      if (existing && !overwrite) {
        return { ok: false, error: 'profile-exists', id };
      }
      const next = buildRecord(input, { id, validated: validated || Boolean(input.validated) });
      if (existing) {
        archive(existing, 'overwrite');
        next.version = Math.max(Number(existing.version) || 1, next.version) + 1;
        next.createdAt = existing.createdAt || next.createdAt;
      }
      state.profiles[id] = next;
      persist();
      return { ok: true, profile: clone(next), archivedPrevious: Boolean(existing) };
    },

    /** Duplicate any profile (preset included) under a new name. */
    saveAs(label, sourceId, options = {}) {
      const source = state.profiles[sourceId];
      if (!source) return { ok: false, error: 'unknown-profile' };
      return this.save({
        ...clone(source),
        id: undefined,
        label: String(label || `${source.label} copie`),
        builtin: false,
      }, options);
    },

    /** Archive the current values of a profile without touching it. */
    backup(id, reason = 'manual') {
      const record = state.profiles[id];
      if (!record) return { ok: false, error: 'unknown-profile' };
      archive(record, reason);
      persist();
      return { ok: true, id, count: state.backups[id].length };
    },

    backups(id) {
      return (state.backups[id] || []).map((entry) => ({
        archivedAt: entry.archivedAt,
        reason: entry.reason,
        record: clone(entry.record),
      }));
    },

    /** Restore the most recent archive of a custom profile. */
    restoreBackup(id) {
      const list = state.backups[id] || [];
      if (!list.length) return { ok: false, error: 'no-backup' };
      const [entry, ...rest] = list;
      const current = state.profiles[id];
      state.backups[id] = rest;
      if (current) archive(current, 'restore');
      state.profiles[id] = clone(entry.record);
      persist();
      return { ok: true, profile: clone(state.profiles[id]) };
    },

    /** Reset a custom profile to its preset, or a preset to its shipped values. */
    reset(id = HUMAN_NATURAL_V1_ID) {
      const preset = PRESET_PROFILES.find((entry) => entry.id === id);
      if (preset) {
        const existing = state.profiles[id];
        if (existing && !existing.builtin) archive(existing, 'reset-to-preset');
        state.profiles[id] = clone(preset);
        persist();
        return { ok: true, profile: clone(preset) };
      }
      const custom = state.profiles[id];
      if (!custom) return { ok: false, error: 'unknown-profile' };
      const origin = custom.origin || HUMAN_NATURAL_V1_ID;
      const base = PRESET_PROFILES.find((entry) => entry.id === origin) || HUMAN_NATURAL_V1;
      archive(custom, 'reset');
      state.profiles[id] = {
        ...clone(base),
        id,
        label: custom.label,
        builtin: false,
        version: 1,
        createdAt: custom.createdAt,
        updatedAt: now(),
        origin,
      };
      persist();
      return { ok: true, profile: clone(state.profiles[id]) };
    },

    remove(id) {
      const record = state.profiles[id];
      if (!record) return { ok: false, error: 'unknown-profile' };
      if (record.builtin) return { ok: false, error: 'builtin-profile-readonly' };
      delete state.profiles[id];
      delete state.backups[id];
      if (state.activeId === id) state.activeId = HUMAN_NATURAL_V1_ID;
      persist();
      return { ok: true, activeId: state.activeId };
    },

    compare(leftId, rightId = HUMAN_NATURAL_V1_ID) {
      const left = state.profiles[leftId];
      const right = state.profiles[rightId];
      if (!left || !right) return { ok: false, error: 'unknown-profile' };
      const a = flatten({ parameters: left.parameters, transitions: left.transitions });
      const b = flatten({ parameters: right.parameters, transitions: right.transitions });
      const paths = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
      const differences = paths
        .filter((path) => Math.abs(Number(a[path] ?? 1) - Number(b[path] ?? 1)) > 1e-9)
        .map((path) => ({ path, left: a[path] ?? null, right: b[path] ?? null }));
      return {
        ok: true,
        identical: differences.length === 0,
        left: { id: left.id, label: left.label },
        right: { id: right.id, label: right.label },
        differences,
        compared: paths.length,
      };
    },

    exportJSON(id = state.activeId) {
      const record = state.profiles[id];
      if (!record) return { ok: false, error: 'unknown-profile' };
      return {
        ok: true,
        json: JSON.stringify({
          schema: PROFILE_EXPORT_SCHEMA,
          schemaVersion: PROFILE_STORE_VERSION,
          exportedAt: now(),
          profiles: [clone(record)],
        }, null, 2),
      };
    },

    exportAll() {
      return JSON.stringify({
        schema: PROFILE_EXPORT_SCHEMA,
        schemaVersion: PROFILE_STORE_VERSION,
        exportedAt: now(),
        profiles: Object.values(state.profiles).map(clone),
      }, null, 2);
    },

    /** Import one or several profile records; never overwrites silently. */
    importJSON(text, { overwrite = false } = {}) {
      let parsed;
      try {
        parsed = JSON.parse(String(text));
      } catch {
        return { ok: false, error: 'invalid-profile-json' };
      }
      const records = Array.isArray(parsed) ? parsed
        : Array.isArray(parsed?.profiles) ? parsed.profiles
        : parsed?.parameters ? [parsed]
        : null;
      if (!records) return { ok: false, error: 'invalid-profile-json' };
      const imported = [];
      const errors = [];
      for (const record of records) {
        const result = this.save(
          { ...record, builtin: false, id: record.id && record.id !== 'human-natural-v1' ? record.id : undefined },
          { overwrite, validated: Boolean(record.validated) },
        );
        if (result.ok) imported.push(result.profile.id);
        else errors.push({ id: record?.id || record?.label || null, error: result.error });
      }
      return { ok: imported.length > 0, imported, errors };
    },

    snapshot() {
      return clone(state);
    },
  };
}
