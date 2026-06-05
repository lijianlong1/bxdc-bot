<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  avatarDisplayUrl,
  emojiToTwemojiPngUrl,
  neutralAvatarPlaceholderDataUri,
} from '../utils/twemojiAvatar';

const props = withDefaults(
  defineProps<{
    avatar?: string;
    size?: number;
    /** 圆角方块（Skill 列表）；默认圆形（用户头像） */
    rounded?: boolean;
    /** 背景：默认灰底；Skill / 聊天区用不同浅底 */
    variant?:
      | 'default'
      | 'skillBuiltin'
      | 'skillExtended'
      | 'chatAssistant'
      | 'chatUser';
  }>(),
  {
    rounded: false,
    variant: 'default',
  },
);

const display = computed(() => props.avatar || '👤');
const imgSrc = ref(avatarDisplayUrl(display.value));

watch(
  display,
  (d) => {
    imgSrc.value = avatarDisplayUrl(d);
  },
  { immediate: true },
);

const sizeStyle = computed(() => ({
  width: `${props.size || 24}px`,
  height: `${props.size || 24}px`,
}));

const rootClass = computed(() => [
  'user-avatar',
  props.rounded ? 'user-avatar--rounded' : 'user-avatar--circle',
  `user-avatar--tone-${props.variant}`,
]);

function onImgError() {
  const png = emojiToTwemojiPngUrl(display.value);
  if (png && imgSrc.value.endsWith('.svg')) {
    imgSrc.value = png;
    return;
  }
  imgSrc.value = neutralAvatarPlaceholderDataUri();
}
</script>

<template>
  <div :class="rootClass" :style="sizeStyle">
    <img class="avatar-img" :src="imgSrc" alt="" loading="lazy" @error="onImgError" />
  </div>
</template>

<style scoped>
.user-avatar {
  position: relative;
  display: block;
  user-select: none;
  box-sizing: border-box;
  padding: 3px;
  overflow: hidden;
}

.user-avatar--circle {
  border-radius: 50%;
}

.user-avatar--rounded {
  border-radius: 8px;
}

.user-avatar--tone-default {
  background: #f0f0f0;
}

.user-avatar--tone-skillBuiltin {
  background: var(--td-brand-color-light);
}

.user-avatar--tone-skillExtended {
  background: var(--td-success-color-light);
}

.user-avatar--tone-chatAssistant,
.user-avatar--tone-chatUser {
  background: transparent;
  border: none;
  box-shadow: none;
}

/* Skill 列表：方形、无底色外框感；flex 居中，contain 不裁切 Twemoji */
.user-avatar--rounded.user-avatar--tone-skillBuiltin,
.user-avatar--rounded.user-avatar--tone-skillExtended {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  overflow: visible;
  background: transparent;
}

.user-avatar--rounded.user-avatar--tone-skillBuiltin .avatar-img,
.user-avatar--rounded.user-avatar--tone-skillExtended .avatar-img {
  position: static;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  object-position: center;
  flex-shrink: 0;
}

/* 对话区：无边框底、略圆角方块、不裁切（覆盖 circle 的 50% + overflow:hidden） */
.user-avatar.user-avatar--circle.user-avatar--tone-chatAssistant,
.user-avatar.user-avatar--circle.user-avatar--tone-chatUser {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  overflow: visible;
  border-radius: 8px;
}

.user-avatar--tone-chatAssistant .avatar-img,
.user-avatar--tone-chatUser .avatar-img {
  position: static;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}

.avatar-img {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  display: block;
}
</style>
