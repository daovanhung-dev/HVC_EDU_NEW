<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { updateMyStaffProfile } from '@/services/commands'
import { getMyStaff } from '@/services/data-queries'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import AppPageHeader from '@/app/components/AppPageHeader.vue'
import AppState from '@/app/components/AppState.vue'

const auth = useAuthStore()
const toast = useToastStore()
const loading = ref(false)
const loaded = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const form = ref({ full_name: '', phone: '', email: '', address: '' })
const initials = computed(() => form.value.full_name.trim().split(/\s+/u).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi-VN') || 'GV')

async function load() {
  loading.value = true
  loaded.value = false
  errorMessage.value = ''
  try {
    const staff: any = await getMyStaff()
    if (!staff) throw new Error('Không tìm thấy hồ sơ giáo viên.')
    form.value = { full_name: staff.full_name || '', phone: staff.phone || '', email: staff.email || '', address: staff.address || '' }
    loaded.value = true
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể tải thông tin cá nhân.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function save() {
  if (saving.value || !form.value.full_name.trim()) return
  saving.value = true
  errorMessage.value = ''
  try {
    await updateMyStaffProfile(form.value)
    await auth.refreshProfile()
    toast.success('Đã cập nhật thông tin cá nhân.')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Không thể cập nhật thông tin cá nhân.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="teacher-workspace teacher-profile">
    <AppPageHeader title="Thông tin cá nhân" eyebrow="Không gian giáo viên" description="Quản lý thông tin liên hệ dùng trong hoạt động giảng dạy.">
      <template #actions><button class="btn btn-outline-primary" type="button" :disabled="loading" @click="load">{{ loading ? 'Đang làm mới…' : 'Làm mới hồ sơ' }}</button></template>
    </AppPageHeader>
    <div class="teacher-workspace__intro"><span class="teacher-workspace__eyebrow">Hồ sơ của tôi</span><p>Cập nhật thông tin để Admin có thể liên hệ khi cần.</p></div>

    <AppState v-if="loading" kind="loading" title="Đang tải hồ sơ" />
    <AppState v-else-if="!loaded" kind="error" title="Không thể tải hồ sơ giáo viên" :message="errorMessage"><button class="btn btn-outline-primary" type="button" @click="load">Thử tải lại</button></AppState>
    <template v-else>
      <div v-if="errorMessage" class="alert alert-danger teacher-alert" role="alert">{{ errorMessage }}</div>
      <div class="teacher-profile__layout">
        <aside class="teacher-profile-card">
          <div class="teacher-profile-card__avatar" aria-hidden="true">{{ initials }}</div>
          <div class="teacher-profile-card__copy">
            <span class="teacher-profile-card__eyebrow">Giáo viên</span>
            <h2>{{ form.full_name || auth.displayName || 'Hồ sơ giáo viên' }}</h2>
            <p>{{ auth.username || 'Tài khoản giáo viên' }}</p>
          </div>
          <div class="teacher-profile-card__divider"></div>
          <div class="teacher-profile-card__tip"><span aria-hidden="true">✦</span><p>Thông tin hồ sơ được lưu vào tài khoản giáo viên và đồng bộ với hệ thống.</p></div>
        </aside>

        <form class="teacher-profile-form" @submit.prevent="save">
          <div class="teacher-profile-form__header"><div><span class="teacher-workspace__eyebrow">Thông tin liên hệ</span><h2>Chi tiết hồ sơ</h2></div><span class="teacher-profile-form__required"><i aria-hidden="true">*</i> Bắt buộc</span></div>
          <div class="teacher-profile-form__fields">
            <div class="teacher-profile-form__field teacher-profile-form__field--wide">
              <label class="form-label" for="profile-full-name">Họ và tên <i aria-hidden="true">*</i></label>
              <input id="profile-full-name" v-model="form.full_name" class="form-control" autocomplete="name" maxlength="200" required placeholder="Nhập họ và tên" />
            </div>
            <div class="teacher-profile-form__field">
              <label class="form-label" for="profile-phone">Số điện thoại</label>
              <input id="profile-phone" v-model="form.phone" type="tel" inputmode="tel" class="form-control" autocomplete="tel" maxlength="50" placeholder="Ví dụ: 09xx xxx xxx" />
            </div>
            <div class="teacher-profile-form__field">
              <label class="form-label" for="profile-email">Email</label>
              <input id="profile-email" v-model="form.email" type="email" class="form-control" autocomplete="email" maxlength="254" placeholder="ten@example.com" />
            </div>
            <div class="teacher-profile-form__field teacher-profile-form__field--wide">
              <label class="form-label" for="profile-address">Địa chỉ</label>
              <input id="profile-address" v-model="form.address" class="form-control" autocomplete="street-address" maxlength="500" placeholder="Nhập địa chỉ liên hệ" />
            </div>
          </div>
          <footer class="teacher-profile-form__footer">
            <p>Các thay đổi chỉ được lưu sau khi bạn xác nhận.</p>
            <button class="btn btn-primary" type="submit" :disabled="saving || !form.full_name.trim()">
              <span v-if="saving" class="app-button__spinner" aria-hidden="true"></span>{{ saving ? 'Đang lưu…' : 'Lưu thông tin' }}
            </button>
          </footer>
        </form>
      </div>
    </template>
  </section>
</template>

<style scoped>
.teacher-workspace { display: grid; gap: 16px; }
.teacher-workspace__intro { display: flex; align-items: baseline; gap: 10px; border-left: 3px solid var(--color-primary); padding: 2px 0 2px 12px; }
.teacher-workspace__eyebrow { color: var(--color-primary-active); font-size: 11px; font-weight: 750; letter-spacing: .07em; text-transform: uppercase; }
.teacher-workspace__intro p { margin: 0; color: var(--color-text-secondary); font-size: 13px; }
.teacher-alert { margin: 0; }
.teacher-profile__layout { display: grid; grid-template-columns: minmax(230px, .38fr) minmax(0, 1fr); align-items: start; gap: 16px; }
.teacher-profile-card, .teacher-profile-form { border: 1px solid var(--color-border); border-radius: 13px; background: #fff; box-shadow: var(--shadow-surface); }
.teacher-profile-card { display: grid; justify-items: center; gap: 13px; padding: 24px 20px; text-align: center; }
.teacher-profile-card__avatar { display: grid; width: 84px; height: 84px; place-items: center; border: 5px solid #e8f3f2; border-radius: 50%; color: var(--color-primary-active); background: var(--color-primary-soft); font-size: 24px; font-weight: 750; letter-spacing: -.03em; }
.teacher-profile-card__copy { display: grid; justify-items: center; gap: 4px; }
.teacher-profile-card__eyebrow { color: var(--color-primary-active); font-size: 10px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
.teacher-profile-card__copy h2 { margin: 0; font-size: 17px; overflow-wrap: anywhere; }
.teacher-profile-card__copy p { margin: 0; color: var(--color-text-secondary); font-size: 12px; }
.teacher-profile-card__divider { width: 100%; height: 1px; background: var(--color-border); }
.teacher-profile-card__tip { display: flex; align-items: flex-start; gap: 8px; text-align: left; }
.teacher-profile-card__tip span { color: var(--color-accent); font-size: 14px; }
.teacher-profile-card__tip p { margin: 0; color: var(--color-text-secondary); font-size: 11px; line-height: 1.5; }
.teacher-profile-form { overflow: hidden; }
.teacher-profile-form__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--color-border); padding: 20px 22px 15px; }
.teacher-profile-form__header h2 { margin: 3px 0 0; font-size: 18px; }
.teacher-profile-form__required { color: var(--color-text-secondary); font-size: 11px; }
.teacher-profile-form__required i, .teacher-profile-form .form-label i { color: var(--color-danger); font-style: normal; }
.teacher-profile-form__fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; padding: 21px 22px; }
.teacher-profile-form__field { min-width: 0; }
.teacher-profile-form__field--wide { grid-column: 1 / -1; }
.teacher-profile-form__footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid var(--color-border); padding: 14px 22px; background: #fafcfb; }
.teacher-profile-form__footer p { margin: 0; color: var(--color-text-secondary); font-size: 11px; }

@media (max-width: 767.98px) {
  .teacher-workspace { gap: 12px; }
  .teacher-workspace__intro { align-items: flex-start; flex-direction: column; gap: 3px; }
  .teacher-workspace__intro p { font-size: 12px; }
  .teacher-profile__layout { grid-template-columns: minmax(0, 1fr); }
  .teacher-profile-card { grid-template-columns: 56px minmax(0, 1fr); justify-items: start; gap: 3px 12px; padding: 15px; text-align: left; }
  .teacher-profile-card__avatar { width: 56px; height: 56px; grid-row: 1 / span 2; border-width: 3px; font-size: 17px; }
  .teacher-profile-card__copy { justify-items: start; align-self: center; }
  .teacher-profile-card__copy h2 { font-size: 15px; }
  .teacher-profile-card__divider { grid-column: 1 / -1; margin: 8px 0 5px; }
  .teacher-profile-card__tip { grid-column: 1 / -1; }
  .teacher-profile-form__header { padding: 16px; }
  .teacher-profile-form__fields { grid-template-columns: minmax(0, 1fr); gap: 13px; padding: 16px; }
  .teacher-profile-form__field--wide { grid-column: auto; }
  .teacher-profile-form__footer { align-items: stretch; flex-direction: column; padding: 14px 16px; }
  .teacher-profile-form__footer .btn { width: 100%; }
}
</style>
