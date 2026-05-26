const { test } = require("node:test");
const assert = require("node:assert/strict");
const { classifyConversationEmotion } = require("../src/lib/agents/emotional-intelligence/conversation-emotion-classifier");
const { buildCriticalPriorityReply, isAllowedMicroSocialMessage } = require("../src/lib/chat/pipeline/conversation-priority-engine");
const { resolveSessionLanguageLock } = require("../src/lib/chat/pipeline/session-language-lock");

test("closed store visit blocks social and replies in French", () => {
  const m = "je suis passé hier mais c'était fermé";
  const em = classifyConversationEmotion({ message: m });
  assert.equal(em.blocks_social_quick, true);
  assert.ok(em.frustration_score >= 0.5);
  const lang = resolveSessionLanguageLock({ message: m });
  assert.equal(lang.language, "fr");
  const reply = buildCriticalPriorityReply({ message: m, lang: lang.language, emotion: em, facts: {} });
  assert.ok(reply);
  assert.match(reply, /désol|frustr|fermé|passé/i);
  assert.doesNotMatch(reply, /Doing well/i);
});

test("micro social only for short greetings", () => {
  assert.equal(isAllowedMicroSocialMessage("salut"), true);
  assert.equal(isAllowedMicroSocialMessage("je suis passé hier mais c'était fermé"), false);
});
