/**
 * 全站 Twemoji 静态资源需覆盖的 emoji 集合（与 `twemojiAvatar.ts` 中文件名归一化一致）。
 * - 用户资料/注册可选：{@link AVATAR_EMOJI_CHOICES}
 * - 内置 Skill、扩展 Skill 派生、消息区见下方常量
 * - AI 生成头像提示词约束为 TWEMOJI_COVERED 全集，避免缺图
 */
export const AVATAR_EMOJI_CHOICES = [
  '👤',
  '🤖',
  '😀',
  '😊',
  '😎',
  '🥳',
  '🤓',
  '🐱',
  '🐶',
  '🦊',
  '🐻',
  '🐼',
  '🐨',
  '🦁',
  '🐸',
  '🦄',
  '🐧',
  '🐙',
  '🌸',
  '🌙',
  '⭐',
  '🌈',
  '🔥',
  '💧',
  '🚀',
  '🎨',
  '📚',
  '🎮',
  '🍎',
  '☕',
  '🎁',
  '💎',
  '🔔',
  '🌊',
  '🌻',
  '🍀',
  '🎸',
  '🏀',
  '⚽',
  '🎲',
] as const;

/** 内置 Skill 列表展示用（与 BUILT_IN_SKILLS 一一对应） */
export const BUILTIN_SKILL_EMOJIS = ['🔌', '🧮', '🐧', '✨'] as const;

/** 扩展 Skill 无 avatar 时稳定派生（与 useSkillHub.extendedSkillEmoji 一致） */
export const EXTENDED_SKILL_EMOJI_POOL = [
  '🧩',
  '⚙️',
  '📦',
  '🛠️',
  '🔧',
  '📡',
  '🎯',
  '💡',
  '🌐',
  '📎',
] as const;

/** 消息区：思考态等（需能加载 Twemoji） */
export const MESSAGE_UI_EMOJIS = ['🤔'] as const;

/** 构建/裁剪脚本与 AI 头像白名单用（去重并集） */
export const TWEMOJI_COVERED_EMOJIS = [
  ...new Set([
    ...AVATAR_EMOJI_CHOICES,
    ...BUILTIN_SKILL_EMOJIS,
    ...EXTENDED_SKILL_EMOJI_POOL,
    ...MESSAGE_UI_EMOJIS,
  ]),
] as const;
