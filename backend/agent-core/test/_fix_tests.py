#!/usr/bin/env python3
"""Fix remaining test mocks for POST /api/skills/execute unified path"""
import re

filepath = 'test/java-skills.loader.test.cjs'
with open(filepath, 'r') as f:
    content = f.read()

# Test names to fix (these all mock axios.post for /api/skills/api but not /api/skills/execute)
# Fix 1: Line 5 - "loadGatewayExtendedTools loads enabled EXTENSION tools"
# The POST mock returns raw string, but func() sends POST /api/skills/execute not /api/skills/api
# For this test, make GET URL-aware and POST handle /api/skills/execute

# Pattern: replace `axios.get = async () => ({ data: [...] })` with URL-aware version
# and add /api/skills/execute handler to axios.post

# Let me just fix them one by one using content replacement

fixes = [
    # Test 1: "loadGatewayExtendedTools loads enabled EXTENSION tools" (line 5)
    {
        'test': "loadGatewayExtendedTools loads enabled EXTENSION tools",
        'get_simple': '''  axios.get = async () => ({
    data: [
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
    ],
  });''',
        'get_new': '''  const skillsList$ = [
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
      return { data: skillsList$ };
    }
    const match = urlStr.match(/\\/api\\/skills\\/(\\d+)$/);
    if (match) {
      const skill = skillsList$.find(s => s.id === parseInt(match[1]));
      if (skill) return { data: skill };
    }
    throw new Error(`Skill not found: ${urlStr}`);
  };''',
        'post_old': '''  let timeProxyHeaders = null;
  axios.post = async (_url, _body, config) => {
    timeProxyHeaders = config?.headers;
    return {
      data: 'QZOutputJson={"t":"1773013121"};',
    };
  };''',
        'post_new': '''  let timeProxyHeaders = null;
  axios.post = async (_url, _body, config) => {
    timeProxyHeaders = config?.headers;
    const urlStr = String(_url);
    if (urlStr.endsWith("/api/skills/execute")) {
      return { data: { timestamp: 1773013121, readableTime: "2026-03-08T00:00:00.000Z" } };
    }
    return { data: 'QZOutputJson={"t":"1773013121"};' };
  };''',
    },
]

for fix in fixes:
    if fix['get_simple'] in content:
        content = content.replace(fix['get_simple'], fix['get_new'])
        print(f"Fixed GET mock: {fix['test']}")
    else:
        print(f"SKIP GET (not found): {fix['test']}")
    
    if fix['post_old'] in content:
        content = content.replace(fix['post_old'], fix['post_new'])
        print(f"Fixed POST mock: {fix['test']}")
    else:
        print(f"SKIP POST (not found): {fix['test']}")

# Fix 2: "configured API extended skill builds query and proxies request" (line 62)
# This test posts to /api/skills/api; need to also handle /api/skills/execute
old_pattern2 = '''  let capturedRequest = null;
  let proxyInboundHeaders = null;
  axios.post = async (_url, body, config) => {
    capturedRequest = body;
    proxyInboundHeaders = config?.headers;
    return {
      data: {
        error_code: 0,
        reason: "Success",
        result: {
          data: [
            { content: "joke" },
          ],
        },
      },
    };
  };'''

new_pattern2 = '''  let capturedRequest = null;
  let proxyInboundHeaders = null;
  axios.post = async (_url, body, config) => {
    const urlStr = String(_url);
    if (urlStr.endsWith("/api/skills/api")) {
      capturedRequest = body;
      proxyInboundHeaders = config?.headers;
      return {
        data: {
          error_code: 0,
          reason: "Success",
          result: { data: [{ content: "joke" }] },
        },
      };
    }
    if (urlStr.endsWith("/api/skills/execute")) {
      capturedRequest = body;
      proxyInboundHeaders = config?.headers;
      return {
        data: {
          error_code: 0,
          reason: "Success",
          result: { data: [{ content: "joke" }] },
        },
      };
    }
    throw new Error(`Unexpected POST ${urlStr}`);
  };'''

if old_pattern2 in content:
    content = content.replace(old_pattern2, new_pattern2)
    print("Fixed: configured API extended skill builds query")
else:
    print("SKIP: configured API extended skill (pattern not found)")

# Fix 3: "POST /api/skills/api includes X-User-Id" (line 134)
old_pattern3 = '''  axios.post = async (url, _body, config) => {
    if (String(url).endsWith("/api/skills/api")) {
      proxyInboundHeaders = config?.headers;
      return { data: { status: "ok" } };
    }
    throw new Error(`Unexpected POST ${url}`);
  };'''

new_pattern3 = '''  axios.post = async (url, _body, config) => {
    if (String(url).endsWith("/api/skills/api")) {
      proxyInboundHeaders = config?.headers;
      return { data: { status: "ok" } };
    }
    if (String(url).endsWith("/api/skills/execute")) {
      proxyInboundHeaders = config?.headers;
      return { data: { status: "ok" } };
    }
    throw new Error(`Unexpected POST ${url}`);
  };'''

if old_pattern3 in content:
    content = content.replace(old_pattern3, new_pattern3)
    print("Fixed: POST /api/skills/api includes X-User-Id")
else:
    print("SKIP: POST /api/skills/api includes X-User-Id")

# Fix 4: "configured API extended skill validates parameter contract" (line 180)
# This test expects validation error - mock /api/skills/execute to return validation error
old_pattern4 = '''  axios.post = async (url, body, config) => {
    if (url.endsWith("/api/skills/api")) {
      apiPayload = body;
      proxyHeaders = config?.headers;
      return { data: { error_code: 0 } };
    }
    throw new Error(`Unexpected POST ${url}`);
  };'''

new_pattern4 = '''  axios.post = async (url, body, config) => {
    const urlStr = String(url);
    if (urlStr.endsWith("/api/skills/api")) {
      apiPayload = body;
      proxyHeaders = config?.headers;
      return { data: { error_code: 0 } };
    }
    if (urlStr.endsWith("/api/skills/execute")) {
      apiPayload = body;
      proxyHeaders = config?.headers;
      return { data: { error_code: 0 } };
    }
    throw new Error(`Unexpected POST ${urlStr}`);
  };'''

if old_pattern4 in content:
    content = content.replace(old_pattern4, new_pattern4)
    print("Fixed: configured API extended skill validates parameter contract")
else:
    print("SKIP: configured API extended skill validates parameter contract")

# Fix 5: "api skill parameterBinding jsonBody sends flat fields as JSON body without query pollution" (line 404)
old_pattern5 = '''    if (url.endsWith("/api/skills/api")) {
      capturedApiPayload = body;
      return { data: { status: "ok", echo: body } };
    }'''

new_pattern5 = '''    if (url.endsWith("/api/skills/api")) {
      capturedApiPayload = body;
      return { data: { status: "ok", echo: body } };
    }
    if (url.endsWith("/api/skills/execute")) {
      capturedApiPayload = body;
      return { data: { status: "COMPLETED", echo: body } };
    }'''

if old_pattern5 in content:
    content = content.replace(old_pattern5, new_pattern5)
    print("Fixed: api skill parameterBinding jsonBody sends flat fields")
else:
    print("SKIP: api skill parameterBinding jsonBody sends flat fields")

# Fix 6: "api skill parameterBinding jsonBody on GET falls back to query mapping" (line 472)
old_pattern6 = '''    if (url.endsWith("/api/skills/api")) {
      capturedApiPayload = body;
      return { data: { results: [] } };
    }'''

new_pattern6 = '''    if (url.endsWith("/api/skills/api")) {
      capturedApiPayload = body;
      return { data: { results: [] } };
    }
    if (url.endsWith("/api/skills/execute")) {
      capturedApiPayload = body;
      return { data: { status: "COMPLETED", results: [] } };
    }'''

if old_pattern6 in content:
    content = content.replace(old_pattern6, new_pattern6)
    print("Fixed: api skill parameterBinding jsonBody on GET")
else:
    print("SKIP: api skill parameterBinding jsonBody on GET")

# Fix 7: "api skill parameterBinding formBody sends URL-encoded string" (line 527)
old_pattern7 = '''    if (url.endsWith("/api/skills/api")) {
      capturedApiPayload = body;
      return { data: { echo: body } };
    }'''

new_pattern7 = '''    if (url.endsWith("/api/skills/api")) {
      capturedApiPayload = body;
      return { data: { echo: body } };
    }
    if (url.endsWith("/api/skills/execute")) {
      capturedApiPayload = body;
      return { data: { status: "COMPLETED", echo: body } };
    }'''

if old_pattern7 in content:
    content = content.replace(old_pattern7, new_pattern7)
    print("Fixed: api skill parameterBinding formBody sends URL-encoded string")
else:
    print("SKIP: api skill parameterBinding formBody sends URL-encoded string")

with open(filepath, 'w') as f:
    f.write(content)

print("\nDone!")
