<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

export interface TeacherOption {
  id: string
  full_name: string
  staff_code?: string | null
}

const props = withDefaults(defineProps<{
  id: string
  modelValue: string | string[]
  teachers: TeacherOption[]
  multiple?: boolean
  disabledIds?: string[]
  placeholder?: string
  describedBy?: string
  label?: string
  labelClass?: string
  disabled?: boolean
}>(), {
  multiple: false,
  disabledIds: () => [],
  placeholder: 'Tìm theo tên hoặc mã giáo viên',
  describedBy: undefined,
  label: undefined,
  labelClass: undefined,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | string[]]
}>()

const root = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const query = ref('')
const open = ref(false)
let suppressFocusOpen = false

const selectedIds = computed(() => {
  if (Array.isArray(props.modelValue)) return props.modelValue
  return props.modelValue ? [props.modelValue] : []
})

const selectedTeachers = computed(() => selectedIds.value
  .map((id) => props.teachers.find((teacher) => teacher.id === id))
  .filter((teacher): teacher is TeacherOption => Boolean(teacher)))

function normalizeSearchText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLocaleLowerCase('vi')
}

const filteredTeachers = computed(() => {
  const term = normalizeSearchText(query.value.trim())
  if (!term) return props.teachers
  return props.teachers.filter((teacher) =>
    normalizeSearchText(`${teacher.full_name} ${teacher.staff_code || ''}`).includes(term),
  )
})

function isSelected(id: string) {
  return selectedIds.value.includes(id)
}

function isDisabled(id: string) {
  return props.disabledIds.includes(id) && !isSelected(id)
}

function updateSelection(id: string) {
  if (isDisabled(id)) return

  if (props.multiple) {
    const next = new Set(selectedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    emit('update:modelValue', [...next])
    return
  }

  emit('update:modelValue', id)
  query.value = ''
  open.value = false
  focusSearchWithoutOpening()
}

function removeSelection(id: string) {
  if (props.multiple) {
    emit('update:modelValue', selectedIds.value.filter((selectedId) => selectedId !== id))
  } else {
    emit('update:modelValue', '')
  }
}

function closeOptions() {
  open.value = false
  focusSearchWithoutOpening()
}

function focusSearchWithoutOpening() {
  suppressFocusOpen = true
  void nextTick(() => {
    searchInput.value?.focus()
    suppressFocusOpen = false
  })
}

function handleSearchFocus() {
  if (!suppressFocusOpen) open.value = true
}

function focusFirstOption() {
  open.value = true
  void nextTick(() => root.value?.querySelector<HTMLInputElement>('[data-teacher-option]')?.focus())
}

function handleFocusout(event: FocusEvent) {
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && root.value?.contains(nextTarget)) return
  open.value = false
}

function handleOutsidePointerdown(event: PointerEvent) {
  if (event.target instanceof Node && root.value?.contains(event.target)) return
  open.value = false
}

onMounted(() => document.addEventListener('pointerdown', handleOutsidePointerdown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleOutsidePointerdown))
</script>

<template>
  <div ref="root" class="teacher-picker" @focusout="handleFocusout" @keydown.esc.prevent.stop="closeOptions">
    <label v-if="label" :for="id" :class="labelClass || 'form-label'">{{ label }}</label>
    <input
      :id="id"
      ref="searchInput"
      v-model="query"
      type="search"
      class="form-control"
      :class="{ 'form-control-sm': labelClass === 'visually-hidden' }"
      :placeholder="placeholder"
      :aria-label="label || undefined"
      :aria-describedby="describedBy"
      :aria-expanded="open"
      :aria-controls="`${id}-options`"
      :disabled="disabled"
      autocomplete="off"
      @focus="handleSearchFocus"
      @click="open = true"
      @input="open = true"
      @keydown.enter.prevent="focusFirstOption"
    />

    <div v-if="selectedTeachers.length" class="teacher-picker__selected mt-2" aria-live="polite">
      <span
        v-for="teacher in selectedTeachers"
        :key="teacher.id"
        class="teacher-picker__chip"
      >
        <span>{{ teacher.full_name }}</span>
        <small v-if="teacher.staff_code">{{ teacher.staff_code }}</small>
        <button
          class="teacher-picker__remove"
          type="button"
          :aria-label="`Bỏ chọn ${teacher.full_name}`"
          :disabled="disabled"
          @click="removeSelection(teacher.id)"
        >
          <span aria-hidden="true">×</span>
        </button>
      </span>
    </div>

    <div
      v-if="open"
      :id="`${id}-options`"
      class="teacher-picker__options mt-2"
      role="group"
      :aria-label="multiple ? 'Chọn một hoặc nhiều giáo viên' : 'Chọn một giáo viên'"
    >
      <label
        v-for="teacher in filteredTeachers"
        :key="teacher.id"
        class="teacher-picker__option"
        :class="{ 'teacher-picker__option--disabled': isDisabled(teacher.id) }"
        :for="`${id}-option-${teacher.id}`"
      >
        <input
          :id="`${id}-option-${teacher.id}`"
          :data-teacher-option="true"
          :type="multiple ? 'checkbox' : 'radio'"
          :name="`${id}-teacher-choice`"
          :value="teacher.id"
          :checked="isSelected(teacher.id)"
          :disabled="disabled || isDisabled(teacher.id)"
          @change="updateSelection(teacher.id)"
        />
        <span class="teacher-picker__option-copy">
          <span class="teacher-picker__name">{{ teacher.full_name }}</span>
          <small v-if="teacher.staff_code" class="text-secondary">{{ teacher.staff_code }}</small>
        </span>
      </label>
      <p v-if="!filteredTeachers.length" class="teacher-picker__empty mb-0">
        {{ teachers.length ? 'Không tìm thấy giáo viên phù hợp.' : 'Chưa có giáo viên đang hoạt động.' }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.teacher-picker {
  min-width: 0;
}

.teacher-picker__selected {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.teacher-picker__chip {
  display: inline-flex;
  min-height: 2rem;
  align-items: center;
  gap: 0.375rem;
  padding: 0.2rem 0.45rem 0.2rem 0.625rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 999px;
  background: var(--bs-tertiary-bg);
  color: var(--bs-body-color);
  font-size: 0.875rem;
}

.teacher-picker__chip small {
  color: var(--bs-secondary-color);
  font-size: 0.75rem;
}

.teacher-picker__remove {
  display: inline-grid;
  width: 1.5rem;
  height: 1.5rem;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--bs-secondary-color);
  font-size: 1.125rem;
  line-height: 1;
}

.teacher-picker__remove:hover,
.teacher-picker__remove:focus-visible {
  background: var(--bs-secondary-bg);
  color: var(--bs-body-color);
}

.teacher-picker__options {
  max-height: 14rem;
  overflow-y: auto;
  padding: 0.25rem;
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
  background: var(--bs-body-bg);
}

.teacher-picker__option {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.625rem;
  margin: 0;
  padding: 0.4rem 0.5rem;
  border-radius: var(--bs-border-radius-sm);
  cursor: pointer;
}

.teacher-picker__option:hover {
  background: var(--bs-tertiary-bg);
}

.teacher-picker__option:focus-within {
  outline: 2px solid var(--bs-primary);
  outline-offset: -2px;
}

.teacher-picker__option input {
  flex: 0 0 auto;
}

.teacher-picker__option-copy {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.5rem;
}

.teacher-picker__name {
  overflow-wrap: anywhere;
}

.teacher-picker__option--disabled {
  color: var(--bs-secondary-color);
  cursor: not-allowed;
  opacity: 0.7;
}

.teacher-picker__empty {
  padding: 0.75rem;
  color: var(--bs-secondary-color);
  font-size: 0.875rem;
}
</style>
