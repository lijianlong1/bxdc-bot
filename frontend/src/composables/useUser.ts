import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { apiUrl } from '../services/config';

export interface User {
  id: string;
  nickname: string;
  avatar: string;
}

export interface LlmSettingsResponse {
  apiBase: string | null;
  modelName: string | null;
  hasApiKey: boolean;
  hasEffectiveApiKey: boolean;
}

// Global state
const currentUser = ref<User | null>(null);
const token = ref<string | null>(localStorage.getItem('user_id'));

export function useUser() {
  const router = useRouter();

  const isLoggedIn = computed(() => !!currentUser.value);

  async function login(id: string) {
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      
      if (!res.ok) {
          const error = await res.json().catch(() => ({ error: 'Login failed' }));
          throw new Error(error.error || 'Login failed');
      }
      
      const user = await res.json();
      currentUser.value = user;
      token.value = user.id;
      localStorage.setItem('user_id', user.id);
      router.push('/');
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  async function register(
    id: string,
    nickname: string,
    systemAdminPassword: string,
    redirect = true
  ) {
    try {
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, nickname, systemAdminPassword })
      });

      if (!res.ok) {
          const error = await res.json().catch(() => ({ error: 'Registration failed' }));
          const msg =
            res.status === 403
              ? (error.error || '暂无注册权限，请联系管理员获取授权凭据。')
              : (error.error || 'Registration failed');
          throw new Error(msg);
      }

      const user = await res.json();
      currentUser.value = user;
      token.value = user.id;
      localStorage.setItem('user_id', user.id);
      
      if (redirect) {
        router.push('/');
      }
      return user;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  function logout() {
    currentUser.value = null;
    token.value = null;
    localStorage.removeItem('user_id');
    router.push('/login');
  }

  async function restoreSession() {
    if (!token.value) return;
    try {
      const res = await fetch(apiUrl(`/api/user/${token.value}`));
      if (res.ok) {
        currentUser.value = await res.json();
      } else {
        // If user not found (e.g. wiped DB), clear local storage
        logout();
      }
    } catch (e) {
      console.error('Failed to restore session:', e);
      // Don't logout immediately on network error, but user remains null so UI might show loading or login prompt
    }
  }

  function userHeadersJson(userId: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    };
  }

  async function updateAvatar(id: string, avatar: string) {
    try {
      const res = await fetch(apiUrl(`/api/user/${id}/avatar`), {
        method: 'PUT',
        headers: userHeadersJson(id),
        body: JSON.stringify({ avatar }),
      });
      if (res.ok) {
        const user = await res.json();
        currentUser.value = user;
        return user;
      }
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || '更新头像失败');
    } catch (e) {
      console.error('Failed to update avatar:', e);
      throw e;
    }
  }

  async function updateProfile(
    id: string,
    body: { nickname?: string; avatar?: string },
  ): Promise<User> {
    const res = await fetch(apiUrl(`/api/user/${id}/profile`), {
      method: 'PUT',
      headers: userHeadersJson(id),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || '保存失败');
    }
    const user = (await res.json()) as User;
    currentUser.value = user;
    return user;
  }

  async function fetchLlmSettings(userId: string): Promise<LlmSettingsResponse> {
    const res = await fetch(apiUrl(`/api/user/${userId}/llm-settings`));
    if (!res.ok) {
      throw new Error('Failed to load LLM settings');
    }
    return res.json();
  }

  async function saveLlmSettings(
    userId: string,
    body: { apiBase: string; modelName: string; apiKey?: string }
  ): Promise<LlmSettingsResponse> {
    const res = await fetch(apiUrl(`/api/user/${userId}/llm-settings`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || 'Save failed');
    }
    return res.json();
  }

  return {
    currentUser,
    isLoggedIn,
    login,
    register,
    logout,
    restoreSession,
    updateAvatar,
    updateProfile,
    fetchLlmSettings,
    saveLlmSettings,
  };
}
