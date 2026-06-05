const test = require("node:test");
const assert = require("node:assert/strict");

/**
 * Verifies static system prompt includes role + policies (agent-system-prompt-role).
 * Loads compiled prompts from dist; run after `npm run build`.
 */
function loadBuildStaticSystemPromptFresh() {
  const path = require.resolve("../dist/src/prompts/index");
  delete require.cache[path];
  return require(path).buildStaticSystemPrompt;
}

test("buildStaticSystemPrompt — en and zh contain expected markers", () => {
  const prev = process.env.AGENT_PROMPTS_LANGUAGE;

  try {
    process.env.AGENT_PROMPTS_LANGUAGE = "en";
    let buildStaticSystemPrompt = loadBuildStaticSystemPromptFresh();
    let s = buildStaticSystemPrompt();
    assert.ok(s.includes("[Role and mission]"));
    assert.ok(s.includes("[Skill generation policy]"));
    assert.ok(s.includes("[Extended skill routing]"));

    process.env.AGENT_PROMPTS_LANGUAGE = "zh";
    buildStaticSystemPrompt = loadBuildStaticSystemPromptFresh();
    s = buildStaticSystemPrompt();
    assert.ok(s.includes("[角色与使命]"));
    assert.ok(s.includes("[技能生成策略]"));
  } finally {
    if (prev !== undefined) process.env.AGENT_PROMPTS_LANGUAGE = prev;
    else delete process.env.AGENT_PROMPTS_LANGUAGE;
  }
});
