const { test } = require("node:test");
const assert = require("node:assert/strict");

const { isWhoAmIIntent, formatWhoAmIResponse } = require("../src/lib/ai/whoami");

test("isWhoAmIIntent matches common variants and typos", () => {
  assert.equal(isWhoAmIIntent("Qui suis-je ?"), true);
  assert.equal(isWhoAmIIntent("salut qui sui je"), true);
  assert.equal(isWhoAmIIntent("Bonjour, qui suis je"), true);
  assert.equal(isWhoAmIIntent("who am i"), true);
  assert.equal(isWhoAmIIntent("qui es-tu ?"), false);
});

test("formatWhoAmIResponse uses profile fields when present", () => {
  const message = formatWhoAmIResponse({
    ownerName: "Yuri",
    businessName: "Optima",
    businessType: "E-commerce",
    country: "Gabon",
    city: "Libreville",
    whatsapp: "+241000000",
    mainGoal: "Vendre plus",
    brandTone: null,
    responseStyle: null,
    primaryLanguage: "fr",
    offer: "IA pour vendeurs WhatsApp",
  });

  assert.match(message, /Vous êtes Yuri\./);
  assert.match(message, /Votre business s’appelle Optima à Libreville\./);
  assert.match(message, /Offre : IA pour vendeurs WhatsApp\./);
});
