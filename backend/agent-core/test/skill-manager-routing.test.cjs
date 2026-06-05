const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function writeSkill(root, folder, content) {
  const skillDir = path.join(root, folder);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), content, "utf8");
}

test("SkillManager hides demo skills from model routing surfaces", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skill-manager-routing-"));
  const previousSkillDirs = process.env.AGENT_SKILLS_DIRS;

  writeSkill(tempRoot, "hello-world", `---
name: hello-world
description: Demo verification skill
metadata:
  category: demo
---

Use this only for demo verification.
`);

  writeSkill(tempRoot, "server-status", `---
name: server-status
description: Check server runtime status
metadata:
  category: ops
---

Use this to inspect server runtime state.
`);

  process.env.AGENT_SKILLS_DIRS = tempRoot;

  try {
    const { SkillManager } = require("../dist/src/skills/skill.manager");
    const manager = new SkillManager();

    const skills = manager.listSkills();
    assert.equal(skills.length, 2);

    const prompt = manager.buildSkillPromptContext();
    assert.ok(prompt.includes("server-status"));
    assert.ok(!prompt.includes("hello-world"));

    const tools = manager.getLangChainTools();
    assert.equal(tools.length, 1);
    assert.equal(tools[0].name, "skill_server_status");
  } finally {
    if (previousSkillDirs === undefined) {
      delete process.env.AGENT_SKILLS_DIRS;
    } else {
      process.env.AGENT_SKILLS_DIRS = previousSkillDirs;
    }

    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
