<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import FormModal from '@/app/components/FormModal.vue'
import AppField from '@/app/components/AppField.vue'
import type { RoomRental } from '@/shared/types/domain'
import { formatBusinessDate, formatBusinessTime, getBusinessDateKey } from '@/shared/utils/session-calendar'
import type { RoomRentalMonthSlotInput, RoomRentalOccurrenceInput } from '@/services/commands'

interface TeacherOption {
  id: string
  full_name: string
  staff_code?: string | null
}

interface ConflictDetail {
  date: string
  room: string
  reason: string
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  mode: 'create' | 'edit'
  teachers: TeacherOption[]
  rental?: RoomRental | null
  defaultDate: string
  defaultMonth: string
  busy?: boolean
  error?: string
  conflicts?: ConflictDetail[]
}>(), { rental: null, busy: false, error: '', conflicts: () => [] })

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'create-single': [input: RoomRentalOccurrenceInput & { staff_id: string }]
  'create-month': [input: { staff_id: string; month_start: string; slots: RoomRentalMonthSlotInput[] }]
  reschedule: [input: RoomRentalOccurrenceInput & { id: string }]
  cancel: [id: string]
}>()

const formMode = ref<'single' | 'month'>('single')
const staffId = ref('')
const date = ref(props.defaultDate)
const monthStart = ref(props.defaultMonth.slice(0, 7))
const startTime = ref('17:30')
const endTime = ref('19:30')
const room = ref('')
const dirty = ref(false)
const confirmCancel = ref(false)
let slotSequence = 0
const weekdayOptions = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
const slots = ref<Array<RoomRentalMonthSlotInput & { clientId: number }>>([])

const editing = computed(() => props.mode === 'edit' && !!props.rental)
const title = computed(() => editing.value ? 'Đổi lịch thuê phòng' : 'Thuê phòng')
const canSubmit = computed(() => {
  if (props.busy) return false
  if (editing.value) return !!date.value && !!startTime.value && !!endTime.value && !!room.value.trim() && endTime.value > startTime.value
  if (!staffId.value) return false
  if (formMode.value === 'single') return !!date.value && !!startTime.value && !!endTime.value && !!room.value.trim() && endTime.value > startTime.value
  return !!monthStart.value && slots.value.length > 0 && slots.value.every((slot) => !!slot.room.trim() && !!slot.start_time && !!slot.end_time && slot.end_time > slot.start_time)
})

function rentalDateTime(value: string) {
  const time = formatBusinessTime(value)
  return time.length >= 5 ? time.slice(0, 5) : time
}

function tomorrow(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function firstFutureDate() {
  const defaultTime = new Date(`${props.defaultDate}T17:30:00+07:00`)
  return defaultTime > new Date() ? props.defaultDate : tomorrow(props.defaultDate)
}

function resetFromProps() {
  dirty.value = false
  confirmCancel.value = false
  formMode.value = 'single'
  staffId.value = props.rental?.staff_id || ''
  date.value = props.rental ? getBusinessDateKey(props.rental.starts_at) : firstFutureDate()
  monthStart.value = props.defaultMonth.slice(0, 7)
  startTime.value = props.rental ? rentalDateTime(props.rental.starts_at) : '17:30'
  endTime.value = props.rental ? rentalDateTime(props.rental.ends_at) : '19:30'
  room.value = props.rental?.room || ''
  slots.value = [{ clientId: ++slotSequence, day_of_week: 1, start_time: '17:30', end_time: '19:30', room: '' }]
}

watch(() => [props.modelValue, props.mode, props.rental?.id] as const, ([open]) => {
  if (open) resetFromProps()
}, { immediate: true })

function addSlot() {
  slots.value.push({ clientId: ++slotSequence, day_of_week: 1, start_time: '17:30', end_time: '19:30', room: '' })
  dirty.value = true
}

function removeSlot(clientId: number) {
  slots.value = slots.value.filter((slot) => slot.clientId !== clientId)
  dirty.value = true
}

function submit() {
  if (!canSubmit.value) return
  dirty.value = false
  if (editing.value && props.rental) {
    emit('reschedule', { id: props.rental.id, date: date.value, start_time: startTime.value, end_time: endTime.value, room: room.value })
  } else if (formMode.value === 'month') {
    emit('create-month', {
      staff_id: staffId.value,
      month_start: `${monthStart.value}-01`,
      slots: slots.value.map(({ day_of_week, start_time, end_time, room: slotRoom }) => ({ day_of_week, start_time, end_time, room: slotRoom })),
    })
  } else {
    emit('create-single', { staff_id: staffId.value, date: date.value, start_time: startTime.value, end_time: endTime.value, room: room.value })
  }
}
</script>

<template>
  <FormModal
    :model-value="modelValue"
    :title="title"
    :description="editing ? 'Chỉ đổi ngày, giờ và phòng của lượt này. Các lượt khác trong mẫu tháng không bị thay đổi.' : 'Lưu người thuê, phòng và thời gian. Lịch thuê không tạo điểm danh hoặc hồ sơ lớp học.'"
    size="lg"
    :busy="busy"
    :dirty="dirty"
    :submit-disabled="!canSubmit"
    :submit-label="editing ? 'Lưu đổi lịch' : formMode === 'month' ? 'Tạo lịch tháng' : 'Tạo lượt thuê'"
    :submitting-label="'Đang lưu…'"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="submit"
    @cancel="emit('update:modelValue', false)"
  >
    <form class="row g-3" @submit.prevent="submit" @input="dirty = true" @change="dirty = true">
      <div v-if="!editing" class="col-12">
        <div class="btn-group" role="group" aria-label="Loại lịch thuê phòng">
          <button type="button" class="btn" :class="formMode === 'single' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="formMode === 'single'" @click="formMode = 'single'">Một lượt</button>
          <button type="button" class="btn" :class="formMode === 'month' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="formMode === 'month'" @click="formMode = 'month'">Theo tháng</button>
        </div>
      </div>

      <AppField v-if="!editing" id="rental-staff" class="col-md-6" label="Giáo viên thuê" required>
        <template #default="field">
          <select :id="field.id" v-model="staffId" class="form-select" required data-modal-autofocus>
            <option value="">Chọn giáo viên</option>
            <option v-for="teacher in teachers" :key="teacher.id" :value="teacher.id">{{ teacher.full_name }}{{ teacher.staff_code ? ` · ${teacher.staff_code}` : '' }}</option>
          </select>
        </template>
      </AppField>
      <div v-else class="col-md-6">
        <span class="form-label d-block">Giáo viên thuê</span>
        <div class="form-control-plaintext fw-semibold">{{ rental?.staff?.full_name || teachers.find((teacher) => teacher.id === rental?.staff_id)?.full_name || 'Giáo viên' }}</div>
      </div>

      <template v-if="editing || formMode === 'single'">
        <AppField id="rental-date" class="col-md-6" label="Ngày" required>
          <template #default="field"><input :id="field.id" v-model="date" type="date" class="form-control" required :min="defaultDate" data-modal-autofocus /></template>
        </AppField>
        <AppField v-if="!editing" id="rental-start-time" class="col-md-6" label="Giờ bắt đầu" required>
          <template #default="field"><input :id="field.id" v-model="startTime" type="time" class="form-control" required /></template>
        </AppField>
        <AppField v-else id="rental-start-time-edit" class="col-md-6" label="Giờ bắt đầu" required>
          <template #default="field"><input :id="field.id" v-model="startTime" type="time" class="form-control" required /></template>
        </AppField>
        <AppField v-if="!editing" id="rental-end-time" class="col-md-6" label="Giờ kết thúc" required>
          <template #default="field"><input :id="field.id" v-model="endTime" type="time" class="form-control" required /></template>
        </AppField>
        <AppField v-else id="rental-end-time-edit" class="col-md-6" label="Giờ kết thúc" required>
          <template #default="field"><input :id="field.id" v-model="endTime" type="time" class="form-control" required /></template>
        </AppField>
        <AppField id="rental-room" class="col-md-6" label="Phòng" required>
          <template #default="field"><input :id="field.id" v-model="room" class="form-control" maxlength="100" placeholder="Ví dụ: A1" required /></template>
        </AppField>
      </template>

      <template v-else>
        <AppField id="rental-month" class="col-md-6" label="Tháng áp dụng" required>
          <template #default="field"><input :id="field.id" v-model="monthStart" type="month" class="form-control" required :min="defaultDate.slice(0, 7)" /></template>
        </AppField>
        <div class="col-12 d-flex justify-content-between align-items-center">
          <div>
            <h3 class="h6 mb-1">Khung giờ lặp trong tháng</h3>
            <p class="small text-secondary mb-0">Mỗi dòng tạo lượt thuê vào các ngày trong tuần đã chọn.</p>
          </div>
          <button type="button" class="btn btn-sm btn-outline-primary" @click="addSlot">Thêm khung giờ</button>
        </div>
        <div v-for="(slot, index) in slots" :key="slot.clientId" class="col-12">
          <fieldset class="row g-2 border rounded p-3 mx-0 rental-slot">
            <legend class="float-none w-auto px-2 small fw-semibold">Khung {{ index + 1 }}</legend>
            <AppField :id="`rental-slot-day-${slot.clientId}`" class="col-md-6" label="Ngày trong tuần" required>
              <template #default="field"><select :id="field.id" v-model.number="slot.day_of_week" class="form-select" required><option v-for="(label, dayIndex) in weekdayOptions" :key="label" :value="dayIndex + 1">{{ label }}</option></select></template>
            </AppField>
            <AppField :id="`rental-slot-room-${slot.clientId}`" class="col-md-6" label="Phòng" required>
              <template #default="field"><input :id="field.id" v-model="slot.room" class="form-control" maxlength="100" required placeholder="Ví dụ: A1" /></template>
            </AppField>
            <AppField :id="`rental-slot-start-${slot.clientId}`" class="col-md-5" label="Giờ bắt đầu" required>
              <template #default="field"><input :id="field.id" v-model="slot.start_time" type="time" class="form-control" required /></template>
            </AppField>
            <AppField :id="`rental-slot-end-${slot.clientId}`" class="col-md-5" label="Giờ kết thúc" required>
              <template #default="field"><input :id="field.id" v-model="slot.end_time" type="time" class="form-control" required /></template>
            </AppField>
            <div class="col-md-2 d-flex align-items-end"><button type="button" class="btn btn-outline-danger w-100" :disabled="slots.length === 1" :aria-label="`Xóa khung ${index + 1}`" @click="removeSlot(slot.clientId)">Xóa</button></div>
          </fieldset>
        </div>
      </template>
    </form>

    <div v-if="error" class="alert alert-danger mt-3 mb-0" role="alert">{{ error }}</div>
    <div v-if="conflicts.length" class="alert alert-warning mt-3 mb-0" role="alert">
      <strong>Các lượt dưới đây bị trùng nên chưa có lịch nào được tạo:</strong>
      <ul class="mb-0 mt-2">
        <li v-for="(conflict, index) in conflicts" :key="`${conflict.date}-${conflict.room}-${index}`">{{ formatBusinessDate(conflict.date) }} · Phòng {{ conflict.room }}</li>
      </ul>
    </div>

    <template v-if="editing" #footer>
      <div class="d-flex flex-wrap gap-2 justify-content-between w-100">
        <div class="d-flex flex-wrap gap-2">
          <button v-if="!confirmCancel" type="button" class="btn btn-outline-danger" :disabled="busy" @click="confirmCancel = true">Hủy lượt thuê</button>
          <template v-else>
            <span class="align-self-center small text-danger" role="alert">Hủy lượt thuê này?</span>
            <button type="button" class="btn btn-danger" :disabled="busy" @click="emit('cancel', rental!.id)">Xác nhận hủy</button>
            <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="confirmCancel = false">Quay lại</button>
          </template>
        </div>
        <div class="d-flex gap-2 ms-auto">
          <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="emit('update:modelValue', false)">Đóng</button>
          <button type="button" class="btn btn-primary" :disabled="!canSubmit" :aria-busy="busy || undefined" @click="submit"><span v-if="busy" class="app-button__spinner" aria-hidden="true"></span>{{ busy ? 'Đang lưu…' : 'Lưu đổi lịch' }}</button>
        </div>
      </div>
    </template>
  </FormModal>
</template>

<style scoped>
.rental-slot { background: var(--bs-tertiary-bg); }
</style>
