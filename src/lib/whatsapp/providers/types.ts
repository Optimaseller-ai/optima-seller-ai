export type WhatsAppProviderId = "manual" | "twilio" | "meta_cloud" | "360dialog" | "waba";

export type WhatsAppProviderCapabilities = {
  sendMessage: boolean;
  scheduledMessages: boolean;
  webhooks: boolean;
  businessHours: boolean;
  humanTakeover: boolean;
  leadTagging: boolean;
};

export type WhatsAppSendUrlArgs = {
  text: string;
  phoneE164?: string | null;
};

export interface WhatsAppProvider {
  id: WhatsAppProviderId;
  displayName: string;
  capabilities: WhatsAppProviderCapabilities;
  buildSendUrl(args: WhatsAppSendUrlArgs): string;
}

