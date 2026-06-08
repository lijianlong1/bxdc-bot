<script setup lang="ts">
import { computed, reactive, ref, watch, nextTick } from 'vue';
import { AddIcon, DeleteIcon, EditIcon } from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import TextOptimizeModal from './TextOptimizeModal.vue';
import ConfigFormRenderer from './ConfigFormRenderer.vue';
import type { ConfigSchema } from './ConfigFormRenderer.vue';
import {
  BUILT_IN_SKILLS,
  type Skill,
  useSkillHub,
  getExecutionModeLabel,
  getConfigSummary,
  canManageGatewaySkill,
} from '../composables/useSkillHub';
import { useUser } from '../composables/useUser';
import { apiUrl } from '../services/config';
import {
  createDefaultSkillDraft,
  isApiDraft,
  isSshDraft,
  isTemplateDraft,
  isOpenClawDraft,
  parseSkillDraft,
  serializeSkillDraft,
  type ConfigKind,
  type ExecutionMode,
  type SkillConfigDraft,
  type ApiConfigDraft,
  type SshConfigDraft,
  type TemplateConfigDraft,
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

interface ExecutionType {
  type: string;
  label: string;
  configSchema: ConfigSchema;
}

const executionTypes = ref<ExecutionType[]>([]);

const configFormValues = ref<Record<string, unknown>>({});
const syncingFromDraft = ref(false);

function fetchExecutionTypes() {
  fetch(apiUrl('/api/system-skills/execution-types'))
    .then(res => res.json())
    .then(data => { executionTypes.value = Array.isArray(data) ? data : []; })
    .catch(() => { executionTypes.value = []; });
}

function draftToFormValues(draft: SkillConfigDraft): Record<string, unknown> {
  if (isApiDraft(draft)) {
    const headers = draft.headersText.trim() ? (() => { try { return JSON.parse(draft.headersText); } catch { return {}; } })() : undefined;
    const query = draft.queryText.trim() ? (() => { try { return JSON.parse(draft.queryText); } catch { return {}; } })() : undefined;
    const body = draft.bodyText.trim() ? (() => { try { return JSON.parse(draft.bodyText); } catch { return {}; } })() : undefined;
    const pc = draft.parameterContractText.trim() ? (() => { try { return JSON.parse(draft.parameterContractText); } catch { return {}; } })() : undefined;
    const asyncPollVal = draft.asyncPollText.trim() ? (() => { try { return JSON.parse(draft.asyncPollText); } catch { return {}; } })() : undefined;
    return {
      preset: draft.preset,
      operation: draft.operation,
      method: draft.method,
      endpoint: draft.endpoint,
      parameterBinding: draft.parameterBinding,
      responseTimestampField: draft.responseTimestampField,
      timeoutSeconds: draft.timeoutSeconds,
      headers,
      query,
      body,
      interfaceDescription: draft.interfaceDescription,
      parameterContract: pc,
      asyncPoll: asyncPollVal,
      asyncPollEnabled: draft.asyncPollEnabled,
      asyncPollStrategy: draft.asyncPollStrategy,
      asyncPollReadTimeoutSeconds: draft.asyncPollReadTimeoutSeconds,
    };
  }
  if (isSshDraft(draft)) {
    return {
      preset: '服务器状态巡检',
      operation: draft.operation,
      lookup: draft.lookup,
      executor: draft.executor,
      command: draft.command,
      interfaceDescription: draft.interfaceDescription,
    };
  }
  if (isTemplateDraft(draft)) {
    return {
      prompt: draft.prompt,
    };
  }
  return {};
}

function updateDraftFromFormValues(values: Record<string, unknown>) {
   if (isApiDraft(configDraft.value)) {
     const d = configDraft.value as ApiConfigDraft;
     d.preset = (values.preset as ApiConfigDraft['preset']) ?? d.preset;
     d.operation = (values.operation as string) ?? d.operation;
     d.method = (values.method as string) ?? d.method;
     d.endpoint = (values.endpoint as string) ?? d.endpoint;
     d.parameterBinding = (values.parameterBinding as ApiConfigDraft['parameterBinding']) ?? d.parameterBinding;
     d.responseTimestampField = (values.responseTimestampField as string) ?? d.responseTimestampField;
    d.timeoutSeconds = typeof values.timeoutSeconds === 'number' ? values.timeoutSeconds : d.timeoutSeconds;
    d.interfaceDescription = (values.interfaceDescription as string) ?? d.interfaceDescription;
    d.headersText = values.headers && typeof values.headers === 'object' ? JSON.stringify(values.headers, null, 2) : (typeof values.headers === 'string' ? values.headers : d.headersText);
    d.queryText = values.query && typeof values.query === 'object' ? JSON.stringify(values.query, null, 2) : (typeof values.query === 'string' ? values.query : d.queryText);
    d.bodyText = values.body && typeof values.body === 'object' ? JSON.stringify(values.body, null, 2) : (typeof values.body === 'string' ? values.body : d.bodyText);
    d.parameterContractText = values.parameterContract && typeof values.parameterContract === 'object' ? JSON.stringify(values.parameterContract, null, 2) : (typeof values.parameterContract === 'string' ? values.parameterContract : d.parameterContractText);
    d.asyncPollEnabled = typeof values.asyncPollEnabled === 'boolean' ? values.asyncPollEnabled : d.asyncPollEnabled;
    d.asyncPollStrategy = (values.asyncPollStrategy as ApiConfigDraft['asyncPollStrategy']) ?? d.asyncPollStrategy;
    d.asyncPollReadTimeoutSeconds = typeof values.asyncPollReadTimeoutSeconds === 'number' ? values.asyncPollReadTimeoutSeconds : d.asyncPollReadTimeoutSeconds;
    if (values.asyncPoll !== undefined && values.asyncPoll !== null) {
      d.asyncPollText = typeof values.asyncPoll === 'object' ? JSON.stringify(values.asyncPoll, null, 2) : String(values.asyncPoll);
    } else if (!values.asyncPollEnabled) {
      d.asyncPollText = '';
    }
  } else if (isSshDraft(configDraft.value)) {
    const d = configDraft.value as SshConfigDraft;
    d.operation = (values.operation as string) ?? d.operation;
    d.lookup = (values.lookup as string) ?? d.lookup;
    d.executor = (values.executor as string) ?? d.executor;
    d.command = (values.command as string) ?? d.command;
    d.interfaceDescription = (values.interfaceDescription as string) ?? d.interfaceDescription;
  } else if (isTemplateDraft(configDraft.value)) {
    const d = configDraft.value as TemplateConfigDraft;
    d.prompt = (values.prompt as string) ?? d.prompt;
  }
}

function syncDraftToConfigForm() {
  syncingFromDraft.value = true;
  configFormValues.value = draftToFormValues(configDraft.value);
  nextTick(() => { syncingFromDraft.value = false; });
}

watch(configFormValues, (val) => {
  if (syncingFromDraft.value) return;
  updateDraftFromFormValues(val);
}, { deep: true });

const currentExecutionType = computed(() => {
  return executionTypes.value.find(t => t.type === currentConfigKind.value) ?? null;
});

const currentConfigSchema = computed<ConfigSchema | null>(() => {
  return currentExecutionType.value?.configSchema ?? null;
});

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
  else if (fid === 'template_prompt' && templateDraft.value) templateDraft.value.prompt = optimizedText;
  syncDraftToConfigForm();
}

const formData = reactive({
  name: '',
  description: '',
  visibility: 'PRIVATE' as 'PUBLIC' | 'PRIVATE',
  executionMode: 'CONFIG' as ExecutionMode,
  enabled: true,
  requiresConfirmation: false,
});

const configKindOptions = computed(() => {
  return executionTypes.value.map(t => ({
    value: t.type,
    label: t.label,
  }));
});

const currentConfigKind = computed<ConfigKind>(() => {
  if (isApiDraft(configDraft.value)) return 'api';
  if (isTemplateDraft(configDraft.value)) return 'template';
  return 'ssh';
});

const apiDraft = computed(() => (isApiDraft(configDraft.value) ? configDraft.value : null));
const sshDraft = computed(() => (isSshDraft(configDraft.value) ? configDraft.value : null));
const templateDraft = computed(() => (isTemplateDraft(configDraft.value) ? configDraft.value : null));
const openClawDraft = computed(() => (isOpenClawDraft(configDraft.value) ? configDraft.value : null));

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
  if (executionTypes.value.length === 0) fetchExecutionTypes();
  isFormVisible.value = true;
}

async function openEditForm(skillSummary: Skill) {
  try {
    isLoading.value = true;
    if (executionTypes.value.length === 0) await fetchExecutionTypes();
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
    syncDraftToConfigForm();
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
  const kind = configKindOptions.value.some(option => option.value === value) ? (value as ConfigKind) : 'api';
  configDraft.value = createDefaultSkillDraft('CONFIG', kind);
  parseError.value = null;
  syncDraftToConfigForm();
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

        <ConfigFormRenderer
          v-if="currentConfigSchema"
          :config-schema="currentConfigSchema"
          :model-value="configFormValues"
          @update:model-value="(val: Record<string, unknown>) => configFormValues = val"
          @optimize="(fieldId: string, fieldLabel: string, currentValue: string) => { optimizeFieldId = fieldId; optimizeFieldLabel = fieldLabel; optimizeOriginalText = currentValue; optimizeContext = `Skill 名称: ${formData.name}`; optimizeVisible = true; }"
        />
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
