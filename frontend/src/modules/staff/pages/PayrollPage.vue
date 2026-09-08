<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { addSalaryAdjustment, calculatePayroll, confirmPayroll, createPayrollPeriod, payPayroll } from '@/services/commands'
import { getPayroll } from '@/services/data-queries'
import { formatDateTime, formatVnd } from '@/shared/utils/format'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const periods = ref<any[]>([])
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const year = ref(new Date().getFullYear())
const month = ref(new Date().getMonth() + 1)
const method = ref<'PERCENTAGE' | 'FIXED'>('PERCENTAGE')
const percentage = ref(40)
const fixedAmount = ref(0)
const adjustment = ref({ period_id: '', staff_id: '', type: 'BONUS' as 'BONUS' | 'PENALTY', amount: 0, reason: '' })
const isAdmin = computed(() => auth.isAdmin)
const myItems = computed(() => periods.value.flatMap((period) => (period.payroll_items || []).map((item: any) => ({ ...item, period }))))

async function load() {
  loading.value = true
  errorMessage.value = ''
  try { periods.value = await getPayroll() as any[] } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải bảng lương' } finally { loading.value = false }
}

async function ensurePeriod() {
  const existing = periods.value.find((item) => item.year === year.value && item.month === month.value)
  if (existing) return existing
  await createPayrollPeriod(year.value, month.value)
  await load()
  return periods.value.find((item) => item.year === year.value && item.month === month.value)
}

async function calculate() {
  try { const period = await ensurePeriod(); if (!period) throw new Error('Không tạo được kỳ lương'); await calculatePayroll(period.id, method.value, method.value === 'PERCENTAGE' ? percentage.value : undefined, method.value === 'FIXED' ? fixedAmount.value : undefined); successMessage.value = 'Đã tính lại bảng lương từ timesheet APPROVED.'; await load() } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tính lương' }
}

async function changeStatus(period: any, action: 'confirm' | 'pay') {
  try { if (action === 'confirm') await confirmPayroll(period.id); else await payPayroll(period.id); successMessage.value = action === 'confirm' ? 'Đã chốt bảng lương.' : 'Đã thanh toán bảng lương và tạo chi phí tự động.'; await load() } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể cập nhật bảng lương' }
}

function total(period: any) { return (period.payroll_items || []).reduce((sum: number, item: any) => sum + Number(item.base_salary || 0), 0) + (period.salary_adjustments || []).reduce((sum: number, item: any) => sum + (item.adjustment_type === 'BONUS' ? 1 : -1) * Number(item.amount || 0), 0) }
async function saveAdjustment() { try { await addSalaryAdjustment(adjustment.value.period_id, adjustment.value.staff_id, adjustment.value.type, Math.trunc(adjustment.value.amount), adjustment.value.reason); successMessage.value = 'Đã ghi nhận thưởng/phạt và audit.'; adjustment.value = { period_id: '', staff_id: '', type: 'BONUS', amount: 0, reason: '' }; await load() } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể lưu thưởng/phạt' } }
onMounted(load)
</script>

<template>
  <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4"><div><div class="small text-secondary">{{ isAdmin ? 'Finance' : 'Staff portal' }}</div><h1 class="h3 mb-0">{{ isAdmin ? 'Bảng lương' : 'Lương của tôi' }}</h1></div><button class="btn btn-outline-primary" @click="load">Làm mới</button></div>
  <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div><div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
  <div v-if="isAdmin" class="card border-0 shadow-sm mb-4"><div class="card-body"><h2 class="h6">Tính bảng lương theo tháng</h2><div class="row g-3 align-items-end"><div class="col-sm-3"><label class="form-label">Năm</label><input v-model.number="year" class="form-control" type="number" min="2000" max="2200" /></div><div class="col-sm-2"><label class="form-label">Tháng</label><input v-model.number="month" class="form-control" type="number" min="1" max="12" /></div><div class="col-sm-3"><label class="form-label">Cách tính</label><select v-model="method" class="form-select"><option value="PERCENTAGE">Theo phần trăm doanh thu</option><option value="FIXED">Mức cố định/buổi</option></select></div><div v-if="method === 'PERCENTAGE'" class="col-sm-2"><label class="form-label">Phần trăm</label><input v-model.number="percentage" class="form-control" type="number" min="0" max="100" step="0.01" /></div><div v-else class="col-sm-2"><label class="form-label">Mức cố định</label><input v-model.number="fixedAmount" class="form-control" type="number" min="0" /></div><div class="col-sm-2"><button class="btn btn-primary w-100" @click="calculate">Tính lương</button></div></div></div></div>
  <div v-if="isAdmin" class="row g-3"><div v-for="period in periods" :key="period.id" class="col-12 col-xl-6"><div class="card border-0 shadow-sm h-100"><div class="card-body"><div class="d-flex justify-content-between"><h2 class="h6 mb-1">Kỳ {{ period.month }}/{{ period.year }}</h2><span class="badge" :class="period.status === 'PAID' ? 'text-bg-success' : period.status === 'CONFIRMED' ? 'text-bg-primary' : 'text-bg-warning'">{{ period.status }}</span></div><div class="small text-secondary mb-3">Tổng base: {{ formatVnd(total(period)) }}</div><div v-if="!period.payroll_items?.length" class="small text-secondary">Chưa có timesheet APPROVED.</div><div v-for="item in period.payroll_items" :key="item.id" class="d-flex justify-content-between border-top py-2 small"><span>{{ item.staff?.full_name || 'Nhân sự' }}<br><span class="text-secondary">{{ formatDateTime(item.sessions?.scheduled_start_at) }}</span></span><strong>{{ formatVnd(item.base_salary) }}</strong></div><div v-for="item in period.salary_adjustments" :key="item.id" class="d-flex justify-content-between border-top py-2 small"><span>{{ item.staff?.full_name || 'Nhân sự' }} · {{ item.adjustment_type }}<br><span class="text-secondary">{{ item.reason }}</span></span><strong :class="item.adjustment_type === 'BONUS' ? 'text-success' : 'text-danger'">{{ item.adjustment_type === 'BONUS' ? '+' : '-' }}{{ formatVnd(item.amount) }}</strong></div><div v-if="period.status === 'DRAFT'" class="border-top mt-3 pt-3"><div class="row g-2"><div class="col-5"><select v-model="adjustment.staff_id" class="form-select form-select-sm"><option value="">Nhân sự</option><option v-for="item in period.payroll_items" :key="item.staff_id" :value="item.staff_id">{{ item.staff?.full_name }}</option></select></div><div class="col-3"><select v-model="adjustment.type" class="form-select form-select-sm"><option value="BONUS">Thưởng</option><option value="PENALTY">Phạt</option></select></div><div class="col-4"><input v-model.number="adjustment.amount" class="form-control form-control-sm" type="number" min="1" placeholder="Số tiền" /></div><div class="col-9"><input v-model="adjustment.reason" class="form-control form-control-sm" placeholder="Lý do" /></div><div class="col-3"><button class="btn btn-sm btn-outline-warning w-100" :disabled="adjustment.period_id !== period.id || !adjustment.staff_id || !adjustment.amount || !adjustment.reason" @click="saveAdjustment">Lưu</button></div></div><button v-if="adjustment.period_id !== period.id" class="btn btn-link btn-sm px-0" @click="adjustment.period_id = period.id">Chọn kỳ này</button></div><div class="d-flex gap-2 mt-3"><button v-if="period.status === 'DRAFT' && period.payroll_items?.length" class="btn btn-sm btn-outline-primary" @click="changeStatus(period, 'confirm')">Chốt kỳ</button><button v-if="period.status === 'CONFIRMED'" class="btn btn-sm btn-success" @click="changeStatus(period, 'pay')">Thanh toán</button></div></div></div></div></div>
  <div v-else class="card border-0 shadow-sm"><div class="card-body"><div v-if="!myItems.length" class="text-center text-secondary py-5">Chưa có bảng lương của bạn.</div><div v-for="item in myItems" :key="item.id" class="d-flex justify-content-between border-bottom py-3"><div><strong>{{ item.period.month }}/{{ item.period.year }}</strong><div class="small text-secondary">{{ formatDateTime(item.sessions?.scheduled_start_at) }} · {{ item.salary_method }}</div></div><strong>{{ formatVnd(item.base_salary) }}</strong></div></div></div>
</template>
