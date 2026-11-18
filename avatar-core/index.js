export {
  AvatarCore,
  createAvatarCore,
  EMOTION_NAMES,
  EMOTION_PROFILES,
  ExpressionMixer,
  normalizeEmotionName,
} from './expression-mixer.js';
export {
  DEFAULT_BLINK_MAPPING,
  DEFAULT_GAZE_MAPPING,
  DEFAULT_VISEME_MAPPING,
  FacialComposer,
  normalizeVisemeName,
  VISEME_ALIASES,
  VISEME_NAMES,
} from './facial-composer.js';
export {
  AVATAR_CORE_VERSION,
  CALIBRATION_PROFILE_VERSION,
  PROFILE_EMOTION_NAMES,
  createCalibrationProfile,
  parseCalibrationProfileJSON,
  validateCalibrationParameters,
  validateCalibrationProfile,
} from './calibration-profile.js';
export {
  HUMAN_NATURAL_V1,
  HUMAN_NATURAL_V1_ID,
  HUMAN_NATURAL_V2,
  HUMAN_NATURAL_V2_ID,
  PRESET_PROFILES,
  PROFILE_EXPORT_SCHEMA,
  PROFILE_STORE_SCHEMA,
  PROFILE_STORE_VERSION,
  createProfileStore,
  memoryStorage,
  slugifyProfileId,
} from './calibration-profiles.js';
export { createVrmAdapter } from './adapters/vrm.js';
export {
  SARRA_PHOTOREAL_RIG_SIGNATURE,
  SARRA_PHOTOREAL_VISEME_MAPPING,
  createSarraPhotorealAdapter,
  createSarraPhotorealAvatarCore,
} from './adapters/vrm-photoreal.js';
export {
  DEFAULT_NATURAL_LIPSYNC_CONFIG,
  NATURAL_LIPSYNC_DEMO_TEXT,
  NaturalJawEnvelope,
  NaturalLipsyncDemo,
  NaturalSpeechGate,
  finiteOr,
  frameRateIndependentBlend,
  sampleNaturalLipsyncDemo,
  sanitizeNaturalLipsyncConfig,
} from './natural-lipsync.js';
export {
  LIPSYNC_CORPUS,
  applyTemporaryProposal,
  createPhoneticReference,
  measureLipsyncRun,
  proposeLipsyncCalibration,
  samplePhoneticReference,
} from './lipsync-calibration.js';
