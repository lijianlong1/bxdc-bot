export type ExecutionMode = 'CONFIG' | 'OPENCLAW'
export type ConfigKind = 'api' | 'ssh' | 'template'
export type ApiPreset = 'none' | 'current-time'
export type SshPreset = 'server-resource-status'

/**
 * 异步轮询（PERIODIC）默认配置模板。
 * 用户在 UI 切到 PERIODIC 且字段为空时，会自动写入这份默认 JSON。
 */
export const DEFAULT_ASYNC_POLL_TEMPLATE = `{
  "pollEndpoint": "https://api.example.com/tasks/{id}/status",
  "idJsonPath": "data.task_id",
  "pollMethod": "GET",
  "pollIntervalSeconds": 5,
  "maxWaitSeconds": 600,
  "completionJsonPath": "status",
  "completionValue": "completed",
  "failedValues": ["failed", "error"],
  "resultJsonPath": "result"
}`

/** 与 agent-core `ExtendedSkillConfig.parameterBinding` 一致：扁平契约字段进 query、JSON body 或 form-urlencoded body。 */
export type ApiParameterBinding = 'query' | 'jsonBody' | 'formBody'

export interface ApiConfigDraft {
  kind: 'api'
  preset: ApiPreset
  operation: string
  method: string
  endpoint: string
  /** HTTP 超时秒数，默认 30 */
  timeoutSeconds: number
  /** 默认 query；POST/PUT/PATCH 等 JSON 接口选 jsonBody；仅接受表单的接口选 formBody */
  parameterBinding: ApiParameterBinding
  responseTimestampField: string
  headersText: string
  queryText: string
  bodyText: string
  interfaceDescription: string
  parameterContractText: string
  /** 是否启用异步轮询模式 */
  asyncPollEnabled: boolean
  /** 轮询策略：'PERIODIC' = 周期轮询（默认，需要 pollEndpoint + {id}）；'SINGLE_CALL' = 单次长调用（不依赖 pollEndpoint） */
  asyncPollStrategy: 'PERIODIC' | 'SINGLE_CALL'
  /** SINGLE_CALL 模式专用：read timeout（秒），默认 600 */
  asyncPollReadTimeoutSeconds: number
  /** 异步轮询配置 JSON（PERIODIC 模式使用；SINGLE_CALL 模式自动从上面两个字段生成） */
  asyncPollText: string
}

export interface SshConfigDraft {
  kind: 'ssh'
  preset: SshPreset
  operation: string
  lookup: string
  executor: string
  command: string
  readOnly: boolean
  /** LLM-facing invocation hints; persisted in configuration like API skills. */
  interfaceDescription: string
}

export interface TemplateConfigDraft {
  kind: 'template'
  prompt: string
}

export interface OpenClawConfigDraft {
  kind: 'openclaw'
  systemPromptMarkdown: string
  allowedTools: string[]
  orchestrationMode: 'serial'
}

export type SkillConfigDraft = ApiConfigDraft | SshConfigDraft | TemplateConfigDraft | OpenClawConfigDraft

export interface ParseSkillDraftResult {
  draft: SkillConfigDraft | null
  error: string | null
}

type JsonRecord = Record<string, unknown>

const CONFIG_KIND_LABELS: Record<ConfigKind, string> = {
  api: 'API',
  ssh: 'SSH',
  template: '模板',
}

const API_ALLOWED_KEYS = [
  'kind',
  'preset',
  'profile',
  'operation',
  'method',
  'endpoint',
  'responseTimestampField',
  'headers',
  'query',
  'body',
  'interfaceDescription',
  'parameterContract',
  'parameterBinding',
  'timeoutSeconds',
  'asyncPoll',
]

const SSH_ALLOWED_KEYS = [
  'kind',
  'preset',
  'profile',
  'operation',
  'lookup',
  'executor',
  'command',
  'readOnly',
  'interfaceDescription',
]

const TEMPLATE_ALLOWED_KEYS = ['kind', 'prompt']

const OPENCLAW_ALLOWED_KEYS = ['kind', 'systemPrompt', 'allowedTools', 'orchestration']

function parseConfigurationObject(configuration: string): JsonRecord {
  const parsed = JSON.parse(configuration || '{}')
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Configuration 必须是 JSON 对象')
  }
  return parsed as JsonRecord
}

function ensureNoUnknownKeys(record: JsonRecord, allowedKeys: string[]): void {
  const unknownKeys = Object.keys(record).filter((key) => !allowedKeys.includes(key))
  if (unknownKeys.length > 0) {
    throw new Error(`存在当前结构化编辑暂不支持的字段：${unknownKeys.join(', ')}`)
  }
}

function readString(record: JsonRecord, key: string, fallback = ''): string {
  const value = record[key]
  if (value == null) return fallback
  if (typeof value !== 'string') {
    throw new Error(`${key} 必须是字符串`)
  }
  return value
}

function readPositiveInt(record: JsonRecord, key: string, fallback: number): number {
  const value = record[key]
  if (value == null) return fallback
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value)
  if (typeof value === 'string') {
    const n = parseInt(value, 10)
    if (Number.isFinite(n) && n > 0) return n
  }
  throw new Error(`${key} 必须是正整数`)
}

function readPreset(record: JsonRecord): string {
  const preset = record.preset
  if (preset != null) {
    if (typeof preset !== 'string') {
      throw new Error('preset 必须是字符串')
    }
    return preset
  }
  const profile = record.profile
  if (profile != null) {
    if (typeof profile !== 'string') {
      throw new Error('profile 必须是字符串')
    }
    return profile
  }
  return ''
}

function formatJsonText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object') {
        return JSON.stringify(parsed, null, 2)
      }
    } catch {
      // not valid JSON — return as-is
    }
    return value
  }
  return JSON.stringify(value, null, 2)
}

function isEmptyRecord(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0
}

function parseJsonText(text: string, fieldName: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    throw new Error(`${fieldName} 必须是合法 JSON`)
  }
}

function readAsyncPollReadTimeout(asyncPoll: unknown): number {
  if (!asyncPoll || typeof asyncPoll !== 'object') return 600
  const v = (asyncPoll as { singleCallReadTimeoutSeconds?: unknown }).singleCallReadTimeoutSeconds
  return typeof v === 'number' ? v : 600
}

function readParameterBinding(record: JsonRecord): ApiParameterBinding {
  const v = record.parameterBinding
  if (v === undefined || v === null || v === '') return 'query'
  if (v === 'jsonBody' || v === 'query' || v === 'formBody') return v
  throw new Error('parameterBinding 必须是 query、jsonBody 或 formBody')
}

function parseApiDraft(configuration: JsonRecord): ApiConfigDraft {
  ensureNoUnknownKeys(configuration, API_ALLOWED_KEYS)
  const preset = readPreset(configuration)
  return {
    kind: 'api',
    preset: preset === 'current-time' ? 'current-time' : 'none',
    operation: readString(configuration, 'operation', preset === 'current-time' ? 'current-time' : ''),
    method: readString(configuration, 'method', 'GET'),
    endpoint: readString(configuration, 'endpoint'),
    timeoutSeconds: readPositiveInt(configuration, 'timeoutSeconds', 30),
    parameterBinding: readParameterBinding(configuration),
    responseTimestampField: readString(configuration, 'responseTimestampField'),
    headersText: formatJsonText(configuration.headers),
    queryText: formatJsonText(configuration.query),
    bodyText: formatJsonText(configuration.body),
    interfaceDescription: readString(configuration, 'interfaceDescription'),
    parameterContractText: formatJsonText(configuration.parameterContract),
    asyncPollEnabled: configuration.asyncPoll != null,
    asyncPollStrategy:
      (configuration.asyncPoll && typeof configuration.asyncPoll === 'object' && (configuration.asyncPoll as { pollStrategy?: string }).pollStrategy === 'SINGLE_CALL')
        ? 'SINGLE_CALL'
        : 'PERIODIC',
    asyncPollReadTimeoutSeconds: readAsyncPollReadTimeout(configuration.asyncPoll),
    asyncPollText: formatJsonText(configuration.asyncPoll),
  }
}

function parseLegacyTimeDraft(configuration: JsonRecord): ApiConfigDraft {
  ensureNoUnknownKeys(configuration, ['kind', 'operation', 'method', 'endpoint', 'responseWrapper', 'responseTimestampField'])
  return {
    kind: 'api',
    preset: 'current-time',
    operation: readString(configuration, 'operation', 'current-time'),
    method: readString(configuration, 'method', 'GET'),
    endpoint: readString(configuration, 'endpoint'),
    timeoutSeconds: 30,
    parameterBinding: 'query',
    responseTimestampField: readString(configuration, 'responseTimestampField'),
    headersText: '',
    queryText: '',
    bodyText: '',
    interfaceDescription: '',
    parameterContractText: '',
    asyncPollEnabled: false,
    asyncPollStrategy: 'PERIODIC',
    asyncPollReadTimeoutSeconds: 600,
    asyncPollText: '',
  }
}

function parseSshDraft(configuration: JsonRecord): SshConfigDraft {
  ensureNoUnknownKeys(configuration, SSH_ALLOWED_KEYS)
  const readOnly = configuration.readOnly
  if (readOnly != null && typeof readOnly !== 'boolean') {
    throw new Error('readOnly 必须是布尔值')
  }
  return {
    kind: 'ssh',
    preset: 'server-resource-status',
    operation: readString(configuration, 'operation', 'server-resource-status'),
    lookup: readString(configuration, 'lookup', 'server_lookup'),
    executor: readString(configuration, 'executor', 'linux_script_executor'),
    command: readString(configuration, 'command'),
    readOnly: readOnly ?? true,
    interfaceDescription: readString(configuration, 'interfaceDescription'),
  }
}

function parseLegacyMonitorDraft(configuration: JsonRecord): SshConfigDraft {
  ensureNoUnknownKeys(configuration, ['kind', 'operation', 'lookup', 'executor', 'command', 'readOnly'])
  const readOnly = configuration.readOnly
  if (readOnly != null && typeof readOnly !== 'boolean') {
    throw new Error('readOnly 必须是布尔值')
  }
  return {
    kind: 'ssh',
    preset: 'server-resource-status',
    operation: readString(configuration, 'operation', 'server-resource-status'),
    lookup: readString(configuration, 'lookup', 'server_lookup'),
    executor: readString(configuration, 'executor', 'linux_script_executor'),
    command: readString(configuration, 'command'),
    readOnly: readOnly ?? true,
    interfaceDescription: '',
  }
}

function parseTemplateDraft(configuration: JsonRecord): TemplateConfigDraft {
  ensureNoUnknownKeys(configuration, TEMPLATE_ALLOWED_KEYS)
  return {
    kind: 'template',
    prompt: readString(configuration, 'prompt'),
  }
}

function parseOpenClawDraft(configuration: JsonRecord): OpenClawConfigDraft {
  ensureNoUnknownKeys(configuration, OPENCLAW_ALLOWED_KEYS)
  const allowedTools = configuration.allowedTools
  const orchestration = configuration.orchestration
  if (allowedTools != null && (!Array.isArray(allowedTools) || allowedTools.some((tool) => typeof tool !== 'string'))) {
    throw new Error('allowedTools 必须是字符串数组')
  }
  if (!orchestration || Array.isArray(orchestration) || typeof orchestration !== 'object') {
    throw new Error('orchestration 必须是对象')
  }
  const mode = (orchestration as JsonRecord).mode
  if (mode != null && mode !== 'serial') {
    throw new Error('当前仅支持 serial 编排模式')
  }
  return {
    kind: 'openclaw',
    systemPromptMarkdown: readString(configuration, 'systemPrompt'),
    allowedTools: Array.isArray(allowedTools) ? allowedTools : [],
    orchestrationMode: 'serial',
  }
}

export function createDefaultSkillDraft(executionMode: ExecutionMode, configKind: ConfigKind = 'api'): SkillConfigDraft {
  if (executionMode === 'OPENCLAW') {
    return {
      kind: 'openclaw',
      systemPromptMarkdown: '',
      allowedTools: [],
      orchestrationMode: 'serial',
    }
  }

  if (configKind === 'ssh') {
    return {
      kind: 'ssh',
      preset: 'server-resource-status',
      operation: 'server-resource-status',
      lookup: 'server_lookup',
      executor: 'linux_script_executor',
      command: '',
      readOnly: true,
      interfaceDescription: '',
    }
  }

  if (configKind === 'template') {
    return {
      kind: 'template',
      prompt: '',
    }
  }

    return {
      kind: 'api',
      preset: 'none',
      operation: '',
      method: 'GET',
      endpoint: '',
      timeoutSeconds: 30,
      parameterBinding: 'query',
      responseTimestampField: '',
      asyncPollStrategy: 'PERIODIC',
      asyncPollReadTimeoutSeconds: 600,
      headersText: '',
      queryText: '',
      bodyText: '',
      interfaceDescription: '',
      parameterContractText: '',
      asyncPollEnabled: false,
      asyncPollText: '',
    }
}

export function parseSkillDraft(executionMode: ExecutionMode, configuration: string): ParseSkillDraftResult {
  try {
    const parsed = parseConfigurationObject(configuration)
    if (executionMode === 'OPENCLAW') {
      if (parsed.kind !== 'openclaw') {
        throw new Error('OPENCLAW Skill 的 configuration.kind 必须为 openclaw')
      }
      return { draft: parseOpenClawDraft(parsed), error: null }
    }

    const kind = parsed.kind
    if (typeof kind !== 'string') {
      throw new Error('CONFIG Skill 缺少 kind 字段')
    }
    switch (kind) {
      case 'time':
        return { draft: parseLegacyTimeDraft(parsed), error: null }
      case 'api':
        return { draft: parseApiDraft(parsed), error: null }
      case 'monitor':
        return { draft: parseLegacyMonitorDraft(parsed), error: null }
      case 'ssh':
        return { draft: parseSshDraft(parsed), error: null }
      case 'template':
        return { draft: parseTemplateDraft(parsed), error: null }
      case 'openclaw':
        throw new Error('CONFIG Skill 不能使用 openclaw 配置')
      default:
        throw new Error(`暂不支持解析的 CONFIG kind：${kind}`)
    }
  } catch (error) {
    return {
      draft: null,
      error: error instanceof Error ? error.message : '配置解析失败',
    }
  }
}

function requireNonEmpty(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`${label}不能为空`)
  }
  return trimmed
}

export function serializeSkillDraft(executionMode: ExecutionMode, draft: SkillConfigDraft): string {
  if (executionMode === 'OPENCLAW') {
    if (draft.kind !== 'openclaw') {
      throw new Error('OPENCLAW Skill 缺少对应草稿数据')
    }
    const allowedTools = draft.allowedTools.map((tool) => tool.trim()).filter(Boolean)
    return JSON.stringify({
      kind: 'openclaw',
      systemPrompt: requireNonEmpty(draft.systemPromptMarkdown, '提示词'),
      allowedTools,
      orchestration: {
        mode: 'serial',
      },
    })
  }

  if (draft.kind === 'api') {
    const headers = parseJsonText(draft.headersText, 'Headers')
    const query = parseJsonText(draft.queryText, 'Query')
    const body = parseJsonText(draft.bodyText, 'Body')
    const parameterContract = parseJsonText(draft.parameterContractText, '参数契约')
    // asyncPoll 配置：PERIODIC 用 asyncPollText，SINGLE_CALL 自动生成（不依赖 pollEndpoint）
    let asyncPoll: unknown = undefined
    if (draft.asyncPollEnabled) {
      if (draft.asyncPollStrategy === 'SINGLE_CALL') {
        asyncPoll = {
          pollStrategy: 'SINGLE_CALL',
          singleCallReadTimeoutSeconds: draft.asyncPollReadTimeoutSeconds,
        }
      } else {
        asyncPoll = parseJsonText(draft.asyncPollText, '异步轮询配置')
      }
    }
    return JSON.stringify({
      kind: 'api',
      ...(draft.preset !== 'none' ? { preset: draft.preset } : {}),
      operation: requireNonEmpty(draft.operation, '操作标识'),
      method: requireNonEmpty(draft.method, '请求方法'),
      endpoint: requireNonEmpty(draft.endpoint, '请求地址'),
      ...(draft.timeoutSeconds !== 30 ? { timeoutSeconds: draft.timeoutSeconds } : {}),
      parameterBinding: draft.parameterBinding,
      ...(draft.responseTimestampField.trim() ? { responseTimestampField: draft.responseTimestampField.trim() } : {}),
      ...(headers !== undefined && !isEmptyRecord(headers) ? { headers } : {}),
      ...(query !== undefined && !isEmptyRecord(query) ? { query } : {}),
      ...(body !== undefined && !isEmptyRecord(body) ? { body } : {}),
      ...(draft.interfaceDescription.trim() ? { interfaceDescription: draft.interfaceDescription.trim() } : {}),
      ...(parameterContract !== undefined ? { parameterContract } : {}),
      ...(asyncPoll !== undefined && asyncPoll !== null ? { asyncPoll } : {}),
    })
  }

  if (draft.kind === 'ssh') {
    return JSON.stringify({
      kind: 'ssh',
      preset: draft.preset,
      operation: requireNonEmpty(draft.operation, '操作标识'),
      lookup: requireNonEmpty(draft.lookup, '服务器查找器'),
      executor: requireNonEmpty(draft.executor, '执行器'),
      command: requireNonEmpty(draft.command, '命令内容'),
      readOnly: draft.readOnly,
      ...(draft.interfaceDescription.trim() ? { interfaceDescription: draft.interfaceDescription.trim() } : {}),
    })
  }

  if (draft.kind === 'template') {
    return JSON.stringify({
      kind: 'template',
      prompt: requireNonEmpty(draft.prompt, '提示词'),
    })
  }

  throw new Error('CONFIG Skill 不能序列化为 openclaw 配置')
}

export function getConfigKindOptions(): Array<{ value: ConfigKind; label: string }> {
  return (Object.keys(CONFIG_KIND_LABELS) as ConfigKind[]).map((kind) => ({
    value: kind,
    label: CONFIG_KIND_LABELS[kind],
  }))
}

export function getPresetLabel(kind: ConfigKind, preset: string): string {
  if (kind === 'api') {
    return preset === 'current-time' ? '当前时间' : '通用接口'
  }
  if (kind === 'template') {
    return '提示词模板'
  }
  return '服务器状态巡检'
}

export function isApiDraft(draft: SkillConfigDraft | null): draft is ApiConfigDraft {
  return draft?.kind === 'api'
}

export function isSshDraft(draft: SkillConfigDraft | null): draft is SshConfigDraft {
  return draft?.kind === 'ssh'
}

export function isTemplateDraft(draft: SkillConfigDraft | null): draft is TemplateConfigDraft {
  return draft?.kind === 'template'
}

export function isOpenClawDraft(draft: SkillConfigDraft | null): draft is OpenClawConfigDraft {
  return draft?.kind === 'openclaw'
}
