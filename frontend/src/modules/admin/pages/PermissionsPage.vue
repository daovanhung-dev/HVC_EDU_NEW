<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { setAdminPermissionGroups } from '@/services/commands'
import { getAdminPermissionGroupIds, getAdminProfiles, getPermissionGroups } from '@/services/data-queries'

const admins = ref<any[]>([]); const groups = ref<any[]>([]); const selectedUser = ref(''); const selectedGroups = ref<string[]>([]); const errorMessage = ref(''); const successMessage = ref(''); const loading = ref(false)
async function load() { loading.value = true; try { [admins.value, groups.value] = await Promise.all([getAdminProfiles(), getPermissionGroups()]); selectedUser.value = admins.value[0]?.user_id || '' } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải nhóm quyền' } finally { loading.value = false } }
async function loadAssignments() { if (!selectedUser.value) { selectedGroups.value = []; return }; const rows: any[] = await getAdminPermissionGroupIds(selectedUser.value) as any[]; selectedGroups.value = rows.map((row) => row.permission_group_id) }
async function save() { try { await setAdminPermissionGroups(selectedUser.value, selectedGroups.value); successMessage.value = 'Đã lưu nhóm quyền cho ADMIN và ghi audit.' } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể lưu nhóm quyền' } }
watch(selectedUser, loadAssignments); onMounted(load)
</script>

<template>
  <div class="d-flex justify-content-between align-items-center mb-4"><div><div class="small text-secondary">Security</div><h1 class="h3 mb-0">Nhóm quyền ADMIN</h1></div><button class="btn btn-outline-primary" @click="load">Làm mới</button></div>
  <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div><div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
  <div class="card border-0 shadow-sm"><div class="card-body"><label class="form-label">Tài khoản ADMIN</label><select v-model="selectedUser" class="form-select mb-4"><option v-for="admin in admins" :key="admin.user_id" :value="admin.user_id">{{ admin.display_name || admin.username }} ({{ admin.status }})</option></select><div class="row g-3"><div v-for="group in groups" :key="group.id" class="col-md-6 col-xl-4"><label class="border rounded p-3 d-flex gap-2 align-items-start h-100"><input v-model="selectedGroups" class="form-check-input mt-1" type="checkbox" :value="group.id" /><span><strong>{{ group.name }}</strong><br><small class="text-secondary">{{ group.code }}</small></span></label></div></div><button class="btn btn-primary mt-4" :disabled="!selectedUser || loading" @click="save">Lưu nhóm quyền</button></div></div>
</template>
