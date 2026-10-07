<script setup lang="ts">
import { computed } from 'vue'
import BaseModal from '@/app/components/BaseModal.vue'
import type { BulkResetDisplayResult } from './bulk-password-reset.types'

const props = withDefaults(defineProps<{
  modelValue: boolean
  mode: 'confirm' | 'result'
  people: BulkResetPerson[]
  results?: BulkResetDisplayResult[]
  temporaryPassword?: string
  busy?: boolean
  errorMessage?: string
}>(), { results: () => [], temporaryPassword: '', busy: false, errorMessage: '' })

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
}>()

const counts = computed(() => ({
  success: props.results.filter((result) => result.status === 'SUCCESS').length,
  partial: props.results.filter((result) => result.status === 'PARTIAL').length,
  failed: props.results.filter((result) => result.status === 'FAILED').length,
  skipped: props.results.filter((result) => result.status === 'SKIPPED').length,
}))

function statusLabel(status: BulkResetDisplayResult['status']) {
  return {
    SUCCESS: 'Thành công',
    PARTIAL: 'Cần kiểm tra',
    FAILED: 'Thất bại',
    SKIPPED: 'Đã bỏ qua',
  }[status]
}

function statusClass(status: BulkResetDisplayResult['status']) {
  return {
    SUCCESS: 'text-bg-success',
    PARTIAL: 'text-bg-warning',
    FAILED: 'text-bg-danger',
    SKIPPED: 'text-bg-secondary',
  }[status]
}

function reasonLabel(code: string) {
  return ({
    ACCOUNT_NOT_FOUND: 'Không tìm thấy tài khoản.',
    ACCOUNT_INACTIVE: 'Tài khoản không còn hoạt động.',
    TARGET_ROLE_NOT_SUPPORTED: 'Loại tài khoản này không thuộc phạm vi đặt lại.',
    TARGET_PROFILE_NOT_FOUND: 'Không tìm thấy hồ sơ học sinh hoặc giáo viên.',
    TARGET_PROFILE_NOT_ACTIVE: 'Hồ sơ không còn hoạt động hoặc đã lưu trữ.',
    PASSWORD_UPDATE_FAILED: 'Không thể cập nhật mật khẩu chung; yêu cầu đổi mật khẩu vẫn đang bật.',
    FORCE_PASSWORD_CHANGE_FAILED: 'Không bật được yêu cầu đổi mật khẩu; mật khẩu chưa thay đổi.',
    AUDIT_WRITE_FAILED: 'Chưa ghi được nhật ký thao tác.',
  } as Record<string, string>)[code] || 'Cần kiểm tra tài khoản này.'
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    :title="mode === 'confirm' ? 'Xác nhận đặt lại mật khẩu' : 'Kết quả đặt lại mật khẩu'"
    :description="mode === 'confirm'
      ? 'Các tài khoản được xử lý sẽ nhận mật khẩu 12345678 và phải đổi mật khẩu ở lần đăng nhập kế tiếp.'
      : 'Kết quả được ghi riêng cho từng tài khoản.'"
    size="lg"
    :busy="mode === 'confirm' && busy"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template v-if="mode === 'confirm'">
      <p class="mb-2 fw-semibold">{{ people.length }} tài khoản đang hoạt động được chọn</p>
      <div class="list-group overflow-auto" style="max-height: 20rem" aria-label="Danh sách tài khoản được chọn">
        <div v-for="person in people" :key="person.user_id" class="list-group-item d-flex justify-content-between gap-3">
          <span>{{ person.full_name }}</span>
          <code v-if="person.code">{{ person.code }}</code>
        </div>
      </div>
      <div v-if="errorMessage" class="alert alert-danger mt-3 mb-0" role="alert">{{ errorMessage }}</div>
    </template>

    <template v-else>
      <p class="mb-3">
        Thành công: {{ counts.success }} · Cần kiểm tra: {{ counts.partial }} · Thất bại: {{ counts.failed }} · Đã bỏ qua: {{ counts.skipped }}
      </p>
      <div v-if="temporaryPassword" class="mb-3">
        <label class="form-label" for="bulk-reset-temporary-password">Mật khẩu tạm cho các tài khoản đã đổi</label>
        <input id="bulk-reset-temporary-password" class="form-control fw-semibold" :value="temporaryPassword" readonly @focus="($event.target as HTMLInputElement).select()" />
        <div class="form-text">Hãy bàn giao qua kênh bảo mật. Người dùng cần đổi mật khẩu ở lần đăng nhập kế tiếp.</div>
      </div>
      <div class="list-group overflow-auto" style="max-height: 22rem" aria-label="Kết quả từng tài khoản">
        <div v-for="result in results" :key="result.user_id" class="list-group-item">
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <span class="fw-semibold">{{ result.full_name }} <code v-if="result.code" class="ms-1">{{ result.code }}</code></span>
            <span class="badge" :class="statusClass(result.status)">{{ statusLabel(result.status) }}</span>
          </div>
          <ul v-if="result.reason_codes.length" class="small text-secondary mb-0 mt-1 ps-3">
            <li v-for="code in result.reason_codes" :key="code">{{ reasonLabel(code) }}</li>
          </ul>
        </div>
      </div>
    </template>

    <template #footer>
      <template v-if="mode === 'confirm'">
        <button class="btn btn-outline-secondary" type="button" :disabled="busy" @click="emit('update:modelValue', false)">Hủy</button>
        <button class="btn btn-primary" type="button" :disabled="busy || !people.length" :aria-busy="busy || undefined" data-testid="confirm-bulk-reset" @click="emit('confirm')">
          <span v-if="busy" class="app-button__spinner" aria-hidden="true"></span>{{ busy ? 'Đang xử lý…' : `Đặt lại cho ${people.length} người` }}
        </button>
      </template>
      <template v-else>
        <button class="btn btn-primary" type="button" @click="emit('update:modelValue', false)">Đóng</button>
      </template>
    </template>
  </BaseModal>
</template>
