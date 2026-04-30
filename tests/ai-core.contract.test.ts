import test from "node:test";
import assert from "node:assert/strict";
import { chatCoreRequestSchema } from "../src/lib/ai/chat-core";

test("chat-core schema accepts assistant and generator modes", () => {
  const base = {
    message: "Quelle heure est-il ?",
    history: [],
    userTimezone: "Africa/Douala",
    model: "openai/gpt-4o-mini",
  } as const;

  assert.ok(chatCoreRequestSchema.safeParse({ ...base, mode: "business_chat", responseFormat: "single" }).success);
  assert.ok(chatCoreRequestSchema.safeParse({ ...base, mode: "reply", responseFormat: "items_3" }).success);
});

