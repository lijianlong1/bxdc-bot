const test = require("node:test");
const assert = require("node:assert/strict");

function load() {
  return require("../dist/src/utils/history-sanitize");
}

/** Mirrors extended-skill progressive disclosure from java-skills (JSON.stringify). */
function makeRequireParametersPayload() {
  return JSON.stringify({
    status: "REQUIRE_PARAMETERS",
    message:
      "This is an API skill. Read the interface description and parameter contract, "
      + "then call this tool again with the parameters you need to set.",
    interfaceDescription: "Test API for sanitize.",
    parameterContract: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name" },
        key: { type: "string" },
      },
      required: ["city"],
    },
  });
}

test("sanitizeMessageContentForAgent — whole JSON REQUIRE_PARAMETERS → placeholder", () => {
  const { sanitizeMessageContentForAgent, PROGRESSIVE_DISCLOSURE_PLACEHOLDER } = load();
  const raw = makeRequireParametersPayload();
  const out = sanitizeMessageContentForAgent(raw);
  assert.equal(out, PROGRESSIVE_DISCLOSURE_PLACEHOLDER);
  assert.ok(out.length < raw.length);
});

test("sanitizeMessageContentForAgent — preserves completed tool JSON", () => {
  const { sanitizeMessageContentForAgent } = load();
  const ok = JSON.stringify({
    status: "ok",
    body: { result: [1, 2, 3] },
    note: "long ".repeat(50),
  });
  assert.equal(sanitizeMessageContentForAgent(ok), ok);
});

test("sanitizeMessageContentForAgent — embedded disclosure JSON in prose", () => {
  const { sanitizeMessageContentForAgent, PROGRESSIVE_DISCLOSURE_PLACEHOLDER } = load();
  const inner = makeRequireParametersPayload();
  const wrapped = `Tool said:\n${inner}\nPlease continue.`;
  const out = sanitizeMessageContentForAgent(wrapped);
  assert.ok(out.includes(PROGRESSIVE_DISCLOSURE_PLACEHOLDER));
  assert.ok(!out.includes("parameterContract"));
});

test("sanitizeHistoryForAgent — maps array and clones", () => {
  const { sanitizeHistoryForAgent, PROGRESSIVE_DISCLOSURE_PLACEHOLDER } = load();
  const disclosure = makeRequireParametersPayload();
  const history = [
    { role: "user", content: "call weather" },
    { role: "assistant", content: disclosure },
  ];
  const out = sanitizeHistoryForAgent(history);
  assert.equal(out[0].content, "call weather");
  assert.equal(out[1].content, PROGRESSIVE_DISCLOSURE_PLACEHOLDER);
  assert.equal(history[1].content, disclosure);
});
