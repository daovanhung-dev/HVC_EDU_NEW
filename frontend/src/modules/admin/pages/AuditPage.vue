<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getAuditLogs } from '@/services/data-queries'
import { formatDateTime } from '@/shared/utils/format'

const rows = ref<any[]>([])
const action = ref('')
const entity = ref('')
const errorMessage = ref('')
const loading = ref(false)
const actions = computed(() => [...new Set(rows.value.map((row) => row.action).filter(Boolean))].sort())
const entities = computed(() => [...new Set(rows.value.map((row) => row.entity_type).filter(Boolean))].sort())
const visibleRows = computed(() => rows.value.filter((row) => (!action.value || row.action === action.value) && (!entity.value || row.entity_type === entity.value)))
async function load() { loading.value = true; try { rows.value = await getAuditLogs() as any[] } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải audit log' } finally { loading.value = false } }
onMounted(load)
</script>

<template>
  <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4"><div><div class="small text-secondary">Security</div><h1 class="h3 mb-0">Audit Log</h1></div><button class="btn btn-outline-primary" @click="load">Làm mới</button></div>
  <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
  <div class="card border-0 shadow-sm"><div class="card-body"><div class="row g-2 mb-3"><div class="col-md-4"><select v-model="action" class="form-select"><option value="">Tất cả thao tác</option><option v-for="item in actions" :key="item" :value="item">{{ item }}</option></select></div><div class="col-md-4"><select v-model="entity" class="form-select"><option value="">Tất cả đối tượng</option><option v-for="item in entities" :key="item" :value="item">{{ item }}</option></select></div></div><div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>Thời gian</th><th>Thao tác</th><th>Đối tượng</th><th>Actor</th><th>Lý do</th><th>Dữ liệu mới</th></tr></thead><tbody><tr v-for="row in visibleRows" :key="row.id"><td>{{ formatDateTime(row.created_at) }}</td><td><code>{{ row.action }}</code></td><td>{{ row.entity_type }}<br><small class="text-secondary">{{ row.entity_id || '—' }}</small></td><td>{{ row.actor_role || '—' }}</td><td>{{ row.reason || '—' }}</td><td><code class="small json-cell">{{ row.new_data ? JSON.stringify(row.new_data) : '—' }}</code></td></tr><tr v-if="!loading && !visibleRows.length"><td colspan="6" class="text-center text-secondary py-5">Chưa có audit log</td></tr></tbody></table></div></div></div>
</template>
