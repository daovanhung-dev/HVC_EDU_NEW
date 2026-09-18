<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { approveTimesheet, submitTimesheet } from '@/services/commands'
import { getMyStaff, getTimesheets } from '@/services/data-queries'
import { formatDateTime, formatVnd } from '@/shared/utils/format'
import { useAuthStore } from '@/stores/auth.store'
import { useAppErrorStore } from '@/stores/app-error.store'

const auth = useAuthStore()
const appErrors = useAppErrorStore()
const rows = ref<any[]>([])
const staff = ref<any | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const pendingOnly = ref(false)
const isAdmin = computed(() => auth.isAdmin)
const visibleRows = computed(() => pendingOnly.value ? rows.value.filter((row) => row.status === 'PENDING') : rows.value)
function showError(error: unknown, fallback: string) { const normalized = appErrors.report(error, fallback); errorMessage.value = normalized.message }

async function load() {
  loading.value = true
  errorMessage.value = ''
  try { rows.value = await getTimesheets() as any[]; if (!isAdmin.value) { staff.value = await getMyStaff(); if (!staff.value) throw new Error('STAFF_NOT_FOUND') } } catch (error) { showError(error, 'Không thể tải dữ liệu chấm công.') } finally { loading.value = false }
}

async function review(row: any, approve: boolean) {
  const reason = approve ? undefined : window.prompt('Nhập lý do từ chối chấm công:') || undefined
  if (!approve && !reason) return
  try { await approveTimesheet(row.id, approve, reason); successMessage.value = approve ? 'Đã duyệt chấm công.' : 'Đã từ chối chấm công.'; await load() } catch (error) { showError(error, 'Không thể xử lý chấm công.') }
}

async function resubmit(row: any) {
  if (!staff.value) return
  try { await submitTimesheet(row.sessions.id, staff.value.id, row.notes || undefined); successMessage.value = 'Đã gửi lại chấm công.'; await load() } catch (error) { showError(error, 'Không thể gửi lại chấm công.') }
}

onMounted(load)
</script>

<template>
  <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
    <div><div class="small text-secondary">{{ isAdmin ? 'Operations' : 'Staff portal' }}</div><h1 class="h3 mb-0">{{ isAdmin ? 'Duyệt chấm công' : 'Chấm công của tôi' }}</h1></div>
    <div class="d-flex gap-2"><label class="form-check form-switch pt-2"><input v-model="pendingOnly" class="form-check-input" type="checkbox" /><span class="form-check-label small">Chờ duyệt</span></label><button class="btn btn-outline-primary" @click="load">Làm mới</button></div>
  </div>
  <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div><div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
  <div class="card border-0 shadow-sm"><div class="card-body"><div class="table-responsive"><table class="table align-middle"><thead><tr><th>Buổi học</th><th>{{ isAdmin ? 'Nhân sự' : 'Doanh thu snapshot' }}</th><th>Gửi lúc</th><th>Trạng thái</th><th>Lý do</th><th>Thao tác</th></tr></thead><tbody>
    <tr v-for="row in visibleRows" :key="row.id"><td><div class="fw-semibold">{{ row.sessions?.class_months?.classes?.name || 'Buổi học' }}</div><small class="text-secondary">{{ formatDateTime(row.sessions?.scheduled_start_at) }}</small></td><td>{{ isAdmin ? `${row.staff?.staff_code || ''} — ${row.staff?.full_name || ''}` : formatVnd(row.sessions?.revenue_snapshot) }}</td><td>{{ formatDateTime(row.submitted_at) }}</td><td><span class="badge" :class="row.status === 'APPROVED' ? 'text-bg-success' : row.status === 'REJECTED' ? 'text-bg-danger' : 'text-bg-warning'">{{ row.status }}</span></td><td class="small text-danger">{{ row.rejection_reason || '—' }}</td><td><div v-if="isAdmin && row.status === 'PENDING'" class="d-flex gap-1"><button class="btn btn-sm btn-success" @click="review(row, true)">Duyệt</button><button class="btn btn-sm btn-outline-danger" @click="review(row, false)">Từ chối</button></div><button v-else-if="!isAdmin && row.status === 'REJECTED'" class="btn btn-sm btn-outline-primary" @click="resubmit(row)">Gửi lại</button><span v-else class="small text-secondary">—</span></td></tr>
    <tr v-if="!loading && !visibleRows.length"><td colspan="6" class="text-center text-secondary py-5">Chưa có bản ghi chấm công</td></tr>
  </tbody></table></div></div></div>
</template>
