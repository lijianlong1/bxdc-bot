import { ref } from 'vue';
import { useUser } from './useUser';
import { apiUrl } from '../services/config';

/** User server ledger row: connection fields stored on the server; password never returned in list. */
export interface ServerLedger {
  id?: number;
  name: string;
  host?: string;
  port?: number;
  username?: string;
  /** Present only in list response; not sent on create. */
  hasPassword?: boolean;
  hasPrivateKeyPath?: boolean;
  createdAt?: string;
  updatedAt?: string;
  /** Set only on create / update request body. */
  password?: string;
  privateKeyPath?: string;
}

const isServerLedgerVisible = ref(false);
const ledgers = ref<ServerLedger[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

export function useServerLedger() {
  const { currentUser } = useUser();

  function toggleServerLedger() {
    isServerLedgerVisible.value = !isServerLedgerVisible.value;
    if (isServerLedgerVisible.value) {
      fetchLedgers();
    }
  }

  async function fetchLedgers() {
    if (!currentUser.value) return;
    isLoading.value = true;
    error.value = null;
    try {
      const res = await fetch(apiUrl('/api/server-ledgers'), {
        headers: {
          'X-User-Id': currentUser.value.id
        }
      });
      if (!res.ok) throw new Error('Failed to fetch server ledgers');
      ledgers.value = await res.json();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      isLoading.value = false;
    }
  }

  async function createLedger(ledger: ServerLedger) {
    if (!currentUser.value) return;
    try {
      const res = await fetch(apiUrl('/api/server-ledgers'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': currentUser.value.id
        },
        body: JSON.stringify(ledger)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create ledger');
      }
      await fetchLedgers();
    } catch (e) {
      throw e;
    }
  }

  async function updateLedger(id: number, ledger: ServerLedger) {
    if (!currentUser.value) return;
    try {
      const res = await fetch(apiUrl(`/api/server-ledgers/${id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': currentUser.value.id
        },
        body: JSON.stringify(ledger)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update ledger');
      }
      await fetchLedgers();
    } catch (e) {
      throw e;
    }
  }

  async function deleteLedger(id: number) {
    if (!currentUser.value) return;
    try {
      const res = await fetch(apiUrl(`/api/server-ledgers/${id}`), {
        method: 'DELETE',
        headers: {
          'X-User-Id': currentUser.value.id
        }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete ledger');
      }
      await fetchLedgers();
    } catch (e) {
      throw e;
    }
  }

  return {
    isServerLedgerVisible,
    ledgers,
    isLoading,
    error,
    toggleServerLedger,
    fetchLedgers,
    createLedger,
    updateLedger,
    deleteLedger
  };
}
