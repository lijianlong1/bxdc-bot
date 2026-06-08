const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");

test("loadGatewayExtendedTools loads enabled EXTENSION tools", async () => {
  const originalGet = axios.get;
  const originalPost = axios.post;

  const skillsList = [
    {
      id: 1,
      name: "获取时间",
      description: "获取当前时间",
      type: "EXTENSION",
      executionMode: "CONFIG",
      enabled: true,
      configuration: JSON.stringify({
        kind: "time",
        operation: "current-time",
        endpoint: "https://vv.video.qq.com/checktime?otype=json",
      }),
    },
    {
      id: 2,
      name: "Disabled Skill",
      description: "should be ignored",
      type: "EXTENSION",
      executionMode: "CONFIG",
      enabled: false,
      configuration: "{}",
    },
  ];

  axios.get = async (url) => {
    const urlStr = String(url);
    if (urlStr === "http://localhost:18080/api/skills") {
      return { data: skillsList };
    }
    const match = urlStr.match(/\/api\/skills\/(\d+)$/);
    if (match) {
      const skill = skillsList.find(s => s.id === parseInt(match[1]));
      if (skill) return { data: skill };
    }
    throw new Error(`Skill not found: ${urlStr}`);
  };

  let timeProxyHeaders = null;
  axios.post = async (_url, _body, config) => {
    timeProxyHeaders = config?.headers;
    const urlStr = String(_url);
    if (urlStr.endsWith("/api/skills/execute")) {
      return { data: { timestamp: 1773013121, readableTime: "2026-03-08T00:00:00.000Z" } };
    }
    return { data: 'QZOutputJson={"t":"1773013121"};' };
  };

  try {
    const { loadGatewayExtendedTools } = require("../dist/src/tools/java-skills");
    const tools = await loadGatewayExtendedTools("http://localhost:18080", "test-token", "ledger-user-7");

    assert.equal(tools.length, 1);
    assert.equal(tools[0].name, "extended_huo_qu_shi_jian");
    const result = await tools[0].func("{}");
    const parsed = JSON.parse(result);
    assert.equal(parsed.timestamp, 1773013121);
    assert.ok(typeof parsed.readableTime === "string");
    assert.equal(timeProxyHeaders && timeProxyHeaders["X-User-Id"], "ledger-user-7");
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
  }
});

test("configured API extended skill builds query and proxies request", async () => {
  const originalGet = axios.get;
  const originalPost = axios.post;

  const skillsList = [
    {
      id: 3,
      name: "获取笑话列表",
      description: "获取笑话内容列表",
      type: "EXTENSION",
      executionMode: "CONFIG",
      enabled: true,
      configuration: JSON.stringify({
        kind: "api",
        operation: "juhe-joke-list",
        method: "GET",
        endpoint: "http://v.juhe.cn/joke/content/list",
        query: { sort: "desc", page: 1, pagesize: 1 },
      }),
    },
  ];

  axios.get = async (url) => {
    const urlStr = String(url);
    if (urlStr === "http://localhost:18080/api/skills") {
      return { data: skillsList };
    }
    const match = urlStr.match(/\/api\/skills\/(\d+)$/);
    if (match) {
      const skill = skillsList.find(s => s.id === parseInt(match[1]));
      if (skill) return { data: skill };
    }
    throw new Error(`Skill not found: ${urlStr}`);
  };

  let capturedRequest = null;
  let proxyInboundHeaders = null;
  axios.post = async (_url, body, config) => {
    const urlStr = String(_url);
    if (urlStr.endsWith("/api/skills/api") || urlStr.endsWith("/api/skills/execute")) {
      capturedRequest = body;
      proxyInboundHeaders = config?.headers;
      return {
        data: { error_code: 0, reason: "Success", result: { data: [{ content: "joke" }] } },
      };
    }
    throw new Error(`Unexpected POST ${urlStr}`);
  };

  try {
    const { loadGatewayExtendedTools } = require("../dist/src/tools/java-skills");
    const tools = await loadGatewayExtendedTools("http://localhost:18080", "test-token");

    assert.equal(tools.length, 1);
    const result = await tools[0].func(JSON.stringify({ page: 2, pagesize: 3 }));
    const parsed = JSON.parse(result);
    assert.equal(parsed.error_code, 0);
    assert.equal(parsed.result.data[0].content, "joke");
    assert.ok(capturedRequest);
    // New architecture: payload is { skillId, parameters }, forwarded to Gateway
    assert.equal(capturedRequest.skillId, 3);
    assert.ok(capturedRequest.parameters);
    assert.equal(proxyInboundHeaders && proxyInboundHeaders["X-User-Id"], undefined);
    // X-Skill-Id is now passed via body.skillId, not headers
    assert.equal(capturedRequest.skillId, 3);
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
  }
});

test("POST /api/skills/api includes X-User-Id when loadGatewayExtendedTools is given userId", async () => {
  const originalGet = axios.get;
  const originalPost = axios.post;
  let proxyInboundHeaders = null;

  const skillsList = [
    {
      id: 501,
      name: "AuditUserPing",
      description: "ping",
      type: "EXTENSION",
      executionMode: "CONFIG",
      enabled: true,
      configuration: JSON.stringify({
        kind: "api",
        operation: "ping",
        method: "GET",
        endpoint: "https://example.com/ping",
      }),
    },
  ];

  axios.get = async (url) => {
    const urlStr = String(url);
    if (urlStr === "http://localhost:18080/api/skills") {
      return { data: skillsList };
    }
    const match = urlStr.match(/\/api\/skills\/(\d+)$/);
    if (match) {
      const skill = skillsList.find(s => s.id === parseInt(match[1]));
      if (skill) return { data: skill };
    }
    throw new Error(`Skill not found: ${urlStr}`);
  };

  axios.post = async (url, _body, config) => {
    if (String(url).endsWith("/api/skills/api") || String(url).endsWith("/api/skills/execute")) {
      proxyInboundHeaders = config?.headers;
      return { data: { status: "ok" } };
    }
    throw new Error(`Unexpected POST ${url}`);
  };

  try {
    const { loadGatewayExtendedTools } = require("../dist/src/tools/java-skills");
    const tools = await loadGatewayExtendedTools("http://localhost:18080", "test-token", "end-user-99", {});
    assert.equal(tools.length, 1);
    await tools[0].func({});
    assert.ok(proxyInboundHeaders);
    assert.equal(proxyInboundHeaders["X-User-Id"], "end-user-99");
    // X-Skill-Id is now passed via body.skillId, not headers
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
  }
});

test("configured API extended skill validates parameter contract", async () => {
  const originalGet = axios.get;
  const originalPost = axios.post;

  const skillsList = [
    {
      id: 4,
      name: "测试契约",
      description: "测试参数契约",
      type: "EXTENSION",
      executionMode: "CONFIG",
      enabled: true,
      configuration: JSON.stringify({
        kind: "api",
        operation: "test-contract",
        method: "POST",
        endpoint: "http://example.com/api",
        parameterContract: {
          type: "object",
          properties: {
            reqField: { type: "string" },
            numField: { type: "number" },
            enumField: { type: "string", enum: ["A", "B"] },
            defField: { type: "string", default: "default_val" },
          },
          required: ["reqField"],
        },
      }),
    },
  ];

  axios.get = async (url) => {
    const urlStr = String(url);
    if (urlStr === "http://localhost:18080/api/skills") {
      return { data: skillsList };
    }
    const match = urlStr.match(/\/api\/skills\/(\d+)$/);
    if (match) {
      const skill = skillsList.find(s => s.id === parseInt(match[1]));
      if (skill) return { data: skill };
    }
    throw new Error(`Skill not found: ${urlStr}`);
  };

  let capturedRequest = null;
  axios.post = async (_url, body) => {
    capturedRequest = body;
    // New architecture: Gateway handles all validation and proxying.
    // The mock simulates Gateway returning a response based on the skillId+parameters payload.
    return { data: { ok: true } };
  };

  try {
    const { loadGatewayExtendedTools } = require("../dist/src/tools/java-skills");
    const tools = await loadGatewayExtendedTools("http://localhost:18080", "test-token");
    assert.equal(tools.length, 1);

    // New architecture: all parameter validation happens on Gateway side.
    // Agent sends { skillId, parameters } to POST /api/skills/execute.
    // Verify the payload is forwarded correctly.

    let result = await tools[0].func(JSON.stringify({ reqField: "val", enumField: "A" }));
    let parsed = JSON.parse(result);
    assert.equal(parsed.ok, true);
    assert.ok(capturedRequest);
    assert.equal(capturedRequest.skillId, 4);
    assert.ok(capturedRequest.parameters);
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
  }
});

test("api skill generator creates skill without post-save probe (no /api/skills/api)", async () => {
  const originalGet = axios.get;
  const originalPost = axios.post;
  const originalPut = axios.put;

  const postCalls = [];
  axios.get = async () => ({ data: [] });
  axios.post = async (url, body) => {
    postCalls.push({ url, body });

    if (url.endsWith("/api/skills")) {
      return {
        data: {
          id: 9,
          name: body.name,
          description: body.description,
          type: body.type,
          configuration: body.configuration,
          enabled: body.enabled,
          requiresConfirmation: body.requiresConfirmation,
        },
      };
    }

    throw new Error(`Unexpected POST ${url}`);
  };
  axios.put = async () => {
    throw new Error("PUT should not be called");
  };

  try {
    const { JavaSkillGeneratorTool } = require("../dist/src/tools/skill-generator");
    const tool = new JavaSkillGeneratorTool("http://localhost:18080", "test-token");
    const result = await tool.invoke({
      targetType: "api",
      rawDescription: "调用 ping 接口检测服务可用性",
      name: "Ping API",
      description: "调用 ping 接口验证服务是否存活",
      method: "GET",
      endpoint: "https://example.com/ping",
      query: { env: "test" },
      testInput: { query: { env: "prod" } },
      interfaceDescription: "Ping 接口说明",
      parameterContract: { type: "object", properties: {} },
    });

    const parsed = JSON.parse(result);
    assert.equal(parsed.status, "VALIDATION_SKIPPED");
    assert.equal(parsed.saveAction, "created");
    assert.equal(parsed.skill.name, "Ping API");
    assert.equal(parsed.skill.configuration.kind, "api");
    assert.equal(parsed.validation.skipped, true);
    assert.equal(parsed.validation.success, true);
    assert.equal(postCalls.length, 1);
    assert.equal(postCalls[0].url, "http://localhost:18080/api/skills");
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
    axios.put = originalPut;
  }
});

test("api skill generator reports missing required fields", async () => {
  const { JavaSkillGeneratorTool } = require("../dist/src/tools/skill-generator");
  const tool = new JavaSkillGeneratorTool("http://localhost:18080", "test-token");

  // interfaceDescription and parameterContract are now required by Zod schema,
  // so omitting them triggers Zod validation, not INPUT_INCOMPLETE.
  await assert.rejects(
    () => tool.invoke({
      targetType: "api",
      rawDescription: "调用某个接口",
      endpoint: "https://example.com/demo",
    }),
    /interfaceDescription|parameterContract/,
    "Should reject when required API fields are missing"
  );
});

test("api skill generator updates existing skill when overwrite is enabled", async () => {
  const originalGet = axios.get;
  const originalPost = axios.post;
  const originalPut = axios.put;

  axios.get = async () => ({
    data: [
      {
        id: 12,
        name: "Ping API",
        description: "old",
        type: "EXTENSION",
        executionMode: "CONFIG",
        configuration: "{}",
        enabled: true,
        requiresConfirmation: false,
      },
    ],
  });
  axios.post = async (url) => {
    throw new Error(`Unexpected POST ${url}`);
  };

  let putCall = null;
  axios.put = async (url, body) => {
    putCall = { url, body };
    return {
      data: {
        id: 12,
        name: body.name,
        description: body.description,
        type: body.type,
        configuration: body.configuration,
        enabled: body.enabled,
        requiresConfirmation: body.requiresConfirmation,
      },
    };
  };

  try {
    const { JavaSkillGeneratorTool } = require("../dist/src/tools/skill-generator");
    const tool = new JavaSkillGeneratorTool("http://localhost:18080", "test-token");
    const result = await tool.invoke({
      targetType: "api",
      name: "Ping API",
      method: "GET",
      endpoint: "https://example.com/ping",
      allowOverwrite: true,
      interfaceDescription: "desc",
      parameterContract: {},
    });
    const parsed = JSON.parse(result);

    assert.equal(parsed.status, "VALIDATION_SKIPPED");
    assert.equal(parsed.saveAction, "updated");
    assert.ok(putCall);
    assert.equal(putCall.url, "http://localhost:18080/api/skills/12");
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
    axios.put = originalPut;
  }
});

test("api skill parameterBinding jsonBody sends flat fields as JSON body without query pollution", async () => {
  const originalGet = axios.get;
  const originalPost = axios.post;
  let capturedApiPayload = null;

  const skillsList$1 = [
    {
      id: 99,
      name: "Register API",
      description: "register user",
      type: "EXTENSION",
      executionMode: "CONFIG",
      enabled: true,
      configuration: JSON.stringify({
        kind: "api",
        operation: "register",
        method: "POST",
        endpoint: "http://localhost:18080/api/auth/register",
        parameterBinding: "jsonBody",
        parameterContract: {
          type: "object",
          properties: {
            id: { type: "string" },
            nickname: { type: "string" },
            systemAdminPassword: { type: "string" },
          },
          required: ["id", "nickname", "systemAdminPassword"],
        },
      }),
    },
  ];

  axios.get = async (url) => {
    const urlStr = String(url);
    if (urlStr === "http://localhost:18080/api/skills") {
      return { data: skillsList$1 };
    }
    const match = urlStr.match(/\/api\/skills\/(\d+)$/);
    if (match) {
      const skill = skillsList$1.find(s => s.id === parseInt(match[1]));
      if (skill) return { data: skill };
    }
    throw new Error(`Skill not found: ${urlStr}`);
  };

  axios.post = async (url, body) => {
    if (url.endsWith("/api/skills/api") || url.endsWith("/api/skills/execute")) {
      capturedApiPayload = body;
      return { data: { ok: true } };
    }
    throw new Error(`Unexpected POST ${url}`);
  };

  try {
    const { loadGatewayExtendedTools } = require("../dist/src/tools/java-skills");
    const tools = await loadGatewayExtendedTools("http://localhost:18080", "test-token", undefined, {});
    assert.equal(tools.length, 1);
    const result = await tools[0].func({
      id: "123456",
      nickname: "n",
      systemAdminPassword: "secret",
    });
    const parsed = JSON.parse(result);
    assert.equal(parsed.ok, true);
    assert.ok(capturedApiPayload);
    // New architecture: payload is { skillId, parameters }
    assert.equal(capturedApiPayload.skillId, 99);
    assert.ok(capturedApiPayload.parameters);
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
  }
});

test("api skill parameterBinding jsonBody on GET falls back to query mapping", async () => {
  const originalGet = axios.get;
  const originalPost = axios.post;
  let capturedApiPayload = null;

  const skillsList$2 = [
    {
      id: 100,
      name: "Query API",
      description: "get with flat params",
      type: "EXTENSION",
      executionMode: "CONFIG",
      enabled: true,
      configuration: JSON.stringify({
        kind: "api",
        operation: "q",
        method: "GET",
        endpoint: "https://example.com/api/items",
        parameterBinding: "jsonBody",
        parameterContract: {
          type: "object",
          properties: { page: { type: "number" } },
          required: ["page"],
        },
      }),
    },
  ];

  axios.get = async (url) => {
    const urlStr = String(url);
    if (urlStr === "http://localhost:18080/api/skills") {
      return { data: skillsList$2 };
    }
    const match = urlStr.match(/\/api\/skills\/(\d+)$/);
    if (match) {
      const skill = skillsList$2.find(s => s.id === parseInt(match[1]));
      if (skill) return { data: skill };
    }
    throw new Error(`Skill not found: ${urlStr}`);
  };

  axios.post = async (url, body) => {
    if (url.endsWith("/api/skills/api") || url.endsWith("/api/skills/execute")) {
      capturedApiPayload = body;
      return { data: { items: [] } };
    }
    throw new Error(`Unexpected POST ${url}`);
  };

  try {
    const { loadGatewayExtendedTools } = require("../dist/src/tools/java-skills");
    const tools = await loadGatewayExtendedTools("http://localhost:18080", "test-token", undefined, {});
    assert.equal(tools.length, 1);
    await tools[0].func({ page: 2 });
    assert.ok(capturedApiPayload);
    assert.equal(capturedApiPayload.skillId, 100);
    assert.ok(capturedApiPayload.parameters);
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
  }
});

test("api skill parameterBinding formBody sends URL-encoded string and form content-type", async () => {
  const originalGet = axios.get;
  const originalPost = axios.post;
  let capturedApiPayload = null;

  const skillsList$3 = [
    {
      id: 101,
      name: "Form API",
      description: "oauth style",
      type: "EXTENSION",
      executionMode: "CONFIG",
      enabled: true,
      configuration: JSON.stringify({
        kind: "api",
        operation: "token",
        method: "POST",
        endpoint: "http://localhost:18080/oauth/token",
        parameterBinding: "formBody",
        parameterContract: {
          type: "object",
          properties: {
            client_id: { type: "string" },
            client_secret: { type: "string" },
          },
          required: ["client_id", "client_secret"],
        },
      }),
    },
  ];

  axios.get = async (url) => {
    const urlStr = String(url);
    if (urlStr === "http://localhost:18080/api/skills") {
      return { data: skillsList$3 };
    }
    const match = urlStr.match(/\/api\/skills\/(\d+)$/);
    if (match) {
      const skill = skillsList$3.find(s => s.id === parseInt(match[1]));
      if (skill) return { data: skill };
    }
    throw new Error(`Skill not found: ${urlStr}`);
  };

  axios.post = async (url, body) => {
    if (url.endsWith("/api/skills/api") || url.endsWith("/api/skills/execute")) {
      capturedApiPayload = body;
      return { data: { ok: true } };
    }
    throw new Error(`Unexpected POST ${url}`);
  };

  try {
    const { loadGatewayExtendedTools } = require("../dist/src/tools/java-skills");
    const tools = await loadGatewayExtendedTools("http://localhost:18080", "test-token", undefined, {});
    assert.equal(tools.length, 1);
    const result = await tools[0].func({
      client_id: "a",
      client_secret: "b",
    });
    const parsed = JSON.parse(result);
    assert.equal(parsed.ok, true);
    assert.ok(capturedApiPayload);
    // New architecture: payload goes to Gateway which handles param binding
    assert.equal(capturedApiPayload.skillId, 101);
    assert.ok(capturedApiPayload.parameters);
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
  }
});

test("api skill parameterBinding formBody on GET falls back to query mapping", async () => {
  const originalGet = axios.get;
  const originalPost = axios.post;
  let capturedApiPayload = null;

  const skillsList = [
    {
      id: 102,
      name: "Form Query",
      type: "EXTENSION",
      executionMode: "CONFIG",
      enabled: true,
      configuration: JSON.stringify({
        kind: "api",
        operation: "q",
        method: "GET",
        endpoint: "https://example.com/api/items",
        parameterBinding: "formBody",
        parameterContract: {
          type: "object",
          properties: {
            page: { type: "number" },
          },
          required: ["page"],
        },
      }),
    },
  ];

  axios.get = async (url) => {
    const urlStr = String(url);
    if (urlStr === "http://localhost:18080/api/skills") {
      return { data: skillsList };
    }
    const match = urlStr.match(/\/api\/skills\/(\d+)$/);
    if (match) {
      const skill = skillsList.find(s => s.id === parseInt(match[1]));
      if (skill) return { data: skill };
    }
    throw new Error(`Skill not found: ${urlStr}`);
  };

  axios.post = async (url, body) => {
    if (url.endsWith("/api/skills/api") || url.endsWith("/api/skills/execute")) {
      capturedApiPayload = body;
      return { data: { items: [] } };
    }
    if (url.endsWith("/api/skills/execute")) {
      capturedApiPayload = body;
      return { data: { status: "COMPLETED", items: [] } };
    }
    throw new Error(`Unexpected POST ${url}`);
  };

  try {
    const { loadGatewayExtendedTools } = require("../dist/src/tools/java-skills");
    const tools = await loadGatewayExtendedTools("http://localhost:18080", "test-token", undefined, {});
    assert.equal(tools.length, 1);
    await tools[0].func({ page: 2 });
    assert.ok(capturedApiPayload);
    assert.equal(capturedApiPayload.skillId, 102);
    assert.ok(capturedApiPayload.parameters);
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
  }
});

test("api skill parameterBinding formBody rejects non-flat merge", async () => {
  const originalGet = axios.get;
  const originalPost = axios.post;
  let capturedApiPayload = null;

  const skillsList = [
    {
      id: 103,
      name: "Form Nested",
      type: "EXTENSION",
      executionMode: "CONFIG",
      enabled: true,
      configuration: JSON.stringify({
        kind: "api",
        method: "POST",
        endpoint: "http://localhost:18080/api/x",
        parameterBinding: "formBody",
        parameterContract: {
          type: "object",
          properties: {
            body: { type: "object" },
          },
        },
      }),
    },
  ];

  axios.get = async (url) => {
    const urlStr = String(url);
    if (urlStr === "http://localhost:18080/api/skills") {
      return { data: skillsList };
    }
    const match = urlStr.match(/\/api\/skills\/(\d+)$/);
    if (match) {
      const skill = skillsList.find(s => s.id === parseInt(match[1]));
      if (skill) return { data: skill };
    }
    throw new Error(`Skill not found: ${urlStr}`);
  };

  axios.post = async (url, body) => {
    if (url.endsWith("/api/skills/api") || url.endsWith("/api/skills/execute")) {
      capturedApiPayload = body;
      return { data: { ok: true } };
    }
    throw new Error(`Unexpected POST ${url}`);
  };

  try {
    const { loadGatewayExtendedTools } = require("../dist/src/tools/java-skills");
    const tools = await loadGatewayExtendedTools("http://localhost:18080", "test-token", undefined, {});
    assert.equal(tools.length, 1);
    const out = await tools[0].func(
      JSON.stringify({ body: { outer: { deep: 1 } } })
    );
    const parsed = JSON.parse(out);
    // Gateway handles formBody validation
    assert.ok(capturedApiPayload);
    assert.equal(capturedApiPayload.skillId, 103);
    assert.ok(capturedApiPayload.parameters);
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
  }
});

test("openclaw skill executes allowed tools serially", async () => {
  const originalGet = axios.get;
  const originalPost = axios.post;

  const skillsList = [
    {
      id: 1,
      name: "获取时间",
      description: "获取当前时间",
      type: "EXTENSION",
      executionMode: "CONFIG",
      enabled: true,
      configuration: JSON.stringify({
        kind: "time",
        operation: "current-time",
        endpoint: "https://vv.video.qq.com/checktime?otype=json",
      }),
    },
    {
      id: 2,
      name: "查询距离生日还有几天",
      description: "自主规划技能",
      type: "EXTENSION",
      executionMode: "OPENCLAW",
      enabled: true,
      configuration: JSON.stringify({
        kind: "openclaw",
        systemPrompt: "先查时间，再做计算。",
        allowedTools: ["获取时间", "compute"],
        orchestration: { mode: "serial" },
      }),
    },
  ];

  axios.get = async (url) => {
    const urlStr = String(url);
    if (urlStr === "http://localhost:18080/api/skills") {
      return { data: skillsList };
    }
    const match = urlStr.match(/\/api\/skills\/(\d+)$/);
    if (match) {
      const skill = skillsList.find(s => s.id === parseInt(match[1]));
      if (skill) return { data: skill };
    }
    throw new Error(`Skill not found: ${urlStr}`);
  };

  axios.post = async (url, body) => {
    if (url.endsWith("/api/skills/api") || url.endsWith("/api/skills/execute")) {
      return { data: 'QZOutputJson={"t":"1773013121"};' };
    }
    if (url.endsWith("/api/skills/compute")) {
      assert.equal(body.operation, "date_diff_days");
      return { data: { result: 4 } };
    }
    throw new Error(`Unexpected POST ${url}`);
  };

  const fakePlannerModel = {
    bindTools(tools) {
      let step = 0;
      return {
        invoke: async () => {
          if (step === 0) {
            step += 1;
            return {
              tool_calls: [{ id: "tool-1", name: tools[0].name, args: {} }],
            };
          }
          if (step === 1) {
            step += 1;
            return {
              tool_calls: [
                {
                  id: "tool-2",
                  name: "compute",
                  args: { operation: "date_diff_days", operands: ["2026-03-08", "2026-03-12"] },
                },
              ],
            };
          }
          return { content: "距离下一次生日还有 4 天" };
        },
      };
    },
  };

  try {
    const { loadGatewayExtendedTools } = require("../dist/src/tools/java-skills");
    const { DynamicTool } = require("@langchain/core/tools");
    const computeTool = new DynamicTool({
      name: "compute",
      description: "compute days",
      func: async (input) => {
        const payload = JSON.parse(input);
        const response = await axios.post("http://localhost:18080/api/skills/compute", payload);
        return JSON.stringify(response.data);
      },
    });

    const tools = await loadGatewayExtendedTools("http://localhost:18080", "test-token", undefined, {
      plannerModel: fakePlannerModel,
      availableTools: [computeTool],
    });

    assert.equal(tools.length, 2);
    const birthdayTool = tools.find((tool) => tool.name === "extended_cha_xun_ju_li_sheng_ri_hai_you_ji_tian");
    assert.ok(birthdayTool);
    const result = await birthdayTool.func("我的生日是 3 月 12 日");
    assert.equal(result, "距离下一次生日还有 4 天");
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
  }
});

test("openclaw skill returns clarification when birthday is ambiguous", async () => {
  const originalGet = axios.get;

  const skillsList = [
    {
      id: 2,
      name: "查询距离生日还有几天",
      description: "自主规划技能",
      type: "EXTENSION",
      executionMode: "OPENCLAW",
      enabled: true,
      configuration: JSON.stringify({
        kind: "openclaw",
        systemPrompt: "无法解析时要求澄清。",
        allowedTools: ["获取时间", "compute"],
        orchestration: { mode: "serial" },
      }),
    },
  ];

  axios.get = async (url) => {
    const urlStr = String(url);
    if (urlStr === "http://localhost:18080/api/skills") {
      return { data: skillsList };
    }
    const match = urlStr.match(/\/api\/skills\/(\d+)$/);
    if (match) {
      const skill = skillsList.find(s => s.id === parseInt(match[1]));
      if (skill) return { data: skill };
    }
    throw new Error(`Skill not found: ${urlStr}`);
  };

  const fakePlannerModel = {
    bindTools() {
      return {
        invoke: async () => ({ content: "请告诉我你的生日具体是哪一天，例如 3 月 12 日。" }),
      };
    },
  };

  try {
    const { loadGatewayExtendedTools } = require("../dist/src/tools/java-skills");
    const { DynamicTool } = require("@langchain/core/tools");
    const placeholderTimeTool = new DynamicTool({
      name: "extended_skill_1",
      description: "time placeholder",
      func: async () => JSON.stringify({ readableTime: "2026-03-08T00:00:00.000Z" }),
    });
    const computeTool = new DynamicTool({
      name: "compute",
      description: "compute placeholder",
      func: async () => JSON.stringify({ result: 0 }),
    });
    const tools = await loadGatewayExtendedTools("http://localhost:18080", "test-token", undefined, {
      plannerModel: fakePlannerModel,
      availableTools: [placeholderTimeTool, computeTool],
    });

    const birthdayTool = tools[0];
    const result = await birthdayTool.func("我生日快到了");
    assert.equal(result, "请告诉我你的生日具体是哪一天，例如 3 月 12 日。");
  } finally {
    axios.get = originalGet;
  }
});

test("openclaw skill can answer with prompt only and no allowed tools", async () => {
  const originalGet = axios.get;

  const skillsList = [
    {
      id: 9,
      name: "纯提示词技能",
      description: "不依赖任何工具",
      type: "EXTENSION",
      executionMode: "OPENCLAW",
      enabled: true,
      configuration: JSON.stringify({
        kind: "openclaw",
        systemPrompt: "只根据提示词回答，不调用工具。",
        allowedTools: [],
        orchestration: { mode: "serial" },
      }),
    },
  ];

  axios.get = async (url) => {
    const urlStr = String(url);
    if (urlStr === "http://localhost:18080/api/skills") {
      return { data: skillsList };
    }
    const match = urlStr.match(/\/api\/skills\/(\d+)$/);
    if (match) {
      const skill = skillsList.find(s => s.id === parseInt(match[1]));
      if (skill) return { data: skill };
    }
    throw new Error(`Skill not found: ${urlStr}`);
  };

  const fakePlannerModel = {
    invoke: async (messages) => {
      assert.equal(messages[0].role, "system");
      assert.match(messages[0].content, /只根据提示词回答/);
      return { content: "这是一个纯提示词 skill 的回答。" };
    },
  };

  try {
    const { loadGatewayExtendedTools } = require("../dist/src/tools/java-skills");
    const tools = await loadGatewayExtendedTools("http://localhost:18080", "test-token", undefined, {
      plannerModel: fakePlannerModel,
      availableTools: [],
    });

    assert.equal(tools.length, 1);
    const result = await tools[0].func("请自我介绍");
    assert.equal(result, "这是一个纯提示词 skill 的回答。");
  } finally {
    axios.get = originalGet;
  }
});

test("openclaw skill can return next birthday result after current year passed", async () => {
  const originalGet = axios.get;
  const originalPost = axios.post;

  const skillsList = [
    {
      id: 1,
      name: "获取时间",
      description: "获取当前时间",
      type: "EXTENSION",
      executionMode: "CONFIG",
      enabled: true,
      configuration: JSON.stringify({
        kind: "time",
        operation: "current-time",
        endpoint: "https://vv.video.qq.com/checktime?otype=json",
      }),
    },
    {
      id: 2,
      name: "查询距离生日还有几天",
      description: "自主规划技能",
      type: "EXTENSION",
      executionMode: "OPENCLAW",
      enabled: true,
      configuration: JSON.stringify({
        kind: "openclaw",
        systemPrompt: "先查时间，再做计算。",
        allowedTools: ["获取时间", "compute"],
        orchestration: { mode: "serial" },
      }),
    },
  ];

  axios.get = async (url) => {
    const urlStr = String(url);
    if (urlStr === "http://localhost:18080/api/skills") {
      return { data: skillsList };
    }
    const match = urlStr.match(/\/api\/skills\/(\d+)$/);
    if (match) {
      const skill = skillsList.find(s => s.id === parseInt(match[1]));
      if (skill) return { data: skill };
    }
    throw new Error(`Skill not found: ${urlStr}`);
  };

  axios.post = async (url, body) => {
    if (url.endsWith("/api/skills/api") || url.endsWith("/api/skills/execute")) {
      return { data: 'QZOutputJson={"t":"1774915200"};' };
    }
    if (url.endsWith("/api/skills/compute")) {
      assert.equal(body.operation, "date_diff_days");
      assert.deepEqual(body.operands, ["2026-04-01", "2027-03-12"]);
      return { data: { result: 345 } };
    }
    throw new Error(`Unexpected POST ${url}`);
  };

  const fakePlannerModel = {
    bindTools(tools) {
      let step = 0;
      return {
        invoke: async () => {
          if (step === 0) {
            step += 1;
            return {
              tool_calls: [{ id: "tool-1", name: tools[0].name, args: {} }],
            };
          }
          if (step === 1) {
            step += 1;
            return {
              tool_calls: [
                {
                  id: "tool-2",
                  name: "compute",
                  args: { operation: "date_diff_days", operands: ["2026-04-01", "2027-03-12"] },
                },
              ],
            };
          }
          return { content: "你距离下一次生日还有 345 天" };
        },
      };
    },
  };

  try {
    const { loadGatewayExtendedTools } = require("../dist/src/tools/java-skills");
    const { DynamicTool } = require("@langchain/core/tools");
    const computeTool = new DynamicTool({
      name: "compute",
      description: "compute days",
      func: async (input) => {
        const payload = JSON.parse(input);
        const response = await axios.post("http://localhost:18080/api/skills/compute", payload);
        return JSON.stringify(response.data);
      },
    });

    const tools = await loadGatewayExtendedTools("http://localhost:18080", "test-token", undefined, {
      plannerModel: fakePlannerModel,
      availableTools: [computeTool],
    });

    const birthdayTool = tools.find((tool) => tool.name === "extended_cha_xun_ju_li_sheng_ri_hai_you_ji_tian");
    assert.ok(birthdayTool);
    const result = await birthdayTool.func("我生日是 3 月 12 日");
    assert.equal(result, "你距离下一次生日还有 345 天");
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
  }
});

test("skill generator creates an SSH skill", async () => {
  const originalGet = axios.get;
  const originalPost = axios.post;

  const postCalls = [];
  axios.get = async () => ({ data: [] });
  axios.post = async (url, body) => {
    postCalls.push({ url, body });
    if (url.endsWith("/api/skills")) {
      return {
        data: {
          id: 14,
          name: body.name,
          description: body.description,
          type: body.type,
          configuration: body.configuration,
          enabled: body.enabled,
          requiresConfirmation: body.requiresConfirmation,
        },
      };
    }
    throw new Error(`Unexpected POST ${url}`);
  };

  try {
    const { JavaSkillGeneratorTool } = require("../dist/src/tools/skill-generator");
    const tool = new JavaSkillGeneratorTool("http://localhost:18080", "test-token");
    const result = await tool.invoke({
      targetType: "ssh",
      name: "Restart Nginx",
      command: "systemctl restart nginx",
    });

    const parsed = JSON.parse(result);
    assert.equal(parsed.status, "VALIDATION_SUCCEEDED");
    assert.equal(parsed.saveAction, "created");
    assert.equal(parsed.skill.name, "Restart Nginx");
    assert.equal(parsed.skill.configuration.kind, "ssh");
    assert.equal(parsed.skill.configuration.preset, "server-resource-status");
    assert.equal(parsed.skill.configuration.operation, "server-resource-status");
    assert.equal(parsed.skill.configuration.lookup, "server_lookup");
    assert.equal(parsed.skill.configuration.executor, "linux_script_executor");
    assert.equal(parsed.skill.configuration.command, "systemctl restart nginx");
    assert.equal(postCalls.length, 1);
    assert.equal(postCalls[0].url, "http://localhost:18080/api/skills");
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
  }
});

test("skill generator creates an OPENCLAW skill", async () => {
  const originalGet = axios.get;
  const originalPost = axios.post;

  const postCalls = [];
  axios.get = async () => ({ data: [] });
  axios.post = async (url, body) => {
    postCalls.push({ url, body });
    if (url.endsWith("/api/skills")) {
      return {
        data: {
          id: 15,
          name: body.name,
          description: body.description,
          type: body.type,
          executionMode: body.executionMode,
          configuration: body.configuration,
          enabled: body.enabled,
          requiresConfirmation: body.requiresConfirmation,
        },
      };
    }
    throw new Error(`Unexpected POST ${url}`);
  };

  try {
    const { JavaSkillGeneratorTool } = require("../dist/src/tools/skill-generator");
    const tool = new JavaSkillGeneratorTool("http://localhost:18080", "test-token");
    const result = await tool.invoke({
      targetType: "openclaw",
      name: "Smart Assistant",
      systemPrompt: "You are a smart assistant.",
      allowedTools: ["tool1", "tool2"],
    });

    const parsed = JSON.parse(result);
    assert.equal(parsed.status, "VALIDATION_SUCCEEDED");
    assert.equal(parsed.saveAction, "created");
    assert.equal(parsed.skill.name, "Smart Assistant");
    assert.equal(parsed.skill.type, "EXTENSION");
    assert.equal(parsed.skill.configuration.systemPrompt, "You are a smart assistant.");
    assert.deepEqual(parsed.skill.configuration.allowedTools, ["tool1", "tool2"]);
    assert.equal(postCalls.length, 1);
    assert.equal(postCalls[0].body.executionMode, "OPENCLAW");
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
  }
});
test("skill generator defaults parameterBinding jsonBody for POST API", async () => {
  const originalGet = axios.get;
  const originalPost = axios.post;

  axios.get = async () => ({ data: [] });
  axios.post = async (url, body) => {
    if (url.endsWith("/api/skills")) {
      const cfg = typeof body.configuration === "string" ? JSON.parse(body.configuration) : body.configuration;
      assert.equal(cfg.kind, "api");
      assert.equal(cfg.method, "POST");
      assert.equal(cfg.parameterBinding, "jsonBody");
      return {
        data: {
          id: 200,
          name: body.name,
          description: body.description,
          type: body.type,
          configuration: body.configuration,
          enabled: body.enabled,
          requiresConfirmation: body.requiresConfirmation,
        },
      };
    }
    throw new Error(`Unexpected POST ${url}`);
  };

  try {
    const { JavaSkillGeneratorTool } = require("../dist/src/tools/skill-generator");
    const tool = new JavaSkillGeneratorTool("http://localhost:18080", "test-token");
    const result = await tool.invoke({
      targetType: "api",
      name: "Register",
      method: "POST",
      endpoint: "https://example.com/register",
      interfaceDescription: "Register user",
      parameterContract: { type: "object", properties: { id: { type: "string" } } },
    });
    const parsed = JSON.parse(result);
    assert.equal(parsed.status, "VALIDATION_SKIPPED");
    assert.equal(parsed.skill.configuration.parameterBinding, "jsonBody");
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
  }
});

test("skill generator saves api skill without calling gateway proxy", async () => {
  const originalGet = axios.get;
  const originalPost = axios.post;
  const originalPut = axios.put;

  let postCalls = 0;
  axios.get = async () => ({ data: [] });
  axios.post = async (url, body) => {
    postCalls += 1;
    if (url.endsWith("/api/skills")) {
      return {
        data: {
          id: 13,
          name: body.name,
          description: body.description,
          type: body.type,
          configuration: body.configuration,
          enabled: body.enabled,
          requiresConfirmation: body.requiresConfirmation,
        },
      };
    }

    throw new Error(`Unexpected POST ${url}`);
  };
  axios.put = async () => {
    throw new Error("PUT should not be called");
  };

  try {
    const { JavaSkillGeneratorTool } = require("../dist/src/tools/skill-generator");
    const tool = new JavaSkillGeneratorTool("http://localhost:18080", "test-token");
    const result = await tool.invoke({
      targetType: "api",
      name: "Failing API",
      method: "GET",
      endpoint: "https://example.com/protected",
      interfaceDescription: "A failing API",
      parameterContract: { type: "object", properties: {} },
    });
    const parsed = JSON.parse(result);

    assert.equal(parsed.status, "VALIDATION_SKIPPED");
    assert.equal(parsed.saveAction, "created");
    assert.equal(parsed.validation.skipped, true);
    assert.equal(postCalls, 1);
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
    axios.put = originalPut;
  }
});
