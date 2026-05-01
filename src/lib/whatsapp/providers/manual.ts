import type { WhatsAppProvider } from "./types";

export const manualWhatsAppProvider: WhatsAppProvider = {
  id: "manual",
  displayName: "WhatsApp (manuel)",
  capabilities: {
    sendMessage: true,
    scheduledMessages: false,
    webhooks: false,
    businessHours: false,
    humanTakeover: false,
    leadTagging: false,
  },
  buildSendUrl({ text, phoneE164 }) {
    const encoded = encodeURIComponent(text);
    const phone = (phoneE164 ?? "").replace(/[^\d]/g, "");

    // If phone is present: direct chat. Otherwise: let WhatsApp choose contact.
    if (phone) return `https://wa.me/${phone}?text=${encoded}`;
    return `https://wa.me/?text=${encoded}`;
  },
};

