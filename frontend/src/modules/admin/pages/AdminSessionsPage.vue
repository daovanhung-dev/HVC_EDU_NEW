<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { updateSessionOccurrence } from '@/services/commands'
import { getMySessions, getSessionStudents } from '@/services/data-queries'
import type { SessionRow } from '@/shared/types/domain'
import { formatDateTime } from '@/shared/utils/format'
import {
  addCalendarDays,
  formatBusinessDate,
  formatBusinessMonth,
  formatBusinessTime,
  getBusinessDateKey,
  getMonthGridDateKeys,
  getWeekDateKeys,
  groupSessionsByBusinessDate,
  shiftCalendarMonth,
} from '@/shared/utils/session-calendar'

type ViewMode = 'month' | 'week' | 'list'

const weekdayLabels = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
const sessions = ref<SessionRow[]>([])
const students = ref<any[]>([])
const selected = ref<SessionRow | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const startInput = ref('')
const endInput = ref('')
const viewMode = ref<ViewMode>('month')
const calendarAnchorDate = ref(getBusinessDateKey(new Date()))
const todayDateKey = ref(getBusinessDateKey(new Date()))
const teachers = computed(() => (selected.value?.session_staff || []).map((item) => item.staff?.full_name).filter(Boolean).join(', ') || 'Chưa phân công')

function refreshTodayDateKey() {
  todayDateKey.value = getBusinessDateKey(new Date())
  return todayDateKey.value
}

function toLocalInput(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value))
  const part = (type: string) => parts.find((item) => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}

function fromLocalInput(value: string) {
  return new Date(`${value}:00+07:00`).toISOString()
}

const sessionsByDate = computed(() => groupSessionsByBusinessDate(sessions.value))
const monthDateKeys = computed(() => getMonthGridDateKeys(calendarAnchorDate.value))
const weekDateKeys = computed(() => getWeekDateKeys(calendarAnchorDate.value))
const visibleDateKeys = computed(() => viewMode.value === 'week' ? weekDateKeys.value : monthDateKeys.value)
const periodTitle = computed(() => viewMode.value === 'month'
  ? formatBusinessMonth(calendarAnchorDate.value)
  : `${formatBusinessDate(weekDateKeys.value[0])} – ${formatBusinessDate(weekDateKeys.value[6])}`)
const visibleSessionCount = computed(() => visibleDateKeys.value.reduce((total, dateKey) => total + (sessionsByDate.value[dateKey]?.length || 0), 0))

function className(session: SessionRow) {
  return session.classes?.name?.trim() || 'Chưa có tên lớp'
}

function sessionStatusClass(status: SessionRow['status']) {
  if (status === 'COMPLETED') return 'text-bg-success'
  if (status === 'CANCELLED') return 'text-bg-danger'
  if (status === 'IN_PROGRESS') return 'text-bg-primary'
  return 'text-bg-secondary'
}

function changePeriod(amount: number) {
  refreshTodayDateKey()
  calendarAnchorDate.value = viewMode.value === 'month'
    ? shiftCalendarMonth(calendarAnchorDate.value, amount)
    : addCalendarDays(calendarAnchorDate.value, amount * 7)
}

function goToToday() {
  calendarAnchorDate.value = refreshTodayDateKey()
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    sessions.value = await getMySessions()
    if (selected.value) {
      selected.value = sessions.value.find((session) => session.id === selected.value?.id) || null
      if (!selected.value) students.value = []
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể tải buổi học.'
  } finally {
    loading.value = false
  }
}

async function selectSession(session: SessionRow) {
  selected.value = session
  startInput.value = toLocalInput(session.scheduled_start_at)
  endInput.value = toLocalInput(session.scheduled_end_at)
  errorMessage.value = ''
  try { students.value = await getSessionStudents(session.id) as any[] }
  catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải chi tiết buổi học.' }
}

async function saveSchedule() {
  if (!selected.value || !startInput.value || !endInput.value) return
  const sessionId = selected.value.id
  try {
    await updateSessionOccurrence({ session_id: sessionId, start: fromLocalInput(startInput.value), end: fromLocalInput(endInput.value) })
    successMessage.value = 'Đã đổi lịch buổi học.'
    await load()
    const refreshed = sessions.value.find((item) => item.id === sessionId)
    if (refreshed) await selectSession(refreshed)
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể đổi lịch buổi học.' }
}

async function cancel() {
  if (!selected.value || !window.confirm(`Hủy buổi học ${formatDateTime(selected.value.scheduled_start_at)}?`)) return
  const sessionId = selected.value.id
  try {
    await updateSessionOccurrence({ session_id: sessionId, cancel: true })
    successMessage.value = 'Đã hủy buổi học.'
    await load()
    const refreshed = sessions.value.find((item) => item.id === sessionId)
    if (refreshed) await selectSession(refreshed)
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể hủy buổi học.' }
}

onMounted(load)
</script>

<template>
  <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
    <div><div class="small text-secondary">Học tập</div><h1 class="h3 mb-0">Buổi học</h1></div>
    <div class="d-flex flex-wrap gap-2">
      <RouterLink class="btn btn-primary" to="/admin/classes">Xếp lịch lớp</RouterLink>
      <button class="btn btn-outline-primary" :disabled="loading" @click="load">Làm mới</button>
    </div>
  </div>
  <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
  <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

  <div class="card border-0 shadow-sm mb-4">
    <div class="card-body">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div class="btn-group" role="group" aria-label="Chế độ hiển thị buổi học">
          <button class="btn" :class="viewMode === 'month' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="viewMode === 'month'" @click="viewMode = 'month'">Tháng</button>
          <button class="btn" :class="viewMode === 'week' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="viewMode === 'week'" @click="viewMode = 'week'">Tuần</button>
          <button class="btn" :class="viewMode === 'list' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="viewMode === 'list'" @click="viewMode = 'list'">Danh sách</button>
        </div>
        <div v-if="viewMode !== 'list'" class="d-flex flex-wrap align-items-center gap-2">
          <button class="btn btn-outline-secondary btn-sm" aria-label="Kỳ trước" @click="changePeriod(-1)">‹ Trước</button>
          <h2 class="h6 mb-0 text-capitalize text-center calendar-period-title">{{ periodTitle }}</h2>
          <button class="btn btn-outline-secondary btn-sm" aria-label="Kỳ sau" @click="changePeriod(1)">Sau ›</button>
          <button class="btn btn-outline-primary btn-sm" @click="goToToday">Hôm nay</button>
        </div>
      </div>
    </div>
  </div>

  <div class="row g-4 mb-4">
    <div :class="viewMode === 'list' ? 'col-12 col-xl-5' : 'col-12'">
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div v-if="viewMode === 'list'" class="session-list">
            <div v-if="loading" class="text-center text-secondary py-4" role="status">Đang tải buổi học…</div>
            <div v-else-if="!errorMessage && !sessions.length" class="text-center text-secondary py-5">Chưa có buổi học.</div>
            <button v-for="session in sessions" :key="session.id" class="btn w-100 text-start border-bottom rounded-0 py-3" :class="selected?.id === session.id ? 'bg-primary-subtle' : ''" @click="selectSession(session)">
              <div class="d-flex justify-content-between gap-2"><span class="fw-semibold">{{ className(session) }}</span><span class="badge" :class="sessionStatusClass(session.status)">{{ session.status }}</span></div>
              <small class="text-secondary">{{ formatDateTime(session.scheduled_start_at) }}</small>
            </button>
          </div>

          <div v-else>
            <div class="calendar-scroll" :aria-label="viewMode === 'month' ? 'Lịch tháng' : 'Lịch tuần'">
              <div class="calendar-weekdays" aria-hidden="true">
                <div v-for="day in weekdayLabels" :key="day" class="calendar-weekday">{{ day }}</div>
              </div>

              <div class="calendar-grid" :class="viewMode === 'week' ? 'calendar-grid-week' : 'calendar-grid-month'">
                <section
                  v-for="dateKey in visibleDateKeys"
                  :key="dateKey"
                  class="calendar-day"
                  :class="{
                    'calendar-day-outside': viewMode === 'month' && dateKey.slice(0, 7) !== calendarAnchorDate.slice(0, 7),
                    'calendar-day-today': dateKey === todayDateKey,
                  }"
                  :aria-label="formatBusinessDate(dateKey)"
                >
                  <div class="calendar-day-heading">
                    <span class="calendar-day-number">{{ Number(dateKey.slice(-2)) }}</span>
                    <span v-if="dateKey === todayDateKey" class="badge text-bg-primary">Hôm nay</span>
                  </div>
                  <div class="calendar-day-events">
                    <button
                      v-for="session in sessionsByDate[dateKey] || []"
                      :key="session.id"
                      class="calendar-event"
                      :class="{ 'calendar-event-selected': selected?.id === session.id }"
                      :aria-pressed="selected?.id === session.id"
                      :aria-label="`${formatBusinessTime(session.scheduled_start_at)} ${className(session)}, ${session.status}`"
                      @click="selectSession(session)"
                    >
                      <span class="calendar-event-time">{{ formatBusinessTime(session.scheduled_start_at) }}–{{ formatBusinessTime(session.scheduled_end_at) }}</span>
                      <span class="calendar-event-name">{{ className(session) }}</span>
                      <span class="badge align-self-start" :class="sessionStatusClass(session.status)">{{ session.status }}</span>
                    </button>
                  </div>
                </section>
              </div>
            </div>
            <div v-if="loading" class="text-center text-secondary py-3" role="status">Đang tải buổi học…</div>
            <div v-else-if="!errorMessage && !visibleSessionCount" class="text-center text-secondary py-3">
              {{ sessions.length ? 'Không có buổi học trong khoảng thời gian này.' : 'Chưa có buổi học.' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div :class="viewMode === 'list' ? 'col-12 col-xl-7' : 'col-12'">
      <div v-if="selected" class="card border-0 shadow-sm">
        <div class="card-body">
          <h2 class="h5">{{ className(selected) }}</h2>
          <div class="text-secondary mb-3">Giáo viên: {{ teachers }} · {{ selected.status }}</div>
          <div class="row g-2 mb-3">
            <div class="col-md-6"><label class="form-label">Bắt đầu</label><input v-model="startInput" class="form-control" type="datetime-local" :disabled="selected.status !== 'SCHEDULED'" /></div>
            <div class="col-md-6"><label class="form-label">Kết thúc</label><input v-model="endInput" class="form-control" type="datetime-local" :disabled="selected.status !== 'SCHEDULED'" /></div>
          </div>
          <div v-if="selected.status === 'SCHEDULED'" class="d-flex gap-2 mb-4">
            <button class="btn btn-primary btn-sm" @click="saveSchedule">Lưu lịch mới</button>
            <button class="btn btn-outline-danger btn-sm" @click="cancel">Hủy buổi học</button>
          </div>
          <p v-if="selected.session_note" class="border-start border-3 ps-3">{{ selected.session_note }}</p>
          <h3 class="h6 mt-3">Học sinh và kết quả</h3>
          <div v-for="row in students" :key="row.student_id" class="border rounded p-3 mb-2">
            <div class="fw-semibold">{{ row.students?.full_name }} <small class="text-secondary">{{ row.students?.student_code }}</small></div>
            <div class="small text-secondary">
              {{ row.student_attendances?.[0]?.status || 'Chưa điểm danh' }}
              <span v-if="row.student_attendances?.[0]?.absence_reason"> · {{ row.student_attendances[0].absence_reason }}</span>
              · BTVN {{ row.student_attendances?.[0]?.homework_score ?? '—' }}/10
              <span v-if="row.student_attendances?.[0]?.homework_note"> ({{ row.student_attendances[0].homework_note }})</span>
              · Hiểu bài {{ row.student_attendances?.[0]?.understanding_score ?? '—' }}/5
              · Thái độ {{ row.student_attendances?.[0]?.attitude_score ?? '—' }}/5
              · Điểm cộng {{ row.student_attendances?.[0]?.positive_feedback_count ?? 0 }}
              <span v-if="row.student_attendances?.[0]?.positive_feedback_raw"> · {{ row.student_attendances[0].positive_feedback_raw }}</span>
            </div>
            <div v-if="row.student_attendances?.[0]?.comment" class="small mt-1">{{ row.student_attendances[0].comment }}</div>
          </div>
          <div v-if="!students.length" class="text-secondary small">Buổi học chưa có danh sách học sinh.</div>
        </div>
      </div>
      <div v-else class="card border-0 shadow-sm">
        <div class="card-body text-center text-secondary py-5">Chọn một buổi học để xem chi tiết.</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar-period-title {
  min-width: 13rem;
}

.calendar-scroll {
  overflow-x: auto;
}

.calendar-weekdays,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(115px, 1fr));
  min-width: 805px;
}

.calendar-weekday {
  padding: 0.5rem;
  color: var(--bs-secondary-color);
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
}

.calendar-day {
  min-height: 8.25rem;
  padding: 0.45rem;
  overflow: hidden;
  border: 1px solid var(--bs-border-color);
  background: var(--bs-body-bg);
}

.calendar-day-outside {
  color: var(--bs-secondary-color);
  background: var(--bs-tertiary-bg);
}

.calendar-day-today {
  box-shadow: inset 0 0 0 2px var(--bs-primary);
}

.calendar-day-heading {
  display: flex;
  min-height: 1.6rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
}

.calendar-day-number {
  font-weight: 600;
}

.calendar-day-events {
  display: flex;
  max-height: 7.1rem;
  flex-direction: column;
  gap: 0.3rem;
  margin-top: 0.35rem;
  overflow-y: auto;
}

.calendar-grid-week .calendar-day {
  min-height: 22rem;
}

.calendar-grid-week .calendar-day-events {
  max-height: 19rem;
}

.calendar-event {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.12rem;
  padding: 0.35rem;
  border: 1px solid var(--bs-border-color);
  border-left: 3px solid var(--bs-primary);
  border-radius: 0.35rem;
  background: var(--bs-body-bg);
  color: var(--bs-body-color);
  font-size: 0.78rem;
  text-align: left;
}

.calendar-event:hover,
.calendar-event-selected {
  background: var(--bs-primary-bg-subtle);
}

.calendar-event:focus-visible {
  outline: 2px solid var(--bs-primary);
  outline-offset: 1px;
}

.calendar-event-time {
  color: var(--bs-secondary-color);
  font-size: 0.72rem;
  white-space: nowrap;
}

.calendar-event-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}
</style>
