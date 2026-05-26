export type { TranscriptionResult } from "./transcription/audio-transcription-engine";
export { transcribeAudioBuffer } from "./transcription/audio-transcription-engine";

export type { VoiceResponsePlan } from "./voice/voice-response-engine";
export {
  planVoiceOrTextResponse,
  patchConversationStateWithAudioMemory,
} from "./voice/voice-response-engine";

export { decideAudioReply } from "./voice/audio-decision-engine";
export { processInboundProspectVoice, processOutboundAgentReply } from "./audio-conversation-engine";
export type { AudioMemory } from "./memory/audio-memory-types";
export { readAudioMemory, mergeAudioMemory } from "./memory/audio-memory";
export { resolveAgentVoicePersonality } from "./personality/voice-personalities";
export { buildAudioN8nPayload, type AudioN8nEventKind } from "./n8n/audio-n8n-events";
export { DEFAULT_AUDIO_SAFETY } from "./safety/audio-safety";
