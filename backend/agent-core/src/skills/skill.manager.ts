/**
 * 技能管理器模块
 * 
 * 模块职责：
 * 1. 发现并加载 SKILL.md 技能定义文件
 * 2. 解析 YAML Frontmatter 获取技能元数据
 * 3. 将技能转换为 LangChain DynamicTool
 * 4. 提供技能描述和搜索能力
 * 
 * 技能发现机制：
 * 1. 扫描默认目录：./SKILLs/
 * 2. 扫描环境变量 AGENT_SKILLS_DIRS 指定的额外目录
 * 3. 递归查找所有 SKILL.md 文件
 * 4. 解析 Frontmatter 和 Markdown 内容
 * 
 * 技能元数据：
 * - name: 技能唯一标识符
 * - description: 技能描述（用于提示词和工具描述）
 * - category: 技能分类
 * - tags: 标签数组
 * - metadata: 扩展元数据键值对
 * 
 * 工具生成：
 * - 每个技能生成一个 DynamicTool
 * - 工具名称格式：skill_{normalized_name}
 * - 工具描述包含：描述、元数据摘要、使用示例
 * 
 * 缓存机制：
 * - 启动时一次性加载所有技能
 * - 提供 getLangChainTools() 获取工具数组
 * - 提供 describeTool() 查询工具信息
 * 
 * @module SkillManager
 * @author Agent Core Team
 * @since 1.0.0
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { Injectable } from '@nestjs/common';
import { DynamicTool } from '@langchain/core/tools';
import { RegisteredSkill, SkillFrontmatter, SkillMetadata, SkillMetadataValue } from './types';

const SKILL_FILE_NAME = 'SKILL.md';
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const DEFAULT_SKILLS_DIR_NAME = 'SKILLs';
const MAX_DESCRIPTION_LENGTH = 180;
const MAX_METADATA_SUMMARY_LENGTH = 160;
const MAX_METADATA_ENTRIES = 6;

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractDescription(content: string): string {
  for (const line of content.split(/\r?\n/)) {
    const normalized = normalizeText(line.replace(/^#+\s*/, ''));
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

function parseFrontmatter(raw: string): { frontmatter: SkillFrontmatter; content: string } {
  const normalized = raw.replace(/^\uFEFF/, '');
  const match = normalized.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {}, content: normalized };
  }

  let frontmatter: SkillFrontmatter = {};
  try {
    const parsed = yaml.load(match[1]);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      frontmatter = parsed as SkillFrontmatter;
    }
  } catch (error) {
    console.warn('[skills] Failed to parse frontmatter:', error);
  }

  return {
    frontmatter,
    content: normalized.slice(match[0].length),
  };
}

function serializeMetadataValue(value: SkillMetadataValue): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => serializeMetadataValue(entry))
      .filter(Boolean)
      .join(', ');
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .slice(0, 3)
      .map(([key, entry]) => `${key}:${serializeMetadataValue(entry)}`)
      .join(', ');
  }
  return '';
}

function summarizeMetadata(metadata: SkillMetadata): string {
  const summary = Object.entries(metadata)
    .map(([key, value]) => {
      const serialized = normalizeText(serializeMetadataValue(value));
      return serialized ? `${key}=${serialized}` : '';
    })
    .filter(Boolean)
    .slice(0, MAX_METADATA_ENTRIES)
    .join('; ');

  return truncate(summary, MAX_METADATA_SUMMARY_LENGTH);
}

function normalizeToolName(skillId: string): string {
  const normalized = skillId.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return `skill_${normalized || 'loader'}`;
}

function isIgnoredDirectory(dirName: string): boolean {
  return dirName === '.git' || dirName === 'node_modules' || dirName === 'dist';
}

function isDemoSkill(skill: RegisteredSkill): boolean {
  const category = normalizeText(String(skill.metadata?.category || '')).toLowerCase();
  return category === 'demo' || category === 'example';
}

@Injectable()
export class SkillManager {
  private getRoutableSkills(): RegisteredSkill[] {
    return this.listSkills().filter((skill) => !isDemoSkill(skill));
  }

  private getConfiguredRoots(): string[] {
    const envValue = process.env.AGENT_SKILLS_DIRS || '';
    const envRoots = envValue
      .split(path.delimiter)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => (path.isAbsolute(entry) ? entry : path.resolve(process.cwd(), entry)));

    const defaultRoot = path.resolve(process.cwd(), DEFAULT_SKILLS_DIR_NAME);
    return Array.from(new Set([defaultRoot, ...envRoots]));
  }

  private collectSkillDirs(root: string): string[] {
    if (!fs.existsSync(root)) return [];

    const skillDirs: string[] = [];
    const queue: string[] = [root];
    const seen = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      const resolved = path.resolve(current);
      if (seen.has(resolved)) continue;
      seen.add(resolved);

      let stat: fs.Stats;
      try {
        stat = fs.statSync(resolved);
      } catch {
        continue;
      }

      if (!stat.isDirectory()) continue;

      if (fs.existsSync(path.join(resolved, SKILL_FILE_NAME))) {
        skillDirs.push(resolved);
        continue;
      }

      let entries: string[] = [];
      try {
        entries = fs.readdirSync(resolved);
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (isIgnoredDirectory(entry)) continue;
        queue.push(path.join(resolved, entry));
      }
    }

    return skillDirs;
  }

  private parseSkillDir(skillDir: string): RegisteredSkill | null {
    const skillPath = path.join(skillDir, SKILL_FILE_NAME);
    if (!fs.existsSync(skillPath)) return null;

    try {
      const raw = fs.readFileSync(skillPath, 'utf8');
      const { frontmatter, content } = parseFrontmatter(raw);
      const prompt = content.trim();
      const folderId = path.basename(skillDir);
      const id = normalizeText(String(frontmatter.name || folderId)).replace(/\s+/g, '-').toLowerCase();
      const name = normalizeText(String(frontmatter.name || folderId)) || folderId;
      const description = truncate(
        normalizeText(String(frontmatter.description || extractDescription(prompt) || name)),
        MAX_DESCRIPTION_LENGTH
      );
      const metadata = (frontmatter.metadata && typeof frontmatter.metadata === 'object' && !Array.isArray(frontmatter.metadata)
        ? frontmatter.metadata
        : {}) as SkillMetadata;

      return {
        id,
        toolName: normalizeToolName(id),
        name,
        description,
        metadata,
        metadataSummary: summarizeMetadata(metadata),
        skillPath,
        prompt,
      };
    } catch (error) {
      console.warn('[skills] Failed to load skill:', skillDir, error);
      return null;
    }
  }

  listSkills(): RegisteredSkill[] {
    const seen = new Set<string>();
    const skills: RegisteredSkill[] = [];

    for (const root of this.getConfiguredRoots()) {
      for (const skillDir of this.collectSkillDirs(root)) {
        const skill = this.parseSkillDir(skillDir);
        if (!skill) continue;
        if (seen.has(skill.id)) continue;
        seen.add(skill.id);
        skills.push(skill);
      }
    }

    skills.sort((left, right) => left.name.localeCompare(right.name));
    return skills;
  }

  buildSkillPromptContext(): string {
    const skills = this.getRoutableSkills();
    if (skills.length === 0) return '';

    const lines = skills.map((skill) => {
      const metadataSuffix = skill.metadataSummary ? ` | metadata: ${skill.metadataSummary}` : '';
      return `- ${skill.name}: ${skill.description}${metadataSuffix}`;
    });

    return [
      '[Available Skills]',
      'You can load a skill on demand when it is directly relevant.',
      'Only use a skill tool when the current request clearly matches the skill description.',
      'The tool will return the full SKILL.md instructions only after you choose it.',
      ...lines,
      '',
    ].join('\n');
  }

  private buildToolResult(skill: RegisteredSkill, reason: string): string {
    const metadataBlock = skill.metadataSummary ? `Metadata: ${skill.metadataSummary}\n` : '';
    const reasonBlock = normalizeText(reason) ? `Why loaded: ${normalizeText(reason)}\n` : '';

    return [
      `Skill loaded: ${skill.name}`,
      `Skill id: ${skill.id}`,
      metadataBlock.trimEnd(),
      reasonBlock.trimEnd(),
      'Follow the instructions below for the current request when relevant:',
      skill.prompt,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  getLangChainTools(): DynamicTool[] {
    return this.getRoutableSkills().map((skill) => new DynamicTool({
      name: skill.toolName,
      description: [
        `Load the full SKILL.md instructions for "${skill.name}".`,
        `Use this only when the user request clearly matches the skill.`,
        `Description: ${skill.description}.`,
        skill.metadataSummary ? `Metadata: ${skill.metadataSummary}.` : '',
        'Input should briefly explain why this skill is needed.',
      ]
        .filter(Boolean)
        .join(' '),
      func: async (input: string) => this.buildToolResult(skill, input),
    }));
  }

  describeTool(toolName: string): { displayName: string; kind: 'skill' | 'tool' } {
    const skill = this.listSkills().find((entry) => entry.toolName === toolName);
    if (skill) {
      return {
        displayName: skill.name,
        kind: 'skill',
      };
    }

    return {
      displayName: toolName.replace(/^skill_/, '').replace(/_/g, ' '),
      kind: 'tool',
    };
  }
}
