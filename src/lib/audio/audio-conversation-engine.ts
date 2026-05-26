import "server-only";

import { detectProspectEmotion } from "@/lib/agents/human-behavior/emotions/emotion-detector";
import { getCommercialAgentById } from "@/lib/agents/personality/commercial-agents";

import { formatAudioDeliveryPayload } from "./delivery/audio-delivery";
import { transcribeAudioBuffer, type TranscriptionResult } from "./transcription/audio-transcription-engine";
import {
  patchConversationStateWithAudioMemory,
  planVoiceOrTextResponse,
} from "./voice/voice-response-engine";

export type ProcessInboundVoiceResult = {
  transcription: TranscriptionResult;
  /** Texte à envoyer au pipeline chat */
  messageForChat: string;
  conversationStatePatch: Record<string, unknown>;
};

export async function processInboundProspectVoice(args: {
  audioBuffer: Buffer;
  mimeType: string;
  conversationState?: Record<string, unknown>;
  hourLocal?: number;
  durationMs?: number;
}): Promise<ProcessInboundVoiceResult> {
  const transcription = await transcribeAudioBuffer({
    buffer: args.audioBuffer,
    mimeType: args.mimeType,
    languageHint: undefined,
  });

  const conversationStatePatch = patchConversationStateWithAudioMemory(
    { ...(args.conversationState ?? {}) },
    {
      userSentVoice: true,
      userAudioDurationMs: args.durationMs,
      hourLocal: args.hourLocal,
    },
  );

  return {
    transcription,
    messageForChat: transcription.text,
    conversationStatePatch,
  };
}

export type ProcessOutboundReplyResult = ReturnType<typeof formatAudioDeliveryPayload> & {
  conversationStatePatch?: Record<string, unknown>;
};

export async function processOutboundAgentReply(args: {
  assistantText: string;
  personaKey?: string | null;
  conversationState?: Record<string, unknown>;
  userMessage: string;
  userSentVoice: boolean;
  lastAgentVoiceAt?: string;
  seed?: string;
}): Promise<ProcessOutboundReplyResult> {
  const agent = getCommercialAgentById(args.personaKey ?? undefined);
  const emotion = detectProspectEmotion(args.userMessage);

  const plan = await planVoiceOrTextResponse({
    assistantText: args.assistantText,
    personaKey: args.personaKey,
    gender: agent?.gender,
    conversationState: args.conversationState,
    userSentVoice: args.userSentVoice,
    userMessage: args.userMessage,
    emotion,
    lastAgentVoiceAt: args.lastAgentVoiceAt,
    seed: args.seed,
  });

  const delivery = formatAudioDeliveryPayload(plan);

  const conversationStatePatch =
    plan.mode === "voice"
      ? patchConversationStateWithAudioMemory(
          { ...(args.conversationState ?? {}) },
          { agentSentVoice: true },
        )
      : undefined;

  return { ...delivery, conversationStatePatch };
}
