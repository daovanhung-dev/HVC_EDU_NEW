<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { submitParentFeedback } from '@/services/commands'
import { normalizeAppError } from '@/shared/utils/errors'

const form = reactive({
  parent_name: '',
  student_name: '',
  class_name: '',
  feedback: '',
  website: '',
})
const isSubmitting = ref(false)
const submitted = ref(false)
const errorMessage = ref('')
const feedbackLength = computed(() => Array.from(form.feedback).length)

async function submit() {
  if (isSubmitting.value) return
  isSubmitting.value = true
  errorMessage.value = ''
  try {
    await submitParentFeedback({
      parent_name: form.parent_name.trim(),
      student_name: form.student_name.trim() || undefined,
      class_name: form.class_name.trim() || undefined,
      feedback: form.feedback.trim(),
      website: form.website,
    })
    submitted.value = true
    Object.assign(form, {
      parent_name: '',
      student_name: '',
      class_name: '',
      feedback: '',
      website: '',
    })
  } catch (error) {
    errorMessage.value = normalizeAppError(
      error,
      'Chưa gửi được phản hồi. Vui lòng thử lại sau.',
    ).message
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="parent-feedback-page" aria-labelledby="parent-feedback-title">
    <header class="parent-feedback-heading">
      <p class="parent-feedback-eyebrow">Kết nối cùng Hùng Cường Education</p>
      <h2 id="parent-feedback-title">Ý kiến của phụ huynh</h2>
      <p>Chia sẻ nhận xét, góp ý hoặc điều trung tâm có thể làm tốt hơn cho gia đình mình.</p>
    </header>

    <div class="parent-feedback-privacy" role="note" aria-label="Thông tin bảo mật phản hồi">
      <span class="parent-feedback-privacy__icon" aria-hidden="true">◈</span>
      <div>
        <h3>Phản hồi riêng tư, kín đáo</h3>
        <p>
          Nội dung chỉ được xem bởi quản trị viên đang hoạt động của trung tâm.
          <strong>Biểu mẫu không ẩn danh: phụ huynh cần nhập họ tên và trung tâm sẽ biết tên người gửi.</strong>
        </p>
      </div>
    </div>

    <div v-if="submitted" class="parent-feedback-success" role="status" aria-live="polite">
      <div class="parent-feedback-success__mark" aria-hidden="true">✓</div>
      <h3>Trung tâm đã nhận được phản hồi</h3>
      <p>Ý kiến của phụ huynh đã được lưu riêng tư để đội ngũ quản lý xem xét.</p>
      <button class="btn btn-outline-primary" type="button" @click="submitted = false">
        Gửi thêm ý kiến
      </button>
    </div>

    <form v-else class="parent-feedback-form" @submit.prevent="submit">
      <div v-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }}</div>

      <div class="parent-feedback-form__field">
        <label class="form-label" for="parent-feedback-name">Họ tên phụ huynh <span aria-hidden="true">*</span></label>
        <input
          id="parent-feedback-name"
          v-model="form.parent_name"
          class="form-control"
          name="parent_name"
          type="text"
          autocomplete="name"
          maxlength="120"
          required
          placeholder="Nhập họ tên của phụ huynh"
        />
        <small class="form-text">Tên này được lưu cùng phản hồi để trung tâm biết ai đã gửi.</small>
      </div>

      <div class="parent-feedback-form__optional">
        <div class="parent-feedback-form__field">
          <label class="form-label" for="parent-feedback-student">Tên học sinh <span>(không bắt buộc)</span></label>
          <input
            id="parent-feedback-student"
            v-model="form.student_name"
            class="form-control"
            name="student_name"
            type="text"
            autocomplete="off"
            maxlength="120"
            placeholder="Tên học sinh"
          />
        </div>
        <div class="parent-feedback-form__field">
          <label class="form-label" for="parent-feedback-class">Lớp <span>(không bắt buộc)</span></label>
          <input
            id="parent-feedback-class"
            v-model="form.class_name"
            class="form-control"
            name="class_name"
            type="text"
            autocomplete="off"
            maxlength="80"
            placeholder="Ví dụ: Lớp Toán 6"
          />
        </div>
      </div>

      <div class="parent-feedback-form__field">
        <label class="form-label" for="parent-feedback-content">Nhận xét hoặc điều phụ huynh muốn góp ý <span aria-hidden="true">*</span></label>
        <textarea
          id="parent-feedback-content"
          v-model="form.feedback"
          class="form-control"
          name="feedback"
          rows="6"
          maxlength="4000"
          required
          placeholder="Phụ huynh có thể chia sẻ về việc học, cách hỗ trợ học sinh hoặc bất kỳ ý kiến nào muốn gửi riêng cho trung tâm."
        />
        <small class="form-text text-end">{{ feedbackLength }}/4000 ký tự</small>
      </div>

      <div class="parent-feedback-honeypot" aria-hidden="true">
        <label for="parent-feedback-website">Website</label>
        <input id="parent-feedback-website" v-model="form.website" name="website" tabindex="-1" autocomplete="off" />
      </div>

      <div class="parent-feedback-form__footer">
        <p>Vui lòng không gửi mật khẩu hoặc thông tin đăng nhập.</p>
        <button class="btn btn-primary" type="submit" :disabled="isSubmitting">
          <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-2" aria-hidden="true" />
          {{ isSubmitting ? 'Đang gửi…' : 'Gửi phản hồi riêng tư' }}
        </button>
      </div>
    </form>

    <footer class="parent-feedback-page__footer">
      <a href="#/login">Quay lại trang đăng nhập</a>
    </footer>
  </section>
</template>

<style scoped>
.parent-feedback-page { display: grid; gap: 22px; }
.parent-feedback-heading { text-align: center; }
.parent-feedback-heading h2 { margin: 0 0 8px; color: var(--color-text); font-size: clamp(22px, 4vw, 28px); font-weight: 750; letter-spacing: -.035em; }
.parent-feedback-heading p:last-child { margin: 0; color: var(--color-text-secondary); font-size: 14px; line-height: 1.6; }
.parent-feedback-eyebrow { margin: 0 0 8px; color: var(--color-primary-active); font-size: 11px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
.parent-feedback-privacy { display: flex; gap: 13px; border: 1px solid #cce5dc; border-radius: 12px; padding: 15px 16px; background: linear-gradient(115deg, #f1faf6, #f8fcfa); color: #214842; }
.parent-feedback-privacy__icon { display: grid; width: 34px; height: 34px; flex: 0 0 auto; place-items: center; border-radius: 10px; color: #0c6e58; background: #dcefe8; font-size: 22px; font-weight: 700; }
.parent-feedback-privacy h3 { margin: 2px 0 5px; font-size: 14px; font-weight: 750; }
.parent-feedback-privacy p { margin: 0; font-size: 12px; line-height: 1.6; }
.parent-feedback-privacy strong { display: inline; }
.parent-feedback-form { display: grid; gap: 17px; }
.parent-feedback-form__field { display: grid; gap: 6px; }
.parent-feedback-form .form-label { margin: 0; color: var(--color-text); font-size: 13px; font-weight: 700; }
.parent-feedback-form .form-label span { color: var(--color-danger); }
.parent-feedback-form .form-label span:not([aria-hidden]) { color: var(--color-text-muted); font-size: 11px; font-weight: 500; }
.parent-feedback-form .form-control { min-height: 46px; border-color: #d5dedc; border-radius: 9px; font-size: 14px; }
.parent-feedback-form textarea.form-control { min-height: 148px; resize: vertical; }
.parent-feedback-form .form-text { color: var(--color-text-muted); font-size: 11px; }
.parent-feedback-form__optional { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.parent-feedback-form__footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; border-top: 1px solid var(--color-border); padding-top: 16px; }
.parent-feedback-form__footer p { margin: 0; color: var(--color-text-muted); font-size: 11px; line-height: 1.5; }
.parent-feedback-form__footer .btn { min-height: 46px; flex: 0 0 auto; padding-inline: 22px; font-weight: 700; }
.parent-feedback-honeypot { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
.parent-feedback-success { display: grid; justify-items: center; gap: 10px; border: 1px solid #cce5dc; border-radius: 14px; padding: 28px 20px; background: #f5fbf8; text-align: center; }
.parent-feedback-success__mark { display: grid; width: 44px; height: 44px; place-items: center; border-radius: 50%; color: #fff; background: #16836a; font-size: 25px; font-weight: 700; }
.parent-feedback-success h3 { margin: 4px 0 0; font-size: 18px; font-weight: 750; }
.parent-feedback-success p { max-width: 420px; margin: 0 0 6px; color: var(--color-text-secondary); font-size: 13px; line-height: 1.6; }
.parent-feedback-success .btn { min-height: 44px; }
.parent-feedback-page__footer { border-top: 1px solid var(--color-border); padding-top: 15px; text-align: center; }
.parent-feedback-page__footer a { color: var(--color-primary-active); font-size: 12px; font-weight: 650; text-decoration: none; }
.parent-feedback-page__footer a:hover { text-decoration: underline; }

@media (max-width: 560px) {
  .parent-feedback-page { gap: 17px; }
  .parent-feedback-form__optional { grid-template-columns: 1fr; gap: 16px; }
  .parent-feedback-form__footer { align-items: stretch; flex-direction: column; }
  .parent-feedback-form__footer .btn { width: 100%; }
}
</style>
