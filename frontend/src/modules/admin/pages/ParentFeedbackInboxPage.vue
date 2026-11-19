<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppIcon from '@/app/components/AppIcon.vue'
import AppPageHeader from '@/app/components/AppPageHeader.vue'
import AppState from '@/app/components/AppState.vue'
import { getParentFeedbackDetail, getParentFeedbackList } from '@/services/data-queries'
import type { ParentFeedbackListRow, ParentFeedbackRow } from '@/shared/types/domain'
import { normalizeAppError } from '@/shared/utils/errors'
import { formatDateTime } from '@/shared/utils/format'

const PAGE_SIZE = 20
const rows = ref<ParentFeedbackListRow[]>([])
const selectedId = ref<string | null>(null)
const selectedFeedback = ref<ParentFeedbackRow | null>(null)
const loading = ref(true)
const loadingMore = ref(false)
const detailLoading = ref(false)
const hasMore = ref(false)
const errorMessage = ref('')
const detailError = ref('')

async function loadFirstPage() {
  loading.value = true
  errorMessage.value = ''
  selectedId.value = null
  selectedFeedback.value = null
  try {
    const result = await getParentFeedbackList(0, PAGE_SIZE + 1)
    rows.value = result.slice(0, PAGE_SIZE)
    hasMore.value = result.length > PAGE_SIZE
  } catch (error) {
    errorMessage.value = normalizeAppError(error, 'Không tải được danh sách phản hồi. Vui lòng thử lại.').message
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  errorMessage.value = ''
  try {
    const result = await getParentFeedbackList(rows.value.length, PAGE_SIZE + 1)
    rows.value.push(...result.slice(0, PAGE_SIZE))
    hasMore.value = result.length > PAGE_SIZE
  } catch (error) {
    errorMessage.value = normalizeAppError(error, 'Không tải thêm được phản hồi. Vui lòng thử lại.').message
  } finally {
    loadingMore.value = false
  }
}

async function selectFeedback(row: ParentFeedbackListRow) {
  selectedId.value = row.id
  selectedFeedback.value = null
  detailError.value = ''
  detailLoading.value = true
  try {
    const result = await getParentFeedbackDetail(row.id)
    if (selectedId.value === row.id) {
      selectedFeedback.value = result
      if (!result) detailError.value = 'Không tìm thấy nội dung phản hồi này. Hãy làm mới danh sách.'
    }
  } catch (error) {
    if (selectedId.value === row.id) {
      detailError.value = normalizeAppError(error, 'Không tải được nội dung phản hồi. Vui lòng thử lại.').message
    }
  } finally {
    if (selectedId.value === row.id) detailLoading.value = false
  }
}

onMounted(loadFirstPage)
</script>

<template>
  <section aria-labelledby="parent-feedback-inbox-title">
    <AppPageHeader
      id="parent-feedback-inbox-title"
      eyebrow="Kênh tiếp nhận riêng tư"
      title="Phản hồi từ phụ huynh"
      description="Ý kiến được ghi nhận cùng họ tên phụ huynh để trung tâm xem xét và phản hồi qua kênh phù hợp."
    >
      <template #actions>
        <button class="btn btn-outline-primary" type="button" :disabled="loading" @click="loadFirstPage">
          <AppIcon name="refresh" :size="17" /> Làm mới
        </button>
      </template>
    </AppPageHeader>

    <div class="parent-feedback-inbox-note" role="note">
      <AppIcon name="info" :size="19" />
      <p>Phản hồi được gửi riêng tư, kín đáo và không ẩn danh. Họ tên người gửi luôn được lưu cùng nội dung.</p>
    </div>

    <AppState
      v-if="loading"
      kind="loading"
      title="Đang tải phản hồi"
      message="Đang mở danh sách mới nhất."
    />
    <AppState
      v-else-if="errorMessage && !rows.length"
      kind="error"
      title="Chưa tải được danh sách"
      :message="errorMessage"
      @retry="loadFirstPage"
    />
    <AppState
      v-else-if="!rows.length"
      kind="empty"
      title="Chưa có phản hồi"
      message="Phản hồi mới của phụ huynh sẽ xuất hiện tại đây."
    />
    <div v-else class="parent-feedback-inbox">
      <section class="parent-feedback-inbox__list" aria-labelledby="parent-feedback-list-title">
        <div class="parent-feedback-inbox__list-heading">
          <div>
            <h2 id="parent-feedback-list-title">Mới nhất</h2>
            <p>{{ rows.length }} phản hồi đang hiển thị</p>
          </div>
          <span class="parent-feedback-inbox__private-badge"><AppIcon name="chat" :size="15" /> Riêng tư</span>
        </div>

        <div class="parent-feedback-inbox__items">
          <button
            v-for="row in rows"
            :key="row.id"
            type="button"
            class="parent-feedback-inbox__item"
            :class="{ 'parent-feedback-inbox__item--active': selectedId === row.id }"
            :aria-current="selectedId === row.id ? 'true' : undefined"
            @click="selectFeedback(row)"
          >
            <span class="parent-feedback-inbox__item-icon" aria-hidden="true"><AppIcon name="chat" :size="18" /></span>
            <span class="parent-feedback-inbox__item-copy">
              <strong>{{ row.parent_name }}</strong>
              <span>{{ row.student_name || 'Chưa ghi tên học sinh' }}<template v-if="row.class_name"> · {{ row.class_name }}</template></span>
              <time :datetime="row.created_at">{{ formatDateTime(row.created_at) }}</time>
            </span>
            <AppIcon class="parent-feedback-inbox__item-chevron" name="chevron" :size="17" />
          </button>
        </div>

        <p v-if="errorMessage" class="parent-feedback-inbox__list-error" role="alert">{{ errorMessage }}</p>
        <button v-if="hasMore" class="btn btn-outline-primary parent-feedback-inbox__load-more" type="button" :disabled="loadingMore" @click="loadMore">
          <span v-if="loadingMore" class="spinner-border spinner-border-sm me-2" aria-hidden="true" />
          {{ loadingMore ? 'Đang tải…' : 'Tải phản hồi cũ hơn' }}
        </button>
      </section>

      <section class="parent-feedback-inbox__detail" aria-labelledby="parent-feedback-detail-title" aria-live="polite">
        <div v-if="!selectedId" class="parent-feedback-inbox__placeholder">
          <span aria-hidden="true"><AppIcon name="chat" :size="24" /></span>
          <h2 id="parent-feedback-detail-title">Xem nội dung phản hồi</h2>
          <p>Chọn một phản hồi trong danh sách để xem nội dung đầy đủ.</p>
        </div>
        <AppState v-else-if="detailLoading" kind="loading" title="Đang tải nội dung" />
        <AppState v-else-if="detailError" kind="error" title="Chưa tải được nội dung" :message="detailError" />
        <article v-else-if="selectedFeedback" class="parent-feedback-detail">
          <div class="parent-feedback-detail__topline">
            <span class="parent-feedback-detail__tag">Phản hồi riêng tư</span>
            <time :datetime="selectedFeedback.created_at">{{ formatDateTime(selectedFeedback.created_at) }}</time>
          </div>
          <h2 id="parent-feedback-detail-title">{{ selectedFeedback.parent_name }}</h2>
          <dl class="parent-feedback-detail__about">
            <div><dt>Học sinh</dt><dd>{{ selectedFeedback.student_name || 'Chưa cung cấp' }}</dd></div>
            <div><dt>Lớp</dt><dd>{{ selectedFeedback.class_name || 'Chưa cung cấp' }}</dd></div>
          </dl>
          <div class="parent-feedback-detail__message">
            <h3>Ý kiến phụ huynh</h3>
            <p>{{ selectedFeedback.feedback }}</p>
          </div>
        </article>
      </section>
    </div>
  </section>
</template>

<style scoped>
.parent-feedback-inbox-note { display: flex; align-items: flex-start; gap: 10px; margin: 0 0 18px; border: 1px solid #d9e8e3; border-radius: 10px; padding: 12px 14px; color: #315b53; background: #f5faf8; }
.parent-feedback-inbox-note svg { flex: 0 0 auto; margin-top: 1px; }
.parent-feedback-inbox-note p { margin: 0; font-size: 12px; line-height: 1.55; }
.parent-feedback-inbox { display: grid; grid-template-columns: minmax(290px, .8fr) minmax(0, 1.2fr); gap: 16px; align-items: start; }
.parent-feedback-inbox__list, .parent-feedback-inbox__detail { min-width: 0; overflow: hidden; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); box-shadow: var(--shadow-surface); }
.parent-feedback-inbox__list-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid var(--color-border); padding: 16px; }
.parent-feedback-inbox__list-heading h2 { margin: 0 0 3px; font-size: 15px; font-weight: 750; }
.parent-feedback-inbox__list-heading p { margin: 0; color: var(--color-text-muted); font-size: 11px; }
.parent-feedback-inbox__private-badge { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 5px 8px; color: #286153; background: #eaf5f1; font-size: 10px; font-weight: 700; white-space: nowrap; }
.parent-feedback-inbox__items { display: grid; max-height: min(64vh, 680px); overflow-y: auto; overscroll-behavior: contain; }
.parent-feedback-inbox__item { display: flex; width: 100%; min-width: 0; align-items: center; gap: 11px; border: 0; border-bottom: 1px solid #edf0ef; padding: 13px 14px; color: inherit; background: transparent; text-align: left; transition: background-color 140ms ease, box-shadow 140ms ease; }
.parent-feedback-inbox__item:last-child { border-bottom: 0; }
.parent-feedback-inbox__item:hover { background: #f8fbfa; }
.parent-feedback-inbox__item:focus-visible { position: relative; z-index: 1; outline: 3px solid color-mix(in srgb, var(--color-primary) 38%, transparent); outline-offset: -3px; }
.parent-feedback-inbox__item--active { background: #f0f7f4; box-shadow: inset 3px 0 0 var(--color-primary); }
.parent-feedback-inbox__item-icon { display: grid; width: 36px; height: 36px; flex: 0 0 auto; place-items: center; border-radius: 10px; color: var(--color-primary-active); background: var(--color-primary-soft); }
.parent-feedback-inbox__item-copy { display: grid; min-width: 0; gap: 3px; flex: 1; }
.parent-feedback-inbox__item-copy strong { overflow: hidden; font-size: 12px; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
.parent-feedback-inbox__item-copy > span { overflow: hidden; color: var(--color-text-secondary); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.parent-feedback-inbox__item-copy time { color: var(--color-text-muted); font-size: 10px; }
.parent-feedback-inbox__item-chevron { flex: 0 0 auto; color: var(--color-text-muted); transform: rotate(180deg); }
.parent-feedback-inbox__load-more { width: calc(100% - 28px); min-height: 40px; margin: 12px 14px 14px; font-size: 12px; }
.parent-feedback-inbox__list-error { margin: 8px 14px; color: var(--color-danger); font-size: 12px; }
.parent-feedback-inbox__detail { min-height: 380px; }
.parent-feedback-inbox__placeholder { display: grid; min-height: 380px; align-content: center; justify-items: center; padding: 26px; text-align: center; }
.parent-feedback-inbox__placeholder > span { display: grid; width: 48px; height: 48px; place-items: center; margin-bottom: 12px; border-radius: 14px; color: var(--color-primary-active); background: var(--color-primary-soft); }
.parent-feedback-inbox__placeholder h2 { margin: 0 0 6px; font-size: 16px; font-weight: 750; }
.parent-feedback-inbox__placeholder p { max-width: 260px; margin: 0; color: var(--color-text-secondary); font-size: 12px; line-height: 1.5; }
.parent-feedback-detail { padding: clamp(18px, 3vw, 28px); }
.parent-feedback-detail__topline { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.parent-feedback-detail__tag { border-radius: 999px; padding: 6px 9px; color: #286153; background: #eaf5f1; font-size: 10px; font-weight: 750; }
.parent-feedback-detail__topline time { color: var(--color-text-muted); font-size: 11px; text-align: right; }
.parent-feedback-detail > h2 { margin: 0 0 18px; font-size: 21px; font-weight: 760; letter-spacing: -.025em; }
.parent-feedback-detail__about { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 0 0 20px; }
.parent-feedback-detail__about > div { min-width: 0; border-radius: 9px; padding: 10px 12px; background: #f7f9f8; }
.parent-feedback-detail__about dt { margin: 0 0 4px; color: var(--color-text-muted); font-size: 10px; font-weight: 650; }
.parent-feedback-detail__about dd { margin: 0; overflow-wrap: anywhere; font-size: 12px; font-weight: 650; }
.parent-feedback-detail__message { border-top: 1px solid var(--color-border); padding-top: 17px; }
.parent-feedback-detail__message h3 { margin: 0 0 10px; font-size: 13px; font-weight: 750; }
.parent-feedback-detail__message p { margin: 0; color: var(--color-text); font-size: 13px; line-height: 1.8; overflow-wrap: anywhere; white-space: pre-wrap; }

@media (max-width: 900px) {
  .parent-feedback-inbox { grid-template-columns: minmax(250px, .9fr) minmax(0, 1.1fr); gap: 12px; }
}
@media (max-width: 720px) {
  .parent-feedback-inbox { grid-template-columns: 1fr; }
  .parent-feedback-inbox__items { max-height: min(48vh, 500px); }
  .parent-feedback-inbox__detail, .parent-feedback-inbox__placeholder { min-height: 280px; }
  .parent-feedback-detail__about { grid-template-columns: 1fr; }
}
</style>
