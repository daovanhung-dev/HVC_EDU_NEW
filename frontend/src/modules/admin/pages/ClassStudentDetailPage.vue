<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { getClassDetail, getClassStudentHistory, getClassStudentMembership } from '@/services/data-queries'
import type { ClassDetailRow, ClassMembershipDetailRow, ClassStudentHistoryRow } from '@/shared/types/domain'
import { formatDateTime } from '@/shared/utils/format'
import { usePermissionStore } from '@/stores/permission.store'

const route = useRoute()
const permissions = usePermissionStore()
const classId = computed(() => String(route.params.classId || ''))
const studentId = computed(() => String(route.params.studentId || ''))
const classRow = ref<ClassDetailRow | null>(null)
const membership = ref<ClassMembershipDetailRow | null>(null)
const history = ref<ClassStudentHistoryRow[]>([])
const loading = ref(false)
const errorMessage = ref('')
const canViewStudents = computed(() => permissions.can('STUDENTS_VIEW'))
const canViewAcademic = computed(() => permissions.can('ACADEMIC_VIEW'))
const student = computed(() => membership.value?.students || null)

function attendanceLabel(status: string) {
  return ({ PRESENT: 'Có mặt', LATE: 'Đi muộn', ABSENT: 'Vắng', EXCUSED: 'Có phép' } as Record<string, string>)[status] || status
}
function attendanceClass(status: string) { return status === 'PRESENT' || status === 'LATE' ? 'text-bg-success' : status === 'EXCUSED' ? 'text-bg-info' : 'text-bg-secondary' }
function sessionStatusLabel(status: string) { return status === 'COMPLETED' ? 'Đã hoàn thành' : status === 'SCHEDULED' ? 'Đã lên lịch' : status === 'IN_PROGRESS' ? 'Đang diễn ra' : status }

async function load() {
  loading.value = true
  errorMessage.value = ''
  classRow.value = null
  membership.value = null
  history.value = []
  try {
    const detail = await getClassDetail(classId.value)
    if (!detail) throw new Error('Không tìm thấy lớp học')
    classRow.value = detail
    if (!canViewStudents.value) return
    const studentMembership = await getClassStudentMembership(classId.value, studentId.value)
    if (!studentMembership?.students) throw new Error('Học sinh không thuộc lớp này hoặc hồ sơ không khả dụng')
    membership.value = studentMembership
    if (canViewAcademic.value) history.value = await getClassStudentHistory(classId.value, studentId.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể tải chi tiết học sinh'
  } finally {
    loading.value = false
  }
}

watch([classId, studentId], () => { void load() })
onMounted(load)
</script>

<template>
  <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4"><div><RouterLink :to="`/admin/classes/${classId}`" class="small text-decoration-none">← {{ classRow?.name || 'Quay lại lớp' }}</RouterLink><div class="small text-secondary mt-2">Student detail</div><h1 class="h3 mb-1">{{ student?.full_name || 'Chi tiết học sinh' }}</h1><div v-if="classRow" class="text-secondary"><code>{{ classRow.code }}</code> · {{ classRow.name }}</div></div><span v-if="student" class="badge" :class="student.status === 'ACTIVE' ? 'text-bg-success' : 'text-bg-secondary'">{{ student.status }}</span></div>
  <div v-if="loading" class="alert alert-info">Đang tải thông tin học sinh…</div><div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
  <template v-if="student && membership"><div class="card border-0 shadow-sm mb-4"><div class="card-body"><h2 class="h6 mb-3">Thông tin học sinh</h2><div class="row g-3"><div class="col-md-4"><div class="small text-secondary">Mã học sinh</div><div class="fw-semibold mt-1"><code>{{ student.student_code }}</code></div></div><div class="col-md-4"><div class="small text-secondary">Họ tên</div><div class="fw-semibold mt-1">{{ student.full_name }}</div></div><div class="col-md-4"><div class="small text-secondary">Số điện thoại</div><div class="mt-1">{{ student.phone || '—' }}</div></div><div class="col-md-4"><div class="small text-secondary">Email</div><div class="mt-1">{{ student.email || '—' }}</div></div><div class="col-md-4"><div class="small text-secondary">Phụ huynh</div><div class="mt-1">{{ student.parent_name || '—' }}</div></div><div class="col-md-4"><div class="small text-secondary">SĐT phụ huynh</div><div class="mt-1">{{ student.parent_phone || '—' }}</div></div><div class="col-md-6"><div class="small text-secondary">Địa chỉ</div><div class="mt-1">{{ student.address || '—' }}</div></div><div class="col-md-3"><div class="small text-secondary">Bắt đầu membership</div><div class="mt-1">{{ membership.start_date }}</div></div><div class="col-md-3"><div class="small text-secondary">Kết thúc membership</div><div class="mt-1">{{ membership.end_date || '—' }}</div></div></div></div></div><div class="card border-0 shadow-sm"><div class="card-body"><h2 class="h6 mb-1">Chuyên cần, điểm và nhận xét từng buổi</h2><small class="text-secondary">Điểm hiển thị là điểm BTVN trên attendance.</small><div v-if="!canViewAcademic" class="alert alert-warning mt-3 mb-0">Bạn chưa có quyền <code>ACADEMIC_VIEW</code> để xem chuyên cần, điểm và nhận xét.</div><div v-else class="table-responsive mt-3"><table class="table align-middle"><thead><tr><th>Thời gian</th><th>Trạng thái buổi</th><th>Chuyên cần</th><th>Điểm BTVN</th><th>Lý do vắng</th><th>Nhận xét</th></tr></thead><tbody><tr v-for="row in history" :key="row.id"><td>{{ formatDateTime(row.scheduled_start_at) }}<br><small class="text-secondary">{{ row.class_months?.classes?.name || classRow?.name }}</small></td><td><span class="badge text-bg-light">{{ sessionStatusLabel(row.status) }}</span></td><td><span v-if="row.attendance" class="badge" :class="attendanceClass(row.attendance.status)">{{ attendanceLabel(row.attendance.status) }}{{ row.attendance.late_minutes ? ` (${row.attendance.late_minutes} phút)` : '' }}</span><span v-else class="text-secondary">Chưa ghi nhận</span></td><td>{{ row.attendance?.homework_score ?? '—' }}/10</td><td>{{ row.attendance?.absence_reason || '—' }}</td><td>{{ row.attendance?.comment || '—' }}</td></tr><tr v-if="!history.length"><td colspan="6" class="text-center text-secondary py-4">Chưa có session của học sinh trong lớp.</td></tr></tbody></table></div></div></div></template>
</template>
