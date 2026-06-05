import { ref } from 'vue';
import { BUILTIN_SKILL_EMOJIS, EXTENDED_SKILL_EMOJI_POOL } from '../constants/twemojiCoveredEmoji';
import { agentUrl, apiUrl } from '../services/config';
import { useUser } from './useUser';

export type SkillVisibility = 'PUBLIC' | 'PRIVATE';

export interface Skill {
  id: number;
  name: string;
  description: string;
  type: string;
  executionMode?: 'CONFIG' | 'OPENCLAW';
  configuration: string;
  enabled: boolean;
  requiresConfirmation?: boolean;
  visibility?: SkillVisibility;
  createdBy?: string;
  /** 展示用 emoji；未设置时由 {@link extendedSkillEmoji} 按 id+名称派生 */
  avatar?: string;
}

/** 与 SkillGateway `SKILL_PLATFORM_ADMIN_USER_ID` 一致；可管理 `createdBy=public` 的平台行 */
export const SKILL_PLATFORM_ADMIN_USER_ID = '890728';

export function canManageGatewaySkill(skill: Skill, userId: string | number | undefined | null): boolean {
  if (userId === undefined || userId === null || String(userId).trim() === '') {
    return false;
  }
  const uid = String(userId).trim();
  const createdBy = (skill.createdBy ?? '').trim();
  if (uid === createdBy) {
    return true;
  }
  return uid === SKILL_PLATFORM_ADMIN_USER_ID && createdBy === 'public';
}

interface ConfigSummary {
  kindLabel: string | null;
}

export function getExecutionModeLabel(executionMode?: string): string {
  return executionMode === 'OPENCLAW' ? '自主规划' : '预配置'
}

export function getConfigSummary(configuration: string): ConfigSummary {
  try {
    const parsed = JSON.parse(configuration || '{}') as Record<string, unknown>
    const rawKind = typeof parsed.kind === 'string' ? parsed.kind : ''
    if (rawKind === 'api') {
      return {
        kindLabel: 'API',
      }
    }
    if (rawKind === 'ssh') {
      return {
        kindLabel: 'SSH',
      }
    }
    if (rawKind === 'template') {
      return {
        kindLabel: '模板',
      }
    }
    if (rawKind === 'time') {
      return {
        kindLabel: 'API',
      }
    }
    if (rawKind === 'monitor') {
      return {
        kindLabel: 'SSH',
      }
    }
  } catch {
    // Ignore malformed configuration in UI summary.
  }

  return {
    kindLabel: null,
  }
}

const isSkillHubVisible = ref(false);
const isSkillManagementVisible = ref(false);
const skills = ref<Skill[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

export const BUILT_IN_SKILLS = [
  {
    id: -1,
    name: 'Interface calls (API)',
    description: 'Call external APIs to retrieve information or perform actions.',
    type: 'BUILTIN',
    configuration: '{}',
    enabled: true,
    emoji: BUILTIN_SKILL_EMOJIS[0],
  },
  {
    id: -2,
    name: 'Calculation (Compute)',
    description: 'Perform mathematical calculations and data processing.',
    type: 'BUILTIN',
    configuration: '{}',
    enabled: true,
    emoji: BUILTIN_SKILL_EMOJIS[1],
  },
  {
    id: -3,
    name: 'SSH Execution (Linux Script)',
    description: 'Execute shell commands on a preconfigured Linux server with serverId and command.',
    type: 'BUILTIN',
    configuration: '{}',
    enabled: true,
    emoji: BUILTIN_SKILL_EMOJIS[2],
  },
  {
    id: -4,
    name: 'Skill Generator',
    description: 'Automatically generate and register new API, SSH, or OPENCLAW skills based on natural language descriptions.',
    type: 'BUILTIN',
    configuration: '{}',
    enabled: true,
    emoji: BUILTIN_SKILL_EMOJIS[3],
  },
];

/** 优先使用保存的 avatar；否则按 id+名称稳定映射，扩展 Skill 列表头像用 Twemoji 展示 */
export function extendedSkillEmoji(skill: Pick<Skill, 'id' | 'name' | 'avatar'>): string {
  const raw = skill.avatar;
  const custom =
    raw !== undefined && raw !== null && String(raw).trim() ? String(raw).trim() : '';
  if (custom) return custom;
  const s = `${skill.id}:${skill.name}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  const idx = h % EXTENDED_SKILL_EMOJI_POOL.length;
  return EXTENDED_SKILL_EMOJI_POOL[idx] ?? '🧩';
}

export function useSkillHub() {
  const { currentUser } = useUser();

  function userIdHeader(): Record<string, string> {
    const id = currentUser.value?.id;
    if (id === undefined || id === null || String(id).trim() === '') {
      return {};
    }
    return { 'X-User-Id': String(id) };
  }

  function toggleSkillHub() {
    isSkillHubVisible.value = !isSkillHubVisible.value;
    if (isSkillHubVisible.value) {
      fetchSkills();
    }
  }

  function openSkillHub() {
    isSkillHubVisible.value = true;
    fetchSkills();
  }

  function closeSkillHub() {
    isSkillHubVisible.value = false;
  }

  function openSkillManagement() {
    isSkillManagementVisible.value = true;
    fetchSkills();
  }

  function closeSkillManagement() {
    isSkillManagementVisible.value = false;
    if (isSkillHubVisible.value) {
      fetchSkills();
    }
  }

  async function fetchSkills() {
    isLoading.value = true;
    error.value = null;
    try {
      const res = await fetch(apiUrl('/api/skills'), {
        cache: 'no-store',
        headers: userIdHeader(),
      });
      if (!res.ok) {
        throw new Error('Failed to fetch skills');
      }
      skills.value = await res.json();
    } catch (e) {
      console.error(e);
      error.value = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchSkill(id: number): Promise<Skill> {
    const res = await fetch(apiUrl(`/api/skills/${id}`), {
      cache: 'no-store',
      headers: userIdHeader(),
    });
    if (!res.ok) {
      throw new Error(res.status === 404 ? 'Skill 不存在或无权查看' : `Failed to fetch skill ${id}`);
    }
    return await res.json();
  }

  async function createSkill(payload: Omit<Skill, 'id'>) {
    const res = await fetch(agentUrl('/features/skills'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...userIdHeader(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create skill');
    }
    const created = (await res.json()) as Skill;
    await fetchSkills();
    const i = skills.value.findIndex((s) => s.id === created.id);
    if (i >= 0) {
      skills.value[i] = { ...skills.value[i], ...created };
    }
  }

  async function updateSkill(id: number, payload: Omit<Skill, 'id'>) {
    const res = await fetch(agentUrl(`/features/skills/${id}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...userIdHeader(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let message = res.status === 404 ? 'Skill 不存在或无权修改' : '更新失败';
      try {
        const err = (await res.json()) as { error?: string };
        if (typeof err?.error === 'string' && err.error.trim()) {
          message = err.error;
        }
      } catch {
        // empty or non-JSON body (e.g. 404)
      }
      throw new Error(message);
    }
    const updated = (await res.json()) as Skill;
    await fetchSkills();
    const i = skills.value.findIndex((s) => s.id === id);
    if (i >= 0) {
      skills.value[i] = { ...skills.value[i], ...updated };
    }
  }

  async function deleteSkill(id: number) {
    const res = await fetch(agentUrl(`/features/skills/${id}`), {
      method: 'DELETE',
      headers: userIdHeader(),
    });
    if (!res.ok) {
      let message = res.status === 404 ? 'Skill 不存在或无权删除' : '删除失败';
      try {
        const err = (await res.json()) as { error?: string };
        if (typeof err?.error === 'string' && err.error.trim()) {
          message = err.error;
        }
      } catch {
        // empty body
      }
      throw new Error(message);
    }
    await fetchSkills();
  }

  async function toggleSkillEnabled(skill: Skill, enabled: boolean) {
    const fullSkill = await fetchSkill(skill.id);
    // Do not send `avatar`: gateway update preserves it when the field is omitted (see SkillService).
    await updateSkill(skill.id, {
      name: fullSkill.name,
      description: fullSkill.description,
      type: fullSkill.type,
      executionMode: fullSkill.executionMode ?? 'CONFIG',
      configuration: fullSkill.configuration,
      enabled,
      requiresConfirmation: fullSkill.requiresConfirmation ?? false,
      visibility: fullSkill.visibility ?? 'PRIVATE',
    });
  }

  return {
    isSkillHubVisible,
    isSkillManagementVisible,
    skills,
    isLoading,
    error,
    toggleSkillHub,
    openSkillHub,
    closeSkillHub,
    openSkillManagement,
    closeSkillManagement,
    refreshSkills: fetchSkills,
    fetchSkills,
    fetchSkill,
    createSkill,
    updateSkill,
    deleteSkill,
    toggleSkillEnabled,
  };
}
