import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HUMAN_NATURAL_V1,
  HUMAN_NATURAL_V1_ID,
  HUMAN_NATURAL_V2,
  PRESET_PROFILES,
  createProfileStore,
  memoryStorage,
  slugifyProfileId,
} from './index.js';
import { validateCalibrationParameters } from './calibration-profile.js';

const makeStore = (options = {}) => createProfileStore({ storage: memoryStorage(), ...options });

test('ships HUMAN NATURAL V1 and V2 as valid builtin presets', () => {
  assert.deepEqual(PRESET_PROFILES.map((preset) => preset.id), [
    HUMAN_NATURAL_V1_ID,
    'human-natural-v2',
  ]);
  for (const preset of PRESET_PROFILES) {
    assert.equal(preset.builtin, true);
    assert.equal(preset.validated, true);
    const validation = validateCalibrationParameters({
      parameters: preset.parameters,
      transitions: preset.transitions,
      mappings: {},
    });
    assert.deepEqual(validation.reasons, []);
    for (const value of Object.values(preset.parameters.emotionScales)) {
      assert.ok(value >= 0.8 && value <= 1.2);
    }
  }
  // the seven requested emotions are all calibrated
  for (const emotion of ['neutre', 'joie', 'tristesse', 'colere', 'surprise', 'peur', 'degout']) {
    assert.ok(Number.isFinite(HUMAN_NATURAL_V1.parameters.emotionScales[emotion]));
  }
  assert.equal(HUMAN_NATURAL_V1.parameters.emotionScales.joie, 1);
  assert.ok(HUMAN_NATURAL_V2.parameters.emotionScales.joie > 1);
});

test('the store seeds both presets and activates Human Natural V1 by default', () => {
  const store = makeStore();
  const list = store.list();
  assert.equal(list.length, 2);
  assert.equal(store.active().id, HUMAN_NATURAL_V1_ID);
  assert.equal(list[0].active, true);
});

test('state survives a reload with the same storage key', () => {
  const storage = memoryStorage();
  const store = createProfileStore({ storage });
  store.save({ label: 'Studio perso', parameters: HUMAN_NATURAL_V1.parameters, transitions: HUMAN_NATURAL_V1.transitions }, { validated: true });
  const reloaded = createProfileStore({ storage });
  assert.ok(reloaded.get('studio-perso'));
  assert.equal(reloaded.list().length, 3);
});

test('saving custom profiles validates the payload and refuses invalid values', () => {
  const store = makeStore();
  const bad = store.save({ label: 'Trop fort', parameters: { jawScale: 2 } });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'invalid-profile-parameters');
  assert.ok(bad.reasons.includes('invalid-profile-jawScale'));

  const good = store.save({ label: 'Doux', parameters: { jawScale: 0.95, emotionScales: { peur: 0.9 } } });
  assert.equal(good.ok, true);
  assert.equal(good.profile.id, 'doux');
  assert.equal(good.profile.origin, HUMAN_NATURAL_V1_ID);
});

test('overwriting a validated profile archives the previous values first', () => {
  const store = makeStore();
  store.save({ label: 'Perso', parameters: { ...HUMAN_NATURAL_V1.parameters, jawScale: 1 } }, { validated: true });

  const conflict = store.save({ label: 'Perso', parameters: { ...HUMAN_NATURAL_V1.parameters, jawScale: 0.9 } });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.error, 'profile-exists');

  const overwritten = store.save(
    { label: 'Perso', parameters: { ...HUMAN_NATURAL_V1.parameters, jawScale: 0.9 } },
    { overwrite: true, validated: true },
  );
  assert.equal(overwritten.ok, true);
  assert.equal(overwritten.archivedPrevious, true);
  assert.equal(overwritten.profile.version, 2);
  assert.equal(overwritten.profile.parameters.jawScale, 0.9);

  const backups = store.backups('perso');
  assert.equal(backups.length, 1);
  assert.equal(backups[0].reason, 'overwrite');
  assert.equal(backups[0].record.parameters.jawScale, 1);
});

test('restoring a backup brings the archived values back and keeps the current one', () => {
  const store = makeStore();
  store.save({ label: 'Perso', parameters: { jawScale: 1 } }, { validated: true });
  store.save({ label: 'Perso', parameters: { jawScale: 0.9 } }, { overwrite: true, validated: true });

  const restored = store.restoreBackup('perso');
  assert.equal(restored.ok, true);
  assert.equal(restored.profile.parameters.jawScale, 1);
  assert.equal(store.backups('perso')[0].record.parameters.jawScale, 0.9);
});

test('builtin presets cannot be overwritten or removed but can be copied', () => {
  const store = makeStore();
  const refused = store.save({ id: HUMAN_NATURAL_V1_ID, parameters: { jawScale: 1.1 } }, { overwrite: true });
  assert.equal(refused.ok, false);
  assert.equal(refused.error, 'builtin-profile-readonly');
  assert.equal(store.remove(HUMAN_NATURAL_V1_ID).ok, false);

  const copy = store.saveAs('Ma V1', HUMAN_NATURAL_V1_ID);
  assert.equal(copy.ok, true);
  assert.equal(copy.profile.label, 'Ma V1');
  assert.equal(copy.profile.parameters.emotionScales.peur, 0.9);
});

test('reset restores a custom profile to the V1 values', () => {
  const store = makeStore();
  store.save({ label: 'Perso', parameters: { ...HUMAN_NATURAL_V1.parameters, jawScale: 0.85 } }, { validated: true });
  const reset = store.reset('perso');
  assert.equal(reset.ok, true);
  assert.equal(reset.profile.parameters.jawScale, 1);
  assert.equal(reset.profile.validated, true);
  assert.equal(store.backups('perso')[0].reason, 'reset');
});

test('compare reports only the differing parameters', () => {
  const store = makeStore();
  store.save({
    label: 'Perso',
    parameters: { ...HUMAN_NATURAL_V1.parameters, jawScale: 0.9, emotionScales: { ...HUMAN_NATURAL_V1.parameters.emotionScales, joie: 1.1 } },
    transitions: HUMAN_NATURAL_V1.transitions,
  });
  const diff = store.compare('perso', HUMAN_NATURAL_V1_ID);
  assert.equal(diff.ok, true);
  assert.equal(diff.identical, false);
  assert.deepEqual(diff.differences.map((entry) => entry.path).sort(), [
    'parameters.emotionScales.joie',
    'parameters.jawScale',
  ]);
  assert.equal(store.compare(HUMAN_NATURAL_V1_ID, HUMAN_NATURAL_V1_ID).identical, true);
});

test('export and import round-trip through versioned JSON', () => {
  const store = makeStore();
  store.save({ label: 'Exportable', parameters: { jawScale: 0.97 } });
  const exported = store.exportJSON('exportable');
  assert.equal(exported.ok, true);
  const payload = JSON.parse(exported.json);
  assert.equal(payload.schema, 'sarra-calibration-profile-export');
  assert.equal(payload.schemaVersion, 1);

  const other = makeStore();
  const imported = other.importJSON(exported.json);
  assert.equal(imported.ok, true);
  assert.deepEqual(imported.imported, ['exportable']);
  assert.equal(other.get('exportable').parameters.jawScale, 0.97);

  const conflict = other.importJSON(exported.json);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.errors[0].error, 'profile-exists');
});

test('import refuses malformed JSON and unknown parameters', () => {
  const store = makeStore();
  assert.equal(store.importJSON('{oops').error, 'invalid-profile-json');
  const invalid = store.importJSON(JSON.stringify({ profiles: [{ label: 'X', parameters: { unknown: 1 } }] }));
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors[0].error, 'invalid-profile-parameters');
});

test('slugify produces stable ids', () => {
  assert.equal(slugifyProfileId('HUMAN NATURAL V1'), 'human-natural-v1');
  assert.equal(slugifyProfileId('Dégoût + Peur'), 'degout-peur');
  assert.equal(slugifyProfileId(''), 'profil');
});
