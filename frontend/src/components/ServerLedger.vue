<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useServerLedger, type ServerLedger } from '../composables/useServerLedger';
import { AddIcon, EditIcon, DeleteIcon, ServerIcon } from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';

const { isServerLedgerVisible, ledgers, isLoading, error, createLedger, updateLedger, deleteLedger } = useServerLedger();

const isFormVisible = ref(false);
const isEditMode = ref(false);
const formTitle = ref('Add Server');
const formData = reactive<ServerLedger>({
  name: '',
  host: '',
  port: 22,
  username: '',
  password: '',
  privateKeyPath: ''
});
const currentId = ref<number | undefined>(undefined);

function openAddForm() {
  isEditMode.value = false;
  formTitle.value = 'Add Server';
  formData.name = '';
  formData.host = '';
  formData.port = 22;
  formData.username = '';
  formData.password = '';
  formData.privateKeyPath = '';
  currentId.value = undefined;
  isFormVisible.value = true;
}

function openEditForm(ledger: ServerLedger) {
  isEditMode.value = true;
  formTitle.value = 'Edit Server';
  formData.name = ledger.name;
  formData.host = ledger.host ?? '';
  formData.port = ledger.port ?? 22;
  formData.username = ledger.username ?? '';
  formData.password = '';
  formData.privateKeyPath = '';
  currentId.value = ledger.id;
  isFormVisible.value = true;
}

async function handleSubmit() {
  try {
    if (isEditMode.value && currentId.value) {
      await updateLedger(currentId.value, { ...formData });
      MessagePlugin.success('Server updated successfully');
    } else {
      await createLedger({ ...formData });
      MessagePlugin.success('Server added successfully');
    }
    isFormVisible.value = false;
  } catch (e: any) {
    MessagePlugin.error(e.message);
  }
}

async function handleDelete(id: number) {
  try {
    await deleteLedger(id);
    MessagePlugin.success('Server deleted successfully');
  } catch (e: any) {
    MessagePlugin.error(e.message);
  }
}
</script>

<template>
  <t-drawer
    v-model:visible="isServerLedgerVisible"
    header="Server Ledger"
    size="medium"
    :footer="false"
  >
    <div class="ledger-content">
      <div class="actions">
        <t-button theme="primary" @click="openAddForm">
          <template #icon><AddIcon /></template>
          Add Server
        </t-button>
      </div>

      <div v-if="isLoading" class="loading-state">
        <t-loading text="Loading..." />
      </div>
      <div v-else-if="error" class="error-state">
        <t-alert theme="error" :message="error" />
      </div>
      <div v-else-if="ledgers.length === 0" class="empty-state">
        <p>No servers found. Add one to get started.</p>
      </div>
      <t-list v-else :split="true">
        <t-list-item v-for="ledger in ledgers" :key="ledger.id">
          <t-list-item-meta
            :title="ledger.name"
            :description="`${ledger.host ?? ''} · id: ${ledger.id} · user: ${ledger.username ?? ''}`"
          >
            <template #image>
              <div class="server-icon">
                <ServerIcon />
              </div>
            </template>
          </t-list-item-meta>
          <template #action>
            <t-space>
              <t-button variant="text" shape="square" @click="openEditForm(ledger)">
                <EditIcon />
              </t-button>
              <t-popconfirm content="Are you sure you want to delete this server?" @confirm="handleDelete(ledger.id!)">
                <t-button variant="text" theme="danger" shape="square">
                  <DeleteIcon />
                </t-button>
              </t-popconfirm>
            </t-space>
          </template>
        </t-list-item>
      </t-list>
    </div>

    <t-dialog
      v-model:visible="isFormVisible"
      :header="formTitle"
      @confirm="handleSubmit"
    >
      <t-form :data="formData" label-align="top">
        <t-form-item label="Display name" name="name">
          <t-input v-model="formData.name" placeholder="e.g. web-prod-1" />
        </t-form-item>
        <t-form-item label="Host" name="host">
          <t-input v-model="formData.host" placeholder="IP or hostname" />
        </t-form-item>
        <t-form-item label="SSH port" name="port">
          <t-input-number v-model="formData.port" :min="1" :max="65535" />
        </t-form-item>
        <t-form-item label="Username" name="username">
          <t-input v-model="formData.username" />
        </t-form-item>
        <t-form-item :label="isEditMode ? 'Password (leave empty to keep)' : 'Password'" name="password">
          <t-input v-model="formData.password" type="password" :placeholder="isEditMode ? 'unchanged if empty' : 'required if no private key path'" />
        </t-form-item>
        <t-form-item label="Private key file path (optional)" name="privateKeyPath">
          <t-input
            v-model="formData.privateKeyPath"
            placeholder="On gateway host; if set, used instead of password"
          />
        </t-form-item>
      </t-form>
    </t-dialog>
  </t-drawer>
</template>

<style scoped>
.ledger-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.server-icon {
  width: 40px;
  height: 40px;
  background-color: var(--td-brand-color-light);
  color: var(--td-brand-color);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
.loading-state, .empty-state {
  padding: 24px;
  text-align: center;
  color: var(--td-text-color-secondary);
}
</style>
