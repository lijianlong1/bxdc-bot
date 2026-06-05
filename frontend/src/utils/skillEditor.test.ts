import { describe, expect, it } from 'vitest'
import {
  createDefaultSkillDraft,
  parseSkillDraft,
  serializeSkillDraft,
} from './skillEditor'

describe('skillEditor', () => {
  it('parses legacy CONFIG time draft into canonical api draft', () => {
    const result = parseSkillDraft(
      'CONFIG',
      '{"kind":"time","operation":"current-time","method":"GET","endpoint":"https://example.com/time","responseTimestampField":"t"}',
    )

    expect(result.error).toBeNull()
    expect(result.draft).toMatchObject({
      kind: 'api',
      preset: 'current-time',
      operation: 'current-time',
      method: 'GET',
      endpoint: 'https://example.com/time',
      responseTimestampField: 't',
    })
  })

  it('parses canonical ssh preset draft', () => {
    const result = parseSkillDraft(
      'CONFIG',
      '{"kind":"ssh","preset":"server-resource-status","operation":"server-resource-status","lookup":"server_lookup","executor":"linux_script_executor","command":"uptime","readOnly":true}',
    )

    expect(result.error).toBeNull()
    expect(result.draft).toMatchObject({
      kind: 'ssh',
      preset: 'server-resource-status',
      operation: 'server-resource-status',
      lookup: 'server_lookup',
      executor: 'linux_script_executor',
      command: 'uptime',
      readOnly: true,
      interfaceDescription: '',
    })
  })

  it('parses ssh draft with interfaceDescription from generator', () => {
    const result = parseSkillDraft(
      'CONFIG',
      '{"kind":"ssh","preset":"server-resource-status","operation":"server-resource-status","lookup":"server_lookup","executor":"linux_script_executor","command":"uptime","readOnly":true,"interfaceDescription":"Pass top-level name."}',
    )

    expect(result.error).toBeNull()
    expect(result.draft).toMatchObject({
      kind: 'ssh',
      interfaceDescription: 'Pass top-level name.',
    })
  })

  it('parses OPENCLAW markdown prompt draft', () => {
    const result = parseSkillDraft(
      'OPENCLAW',
      '{"kind":"openclaw","systemPrompt":"# Title\\n- step 1","allowedTools":["compute","获取时间"],"orchestration":{"mode":"serial"}}',
    )

    expect(result.error).toBeNull()
    expect(result.draft).toMatchObject({
      kind: 'openclaw',
      systemPromptMarkdown: '# Title\n- step 1',
      allowedTools: ['compute', '获取时间'],
      orchestrationMode: 'serial',
    })
  })

  it('parses OPENCLAW draft without allowedTools', () => {
    const result = parseSkillDraft(
      'OPENCLAW',
      '{"kind":"openclaw","systemPrompt":"Only prompt","orchestration":{"mode":"serial"}}',
    )

    expect(result.error).toBeNull()
    expect(result.draft).toMatchObject({
      kind: 'openclaw',
      systemPromptMarkdown: 'Only prompt',
      allowedTools: [],
      orchestrationMode: 'serial',
    })
  })

  it('rejects unsupported extra keys while parsing', () => {
    const result = parseSkillDraft(
      'CONFIG',
      '{"kind":"time","operation":"current-time","method":"GET","endpoint":"https://example.com/time","extra":"unsupported"}',
    )

    expect(result.draft).toBeNull()
    expect(result.error).toContain('暂不支持')
  })

  it('parses api draft with string-encoded parameterContract (LLM double-serialization)', () => {
    const config = JSON.stringify({
      kind: 'api',
      operation: 'test-api',
      method: 'GET',
      endpoint: 'https://example.com/api',
      parameterContract: '{"type":"object","properties":{"page":{"type":"number"}}}',
    })

    const result = parseSkillDraft('CONFIG', config)
    expect(result.error).toBeNull()
    expect(result.draft).toMatchObject({ kind: 'api' })

    if (result.draft?.kind === 'api') {
      const text = result.draft.parameterContractText
      expect(text).not.toContain('\\')
      expect(text).toContain('"type": "object"')
      const parsed = JSON.parse(text)
      expect(parsed).toEqual({ type: 'object', properties: { page: { type: 'number' } } })
    }
  })

  it('parses and serializes api parameterBinding jsonBody', () => {
    const result = parseSkillDraft(
      'CONFIG',
      JSON.stringify({
        kind: 'api',
        operation: 'register',
        method: 'POST',
        endpoint: 'http://localhost:18080/api/auth/register',
        parameterBinding: 'jsonBody',
        parameterContract: { type: 'object', properties: { id: { type: 'string' } } },
      }),
    )
    expect(result.error).toBeNull()
    expect(result.draft?.kind).toBe('api')
    if (result.draft?.kind !== 'api') throw new Error('expected api')
    expect(result.draft.parameterBinding).toBe('jsonBody')

    const raw = serializeSkillDraft('CONFIG', result.draft)
    const parsed = JSON.parse(raw)
    expect(parsed.parameterBinding).toBe('jsonBody')
  })

  it('parses and serializes api parameterBinding formBody', () => {
    const result = parseSkillDraft(
      'CONFIG',
      JSON.stringify({
        kind: 'api',
        operation: 'token',
        method: 'POST',
        endpoint: 'https://example.com/oauth/token',
        parameterBinding: 'formBody',
        parameterContract: { type: 'object', properties: { client_id: { type: 'string' } } },
      }),
    )
    expect(result.error).toBeNull()
    expect(result.draft?.kind).toBe('api')
    if (result.draft?.kind !== 'api') throw new Error('expected api')
    expect(result.draft.parameterBinding).toBe('formBody')

    const raw = serializeSkillDraft('CONFIG', result.draft)
    const parsed = JSON.parse(raw)
    expect(parsed.parameterBinding).toBe('formBody')
  })

  it('serializes api draft with nested JSON fields and new contract fields', () => {
    const draft = createDefaultSkillDraft('CONFIG', 'api')
    if (draft.kind !== 'api') {
      throw new Error('Expected api draft')
    }

    draft.operation = 'juhe-joke-list'
    draft.method = 'GET'
    draft.endpoint = 'http://v.juhe.cn/joke/content/list'
    draft.queryText = '{"page":1,"pagesize":1}'
    draft.headersText = '{"Authorization":"Bearer token"}'
    draft.bodyText = '{"debug":true}'
    draft.interfaceDescription = '获取笑话列表'
    draft.parameterContractText = '{"type":"object","properties":{"page":{"type":"number"}}}'

    const raw = serializeSkillDraft('CONFIG', draft)
    const parsed = JSON.parse(raw)

    expect(parsed).toMatchObject({
      kind: 'api',
      operation: 'juhe-joke-list',
      method: 'GET',
      endpoint: 'http://v.juhe.cn/joke/content/list',
      query: { page: 1, pagesize: 1 },
      headers: { Authorization: 'Bearer token' },
      body: { debug: true },
      interfaceDescription: '获取笑话列表',
      parameterContract: { type: 'object', properties: { page: { type: 'number' } } },
    })
  })

  it('serializes ssh draft using canonical kind and preset', () => {
    const draft = createDefaultSkillDraft('CONFIG', 'ssh')
    if (draft.kind !== 'ssh') {
      throw new Error('Expected ssh draft')
    }

    draft.command = 'netstat -tlnp | grep LISTEN'

    const raw = serializeSkillDraft('CONFIG', draft)
    const parsed = JSON.parse(raw)

    expect(parsed).toEqual({
      kind: 'ssh',
      preset: 'server-resource-status',
      operation: 'server-resource-status',
      lookup: 'server_lookup',
      executor: 'linux_script_executor',
      command: 'netstat -tlnp | grep LISTEN',
      readOnly: true,
    })
  })

  it('serializes ssh draft with optional interfaceDescription', () => {
    const draft = createDefaultSkillDraft('CONFIG', 'ssh')
    if (draft.kind !== 'ssh') {
      throw new Error('Expected ssh draft')
    }

    draft.command = 'uptime'
    draft.interfaceDescription = 'Use ledger alias `name`.'

    const raw = serializeSkillDraft('CONFIG', draft)
    const parsed = JSON.parse(raw)

    expect(parsed.interfaceDescription).toBe('Use ledger alias `name`.')
  })

  it('serializes OPENCLAW draft and trims tool entries', () => {
    const draft = createDefaultSkillDraft('OPENCLAW')
    if (draft.kind !== 'openclaw') {
      throw new Error('Expected openclaw draft')
    }

    draft.systemPromptMarkdown = '# Planner\nUse tools carefully'
    draft.allowedTools = [' compute ', '', '获取时间']

    const raw = serializeSkillDraft('OPENCLAW', draft)
    const parsed = JSON.parse(raw)

    expect(parsed).toEqual({
      kind: 'openclaw',
      systemPrompt: '# Planner\nUse tools carefully',
      allowedTools: ['compute', '获取时间'],
      orchestration: {
        mode: 'serial',
      },
    })
  })

  it('serializes OPENCLAW draft without allowedTools', () => {
    const draft = createDefaultSkillDraft('OPENCLAW')
    if (draft.kind !== 'openclaw') {
      throw new Error('Expected openclaw draft')
    }

    draft.systemPromptMarkdown = '# Prompt only'
    draft.allowedTools = []

    const raw = serializeSkillDraft('OPENCLAW', draft)
    const parsed = JSON.parse(raw)

    expect(parsed).toEqual({
      kind: 'openclaw',
      systemPrompt: '# Prompt only',
      allowedTools: [],
      orchestration: {
        mode: 'serial',
      },
    })
  })
})
