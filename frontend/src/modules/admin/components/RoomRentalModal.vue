<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import FormModal from '@/app/components/FormModal.vue'
import AppField from '@/app/components/AppField.vue'
import type { RoomRental } from '@/shared/types/domain'
import { formatBusinessDate, formatBusinessTime, getBusinessDateKey } from '@/shared/utils/session-calendar'
import type {
  RoomRentalConflictDetail,
  RoomRentalMonthRange,
  RoomRentalMonthSlotInput,
  RoomRentalOccurrenceInput,
} from '@/services/commands'

interface TeacherOption {
  id: string
  full_name: string
  staff_code?: string | null
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
  conflicts?: RoomRentalConflictDetail[]
}>(), { rental: null, busy: false, error: '', conflicts: () => [] })

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'create-single': [input: RoomRentalOccurrenceInput & { staff_id: string }]
  'create-month': [input: {
    staff_id: string
    month_start: string
    range: RoomRentalMonthRange
    slots: RoomRentalMonthSlotInput[]
    confirmed_conflict_keys?: string[]
  }]
  'clear-conflicts': []
  reschedule: [input: RoomRentalOccurrenceInput & { id: string }]
  cancel: [id: string]
  delete: [id: string]
}>()

const formMode = ref<'single' | 'month'>('single')
const staffId = ref('')
const date = ref(props.defaultDate)
const monthStart = ref(props.defaultMonth.slice(0, 7))
const monthRange = ref<RoomRentalMonthRange>('REMAINING_MONTH')
const startTime = ref('17:30')
const endTime = ref('19:30')
const room = ref('')
const dirty = ref(false)
const confirmationAction = ref<'cancel' | 'delete' | ''>('')
let slotSequence = 0
const weekdayOptions = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
const slots = ref<Array<RoomRentalMonthSlotInput & { clientId: number }>>([])

const editing = computed(() => props.mode === 'edit' && !!props.rental)
const canChangeRental = computed(() => editing.value
  && props.rental?.status === 'BOOKED'
  && new Date(props.rental.starts_at).getTime() > Date.now())
const title = computed(() => !editing.value
  ? 'Thuê phòng'
  : canChangeRental.value ? 'Đổi lịch thuê phòng' : 'Chi tiết lượt thuê phòng')
const rentalStatusLabel = computed(() => props.rental?.status === 'CANCELLED' ? 'Đã hủy' : 'Đã đặt')
const rentalTeacherName = computed(() => props.rental?.staff?.full_name
  || teachers.find((teacher) => teacher.id === props.rental?.staff_id)?.full_name
  || 'Giáo viên')
const rentalSummary = computed(() => {
  const rental = props.rental
  if (!rental) return ''
  return `${rentalTeacherName.value} · ${formatBusinessDate(getBusinessDateKey(rental.starts_at))} · ${rentalDateTime(rental.starts_at)}–${rentalDateTime(rental.ends_at)} · ${rental.room} · ${rentalStatusLabel.value}`
})
const canSubmit = computed(() => {
  if (props.busy || confirmationAction.value !== '') return false
  if (editing.value) return canChangeRental.value && !!date.value && !!startTime.value && !!endTime.value && !!room.value.trim() && endTime.value > startTime.value
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
  confirmationAction.value = ''
  formMode.value = 'single'
  staffId.value = props.rental?.staff_id || ''
  date.value = props.rental ? getBusinessDateKey(props.rental.starts_at) : firstFutureDate()
  monthStart.value = props.defaultMonth.slice(0, 7)
  monthRange.value = 'REMAINING_MONTH'
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
  markDirty()
}

function removeSlot(clientId: number) {
  slots.value = slots.value.filter((slot) => slot.clientId !== clientId)
  markDirty()
}

function markDirty() {
  dirty.value = true
  if (props.conflicts.length || props.error) emit('clear-conflicts')
}

function submit(confirmedConflictKeys?: string[]) {
  if (!canSubmit.value) return
  dirty.value = false
  if (editing.value && props.rental) {
    emit('reschedule', { id: props.rental.id, date: date.value, start_time: startTime.value, end_time: endTime.value, room: room.value })
  } else if (formMode.value === 'month') {
    emit('create-month', {
      staff_id: staffId.value,
      month_start: `${monthStart.value}-01`,
      range: monthRange.value,
      slots: slots.value.map(({ day_of_week, start_time, end_time, room: slotRoom }) => ({ day_of_week, start_time, end_time, room: slotRoom })),
      ...(confirmedConflictKeys ? { confirmed_conflict_keys: confirmedConflictKeys } : {}),
    })
  } else {
    emit('create-single', { staff_id: staffId.value, date: date.value, start_time: startTime.value, end_time: endTime.value, room: room.value })
  }
}

function confirmMonthConflicts() {
  if (!props.conflicts.length || props.conflicts.some((conflict) => !conflict.can_override)) return
  submit(props.conflicts.map((conflict) => conflict.key))
}

function beginConfirmation(action: 'cancel' | 'delete') {
  confirmationAction.value = action
}

function confirmRentalAction() {
  if (!props.rental || props.busy) return
  if (confirmationAction.value === 'cancel' && canChangeRental.value) {
    emit('cancel', props.rental.id)
  } else if (confirmationAction.value === 'delete') {
    emit('delete', props.rental.id)
  }
}

function conflictHeading(conflict: RoomRentalConflictDetail): string {
  if (conflict.type === 'RENTAL') return `Lượt thuê của ${conflict.renter_name || 'giáo viên khác'}`
  if (conflict.type === 'SESSION') return `Buổi học${conflict.class_name ? ` lớp ${conflict.class_name}` : ''}`
  if (conflict.type === 'RECURRING_SCHEDULE') return `Lịch lặp${conflict.class_name ? ` lớp ${conflict.class_name}` : ''}`
  if (conflict.type === 'REQUEST') return 'Hai khung giờ trong mẫu bị trùng'
  return 'Lịch hiện có'
}

function conflictingTime(conflict: RoomRentalConflictDetail): string {
  if (!conflict.conflict_starts_at || !conflict.conflict_ends_at) return ''
  return `${formatBusinessTime(conflict.conflict_starts_at)}–${formatBusinessTime(conflict.conflict_ends_at)}`
}

const canConfirmConflicts = computed(() => props.conflicts.length > 0
  && props.conflicts.every((conflict) => conflict.can_override))
const hasRentalReplacement = computed(() => props.conflicts.some((conflict) => conflict.action === 'REPLACE_RENTAL'))
const hasClassOverlap = computed(() => props.conflicts.some((conflict) => conflict.action === 'ALLOW_CLASS_OVERLAP'))
const confirmLabel = computed(() => hasRentalReplacement.value && hasClassOverlap.value
  ? 'Xác nhận và tạo lịch'
  : hasRentalReplacement.value
    ? 'Xác nhận ghi đè lịch thuê'
    : 'Cho phép trùng lịch học và tạo')
</script>

<template>
  <FormModal
    :model-value="modelValue"
    :title="title"
    :description="editing ? canChangeRental ? 'Chỉ đổi ngày, giờ và phòng của lượt này. Các lượt khác trong mẫu tháng không bị thay đổi.' : 'Lượt thuê này chỉ xem được vì đã hủy, đã bắt đầu hoặc đã qua thời gian.' : 'Lưu người thuê, phòng và thời gian. Lịch thuê không tạo điểm danh hoặc hồ sơ lớp học.'"
    size="lg"
    :busy="busy"
    :dirty="dirty"
    :submit-disabled="!canSubmit || (formMode === 'month' && conflicts.length > 0)"
    :submit-label="editing ? 'Lưu đổi lịch' : formMode === 'month' ? 'Tạo lịch tháng' : 'Tạo lượt thuê'"
    :submitting-label="'Đang lưu…'"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="submit()"
    @cancel="emit('update:modelValue', false)"
  >
    <form class="row g-3" @submit.prevent="submit()" @input="markDirty" @change="markDirty">
      <div v-if="!editing" class="col-12">
        <div class="btn-group" role="group" aria-label="Loại lịch thuê phòng">
          <button type="button" class="btn" :class="formMode === 'single' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="formMode === 'single'" @click="formMode = 'single'; markDirty()">Một lượt</button>
          <button type="button" class="btn" :class="formMode === 'month' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="formMode === 'month'" @click="formMode = 'month'; markDirty()">Theo tháng</button>
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

      <template v-if="editing && !canChangeRental">
        <div class="col-md-6">
          <span class="form-label d-block">Ngày</span>
          <div class="form-control-plaintext fw-semibold">{{ formatBusinessDate(getBusinessDateKey(rental!.starts_at)) }}</div>
        </div>
        <div class="col-md-6">
          <span class="form-label d-block">Thời gian</span>
          <div class="form-control-plaintext fw-semibold">{{ rentalDateTime(rental!.starts_at) }}–{{ rentalDateTime(rental!.ends_at) }}</div>
        </div>
        <div class="col-md-6">
          <span class="form-label d-block">Phòng</span>
          <div class="form-control-plaintext fw-semibold">{{ rental!.room }}</div>
        </div>
        <div class="col-md-6">
          <span class="form-label d-block">Trạng thái</span>
          <div class="form-control-plaintext fw-semibold">{{ rentalStatusLabel }}</div>
        </div>
      </template>
      <template v-else-if="editing || formMode === 'single'">
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
        <div class="col-12">
          <span class="form-label d-block">Phạm vi áp dụng</span>
          <div class="btn-group" role="group" aria-label="Phạm vi lịch thuê tháng">
            <button type="button" class="btn" :class="monthRange === 'FULL_MONTH' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="monthRange === 'FULL_MONTH'" @click="monthRange = 'FULL_MONTH'; markDirty()">Cả tháng</button>
            <button type="button" class="btn" :class="monthRange === 'REMAINING_MONTH' ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="monthRange === 'REMAINING_MONTH'" @click="monthRange = 'REMAINING_MONTH'; markDirty()">Những ngày còn lại</button>
          </div>
        </div>
        <div class="col-12 d-flex justify-content-between align-items-center">
          <div>
            <h3 class="h6 mb-1">Khung giờ lặp trong tháng</h3>
            <p class="small text-secondary mb-0">{{ monthRange === 'FULL_MONTH' ? 'Tạo lượt vào mọi ngày khớp trong tháng, kể cả ngày đã qua.' : 'Tạo lượt chưa bắt đầu từ hôm nay đến hết tháng.' }}</p>
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
      <strong>Phát hiện {{ conflicts.length }} lịch trùng. Chưa có lượt nào được lưu:</strong>
      <ul class="mb-2 mt-2">
        <li v-for="conflict in conflicts" :key="conflict.key">
          {{ formatBusinessDate(conflict.date) }} · {{ conflict.start_time }}–{{ conflict.end_time }} · Phòng {{ conflict.room }}
          — {{ conflictHeading(conflict) }}<template v-if="conflictingTime(conflict)"> ({{ conflictingTime(conflict) }}<template v-if="conflict.conflict_room">, phòng {{ conflict.conflict_room }}</template>)</template>
          <template v-if="['SESSION', 'RECURRING_SCHEDULE'].includes(conflict.type) && !conflict.conflict_room"> · Phòng của lịch học chưa khai báo</template>
          <template v-if="conflict.teacher_names?.length"> · GV: {{ conflict.teacher_names.join(', ') }}</template>
          <template v-if="conflict.action === 'REPLACE_RENTAL'"> · Có thể ghi đè lượt thuê</template>
          <template v-else-if="conflict.action === 'ALLOW_CLASS_OVERLAP'"> · Đúng giáo viên của lớp, có thể cho phép trùng</template>
          <template v-else> · Không thể ghi đè</template>
        </li>
      </ul>
      <div v-if="canConfirmConflicts" class="d-flex flex-wrap align-items-center gap-2">
        <span class="small">Xác nhận sẽ cập nhật lượt thuê đang trùng và/hoặc giữ nguyên buổi học cùng giáo viên, lớp.</span>
        <button type="button" class="btn btn-sm btn-warning" :disabled="busy" @click="confirmMonthConflicts">{{ confirmLabel }}</button>
      </div>
      <p v-else class="small mb-0">Có xung đột không đủ điều kiện ghi đè. Hãy chỉnh khung giờ hoặc phòng rồi kiểm tra lại.</p>
    </div>

    <template v-if="editing" #footer>
      <div class="d-flex flex-column flex-sm-row flex-wrap gap-2 justify-content-between w-100">
        <div v-if="confirmationAction" class="alert alert-danger d-flex flex-wrap align-items-center gap-2 mb-0 w-100" role="alert">
          <div class="flex-grow-1">
            <strong>{{ confirmationAction === 'delete' ? 'Xóa vĩnh viễn lượt thuê này?' : 'Hủy lượt thuê này?' }}</strong>
            <div class="small">{{ rentalSummary }}</div>
            <div v-if="confirmationAction === 'delete'" class="small">Không thể hoàn tác; nhật ký audit vẫn được giữ. Thay đổi chưa lưu trong biểu mẫu sẽ không được áp dụng.</div>
          </div>
          <button type="button" class="btn btn-danger" :disabled="busy" @click="confirmRentalAction"><span v-if="busy" class="app-button__spinner" aria-hidden="true"></span>{{ confirmationAction === 'delete' ? 'Xác nhận xóa vĩnh viễn' : 'Xác nhận hủy' }}</button>
          <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="confirmationAction = ''">Quay lại</button>
        </div>
        <template v-else>
          <div class="d-flex flex-wrap gap-2">
            <button v-if="canChangeRental" type="button" class="btn btn-outline-danger" :disabled="busy" @click="beginConfirmation('cancel')">Hủy lượt thuê</button>
            <button type="button" class="btn btn-danger" :disabled="busy" @click="beginConfirmation('delete')">Xóa vĩnh viễn</button>
          </div>
          <div class="d-flex gap-2 ms-auto">
            <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="emit('update:modelValue', false)">Đóng</button>
            <button v-if="canChangeRental" type="button" class="btn btn-primary" :disabled="!canSubmit" :aria-busy="busy || undefined" @click="submit"><span v-if="busy" class="app-button__spinner" aria-hidden="true"></span>{{ busy ? 'Đang lưu…' : 'Lưu đổi lịch' }}</button>
          </div>
        </template>
      </div>
    </template>
  </FormModal>
</template>

<style scoped>
.rental-slot { background: var(--bs-tertiary-bg); }
</style>
