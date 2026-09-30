<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { reviewTimesheet } from '@/services/commands'
import { getTimesheets } from '@/services/data-queries'
import type { TimesheetRow } from '@/shared/types/domain'
import { formatDateTime } from '@/shared/utils/format'
import { userErrorMessage } from '@/shared/utils/errors'
import { useToastStore } from '@/stores/toast.store'
import FormModal from '@/app/components/FormModal.vue'
import ConfirmModal from '@/app/components/ConfirmModal.vue'
import AppField from '@/app/components/AppField.vue'
import AppState from '@/app/components/AppState.vue'

const toast = useToastStore()
const rows = ref<TimesheetRow[]>([])
const rejectionReasons = ref<Record<string, string>>({})
const selectedRejection = ref<TimesheetRow | null>(null)
const rejectionOpen = ref(false)
const approvalRow = ref<TimesheetRow | null>(null)
const approvalOpen = ref(false)
const loading = ref(false)
const reviewingId = ref('')
const errorMessage = ref('')

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
  if (!approve && !reason) return
  reviewingId.value = row.id
  errorMessage.value = ''
  try {
    await reviewTimesheet({ timesheet_id: row.id, approve, reason: approve ? null : reason })
    toast.success(approve ? 'Đã duyệt chấm công.' : 'Đã từ chối chấm công.')
    if (approve) approvalOpen.value = false
    else rejectionOpen.value = false
    await load()
  } catch (error) {
    errorMessage.value = userErrorMessage(error, 'Không thể xử lý chấm công.')
    if (approve) toast.error(errorMessage.value)
  } finally {
    reviewingId.value = ''
  }
}

function askApprove(row: TimesheetRow) { approvalRow.value = row; approvalOpen.value = true }
function askReject(row: TimesheetRow) { selectedRejection.value = row; rejectionReasons.value[row.id] = ''; rejectionOpen.value = true }

onMounted(load)
</script>

<template>
  <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
    <div><div class="small text-secondary">Nhân sự</div><h1 class="h3 mb-0">Duyệt công</h1></div>
    <button class="btn btn-outline-primary" :disabled="loading" @click="load">Làm mới</button>
  </div>
  <div v-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }}</div>
  <div class="card border-0 shadow-sm"><div class="card-body">
    <AppState v-if="loading" kind="loading" title="Đang tải chấm công" />
    <AppState v-else-if="!rows.length" kind="empty" title="Chưa có yêu cầu chấm công" message="Các yêu cầu mới sẽ xuất hiện tại đây." />
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
                <button class="btn btn-success btn-sm me-2" :disabled="reviewingId === row.id" @click="askApprove(row)">Duyệt</button>
                <div class="d-flex flex-column flex-sm-row gap-2">
                  <button class="btn btn-outline-danger btn-sm" :disabled="reviewingId === row.id" @click="askReject(row)">Từ chối</button>
                </div>
              </template>
              <span v-else class="small text-secondary">Đã xử lý</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div></div>
  <ConfirmModal v-model="approvalOpen" title="Duyệt chấm công?" message="Xác nhận rằng buổi dạy và thông tin chấm công đã được kiểm tra." :item-name="approvalRow?.sessions?.classes?.name || 'Buổi học'" :warning="approvalRow ? `${approvalRow.staff?.full_name || 'Giáo viên'} · ${formatDateTime(approvalRow.sessions?.scheduled_start_at || '')}` : ''" confirm-label="Duyệt chấm công" :busy="Boolean(approvalRow && reviewingId === approvalRow.id)" @confirm="approvalRow && review(approvalRow, true)" />
  <FormModal v-model="rejectionOpen" title="Từ chối chấm công" description="Nhập lý do để giáo viên biết thông tin cần chỉnh sửa." :busy="Boolean(selectedRejection && reviewingId === selectedRejection.id)" :submit-disabled="!selectedRejection || !rejectionReasons[selectedRejection.id]?.trim()" submit-label="Từ chối chấm công" @submit="selectedRejection && review(selectedRejection, false)" @cancel="rejectionOpen = false">
    <AppField v-if="selectedRejection" :id="`rejection-reason-${selectedRejection.id}`" label="Lý do từ chối" required description="Tối đa 500 ký tự."><template #default="field"><textarea :id="field.id" v-model="rejectionReasons[selectedRejection.id]" class="form-control" rows="4" maxlength="500" required data-modal-autofocus :aria-describedby="field.describedBy" /></template></AppField>
    <div v-if="errorMessage" class="alert alert-danger mt-3 mb-0" role="alert">{{ errorMessage }}</div>
    <p class="small text-secondary mt-3 mb-0">{{ selectedRejection?.staff?.full_name }} · {{ selectedRejection?.sessions?.classes?.name || 'Buổi học' }}</p>
  </FormModal>
</template>
