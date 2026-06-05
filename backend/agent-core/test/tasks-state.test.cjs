const test = require("node:test");
const assert = require("node:assert/strict");

/**
 * Integration / repeatable scenario:
 * Multi-task sequential work with "completed tasks not repeated" behaviour.
 *
 * Tests the core tasks-state logic without requiring an LLM connection.
 */

function loadModule() {
  return require("../dist/src/agent/tasks-state");
}

function fakeAIMessage(toolCalls) {
  return {
    getType() { return "ai"; },
    type: "ai",
    tool_calls: toolCalls,
    content: "",
  };
}

function fakeHumanMessage(content) {
  return {
    getType() { return "human"; },
    type: "human",
    content,
  };
}

function fakeToolMessage(toolCallId, content) {
  return {
    getType() { return "tool"; },
    type: "tool",
    tool_call_id: toolCallId,
    content,
  };
}

test("rebuildTasksStatusFromMessages — empty messages", () => {
  const { rebuildTasksStatusFromMessages } = loadModule();
  const result = rebuildTasksStatusFromMessages([]);
  assert.deepStrictEqual(result, {});
});

test("rebuildTasksStatusFromMessages — creates tasks from manage_tasks tool calls", () => {
  const { rebuildTasksStatusFromMessages } = loadModule();

  const messages = [
    fakeHumanMessage("check disk and restart nginx"),
    fakeAIMessage([
      {
        name: "manage_tasks",
        id: "call_1",
        args: {
          updates: [
            { id: "check-disk", label: "Check disk usage", status: "pending" },
            { id: "restart-nginx", label: "Restart nginx", status: "pending" },
          ],
        },
      },
    ]),
    fakeToolMessage("call_1", "Task status updated"),
  ];

  const result = rebuildTasksStatusFromMessages(messages);
  assert.equal(Object.keys(result).length, 2);
  assert.equal(result["check-disk"].status, "pending");
  assert.equal(result["restart-nginx"].status, "pending");
});

test("rebuildTasksStatusFromMessages — updates overwrite previous status", () => {
  const { rebuildTasksStatusFromMessages } = loadModule();

  const messages = [
    fakeAIMessage([
      {
        name: "manage_tasks",
        id: "call_1",
        args: {
          updates: [
            { id: "check-disk", label: "Check disk usage", status: "pending" },
            { id: "restart-nginx", label: "Restart nginx", status: "pending" },
          ],
        },
      },
    ]),
    fakeToolMessage("call_1", "ok"),
    fakeAIMessage([
      {
        name: "manage_tasks",
        id: "call_2",
        args: {
          updates: [
            { id: "check-disk", label: "Check disk usage", status: "completed" },
          ],
        },
      },
    ]),
    fakeToolMessage("call_2", "ok"),
  ];

  const result = rebuildTasksStatusFromMessages(messages);
  assert.equal(result["check-disk"].status, "completed");
  assert.equal(result["restart-nginx"].status, "pending");
});

test("rebuildTasksStatusFromMessages — ignores non-manage_tasks tool calls", () => {
  const { rebuildTasksStatusFromMessages } = loadModule();

  const messages = [
    fakeAIMessage([
      {
        name: "ssh_executor",
        id: "call_1",
        args: { host: "prod-01", command: "df -h" },
      },
    ]),
    fakeToolMessage("call_1", "Filesystem ..."),
  ];

  const result = rebuildTasksStatusFromMessages(messages);
  assert.deepStrictEqual(result, {});
});

test("buildTasksSummary — empty tasks returns empty string", () => {
  const { buildTasksSummary } = loadModule();
  assert.equal(buildTasksSummary({}), "");
});

test("buildTasksSummary — formats tasks correctly", () => {
  const { buildTasksSummary } = loadModule();

  const summary = buildTasksSummary({
    "check-disk": { label: "Check disk usage", status: "completed", updatedAt: "" },
    "restart-nginx": { label: "Restart nginx", status: "pending", updatedAt: "" },
  });

  assert.ok(summary.includes("1/2 completed"));
  assert.ok(summary.includes("[completed] check-disk"));
  assert.ok(summary.includes("[pending] restart-nginx"));
  assert.ok(summary.includes("Do NOT repeat work"));
});

test("preModelHook — injects summary and returns updated tasks_status", () => {
  const { preModelHook } = loadModule();
  const { SystemMessage } = require("@langchain/core/messages");

  const state = {
    messages: [
      fakeAIMessage([
        {
          name: "manage_tasks",
          id: "call_1",
          args: {
            updates: [
              { id: "task-a", label: "Task A", status: "completed" },
              { id: "task-b", label: "Task B", status: "in_progress" },
            ],
          },
        },
      ]),
      fakeToolMessage("call_1", "ok"),
    ],
    tasks_status: {},
    llmInputMessages: [
      fakeHumanMessage("do more work"),
    ],
  };

  const result = preModelHook(state);

  assert.equal(result.tasks_status["task-a"].status, "completed");
  assert.equal(result.tasks_status["task-b"].status, "in_progress");
  assert.ok(result.llmInputMessages.length > 1);

  const systemMsg = result.llmInputMessages[0];
  assert.ok(systemMsg instanceof SystemMessage);
  assert.ok(systemMsg.content.includes("1/2 completed"));
});

test("preModelHook — no summary injected when no tasks exist", () => {
  const { preModelHook } = loadModule();

  const userMsg = fakeHumanMessage("hello");
  const state = {
    messages: [userMsg],
    tasks_status: {},
    llmInputMessages: [userMsg],
  };

  const result = preModelHook(state);
  assert.deepStrictEqual(result.tasks_status, {});
  assert.equal(result.llmInputMessages.length, 1);
});

test("preModelHook — handles undefined llmInputMessages gracefully", () => {
  const { preModelHook } = loadModule();

  const userMsg = fakeHumanMessage("hello");
  const state = {
    messages: [userMsg],
    tasks_status: {},
    // llmInputMessages intentionally omitted (undefined)
  };

  const result = preModelHook(state);
  assert.deepStrictEqual(result.tasks_status, {});
  assert.equal(result.llmInputMessages.length, 1);
  assert.equal(result.llmInputMessages[0].content, "hello");
});

test("scenario: multi-task sequential — completed tasks not repeated", () => {
  const { rebuildTasksStatusFromMessages, buildTasksSummary } = loadModule();

  const messages = [
    fakeHumanMessage("Check disk on prod-01, then restart nginx, then verify logs"),

    // LLM registers tasks
    fakeAIMessage([
      {
        name: "manage_tasks",
        id: "call_reg",
        args: {
          updates: [
            { id: "check-disk", label: "Check disk on prod-01", status: "in_progress" },
            { id: "restart-nginx", label: "Restart nginx", status: "pending" },
            { id: "verify-logs", label: "Verify logs", status: "pending" },
          ],
        },
      },
    ]),
    fakeToolMessage("call_reg", "ok"),

    // LLM calls SSH to check disk
    fakeAIMessage([{ name: "ssh_executor", id: "call_ssh1", args: { command: "df -h" } }]),
    fakeToolMessage("call_ssh1", "Filesystem 50% used"),

    // LLM marks check-disk completed, starts restart-nginx
    fakeAIMessage([
      {
        name: "manage_tasks",
        id: "call_u1",
        args: {
          updates: [
            { id: "check-disk", label: "Check disk on prod-01", status: "completed" },
            { id: "restart-nginx", label: "Restart nginx", status: "in_progress" },
          ],
        },
      },
    ]),
    fakeToolMessage("call_u1", "ok"),

    // LLM calls SSH to restart nginx
    fakeAIMessage([{ name: "ssh_executor", id: "call_ssh2", args: { command: "systemctl restart nginx" } }]),
    fakeToolMessage("call_ssh2", "ok"),

    // LLM marks restart-nginx completed, starts verify-logs
    fakeAIMessage([
      {
        name: "manage_tasks",
        id: "call_u2",
        args: {
          updates: [
            { id: "restart-nginx", label: "Restart nginx", status: "completed" },
            { id: "verify-logs", label: "Verify logs", status: "in_progress" },
          ],
        },
      },
    ]),
    fakeToolMessage("call_u2", "ok"),
  ];

  const tasks = rebuildTasksStatusFromMessages(messages);

  assert.equal(tasks["check-disk"].status, "completed");
  assert.equal(tasks["restart-nginx"].status, "completed");
  assert.equal(tasks["verify-logs"].status, "in_progress");

  const summary = buildTasksSummary(tasks);
  assert.ok(summary.includes("2/3 completed"));
  assert.ok(summary.includes("Do NOT repeat work for completed tasks"));
});
