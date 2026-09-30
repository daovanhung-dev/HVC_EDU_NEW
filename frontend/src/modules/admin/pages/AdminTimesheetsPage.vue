<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { reviewTimesheet } from '@/services/commands'
import { getTimesheets } from '@/services/data-queries'
import type { TimesheetRow } from '@/shared/types/domain'
import { formatDateTime } from '@/shared/utils/format'
import { userErrorMessage } from '@/shared/utils/errors'

const rows = ref<TimesheetRow[]>([])
const rejectionReasons = ref<Record<string, string>>({})
const loading = ref(false)
const reviewingId = ref('')
const errorMessage = ref('')
const successMessage = ref('')

function statusLabel(status: TimesheetRow['status']) {
  if (status === 'APPROVED') return 'Đã duyệt'
  if (status === 'REJECTED') return 'Bị từ chối'
  return 'Chờ duyệt'
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try { rows.value = await getTimesheets() }
  catch (error) { errorMessage.value = userErrorMessage(error, 'Không thể tải danh sách chấm công.') }
  finally { loading.value = false }
}

async function review(row: TimesheetRow, approve: boolean) {
  const reason = rejectionReasons.value[row.id]?.trim() || ''
  if (!approve && !reason) {
    errorMessage.value = 'Nhập lý do trước khi từ chối chấm công.'
    return
  }
  reviewingId.value = row.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await reviewTimesheet({ timesheet_id: row.id, approve, reason: approve ? null : reason })
    successMessage.value = approve ? 'Đã duyệt chấm công.' : 'Đã từ chối chấm công.'
    await load()
  } catch (error) {
    errorMessage.value = userErrorMessage(error, 'Không thể xử lý chấm công.')
  } finally {
    reviewingId.value = ''
  }
}

onMounted(load)
</script>

<template>
  <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
    <div><div class="small text-secondary">Nhân sự</div><h1 class="h3 mb-0">Duyệt công</h1></div>
    <button class="btn btn-outline-primary" :disabled="loading" @click="load">Làm mới</button>
  </div>
  <div v-if="successMessage" class="alert alert-success" role="status">{{ successMessage }}</div>
  <div v-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }}</div>
  <div class="card border-0 shadow-sm"><div class="card-body">
    <div v-if="loading" class="text-center text-secondary py-4" role="status">Đang tải chấm công…</div>
    <div v-else-if="!rows.length" class="text-center text-secondary py-5">Chưa có yêu cầu chấm công.</div>
    <div v-else class="table-responsive">
      <table class="table align-middle mb-0">
        <thead><tr><th>Buổi học</th><th>Giáo viên</th><th>Thời gian buổi</th><th>Ghi chú</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td class="fw-semibold">{{ row.sessions?.classes?.name || 'Lớp học' }}</td>
            <td>{{ row.staff?.full_name || 'Giáo viên' }}</td>
            <td>{{ row.sessions ? `${formatDateTime(row.sessions.scheduled_start_at)} – ${formatDateTime(row.sessions.scheduled_end_at)}` : '—' }}</td>
            <td class="text-break">{{ row.notes || '—' }}<div v-if="row.rejection_reason" class="small text-danger">Lý do từ chối: {{ row.rejection_reason }}</div></td>
            <td><span class="badge" :class="row.status === 'APPROVED' ? 'text-bg-success' : row.status === 'REJECTED' ? 'text-bg-danger' : 'text-bg-warning'">{{ statusLabel(row.status) }}</span></td>
            <td class="timesheet-review-actions">
              <template v-if="row.status === 'PENDING'">
                <button class="btn btn-success btn-sm me-2" :disabled="reviewingId === row.id" @click="review(row, true)">Duyệt</button>
                <div class="d-flex flex-column flex-sm-row gap-2">
                  <input v-model="rejectionReasons[row.id]" class="form-control form-control-sm" aria-label="Lý do từ chối" placeholder="Lý do từ chối" maxlength="500" />
                  <button class="btn btn-outline-danger btn-sm" :disabled="reviewingId === row.id" @click="review(row, false)">Từ chối</button>
                </div>
              </template>
              <span v-else class="small text-secondary">Đã xử lý</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div></div>
</template>
