const { test } = require("node:test");
const assert = require("node:assert/strict");

// Import our intent classifier functions
const intentClassifier = require("../src/lib/ai/intent-classifier");

test("classifyIntent correctly identifies current time queries", () => {
  assert.equal(intentClassifier.classifyIntent("il est quelle heure"), "current_time");
  assert.equal(intentClassifier.classifyIntent("quelle heure est-il"), "current_time");
  assert.equal(intentClassifier.classifyIntent("quelle est l'heure actuelle"), "current_time");
  assert.equal(intentClassifier.classifyIntent("time"), "current_time");
});

test("classifyIntent correctly identifies business hours queries", () => {
  assert.equal(intentClassifier.classifyIntent("quelles sont vos heures d'ouverture"), "business_hours");
  assert.equal(intentClassifier.classifyIntent("quand ouvrez-vous"), "business_hours");
  assert.equal(intentClassifier.classifyIntent("horaires d'ouverture"), "business_hours");
});

test("classifyIntent correctly identifies weather queries", () => {
  assert.equal(intentClassifier.classifyIntent("quel temps fait-il"), "weather");
  assert.equal(intentClassifier.classifyIntent("meteo aujourd'hui"), "weather");
  assert.equal(intentClassifier.classifyIntent("il va pleuvoir"), "weather");
});

test("classifyIntent correctly identifies calculator queries", () => {
  assert.equal(intentClassifier.classifyIntent("combien fait 2+2"), "calculator");
  assert.equal(intentClassifier.classifyIntent("calculer 10*5"), "calculator");
  assert.equal(intentClassifier.classifyIntent("quelle est la racine de 16"), "calculator");
});

test("classifyIntent correctly identifies greeting messages", () => {
  assert.equal(intentClassifier.classifyIntent("bonjour"), "greeting");
  assert.equal(intentClassifier.classifyIntent("salut"), "greeting");
  assert.equal(intentClassifier.classifyIntent("bonsoir"), "greeting");
  assert.equal(intentClassifier.classifyIntent("hello"), "greeting");
});

test("classifyIntent correctly identifies small talk", () => {
  assert.equal(intentClassifier.classifyIntent("ça va"), "small_talk");
  assert.equal(intentClassifier.classifyIntent("merci"), "small_talk");
  assert.equal(intentClassifier.classifyIntent("ok"), "small_talk");
  assert.equal(intentClassifier.classifyIntent("d'accord"), "small_talk");
});

test("classifyIntent correctly identifies product questions", () => {
  assert.equal(intentClassifier.classifyIntent("quel est le prix de ce produit"), "product_question");
  assert.equal(intentClassifier.classifyIntent("vous avez ceci en stock"), "product_question");
  assert.equal(intentClassifier.classifyIntent("disponible en livraison"), "product_question");
});

test("classifyIntent correctly identifies support requests", () => {
  assert.equal(intentClassifier.classifyIntent("j'ai un problème avec ma commande"), "support");
  assert.equal(intentClassifier.classifyIntent("ça ne fonctionne pas"), "support");
  assert.equal(intentClassifier.classifyIntent("besoin d'aide"), "support");
});

test("classifyIntent correctly identifies general knowledge", () => {
  assert.equal(intentClassifier.classifyIntent("qu'est-ce que l'intelligence artificielle"), "general_knowledge");
  assert.equal(intentClassifier.classifyIntent("comment faire un gâteau"), "general_knowledge");
  assert.equal(intentClassifier.classifyIntent("qui est le président du Gabon"), "general_knowledge");
});

test("getQuickResponse returns appropriate responses", () => {
  // Test specific quick responses
  assert.equal(intentClassifier.getQuickResponse("greeting"), "Bonjour ! Comment puis-je vous aider aujourd'hui ?");
  
  // For small_talk, we need to test based on the actual message content
  // Since getQuickResponse only takes intent, we'll test that it returns something for small_talk
  const smallTalkResponse = intentClassifier.getQuickResponse("small_talk");
  assert.ok(smallTalkResponse !== null && smallTalkResponse.length > 0);
  
  // Test specific cases by checking what intent they classify to
  assert.equal(intentClassifier.classifyIntent("merci"), "small_talk");
  assert.equal(intentClassifier.classifyIntent("ok"), "small_talk");
  assert.equal(intentClassifier.classifyIntent("ça va"), "small_talk");
});

test("getDeterministicResponse returns correct time format", () => {
  const mockContext = {
    timezone: "Africa/Douala",
    businessProfile: { city: "Douala", businessName: "Test Business" },
    currentDateTime: "2026-05-23 10:30 (Africa/Douala)"
  };
  
  const response = intentClassifier.getDeterministicResponse("current_time", mockContext);
  assert.ok(response !== null);
  assert.ok(response.includes("Il est actuellement"));
  assert.ok(response.includes("10h30"));
  assert.ok(response.includes("Douala"));
});

test("getDeterministicResponse returns business hours", () => {
  const mockContext = {
    timezone: "Africa/Douala",
    businessProfile: { city: "Douala", businessName: "Test Business" },
    currentDateTime: "2026-05-23 10:30 (Africa/Douala)"
  };
  
  const response = intentClassifier.getDeterministicResponse("business_hours", mockContext);
  assert.ok(response !== null);
  assert.ok(response.includes("horaires d'ouverture"));
  assert.ok(response.includes("9h à 18h"));
  assert.ok(response.includes("Douala"));
});

test("classifyIntent defaults to sales for unclear messages", () => {
  assert.equal(intentClassifier.classifyIntent("blablabla aléatoire"), "sales");
  assert.equal(intentClassifier.classifyIntent("xyz"), "sales");
});