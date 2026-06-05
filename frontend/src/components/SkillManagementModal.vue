<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { AddIcon, DeleteIcon, EditIcon } from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import TextOptimizeModal from './TextOptimizeModal.vue';
import {
  BUILT_IN_SKILLS,
  type Skill,
  useSkillHub,
  getExecutionModeLabel,
  getConfigSummary,
  canManageGatewaySkill,
} from '../composables/useSkillHub';
import { useUser } from '../composables/useUser';
import {
  createDefaultSkillDraft,
  getConfigKindOptions,
  isApiDraft,
  isSshDraft,
  isTemplateDraft,
  isOpenClawDraft,
  getPresetLabel,
  parseSkillDraft,
  serializeSkillDraft,
  DEFAULT_ASYNC_POLL_TEMPLATE,
  type ConfigKind,
  type ExecutionMode,
  type SkillConfigDraft,
} from '../utils/skillEditor';

const {
  isSkillManagementVisible,
  skills,
  isLoading,
  error,
  closeSkillManagement,
  createSkill,
  updateSkill,
  deleteSkill,
  toggleSkillEnabled,
  fetchSkill,
} = useSkillHub();

const { currentUser } = useUser();

function canManageRow(row: Skill): boolean {
  return canManageGatewaySkill(row, currentUser.value?.id);
}

const isFormVisible = ref(false);
const isEditMode = ref(false);
const currentId = ref<number | null>(null);
const parseError = ref<string | null>(null);
const rawConfiguration = ref('{}');
const configDraft = ref<SkillConfigDraft>(createDefaultSkillDraft('CONFIG'));

const optimizeVisible = ref(false);
const optimizeFieldId = ref('');
const optimizeFieldLabel = ref('');
const optimizeOriginalText = ref('');
const optimizeContext = ref('');

function openTextOptimize(fieldId: string, fieldLabel: string, text: string) {
  optimizeFieldId.value = fieldId;
  optimizeFieldLabel.value = fieldLabel;
  optimizeOriginalText.value = text;
  optimizeContext.value = `Skill 名称: ${formData.name}`;
  optimizeVisible.value = true;
}

function handleOptimizeConfirm(optimizedText: string) {
  const fid = optimizeFieldId.value;
  if (fid === 'description') formData.description = optimizedText;
  else if (fid === 'api_interface_description' && apiDraft.value) apiDraft.value.interfaceDescription = optimizedText;
  else if (fid === 'api_parameter_contract' && apiDraft.value) apiDraft.value.parameterContractText = optimizedText;
  else if (fid === 'api_async_poll' && apiDraft.value) apiDraft.value.asyncPollText = optimizedText;
  else if (fid === 'api_headers' && apiDraft.value) apiDraft.value.headersText = optimizedText;
  else if (fid === 'api_query' && apiDraft.value) apiDraft.value.queryText = optimizedText;
  else if (fid === 'api_body' && apiDraft.value) apiDraft.value.bodyText = optimizedText;
  else if (fid === 'ssh_command' && sshDraft.value) sshDraft.value.command = optimizedText;
  else if (fid === 'openclaw_prompt' && openClawDraft.value) openClawDraft.value.systemPromptMarkdown = optimizedText;
}

const formData = reactive({
  name: '',
  description: '',
  visibility: 'PRIVATE' as 'PUBLIC' | 'PRIVATE',
  executionMode: 'CONFIG' as ExecutionMode,
  enabled: true,
  requiresConfirmation: false,
});

const configKindOptions = getConfigKindOptions();

const currentConfigKind = computed<ConfigKind>(() => {
  if (isApiDraft(configDraft.value)) return 'api';
  if (isTemplateDraft(configDraft.value)) return 'template';
  return 'ssh';
});

const apiDraft = computed(() => (isApiDraft(configDraft.value) ? configDraft.value : null));
const sshDraft = computed(() => (isSshDraft(configDraft.value) ? configDraft.value : null));
const templateDraft = computed(() => (isTemplateDraft(configDraft.value) ? configDraft.value : null));
const openClawDraft = computed(() => (isOpenClawDraft(configDraft.value) ? configDraft.value : null));

// PERIODIC 切回时，如果 JSON 字段为空，自动写入默认模板（避免用户重新手写）
watch(
  () => (apiDraft.value ? apiDraft.value.asyncPollStrategy : null),
  (newStrategy, oldStrategy) => {
    const draft = apiDraft.value
    if (!draft) return
    if (newStrategy === 'PERIODIC' && oldStrategy !== 'PERIODIC' && !draft.asyncPollText.trim()) {
      draft.asyncPollText = DEFAULT_ASYNC_POLL_TEMPLATE
    }
  }
)

const suggestedTools = computed(() => {
  const names = new Set<string>(['compute']);
  skills.value.forEach((skill) => {
    if (skill.name) {
      names.add(skill.name);
    }
  });
  BUILT_IN_SKILLS.forEach((skill) => {
    if (skill.name.includes('Compute')) {
      names.add('compute');
    }
  });
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'zh-CN'));
});

function resetForm() {
  formData.name = '';
  formData.description = '';
  formData.visibility = 'PRIVATE';
  formData.executionMode = 'CONFIG';
  formData.enabled = true;
  formData.requiresConfirmation = false;
  currentId.value = null;
  parseError.value = null;
  rawConfiguration.value = '{}';
  configDraft.value = createDefaultSkillDraft('CONFIG');
}

function openCreateForm() {
  isEditMode.value = false;
  resetForm();
  isFormVisible.value = true;
}

async function openEditForm(skillSummary: Skill) {
  try {
    isLoading.value = true;
    const skill = await fetchSkill(skillSummary.id);
    isEditMode.value = true;
    currentId.value = skill.id;
    formData.name = skill.name;
    formData.description = skill.description || '';
    formData.visibility = skill.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';
    formData.executionMode = skill.executionMode ?? 'CONFIG';
    formData.enabled = skill.enabled;
    formData.requiresConfirmation = skill.requiresConfirmation ?? false;
    rawConfiguration.value = skill.configuration || '{}';
    const parsed = parseSkillDraft(formData.executionMode, rawConfiguration.value);
    parseError.value = parsed.error;
    configDraft.value = parsed.draft ?? createDefaultSkillDraft(formData.executionMode);
    isFormVisible.value = true;
  } catch (e) {
    MessagePlugin.error(`Failed to load skill details: ${e instanceof Error ? e.message : 'Unknown error'}`);
  } finally {
    isLoading.value = false;
  }
}

function handleExecutionModeChange(value: string) {
  formData.executionMode = value === 'OPENCLAW' ? 'OPENCLAW' : 'CONFIG';
  configDraft.value = createDefaultSkillDraft(formData.executionMode);
  parseError.value = null;
  rawConfiguration.value = '{}';
}

function handleConfigKindChange(value: string) {
  const kind = configKindOptions.some((option) => option.value === value) ? (value as ConfigKind) : 'api';
  configDraft.value = createDefaultSkillDraft('CONFIG', kind);
  parseError.value = null;
}

function handleApiPresetChange(value: string) {
  if (!apiDraft.value) return;
  apiDraft.value.preset = value === 'current-time' ? 'current-time' : 'none';
  if (apiDraft.value.preset === 'current-time') {
    if (!apiDraft.value.operation.trim()) apiDraft.value.operation = 'current-time';
    if (!apiDraft.value.method.trim()) apiDraft.value.method = 'GET';
    if (!apiDraft.value.endpoint.trim()) apiDraft.value.endpoint = 'https://vv.video.qq.com/checktime?otype=json';
  }
}

function addAllowedTool() {
  if (!openClawDraft.value) return;
  openClawDraft.value.allowedTools.push('');
}

function removeAllowedTool(index: number) {
  if (!openClawDraft.value) return;
  openClawDraft.value.allowedTools.splice(index, 1);
}

function useSuggestedTool(toolName: string) {
  if (!openClawDraft.value) return;
  if (openClawDraft.value.allowedTools.includes(toolName)) {
    return;
  }
  const emptyIndex = openClawDraft.value.allowedTools.findIndex((tool) => !tool.trim());
  if (emptyIndex >= 0) {
    openClawDraft.value.allowedTools[emptyIndex] = toolName;
    return;
  }
  openClawDraft.value.allowedTools.push(toolName);
}

async function handleSubmit() {
  if (parseError.value) {
    MessagePlugin.error('当前 Skill 配置无法安全解析，请先处理配置兼容问题');
    return;
  }

  try {
    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      type: 'EXTENSION',
      visibility: formData.visibility,
      executionMode: formData.executionMode,
      configuration: serializeSkillDraft(formData.executionMode, configDraft.value),
      enabled: formData.enabled,
      requiresConfirmation: formData.requiresConfirmation,
    };

    if (isEditMode.value && currentId.value != null) {
      await updateSkill(currentId.value, payload);
      MessagePlugin.success('Skill 更新成功');
    } else {
      await createSkill(payload);
      MessagePlugin.success('Skill 创建成功');
    }
    isFormVisible.value = false;
    resetForm();
  } catch (err) {
    MessagePlugin.error(err instanceof Error ? err.message : '操作失败');
  }
}

async function handleDelete(id: number) {
  try {
    await deleteSkill(id);
    MessagePlugin.success('Skill 删除成功');
  } catch (err) {
    MessagePlugin.error(err instanceof Error ? err.message : '删除失败');
  }
}

async function handleEnabledChange(skill: Skill, value: boolean) {
  try {
    await toggleSkillEnabled(skill, value);
  } catch (err) {
    MessagePlugin.error(err instanceof Error ? err.message : '状态更新失败');
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="isSkillManagementVisible"
    header="Extended Skill 管理"
    width="760px"
    :confirm-btn="null"
    :cancel-btn="null"
    @close="closeSkillManagement"
  >
    <div class="skill-management-content">
      <div class="actions">
        <t-button theme="primary" @click="openCreateForm">
          <template #icon><AddIcon /></template>
          新增 Skill
        </t-button>
      </div>

      <div v-if="isLoading" class="loading-state">
        <t-loading text="Loading skills..." />
      </div>
      <div v-else-if="error" class="error-state">
        <t-alert theme="error" :message="error" />
      </div>
      <div v-else-if="skills.length === 0" class="empty-state">
        <p>暂无 Extended Skill</p>
      </div>

      <t-table
        v-else
        :data="skills"
        row-key="id"
        :columns="[
          { colKey: 'name', title: '名称' },
          { colKey: 'description', title: '技能介绍' },
          { colKey: 'visibility', title: '可见性', width: 88 },
          { colKey: 'executionMode', title: '类型', width: 120 },
          { colKey: 'enabled', title: 'Enabled' },
          { colKey: 'operations', title: '操作', width: 160 }
        ]"
        size="small"
      >
        <template #visibility="{ row }">
          <t-tag size="small" variant="light" :theme="row.visibility === 'PUBLIC' ? 'success' : 'default'">
            {{ row.visibility === 'PUBLIC' ? '公共' : '私人' }}
          </t-tag>
        </template>
        <template #executionMode="{ row }">
          <t-space>
            <t-tag :theme="row.executionMode === 'OPENCLAW' ? 'warning' : 'primary'" variant="light" size="small">
              {{ getExecutionModeLabel(row.executionMode) }}
            </t-tag>
            <t-tag v-if="row.executionMode === 'CONFIG' && getConfigSummary(row.configuration).kindLabel" variant="light" size="small">
              {{ getConfigSummary(row.configuration).kindLabel }}
            </t-tag>
          </t-space>
        </template>
        <template #enabled="{ row }">
          <t-switch
            :disabled="!canManageRow(row)"
            :model-value="row.enabled"
            @update:model-value="(value: boolean) => handleEnabledChange(row, value)"
          />
        </template>
        <template #operations="{ row }">
          <t-space v-if="canManageRow(row)">
            <t-button variant="text" shape="square" @click="openEditForm(row)">
              <EditIcon />
            </t-button>
            <t-popconfirm content="确认删除该 Skill 吗？" @confirm="handleDelete(row.id)">
              <t-button variant="text" theme="danger" shape="square">
                <DeleteIcon />
              </t-button>
            </t-popconfirm>
          </t-space>
          <span v-else class="skill-mgmt-readonly">—</span>
        </template>
      </t-table>
    </div>
  </t-dialog>

  <t-dialog
    v-model:visible="isFormVisible"
    :header="isEditMode ? '编辑 Skill' : '新增 Skill'"
    width="860px"
    @confirm="handleSubmit"
  >
    <t-form :data="formData" label-align="top">
      <t-form-item label="名称" name="name">
        <t-input v-model="formData.name" placeholder="例如：获取时间" />
      </t-form-item>
      <t-form-item label="技能介绍" name="description">
        <div class="optimize-textarea-wrap">
          <t-textarea v-model="formData.description" :autosize="{ minRows: 2, maxRows: 4 }" />
          <t-button size="small" variant="text" class="optimize-btn" @click="openTextOptimize('description', '技能介绍', formData.description)">
            ✨ AI 优化
          </t-button>
        </div>
      </t-form-item>
      <t-form-item label="可见性" name="visibility">
        <t-radio-group v-model="formData.visibility">
          <t-radio-button value="PRIVATE">私人（仅自己可管理）</t-radio-button>
          <t-radio-button value="PUBLIC">公共（全员可见）</t-radio-button>
        </t-radio-group>
      </t-form-item>
      <t-form-item label="Execution Mode" name="executionMode">
        <t-radio-group :model-value="formData.executionMode" @update:model-value="handleExecutionModeChange">
          <t-radio-button value="CONFIG">预配置</t-radio-button>
          <t-radio-button value="OPENCLAW">自主规划</t-radio-button>
        </t-radio-group>
      </t-form-item>

      <template v-if="parseError">
        <t-alert theme="warning" :message="`该 Skill 的历史配置当前无法安全映射为结构化表单：${parseError}`" />
        <t-form-item label="原始 Configuration（只读）" name="rawConfiguration">
          <t-textarea
            :model-value="rawConfiguration"
            readonly
            :autosize="{ minRows: 6, maxRows: 12 }"
          />
        </t-form-item>
      </template>

      <template v-else-if="formData.executionMode === 'CONFIG'">
        <t-form-item label="基础类型" name="configKind">
          <t-select
            :model-value="currentConfigKind"
            :options="configKindOptions"
            @change="handleConfigKindChange"
          />
        </t-form-item>

        <template v-if="apiDraft">
          <t-form-item label="预配置模板" name="apiPreset">
            <t-select
              :model-value="apiDraft.preset"
              :options="[
                { value: 'none', label: getPresetLabel('api', 'none') },
                { value: 'current-time', label: getPresetLabel('api', 'current-time') }
              ]"
              @change="handleApiPresetChange"
            />
          </t-form-item>
          <t-form-item label="操作标识" name="apiOperation">
            <t-input v-model="apiDraft.operation" :placeholder="apiDraft.preset === 'current-time' ? '例如：current-time' : '例如：juhe-joke-list'" />
          </t-form-item>
          <t-form-item label="请求方法" name="apiMethod">
            <t-input v-model="apiDraft.method" placeholder="例如：GET / POST" />
          </t-form-item>
          <t-form-item label="请求地址" name="apiEndpoint">
            <t-input v-model="apiDraft.endpoint" :placeholder="apiDraft.preset === 'current-time' ? '例如：https://vv.video.qq.com/checktime?otype=json' : '例如：http://v.juhe.cn/joke/content/list'" />
          </t-form-item>
          <t-form-item label="参数绑定" name="apiParameterBinding">
            <t-radio-group v-model="apiDraft.parameterBinding">
              <t-radio-button value="query">URL Query（默认）</t-radio-button>
              <t-radio-button value="jsonBody">JSON Body</t-radio-button>
              <t-radio-button value="formBody">Form Body</t-radio-button>
            </t-radio-group>
            <p class="skill-param-binding-hint">
              扁平契约字段可写入 URL 查询参数、JSON 请求体，或
              <code>application/x-www-form-urlencoded</code> 表单（POST/PUT/PATCH/DELETE 等；GET/HEAD
              仍走 Query）。注册类 JSON 接口选「JSON Body」；只接受表单的旧接口选「Form Body」。
            </p>
          </t-form-item>
          <t-form-item label="时间戳字段" name="apiResponseTimestampField">
            <t-input v-model="apiDraft.responseTimestampField" placeholder="例如：t" />
          </t-form-item>
          <t-form-item label="接口说明" name="apiInterfaceDescription">
            <div class="optimize-textarea-wrap">
              <t-textarea v-model="apiDraft.interfaceDescription" :autosize="{ minRows: 3, maxRows: 6 }" placeholder="例如：该接口用于获取笑话列表，包含入参说明、出参说明、核心字段意义、限制、字典值和默认值" />
              <t-button size="small" variant="text" class="optimize-btn" @click="openTextOptimize('api_interface_description', '接口说明', apiDraft!.interfaceDescription)">
                ✨ AI 优化
              </t-button>
            </div>
          </t-form-item>
          <t-form-item label="参数格式契约 (JSON)" name="apiParameterContract">
            <div class="optimize-textarea-wrap">
              <t-textarea v-model="apiDraft.parameterContractText" :autosize="{ minRows: 3, maxRows: 8 }" placeholder='例如：{"type":"object","properties":{"page":{"type":"number"}}}' />
              <t-button size="small" variant="text" class="optimize-btn" @click="openTextOptimize('api_parameter_contract', '参数格式契约', apiDraft!.parameterContractText)">
                ✨ AI 优化
              </t-button>
            </div>
          </t-form-item>
          <t-form-item label="Headers (JSON，可选)" name="apiHeaders">
            <div class="optimize-textarea-wrap">
              <t-textarea v-model="apiDraft.headersText" :autosize="{ minRows: 3, maxRows: 6 }" placeholder='例如：{"Authorization":"Bearer token"}' />
              <t-button size="small" variant="text" class="optimize-btn" @click="openTextOptimize('api_headers', 'Headers', apiDraft!.headersText)">
                ✨ AI 优化
              </t-button>
            </div>
          </t-form-item>
          <t-form-item label="Query (JSON，可选)" name="apiQuery">
            <div class="optimize-textarea-wrap">
              <t-textarea v-model="apiDraft.queryText" :autosize="{ minRows: 3, maxRows: 6 }" placeholder='例如：{"page":1,"pagesize":1}' />
              <t-button size="small" variant="text" class="optimize-btn" @click="openTextOptimize('api_query', 'Query', apiDraft!.queryText)">
                ✨ AI 优化
              </t-button>
            </div>
          </t-form-item>
          <t-form-item label="Body (JSON，可选)" name="apiBody">
            <div class="optimize-textarea-wrap">
              <t-textarea v-model="apiDraft.bodyText" :autosize="{ minRows: 3, maxRows: 6 }" placeholder='例如：{"foo":"bar"}' />
              <t-button size="small" variant="text" class="optimize-btn" @click="openTextOptimize('api_body', 'Body', apiDraft!.bodyText)">
                ✨ AI 优化
              </t-button>
            </div>
          </t-form-item>
          <t-form-item label="HTTP 超时（秒）" name="apiTimeoutSeconds">
            <t-input-number
              v-model="apiDraft.timeoutSeconds"
              :min="1"
              :max="3600"
              placeholder="默认 30"
              style="width: 160px"
            />
            <p class="skill-param-binding-hint">
              调用上游 API 的超时等待秒数（1 ~ 3600）。默认 30 秒，超时未响应将返回错误。
              长时间运行的任务建议启用下方「异步轮询」模式。
            </p>
          </t-form-item>
          <t-form-item label="异步轮询" name="apiAsyncPoll">
            <t-checkbox v-model="apiDraft.asyncPollEnabled">启用异步轮询模式</t-checkbox>
            <p class="skill-param-binding-hint">
              适用于上游 API 返回 task_id 后需要轮询结果的场景（批量任务、数据导出等）。
              要求上游提供独立的状态查询端点（见文档）。
            </p>
          </t-form-item>
          <t-form-item v-if="apiDraft.asyncPollEnabled" label="轮询策略" name="apiAsyncPollStrategy">
            <t-radio-group v-model="apiDraft.asyncPollStrategy">
              <t-radio value="PERIODIC">周期轮询（需要提供状态查询端点 + {id} 占位符）</t-radio>
              <t-radio value="SINGLE_CALL">单次长调用（无需 pollEndpoint，提交后立即返回，长 readTimeout 等结果）</t-radio>
            </t-radio-group>
          </t-form-item>
          <t-form-item v-if="apiDraft.asyncPollEnabled && apiDraft.asyncPollStrategy === 'SINGLE_CALL'" label="单次调用 read timeout（秒）" name="apiAsyncPollReadTimeoutSeconds">
            <t-input-number v-model="apiDraft.asyncPollReadTimeoutSeconds" :min="1" :max="3600" :step="30" />
            <p class="skill-param-binding-hint">
              单次调用的最大等待时间（秒）。到达后由后台线程继续等待，完成后写回通知中心。默认 600。
            </p>
          </t-form-item>
          <t-form-item v-if="apiDraft.asyncPollEnabled && apiDraft.asyncPollStrategy === 'PERIODIC'" label="异步轮询配置 (JSON)" name="apiAsyncPollText">
            <div class="optimize-textarea-wrap">
              <t-textarea
                v-model="apiDraft.asyncPollText"
                :autosize="{ minRows: 6, maxRows: 14 }"
                :placeholder="DEFAULT_ASYNC_POLL_TEMPLATE"
              />
              <t-button size="small" variant="text" class="optimize-btn" @click="openTextOptimize('api_async_poll', '异步轮询配置', apiDraft!.asyncPollText)">
                ✨ AI 优化
              </t-button>
            </div>
          </t-form-item>
        </template>

        <template v-else-if="sshDraft">
          <t-form-item label="预配置模板" name="sshPreset">
            <t-input :model-value="getPresetLabel('ssh', sshDraft.preset)" readonly />
          </t-form-item>
          <t-form-item label="操作标识" name="sshOperation">
            <t-input v-model="sshDraft.operation" placeholder="例如：server-resource-status" />
          </t-form-item>
          <t-form-item label="服务器查找器" name="sshLookup">
            <t-input v-model="sshDraft.lookup" placeholder="例如：server_lookup" />
          </t-form-item>
          <t-form-item label="执行器" name="sshExecutor">
            <t-input v-model="sshDraft.executor" placeholder="例如：linux_script_executor" />
          </t-form-item>
          <t-form-item label="调用说明（可选，面向模型）" name="sshInterfaceDescription">
            <t-textarea
              v-model="sshDraft.interfaceDescription"
              :autosize="{ minRows: 3, maxRows: 8 }"
              placeholder="说明工具调用方式（例如台账别名字段）；生成器会写入，也可留空"
            />
          </t-form-item>
          <t-form-item label="执行命令" name="sshCommand">
            <div class="optimize-textarea-wrap">
              <t-textarea v-model="sshDraft.command" :autosize="{ minRows: 5, maxRows: 10 }" />
              <t-button size="small" variant="text" class="optimize-btn" @click="openTextOptimize('ssh_command', '执行命令', sshDraft!.command)">
                ✨ AI 优化
              </t-button>
            </div>
          </t-form-item>
          <t-form-item label="只读模式" name="sshReadOnly">
            <t-checkbox v-model="sshDraft.readOnly">该 SSH 预配置 Skill 只允许只读命令</t-checkbox>
          </t-form-item>
        </template>

        <template v-else-if="templateDraft">
          <t-form-item label="提示词" name="templatePrompt">
            <t-textarea
              v-model="templateDraft.prompt"
              :autosize="{ minRows: 6, maxRows: 16 }"
              placeholder="输入可复用的提示词文本"
            />
          </t-form-item>
        </template>
      </template>

      <template v-else-if="openClawDraft">
        <t-form-item label="提示词（Markdown）" name="openclawPrompt">
          <div class="optimize-textarea-wrap">
            <t-textarea
              v-model="openClawDraft.systemPromptMarkdown"
              :autosize="{ minRows: 8, maxRows: 16 }"
              placeholder="直接输入 Markdown 格式提示词，保存时会写入 systemPrompt。"
            />
            <t-button size="small" variant="text" class="optimize-btn" @click="openTextOptimize('openclaw_prompt', '自主规划提示词', openClawDraft!.systemPromptMarkdown)">
              ✨ AI 优化
            </t-button>
          </div>
        </t-form-item>
        <t-form-item label="编排模式" name="openclawMode">
          <t-input :model-value="openClawDraft.orchestrationMode" readonly />
        </t-form-item>
        <t-form-item label="允许工具列表" name="openclawAllowedTools">
          <div class="tool-list-editor">
            <div
              v-for="(_, index) in openClawDraft.allowedTools"
              :key="`tool-${index}`"
              class="tool-row"
            >
              <t-input v-model="openClawDraft.allowedTools[index]" placeholder="例如：compute" />
              <t-button variant="outline" theme="danger" @click="removeAllowedTool(index)">删除</t-button>
            </div>
            <t-button variant="dashed" @click="addAllowedTool">
              <template #icon><AddIcon /></template>
              添加工具
            </t-button>
            <div class="tool-suggestions">
              <span class="tool-suggestions-label">常用工具：</span>
              <t-space>
                <t-button
                  v-for="toolName in suggestedTools"
                  :key="toolName"
                  size="small"
                  variant="outline"
                  @click="useSuggestedTool(toolName)"
                >
                  {{ toolName }}
                </t-button>
              </t-space>
            </div>
          </div>
        </t-form-item>
      </template>

      <t-space>
        <t-checkbox v-model="formData.enabled">启用</t-checkbox>
        <t-checkbox v-model="formData.requiresConfirmation">需要确认</t-checkbox>
      </t-space>
    </t-form>
  </t-dialog>

  <TextOptimizeModal
    :visible="optimizeVisible"
    :field-id="optimizeFieldId"
    :field-label="optimizeFieldLabel"
    :original-text="optimizeOriginalText"
    :context="optimizeContext"
    :user-id="currentUser?.id || ''"
    @update:visible="(val: boolean) => optimizeVisible = val"
    @confirm="handleOptimizeConfirm"
  />
</template>

<style scoped>
.skill-management-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tool-list-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.tool-suggestions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-suggestions-label {
  color: var(--td-text-color-secondary);
  font-size: 12px;
}

.loading-state,
.empty-state {
  padding: 24px;
  text-align: center;
  color: var(--td-text-color-secondary);
}

.skill-param-binding-hint {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--td-text-color-secondary);
}

.optimize-textarea-wrap {
  position: relative;
  width: 100%;
}

.optimize-btn {
  position: absolute;
  bottom: 4px;
  right: 4px;
  z-index: 1;
}
</style>
