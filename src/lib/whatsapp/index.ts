import type { WhatsAppProvider, WhatsAppProviderId } from "./providers/types";
import { manualWhatsAppProvider } from "./providers/manual";

export const whatsappProviders: Record<WhatsAppProviderId, WhatsAppProvider> = {
  manual: manualWhatsAppProvider,
  // Reserved for future integrations
  twilio: {
    id: "twilio",
    displayName: "Twilio (bientôt)",
    capabilities: {
      sendMessage: false,
      scheduledMessages: true,
      webhooks: true,
      businessHours: true,
      humanTakeover: true,
      leadTagging: true,
    },
    buildSendUrl() {
      return "https://www.twilio.com/whatsapp";
    },
  },
  meta_cloud: {
    id: "meta_cloud",
    displayName: "Meta Cloud API (bientôt)",
    capabilities: {
      sendMessage: false,
      scheduledMessages: true,
      webhooks: true,
      businessHours: true,
      humanTakeover: true,
      leadTagging: true,
    },
    buildSendUrl() {
      return "https://developers.facebook.com/docs/whatsapp/cloud-api";
    },
  },
  "360dialog": {
    id: "360dialog",
    displayName: "360dialog (bientôt)",
    capabilities: {
      sendMessage: false,
      scheduledMessages: true,
      webhooks: true,
      businessHours: true,
      humanTakeover: true,
      leadTagging: true,
    },
    buildSendUrl() {
      return "https://www.360dialog.com/";
    },
  },
  waba: {
    id: "waba",
    displayName: "WhatsApp Business API (bientôt)",
    capabilities: {
      sendMessage: false,
      scheduledMessages: true,
      webhooks: true,
      businessHours: true,
      humanTakeover: true,
      leadTagging: true,
    },
    buildSendUrl() {
      return "https://business.whatsapp.com/";
    },
  },
};

export function getDefaultWhatsAppProvider() {
  return whatsappProviders.manual;
}

