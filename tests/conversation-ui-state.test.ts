import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyConversationUiClear,
  archiveMessagesFromUi,
  isConversationUiCleared,
  patchConversationStateForApi,
} from "@/lib/chat/conversation-ui-state";

describe("conversation-ui-state", () => {
  it("applyConversationUiClear archives messages without wiping conversation_state", () => {
    const session = {
      messages: [
        { id: "1", role: "user" as const, content: "Bonjour", ts: "2026-01-01T10:00:00.000Z" },
        { id: "2", role: "assistant" as const, content: "Salut", ts: "2026-01-01T10:00:05.000Z" },
      ],
      conversation_state: { intro_done: true, language: "fr", stats: { turn_count: 3 } },
    };
    const cleared = applyConversationUiClear(session);
    assert.equal(cleared.messages.length, 0);
    assert.equal(cleared.ui_hidden_messages?.length, 2);
    assert.equal(isConversationUiCleared(cleared), true);
    assert.equal((cleared.conversation_state as { intro_done?: boolean }).intro_done, true);
    assert.equal((cleared.conversation_state as { stats?: { turn_count?: number } }).stats?.turn_count, 3);
  });

  it("archives user and assistant messages from UI", () => {
    const archived = archiveMessagesFromUi([
      { role: "user", content: "Bonjour", ts: "t1" },
      { role: "assistant", content: "Salut", ts: "t2" },
    ]);
    assert.equal(archived.length, 2);
    assert.equal(archived[0]?.role, "user");
    assert.equal(archived[1]?.role, "assistant");
    const cleared = applyConversationUiClear(
      { messages: [], conversation_state: {} },
      { uiMessages: archived },
    );
    assert.equal(cleared.ui_hidden_messages?.length, 2);
  });

  it("patchConversationStateForApi adds conversationUi flag", () => {
    const session = applyConversationUiClear({
      messages: [{ role: "user", content: "x", ts: "t" }],
      conversation_state: { language: "fr" },
    });
    const patched = patchConversationStateForApi(session.conversation_state, session);
    assert.equal((patched.conversationUi as { cleared_by_user?: boolean })?.cleared_by_user, true);
  });
});
