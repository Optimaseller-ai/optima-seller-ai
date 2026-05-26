import "server-only";

function seedHash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

export type HumanAudioTimingPlan = {
  /** Pause avant d’afficher / envoyer le vocal (ms) */
  delayBeforeVoiceMs: number;
  /** Durée affichée « en train d’enregistrer » */
  recordingIndicatorMs: number;
  /** Micro-respiration avant lecture */
  breathPauseMs: number;
  estimatedPlaybackMs: number;
};

export function buildHumanAudioTimingPlan(args: {
  textLength: number;
  durationEstimateMs: number;
  seed: string;
  userSentVoice?: boolean;
}): HumanAudioTimingPlan {
  const roll = seedHash(args.seed) % 100;
  const baseDelay = args.userSentVoice ? 2200 + (roll % 1800) : 2800 + (roll % 2400);
  const recordingIndicatorMs = Math.min(4500, 800 + Math.round(args.textLength * 12) + (roll % 600));
  const breathPauseMs = 180 + (roll % 220);
  const estimatedPlaybackMs = args.durationEstimateMs;

  return {
    delayBeforeVoiceMs: baseDelay,
    recordingIndicatorMs,
    breathPauseMs,
    estimatedPlaybackMs,
  };
}
