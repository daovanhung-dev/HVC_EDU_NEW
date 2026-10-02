<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getMyAttendance, getMySessions } from '@/services/data-queries'
import type { SessionRow } from '@/shared/types/domain'
import { formatDateTime } from '@/shared/utils/format'
import AppPageHeader from '@/app/components/AppPageHeader.vue'
import AppState from '@/app/components/AppState.vue'
import SessionMonthCalendar from '@/app/components/SessionMonthCalendar.vue'

const route = useRoute()
const loading = ref(false)
const errorMessage = ref('')
const sessions = ref<SessionRow[]>([])
const attendance = ref<any[]>([])
const selectedSession = ref<SessionRow | null>(null)
const selectedSessionDetail = ref<HTMLElement | null>(null)
const moduleName = computed(() => String(route.params.module))
const title = computed(() => moduleName.value === 'attendance' ? 'Kết quả học tập' : 'Lịch học')
const attendanceLabel = (status: string) => ({ PRESENT: 'Có mặt', LATE: 'Đi muộn', ABSENT: 'Vắng', EXCUSED: 'Có phép' }[status] || status)
const teacherNames = (assignments: any[] = []) => assignments.map((item) => item.staff?.full_name).filter(Boolean).join(', ') || 'Chưa phân công'
const sessionStatusLabel = (status: SessionRow['status']) => ({ SCHEDULED: 'Sắp diễn ra', IN_PROGRESS: 'Đang học', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy' }[status])
const sessionStatusClass = (status: SessionRow['status']) => ({ COMPLETED: 'text-bg-success', CANCELLED: 'text-bg-danger', IN_PROGRESS: 'text-bg-primary', SCHEDULED: 'text-bg-secondary' }[status])

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [sessionRows, attendanceRows] = await Promise.all([getMySessions(), getMyAttendance()])
    sessions.value = sessionRows
    attendance.value = attendanceRows as any[]
    if (selectedSession.value) selectedSession.value = sessions.value.find((session) => session.id === selectedSession.value?.id) || null
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải dữ liệu' }
  finally { loading.value = false }
}

async function selectSession(session: SessionRow) {
  selectedSession.value = session
  await nextTick()
  if (window.matchMedia?.('(max-width: 1199.98px)').matches && selectedSessionDetail.value) {
    selectedSessionDetail.value.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }
}
onMounted(load)
</script>

<template>
  <AppPageHeader :title="title" eyebrow="Hồ sơ học tập" :description="moduleName === 'attendance' ? 'Điểm danh và nhận xét từ các buổi học.' : 'Xem lịch học theo tháng và thông tin từng buổi học.'">
    <template #actions><button class="btn btn-outline-primary" :disabled="loading" @click="load">Làm mới</button></template>
  </AppPageHeader>
  <div v-if="errorMessage && (moduleName === 'attendance' || sessions.length)" class="alert alert-danger" role="alert">{{ errorMessage }} <button class="btn btn-sm btn-outline-danger ms-2" type="button" @click="load">Thử tải lại</button></div>
  <AppState v-if="loading" kind="loading" :title="moduleName === 'attendance' ? 'Đang tải kết quả học tập' : 'Đang tải lịch học'" />
  <div v-else-if="moduleName === 'attendance'" class="card"><div class="card-body table-responsive"><table class="table align-middle"><thead><tr><th>Thời gian</th><th>Lớp và giáo viên</th><th>Điểm danh</th><th>Điểm</th><th>Nhận xét buổi học</th></tr></thead><tbody>
    <tr v-for="row in attendance" :key="row.id"><td>{{ formatDateTime(row.sessions?.scheduled_start_at) }}</td><td><div>{{ row.sessions?.classes?.name || '—' }}</div><small class="text-secondary">{{ teacherNames(row.sessions?.session_staff) }}</small></td><td><span class="badge" :class="row.status === 'PRESENT' || row.status === 'LATE' ? 'text-bg-success' : 'text-bg-secondary'">{{ attendanceLabel(row.status) }}{{ row.late_minutes ? ` (${row.late_minutes} phút)` : '' }}</span><div v-if="row.absence_reason" class="small text-secondary">{{ row.absence_reason }}</div></td><td>BTVN {{ row.homework_score ?? '—' }}/10<span v-if="row.homework_note"> · {{ row.homework_note }}</span><br><small>Hiểu bài {{ row.understanding_score ?? '—' }}/5 · Thái độ {{ row.attitude_score ?? '—' }}/5 · Điểm cộng {{ row.positive_feedback_count ?? 0 }}</small><br><small v-if="row.positive_feedback_raw">{{ row.positive_feedback_raw }}</small></td><td><div>{{ row.comment || '—' }}</div><small v-if="row.sessions?.session_note" class="text-secondary">Nội dung buổi học: {{ row.sessions.session_note }}</small></td></tr>
    <tr v-if="!loading && !attendance.length"><td colspan="5" class="text-center text-secondary py-4">Chưa có kết quả học tập.</td></tr>
  </tbody></table></div></div>
  <AppState v-else-if="errorMessage && !sessions.length" kind="error" title="Không thể tải lịch học" :message="errorMessage" @retry="load" />
  <div v-else class="student-schedule" :class="{ 'student-schedule--selected': selectedSession }">
    <SessionMonthCalendar :sessions="sessions" :selected-session-id="selectedSession?.id" @select="selectSession" />
    <section v-if="selectedSession" ref="selectedSessionDetail" class="card student-schedule__detail" aria-live="polite" aria-label="Chi tiết buổi học">
      <div class="card-body">
        <div class="student-schedule__detail-heading">
          <div>
            <div class="app-page-header__eyebrow">Chi tiết buổi học</div>
            <h2 class="h5 mb-1">{{ selectedSession.classes?.name || 'Lớp học' }}</h2>
            <div class="text-secondary">{{ formatDateTime(selectedSession.scheduled_start_at) }}</div>
          </div>
          <span class="badge" :class="sessionStatusClass(selectedSession.status)">{{ sessionStatusLabel(selectedSession.status) }}</span>
        </div>
        <dl class="student-schedule__facts">
          <div><dt>Giáo viên</dt><dd>{{ teacherNames(selectedSession.session_staff) }}</dd></div>
          <div><dt>Phòng học</dt><dd>{{ selectedSession.room || selectedSession.class_schedules?.room || 'Chưa xếp phòng' }}</dd></div>
          <div class="student-schedule__note"><dt>Nội dung</dt><dd>{{ selectedSession.session_note || (selectedSession.status === 'CANCELLED' ? 'Buổi học đã hủy' : selectedSession.status === 'COMPLETED' ? 'Đã hoàn thành' : 'Theo lịch lớp') }}</dd></div>
        </dl>
      </div>
    </section>
  </div>
</template>

<style scoped>
.student-schedule { display: grid; gap: 16px; }
.student-schedule__detail { scroll-margin-top: 84px; animation: app-reveal-small 280ms var(--motion-ease-out) both; }
.student-schedule__detail-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.student-schedule__facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 20px; margin: 18px 0 0; }
.student-schedule__facts > div { min-width: 0; }
.student-schedule__facts dt { margin-bottom: 3px; color: var(--color-text-secondary); font-size: 12px; font-weight: 650; }
.student-schedule__facts dd { margin: 0; font-size: 14px; overflow-wrap: anywhere; }
.student-schedule__note { grid-column: 1 / -1; }
@media (min-width: 1200px) {
  .student-schedule--selected { grid-template-columns: minmax(0, 1.35fr) minmax(300px, .85fr); align-items: start; }
  .student-schedule__detail { position: sticky; top: 84px; scroll-margin-top: 84px; }
}
@media (max-width: 575.98px) {
  .student-schedule__facts { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .student-schedule__note { grid-column: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .student-schedule__detail { animation: none; }
}
</style>
