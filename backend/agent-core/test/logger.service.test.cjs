const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

test("LoggerService emits structured request and response llm log events", async () => {
  const originalAppendFileSync = fs.appendFileSync;
  const capturedWrites = [];
  fs.appendFileSync = (filePath, content) => {
    capturedWrites.push({ filePath, content: String(content) });
  };

  try {
    const { LoggerService } = require("../dist/src/utils/logger.service");
    const logger = new LoggerService();
    const events = [];
    const handler = logger.createLlmCallbackHandler("session-1", (event) => events.push(event));

    await handler.handleChatModelStart(
      { kwargs: { modelName: "gpt-4o-mini" } },
      [[
        { kwargs: { role: "system", content: "You are helpful." } },
        { kwargs: { role: "user", content: "hi" } },
        { type: "ai", kwargs: { content: "prior assistant turn" } },
      ]],
      "run-1",
      undefined,
      { model: "gpt-4o-mini", temperature: 0, apiKey: "secret-key" },
    );

    await handler.handleLLMEnd(
      {
        generations: [[{
          text: "hello",
          message: {
            kwargs: {
              content: "hello",
            },
          },
        }]],
        llmOutput: {
          tokenUsage: { promptTokens: 12, completionTokens: 3 },
        },
      },
      "run-1",
    );

    assert.equal(events.length, 2);
    assert.equal(events[0].type, "llm_log");
    assert.equal(events[0].entry.direction, "request");
    assert.equal(events[0].entry.sessionId, "session-1");
    assert.equal(events[0].entry.request.params.apiKey, "[redacted]");
    assert.equal(events[0].entry.request.messages.length, 3);
    assert.equal(events[0].entry.request.messages[2].role, "assistant");
    assert.equal(events[1].entry.direction, "response");
    assert.equal(events[1].entry.invocationId, "run-1");
    assert.equal(events[1].entry.response.generations[0].content, "hello");
    assert.equal(capturedWrites.length, 2);
  } finally {
    fs.appendFileSync = originalAppendFileSync;
  }
});

test("LoggerService request params omit invocation_params and function fields", async () => {
  const originalAppendFileSync = fs.appendFileSync;
  fs.appendFileSync = () => {};

  try {
    const { LoggerService } = require("../dist/src/utils/logger.service");
    const logger = new LoggerService();
    const events = [];
    const handler = logger.createLlmCallbackHandler("session-2", (event) => events.push(event));

    await handler.handleChatModelStart(
      { kwargs: { modelName: "gpt-4o-mini" } },
      [[{ kwargs: { role: "user", content: "hi" } }]],
      "run-2",
      undefined,
      {
        model: "gpt-4o-mini",
        temperature: 0,
        invocation_params: { model: "gpt-4o-mini", messages: [{ role: "user", content: "dup" }] },
        writer: () => {},
        interrupt: function interrupt() {},
        nested: { invocation_params: { x: 1 }, ok: true },
      },
    );

    assert.equal(events.length, 1);
    const params = events[0].entry.request.params;
    assert.ok(!("invocation_params" in params));
    assert.ok(!("writer" in params));
    assert.ok(!("interrupt" in params));
    assert.equal(params.model, "gpt-4o-mini");
    assert.deepEqual(params.nested, { ok: true });
  } finally {
    fs.appendFileSync = originalAppendFileSync;
  }
});
