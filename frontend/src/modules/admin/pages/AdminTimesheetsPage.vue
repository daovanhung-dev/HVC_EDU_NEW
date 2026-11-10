<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { reviewTimesheet } from '@/services/commands'
import { getTimesheets } from '@/services/data-queries'
import type { TimesheetRow } from '@/shared/types/domain'
import { formatDateTime } from '@/shared/utils/format'
import {
  formatBusinessDate,
  formatBusinessMonth,
  getBusinessDateKey,
  getMonthGridDateKeys,
  shiftCalendarMonth,
} from '@/shared/utils/session-calendar'
import { userErrorMessage } from '@/shared/utils/errors'
import { useToastStore } from '@/stores/toast.store'
import AppPageHeader from '@/app/components/AppPageHeader.vue'
import FormModal from '@/app/components/FormModal.vue'
import ConfirmModal from '@/app/components/ConfirmModal.vue'
import AppField from '@/app/components/AppField.vue'
import AppState from '@/app/components/AppState.vue'

type TimesheetViewMode = 'calendar' | 'list'

const weekdayLabels = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
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
const viewMode = ref<TimesheetViewMode>('calendar')
const calendarAnchorDate = ref(getBusinessDateKey(new Date()))
const selectedDate = ref('')

const displayedMonthKey = computed(() => calendarAnchorDate.value.slice(0, 7))
const monthDateKeys = computed(() => getMonthGridDateKeys(calendarAnchorDate.value))
const timesheetsByDate = computed(() => {
  const groups: Record<string, TimesheetRow[]> = {}

  rows.value.forEach((row) => {
    const startAt = row.sessions?.scheduled_start_at
    if (!startAt) return

    const dateKey = getBusinessDateKey(startAt)
    ;(groups[dateKey] ||= []).push(row)
  })

  Object.values(groups).forEach((dayRows) => {
    dayRows.sort((left, right) => {
      const startDifference = Date.parse(left.sessions?.scheduled_start_at || '') - Date.parse(right.sessions?.scheduled_start_at || '')
      if (startDifference !== 0) return startDifference
      return (left.staff?.full_name || '').localeCompare(right.staff?.full_name || '', 'vi')
    })
  })

  return groups
})
const pendingCountsByDate = computed(() => Object.fromEntries(
  Object.entries(timesheetsByDate.value)
    .map(([dateKey, dayRows]) => [dateKey, dayRows.filter((row) => row.status === 'PENDING').length])
    .filter(([, count]) => count > 0),
))
const selectedDateRows = computed(() => selectedDate.value ? timesheetsByDate.value[selectedDate.value] || [] : [])
const visibleRows = computed(() => viewMode.value === 'calendar' ? selectedDateRows.value : rows.value)
const displayedMonthPendingCount = computed(() => Object.entries(pendingCountsByDate.value)
  .filter(([dateKey]) => dateKey.startsWith(`${displayedMonthKey.value}-`))
  .reduce((total, [, count]) => total + count, 0))

function statusLabel(status: TimesheetRow['status']) {
  if (status === 'APPROVED') return 'Đã duyệt'
  if (status === 'REVOKED') return 'Đã thu hồi công'
  if (status === 'REJECTED') return 'Bị từ chối'
  return 'Chờ duyệt'
}

function defaultDateForMonth(monthKey: string, fallbackDate?: string) {
  const firstPendingDate = Object.keys(pendingCountsByDate.value)
    .filter((dateKey) => dateKey.startsWith(`${monthKey}-`))
    .sort()[0]

  if (firstPendingDate) return firstPendingDate
  if (fallbackDate?.startsWith(`${monthKey}-`)) return fallbackDate
  return `${monthKey}-01`
}

function calendarDayAriaLabel(dateKey: string) {
  const pendingCount = pendingCountsByDate.value[dateKey] || 0
  const requestCount = timesheetsByDate.value[dateKey]?.length || 0
  const description = pendingCount
    ? `${pendingCount} yêu cầu chờ duyệt`
    : requestCount
      ? `${requestCount} yêu cầu chấm công`
      : 'không có yêu cầu chấm công'
  return `${formatBusinessDate(dateKey)}, ${description}`
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    rows.value = await getTimesheets()
    if (!selectedDate.value) {
      const today = getBusinessDateKey(new Date())
      selectedDate.value = defaultDateForMonth(displayedMonthKey.value, today)
    }
  }
  catch (error) { errorMessage.value = userErrorMessage(error, 'Không thể tải danh sách chấm công.') }
  finally { loading.value = false }
}

function changeMonth(amount: number) {
  calendarAnchorDate.value = shiftCalendarMonth(calendarAnchorDate.value, amount)
  selectedDate.value = defaultDateForMonth(displayedMonthKey.value, getBusinessDateKey(new Date()))
}

function goToCurrentMonth() {
  const today = getBusinessDateKey(new Date())
  calendarAnchorDate.value = today
  selectedDate.value = defaultDateForMonth(today.slice(0, 7), today)
}

function selectCalendarDate(dateKey: string) {
  selectedDate.value = dateKey
  if (!dateKey.startsWith(`${displayedMonthKey.value}-`)) calendarAnchorDate.value = dateKey
}

async function review(row: TimesheetRow, approve: boolean) {
  const reason = rejectionReasons.value[row.id]?.trim() || ''
  if (!approve && !reason) return
  reviewingId.value = row.id
  errorMessage.value = ''
  try {
    await reviewTimesheet({ timesheet_id: row.id, approve, reason: approve ? null : reason })
    toast.success(approve ? 'Đã duyệt chấm công.' : 'Đã từ chối chấm công.')
    reviewingId.value = ''
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
  <AppPageHeader title="Duyệt công" eyebrow="Nhân sự" description="Theo dõi yêu cầu chấm công theo ngày và phản hồi cho giáo viên.">
    <template #actions><button class="btn btn-outline-primary" :disabled="loading" @click="load">{{ loading ? 'Đang làm mới…' : 'Làm mới' }}</button></template>
  </AppPageHeader>
  <div v-if="errorMessage && rows.length" class="alert alert-danger" role="alert">{{ errorMessage }} <button class="btn btn-sm btn-outline-danger ms-2" type="button" @click="load">Thử lại</button></div>
  <div class="card border-0 shadow-sm">
    <div class="card-body">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div class="btn-group" role="group" aria-label="Chế độ hiển thị yêu cầu chấm công">
          <button class="btn" :class="viewMode === 'calendar' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="viewMode === 'calendar'" @click="viewMode = 'calendar'">Lịch</button>
          <button class="btn" :class="viewMode === 'list' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="viewMode === 'list'" @click="viewMode = 'list'">Danh sách</button>
        </div>
        <div v-if="viewMode === 'calendar'" class="d-flex flex-wrap align-items-center justify-content-center gap-2">
          <button class="btn btn-outline-secondary btn-sm" aria-label="Tháng trước" @click="changeMonth(-1)">‹ Trước</button>
          <h2 class="h6 mb-0 text-capitalize text-center timesheet-calendar-period">{{ formatBusinessMonth(calendarAnchorDate) }}</h2>
          <button class="btn btn-outline-secondary btn-sm" aria-label="Tháng sau" @click="changeMonth(1)">Sau ›</button>
          <button class="btn btn-outline-primary btn-sm" @click="goToCurrentMonth">Tháng hiện tại</button>
          <span class="badge" :class="displayedMonthPendingCount ? 'text-bg-danger' : 'text-bg-secondary'">{{ displayedMonthPendingCount }} chờ duyệt</span>
        </div>
      </div>

      <AppState v-if="loading" kind="loading" title="Đang tải chấm công" />
      <AppState v-else-if="errorMessage && !rows.length" kind="error" title="Không thể tải danh sách chấm công" :message="errorMessage" @retry="load" />
      <template v-else>
        <section v-if="viewMode === 'calendar'" class="timesheet-calendar" aria-label="Lịch duyệt công theo tháng">
          <div class="timesheet-calendar-scroll">
            <div class="timesheet-calendar-weekdays" aria-hidden="true">
              <div v-for="day in weekdayLabels" :key="day" class="timesheet-calendar-weekday">{{ day }}</div>
            </div>
            <div class="timesheet-calendar-grid">
              <div
                v-for="dateKey in monthDateKeys"
                :key="dateKey"
                class="timesheet-calendar-cell"
                :data-date="dateKey"
                :class="{
                  'timesheet-calendar-cell--outside': dateKey.slice(0, 7) !== displayedMonthKey,
                  'timesheet-calendar-cell--pending': Boolean(pendingCountsByDate[dateKey]),
                }"
              >
                <button
                  type="button"
                  class="timesheet-calendar-day"
                  :class="{ 'timesheet-calendar-day--selected': selectedDate === dateKey }"
                  :aria-label="calendarDayAriaLabel(dateKey)"
                  :aria-pressed="selectedDate === dateKey"
                  @click="selectCalendarDate(dateKey)"
                >
                  <span class="timesheet-calendar-day-number">{{ Number(dateKey.slice(-2)) }}</span>
                  <span v-if="pendingCountsByDate[dateKey]" class="badge text-bg-danger timesheet-calendar-count">{{ pendingCountsByDate[dateKey] }} chờ duyệt</span>
                  <span v-else-if="timesheetsByDate[dateKey]?.length" class="badge text-bg-light text-secondary timesheet-calendar-count">{{ timesheetsByDate[dateKey].length }} yêu cầu</span>
                </button>
              </div>
            </div>
          </div>

          <section v-if="selectedDate" class="timesheet-day-details" :aria-label="`Yêu cầu chấm công ngày ${formatBusinessDate(selectedDate)}`">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <h3 class="h6 mb-0">Yêu cầu chấm công · {{ formatBusinessDate(selectedDate) }}</h3>
              <span v-if="pendingCountsByDate[selectedDate]" class="badge text-bg-danger">{{ pendingCountsByDate[selectedDate] }} chờ duyệt</span>
            </div>
            <AppState v-if="!selectedDateRows.length" kind="empty" title="Ngày này chưa có yêu cầu chấm công" message="Chọn ngày có yêu cầu để xem chi tiết." />
          </section>
        </section>

        <AppState v-if="viewMode === 'list' && !rows.length" kind="empty" title="Chưa có yêu cầu chấm công" message="Các yêu cầu mới sẽ xuất hiện tại đây." />
        <div v-if="visibleRows.length" class="table-responsive timesheet-review-table">
          <table class="table align-middle mb-0">
            <thead><tr><th>Buổi học</th><th>Giáo viên</th><th>Thời gian buổi</th><th>Ghi chú</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              <tr v-for="row in visibleRows" :key="row.id">
                <td class="fw-semibold">{{ row.sessions?.classes?.name || 'Lớp học' }}</td>
                <td>{{ row.staff?.full_name || 'Giáo viên' }}</td>
                <td>{{ row.sessions ? `${formatDateTime(row.sessions.scheduled_start_at)} – ${formatDateTime(row.sessions.scheduled_end_at)}` : '—' }}</td>
                <td class="text-break">{{ row.notes || '—' }}<div v-if="row.rejection_reason" class="small text-danger">Lý do từ chối: {{ row.rejection_reason }}</div><div v-if="row.revoked_reason" class="small text-secondary">Lý do thu hồi: {{ row.revoked_reason }}</div></td>
                <td><span class="badge" :class="row.status === 'APPROVED' ? 'text-bg-success' : row.status === 'REJECTED' ? 'text-bg-danger' : row.status === 'REVOKED' ? 'text-bg-secondary' : 'text-bg-warning'">{{ statusLabel(row.status) }}</span></td>
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
      </template>
    </div>
  </div>
  <ConfirmModal v-model="approvalOpen" title="Duyệt chấm công?" message="Xác nhận rằng buổi dạy và thông tin chấm công đã được kiểm tra." :item-name="approvalRow?.sessions?.classes?.name || 'Buổi học'" :warning="approvalRow ? `${approvalRow.staff?.full_name || 'Giáo viên'} · ${formatDateTime(approvalRow.sessions?.scheduled_start_at || '')}` : ''" confirm-label="Duyệt chấm công" :busy="Boolean(approvalRow && reviewingId === approvalRow.id)" @confirm="approvalRow && review(approvalRow, true)" />
  <FormModal v-model="rejectionOpen" title="Từ chối chấm công" description="Nhập lý do để giáo viên biết thông tin cần chỉnh sửa." :busy="Boolean(selectedRejection && reviewingId === selectedRejection.id)" :submit-disabled="!selectedRejection || !rejectionReasons[selectedRejection.id]?.trim()" submit-label="Từ chối chấm công" @submit="selectedRejection && review(selectedRejection, false)" @cancel="rejectionOpen = false">
    <AppField v-if="selectedRejection" :id="`rejection-reason-${selectedRejection.id}`" label="Lý do từ chối" required description="Tối đa 500 ký tự."><template #default="field"><textarea :id="field.id" v-model="rejectionReasons[selectedRejection.id]" class="form-control" rows="4" maxlength="500" required data-modal-autofocus :aria-describedby="field.describedBy" /></template></AppField>
    <div v-if="errorMessage" class="alert alert-danger mt-3 mb-0" role="alert">{{ errorMessage }}</div>
    <p class="small text-secondary mt-3 mb-0">{{ selectedRejection?.staff?.full_name }} · {{ selectedRejection?.sessions?.classes?.name || 'Buổi học' }}</p>
  </FormModal>
</template>

<style scoped>
.timesheet-calendar-scroll {
  overflow-x: auto;
}

.timesheet-calendar-weekdays,
.timesheet-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(6.25rem, 1fr));
  min-width: 43.75rem;
}

.timesheet-calendar-weekday {
  padding: 0.5rem 0.25rem;
  color: var(--bs-secondary-color);
  font-size: 0.8rem;
  font-weight: 600;
  text-align: center;
}

.timesheet-calendar-cell {
  min-height: 5.5rem;
  border: 1px solid var(--bs-border-color);
  background: var(--bs-body-bg);
}

.timesheet-calendar-cell--outside {
  background: var(--bs-tertiary-bg);
}

.timesheet-calendar-cell--pending {
  background: #fff1f0;
  border-color: #f1b5b5;
}

.timesheet-calendar-cell--pending.timesheet-calendar-cell--outside {
  background: #fde4e2;
}

.timesheet-calendar-day {
  display: flex;
  width: 100%;
  min-height: 5.5rem;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.45rem;
  padding: 0.5rem;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
}

.timesheet-calendar-day:hover {
  background: rgb(13 110 253 / 8%);
}

.timesheet-calendar-day:focus-visible {
  position: relative;
  z-index: 1;
  outline: 2px solid var(--bs-primary);
  outline-offset: -2px;
}

.timesheet-calendar-day--selected {
  box-shadow: inset 0 0 0 2px var(--bs-primary);
}

.timesheet-calendar-day-number {
  font-weight: 600;
}

.timesheet-calendar-cell--outside .timesheet-calendar-day-number {
  color: var(--bs-secondary-color);
}

.timesheet-calendar-count {
  white-space: normal;
  text-align: left;
}

.timesheet-day-details {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--bs-border-color);
}
</style>
