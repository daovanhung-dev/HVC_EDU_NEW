<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { exportReport } from '@/services/commands'
import { getClasses, getReports, getStudents } from '@/services/data-queries'
import type { ReportFormat, ReportFilters, ReportType } from '@/shared/types/domain'
import { formatDateTime, formatVnd } from '@/shared/utils/format'

const type = ref<ReportType>('MONTHLY')
const format = ref<ReportFormat>('XLSX')
const filters = ref<ReportFilters>({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 })
const classes = ref<any[]>([])
const students = ref<any[]>([])
const rows = ref<any[]>([])
const summary = ref<any>(null)
const loading = ref(false)
const exporting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const types: Array<{ value: ReportType; label: string }> = [
  { value: 'MONTHLY', label: 'Báo cáo tháng' }, { value: 'STUDENTS', label: 'Danh sách học sinh' }, { value: 'ATTENDANCE', label: 'Điểm danh' }, { value: 'HOMEWORK', label: 'BTVN và nhận xét' }, { value: 'TUITION', label: 'Học phí' }, { value: 'PAYROLL', label: 'Bảng lương' }, { value: 'ACCOUNTING', label: 'Thu/chi' },
]
const headers = computed(() => {
  if (type.value === 'STUDENTS') return ['Mã', 'Họ tên', 'Điện thoại', 'Phụ huynh', 'Trạng thái']
  if (type.value === 'ATTENDANCE' || type.value === 'HOMEWORK') return ['Học sinh', 'Lớp', 'Thời gian', type.value === 'ATTENDANCE' ? 'Trạng thái' : 'BTVN', 'Nhận xét']
  if (type.value === 'TUITION') return ['Học sinh', 'Tháng', 'Phải thu', 'Đã thu', 'Trạng thái']
  if (type.value === 'PAYROLL') return ['Kỳ', 'Nhân sự', 'Buổi', 'Doanh thu', 'Lương']
  if (type.value === 'ACCOUNTING') return ['Ngày', 'Loại', 'Danh mục', 'Số tiền', 'Mô tả']
  return ['Chỉ số', 'Giá trị']
})

async function loadOptions() {
  try { [classes.value, students.value] = await Promise.all([getClasses(), getStudents()]) } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải bộ lọc' }
}

async function load() {
  loading.value = true; errorMessage.value = ''
  try {
    const result: any = await getReports(type.value, filters.value)
    if (type.value === 'MONTHLY') { summary.value = result; rows.value = [] } else { summary.value = null; rows.value = Array.isArray(result) ? result : [] }
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải báo cáo' } finally { loading.value = false }
}

function rowValues(row: any): any[] {
  if (type.value === 'STUDENTS') return [row.student_code, row.full_name, row.phone || '—', row.parent_name || '—', row.status]
  if (type.value === 'ATTENDANCE' || type.value === 'HOMEWORK') return [row.students?.full_name, row.sessions?.class_months?.classes?.name || '—', formatDateTime(row.sessions?.scheduled_start_at), type.value === 'ATTENDANCE' ? row.status : row.homework_score ?? '—', row.comment || '—']
  if (type.value === 'TUITION') return [row.students?.full_name, `${row.class_months?.month}/${row.class_months?.year}`, formatVnd(row.amount_due), formatVnd(row.amount_paid), row.status]
  if (type.value === 'PAYROLL') return [(row.year ? `${row.month}/${row.year}` : row.period ? `${row.period.month}/${row.period.year}` : '—'), row.staff?.full_name || row.payroll_items?.staff?.full_name || '—', formatDateTime(row.sessions?.scheduled_start_at || row.payroll_items?.sessions?.scheduled_start_at), formatVnd(row.revenue_snapshot), formatVnd(row.base_salary)]
  if (type.value === 'ACCOUNTING') return [row.transaction_date, row.direction, row.accounting_categories?.name || '—', formatVnd(row.amount), row.description || '—']
  return []
}

function summaryRows() {
  const sessions = summary.value?.sessions || []; const tuition = summary.value?.tuition || []; const accounting = summary.value?.accounting || []; const payrollItems = summary.value?.payroll?.payroll_items || []
  const income = accounting.filter((row: any) => row.direction === 'INCOME').reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0)
  const expense = accounting.filter((row: any) => row.direction === 'EXPENSE').reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0)
  return [['Buổi đã hoàn thành', sessions.filter((row: any) => row.status === 'COMPLETED').length], ['Buổi sắp tới', sessions.filter((row: any) => row.status === 'SCHEDULED').length], ['Học phí phải thu', formatVnd(tuition.reduce((sum: number, row: any) => sum + Number(row.amount_due || 0), 0))], ['Học phí đã thu', formatVnd(tuition.reduce((sum: number, row: any) => sum + Number(row.amount_paid || 0), 0))], ['Lương', formatVnd(payrollItems.reduce((sum: number, row: any) => sum + Number(row.base_salary || 0), 0))], ['Thu thực tế', formatVnd(income)], ['Chi thực tế', formatVnd(expense)], ['Lợi nhuận', formatVnd(income - expense)]]
}

function decodeBase64(value: string) { const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); return bytes }
async function download() {
  exporting.value = true; errorMessage.value = ''; successMessage.value = ''
  try { const file = await exportReport(type.value, format.value, filters.value); const blob = new Blob([decodeBase64(file.content_base64)], { type: file.mime_type }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.filename; anchor.click(); URL.revokeObjectURL(url); successMessage.value = `Đã tải ${file.filename}.` } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể export báo cáo' } finally { exporting.value = false }
}

onMounted(async () => { await loadOptions(); await load() })
</script>

<template>
  <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4"><div><div class="small text-secondary">Reporting</div><h1 class="h3 mb-0">Báo cáo và export</h1></div><div class="d-flex gap-2"><button class="btn btn-outline-primary" @click="load">Làm mới</button><button class="btn btn-primary" :disabled="exporting" @click="download">{{ exporting ? 'Đang tạo…' : `Tải ${format}` }}</button></div></div>
  <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div><div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
  <div class="card border-0 shadow-sm mb-4"><div class="card-body"><div class="row g-3 align-items-end"><div class="col-md-3"><label class="form-label">Loại báo cáo</label><select v-model="type" class="form-select" @change="load"><option v-for="item in types" :key="item.value" :value="item.value">{{ item.label }}</option></select></div><div class="col-md-2"><label class="form-label">Năm</label><input v-model.number="filters.year" class="form-control" type="number" /></div><div class="col-md-2"><label class="form-label">Tháng</label><input v-model.number="filters.month" class="form-control" type="number" min="1" max="12" /></div><div class="col-md-3"><label class="form-label">Lớp</label><select v-model="filters.class_id" class="form-select"><option value="">Tất cả lớp</option><option v-for="item in classes" :key="item.id" :value="item.id">{{ item.code }} — {{ item.name }}</option></select></div><div class="col-md-2"><label class="form-label">Định dạng</label><select v-model="format" class="form-select"><option value="XLSX">Excel</option><option value="PDF">PDF</option></select></div><div class="col-12"><button class="btn btn-outline-primary" @click="load">Áp dụng bộ lọc</button></div></div></div></div>
  <div v-if="type === 'MONTHLY' && summary" class="row g-3"><div v-for="row in summaryRows()" :key="row[0]" class="col-6 col-md-3"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="small text-secondary">{{ row[0] }}</div><div class="h5 mt-2 mb-0">{{ row[1] }}</div></div></div></div></div>
  <div v-else class="card border-0 shadow-sm"><div class="card-body"><div class="table-responsive"><table class="table align-middle"><thead><tr><th v-for="header in headers" :key="header">{{ header }}</th></tr></thead><tbody><tr v-for="row in rows" :key="row.id || JSON.stringify(row)"><td v-for="(value, index) in rowValues(row)" :key="index">{{ value }}</td></tr><tr v-if="!loading && !rows.length"><td :colspan="headers.length" class="text-center text-secondary py-5">Không có dữ liệu phù hợp</td></tr></tbody></table></div></div></div>
</template>
