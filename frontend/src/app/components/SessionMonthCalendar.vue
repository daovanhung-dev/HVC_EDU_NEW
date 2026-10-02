<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SessionRow } from '@/shared/types/domain'
import {
  formatBusinessDate,
  formatBusinessMonth,
  formatBusinessTime,
  getBusinessDateKey,
  getMonthGridDateKeys,
  groupSessionsByBusinessDate,
  shiftCalendarMonth,
} from '@/shared/utils/session-calendar'

type ViewMode = 'month' | 'list'

const props = defineProps<{
  sessions: SessionRow[]
  selectedSessionId?: string
}>()

const emit = defineEmits<{ select: [session: SessionRow] }>()

const weekdayLabels = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
const todayDateKey = getBusinessDateKey(new Date())
const calendarAnchorDate = ref(todayDateKey)
const selectedDateKey = ref(todayDateKey)
const viewMode = ref<ViewMode>('month')

const monthDateKeys = computed(() => getMonthGridDateKeys(calendarAnchorDate.value))
const sessionsByDate = computed(() => groupSessionsByBusinessDate(props.sessions))
const monthKey = computed(() => calendarAnchorDate.value.slice(0, 7))
const monthSessions = computed(() => props.sessions
  .filter((session) => getBusinessDateKey(session.scheduled_start_at).slice(0, 7) === monthKey.value)
  .sort((left, right) => left.scheduled_start_at.localeCompare(right.scheduled_start_at)))
const selectedDaySessions = computed(() => sessionsByDate.value[selectedDateKey.value] || [])
const periodTitle = computed(() => formatBusinessMonth(calendarAnchorDate.value).replace(/^./u, (firstLetter) => firstLetter.toLocaleUpperCase('vi-VN')))
const compactPeriodTitle = computed(() => `Tháng ${Number(calendarAnchorDate.value.slice(5, 7))}/${calendarAnchorDate.value.slice(0, 4)}`)
const selectedDateTitle = computed(() => formatBusinessDate(selectedDateKey.value))

function sessionsForDay(dateKey: string) {
  return sessionsByDate.value[dateKey] || []
}

function changeMonth(amount: number) {
  calendarAnchorDate.value = shiftCalendarMonth(calendarAnchorDate.value, amount)
  selectedDateKey.value = `${calendarAnchorDate.value.slice(0, 7)}-01`
}

function goToToday() {
  const today = getBusinessDateKey(new Date())
  calendarAnchorDate.value = today
  selectedDateKey.value = today
}

function selectDate(dateKey: string) {
  selectedDateKey.value = dateKey
}

function selectSession(session: SessionRow) {
  selectedDateKey.value = getBusinessDateKey(session.scheduled_start_at)
  emit('select', session)
}

function sessionStatusLabel(status: SessionRow['status']) {
  return ({
    SCHEDULED: 'Sắp diễn ra',
    IN_PROGRESS: 'Đang học',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
  })[status]
}

function sessionStatusClass(status: SessionRow['status']) {
  return `session-month__event--${status.toLowerCase().replaceAll('_', '-')}`
}

function sessionName(session: SessionRow) {
  return session.classes?.name?.trim() || 'Lớp học'
}

function sessionAriaLabel(session: SessionRow) {
  return `${formatBusinessTime(session.scheduled_start_at)}, ${sessionName(session)}, ${sessionStatusLabel(session.status)}`
}

function roomName(session: SessionRow) {
  return session.room || session.class_schedules?.room || 'Chưa xếp phòng'
}
</script>

<template>
  <section class="session-month card" aria-label="Lịch buổi học">
    <div class="session-month__toolbar">
      <div class="session-month__period-controls">
        <button class="btn btn-outline-secondary session-month__nav" type="button" aria-label="Tháng trước" @click="changeMonth(-1)">‹</button>
        <h2 class="session-month__title" aria-live="polite" :aria-label="periodTitle">
          <span class="session-month__title-full">{{ periodTitle }}</span>
          <span class="session-month__title-compact">{{ compactPeriodTitle }}</span>
        </h2>
        <button class="btn btn-outline-secondary session-month__nav" type="button" aria-label="Tháng sau" @click="changeMonth(1)">›</button>
        <button class="btn btn-outline-primary session-month__today" type="button" @click="goToToday">Hôm nay</button>
      </div>
      <div class="session-month__view-toggle" role="group" aria-label="Kiểu xem lịch">
        <button class="btn btn-sm" :class="viewMode === 'month' ? 'btn-primary' : 'btn-outline-secondary'" type="button" :aria-pressed="viewMode === 'month'" @click="viewMode = 'month'">Tháng</button>
        <button class="btn btn-sm" :class="viewMode === 'list' ? 'btn-primary' : 'btn-outline-secondary'" type="button" :aria-pressed="viewMode === 'list'" @click="viewMode = 'list'">Danh sách</button>
      </div>
    </div>

    <div v-if="viewMode === 'month'" class="session-month__body">
      <div class="session-month__weekdays" aria-hidden="true">
        <span v-for="label in weekdayLabels" :key="label">{{ label }}</span>
      </div>
      <div class="session-month__grid" :aria-label="`Lịch tháng ${periodTitle}`">
        <article
          v-for="dateKey in monthDateKeys"
          :key="dateKey"
          class="session-month__day"
          :class="{
            'session-month__day--outside': dateKey.slice(0, 7) !== monthKey,
            'session-month__day--today': dateKey === todayDateKey,
            'session-month__day--selected': dateKey === selectedDateKey,
          }"
          :data-date-key="dateKey"
          :aria-label="formatBusinessDate(dateKey)"
        >
          <button
            class="session-month__date-button"
            type="button"
            :aria-label="`Chọn ngày ${formatBusinessDate(dateKey)}${sessionsForDay(dateKey).length ? `, ${sessionsForDay(dateKey).length} buổi học` : ''}`"
            :aria-pressed="dateKey === selectedDateKey"
            @click="selectDate(dateKey)"
          >
            <span>{{ Number(dateKey.slice(-2)) }}</span>
            <span v-if="sessionsForDay(dateKey).length" class="session-month__day-count">{{ sessionsForDay(dateKey).length }} buổi</span>
          </button>
          <div class="session-month__cell-events">
            <button
              v-for="session in sessionsForDay(dateKey).slice(0, 2)"
              :key="session.id"
              class="calendar-event session-month__event"
              :class="[sessionStatusClass(session.status), { 'calendar-event-selected': selectedSessionId === session.id }]"
              type="button"
              :aria-label="sessionAriaLabel(session)"
              :title="sessionAriaLabel(session)"
              @click="selectSession(session)"
            >
              <span class="session-month__event-time">{{ formatBusinessTime(session.scheduled_start_at) }}</span>
              <span class="session-month__event-name">{{ sessionName(session) }}</span>
              <span class="session-month__event-status">{{ sessionStatusLabel(session.status) }}</span>
            </button>
            <button
              v-if="sessionsForDay(dateKey).length > 2"
              class="session-month__more"
              type="button"
              :aria-label="`Xem ${sessionsForDay(dateKey).length} buổi học ngày ${formatBusinessDate(dateKey)}`"
              @click="selectDate(dateKey)"
            >+{{ sessionsForDay(dateKey).length - 2 }} buổi khác</button>
          </div>
        </article>
      </div>

      <section class="session-month__agenda" :aria-label="`Các buổi học ngày ${selectedDateTitle}`" aria-live="polite">
        <div class="session-month__agenda-heading">
          <h3>{{ selectedDateTitle }}</h3>
          <span>{{ selectedDaySessions.length }} buổi học</span>
        </div>
        <p v-if="!selectedDaySessions.length" class="session-month__empty-day">Không có buổi học trong ngày này.</p>
        <div v-else class="session-month__session-list">
          <button
            v-for="session in selectedDaySessions"
            :key="session.id"
            class="session-month__session-card"
            :class="{ 'session-month__session-card--selected': selectedSessionId === session.id }"
            type="button"
            :aria-label="sessionAriaLabel(session)"
            :aria-pressed="selectedSessionId === session.id"
            @click="selectSession(session)"
          >
            <span class="session-month__session-time">{{ formatBusinessTime(session.scheduled_start_at) }}–{{ formatBusinessTime(session.scheduled_end_at) }}</span>
            <span class="session-month__session-copy">
              <strong>{{ sessionName(session) }}</strong>
              <small>{{ roomName(session) }}</small>
            </span>
            <span class="badge" :class="sessionStatusClass(session.status)">{{ sessionStatusLabel(session.status) }}</span>
          </button>
        </div>
      </section>
    </div>

    <div v-else class="session-month__body session-month__body--list">
      <div class="session-month__agenda-heading">
        <h3>{{ periodTitle }}</h3>
        <span>{{ monthSessions.length }} buổi học</span>
      </div>
      <p v-if="!monthSessions.length" class="session-month__empty-day">Tháng này chưa có buổi học.</p>
      <div v-else class="session-month__session-list">
        <button
          v-for="session in monthSessions"
          :key="session.id"
          class="session-month__session-card"
          :class="{ 'session-month__session-card--selected': selectedSessionId === session.id }"
          type="button"
          :aria-label="`${formatBusinessDate(getBusinessDateKey(session.scheduled_start_at))}, ${sessionAriaLabel(session)}`"
          :aria-pressed="selectedSessionId === session.id"
          @click="selectSession(session)"
        >
          <span class="session-month__session-time">{{ formatBusinessDate(getBusinessDateKey(session.scheduled_start_at)) }}<br>{{ formatBusinessTime(session.scheduled_start_at) }}–{{ formatBusinessTime(session.scheduled_end_at) }}</span>
          <span class="session-month__session-copy">
            <strong>{{ sessionName(session) }}</strong>
            <small>{{ roomName(session) }}</small>
          </span>
          <span class="badge" :class="sessionStatusClass(session.status)">{{ sessionStatusLabel(session.status) }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.session-month { min-width: 0; overflow: hidden; }
.session-month__toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--color-border); padding: 14px 16px; }
.session-month__period-controls { display: flex; min-width: 0; align-items: center; gap: 8px; }
.session-month__title { min-width: 144px; margin: 0; color: var(--color-text); font-size: 17px; font-weight: 700; text-align: center; }
.session-month__title-compact { display: none; }
.session-month__nav { width: 40px; min-width: 40px; min-height: 40px; padding: 0; font-size: 24px; line-height: 1; }
.session-month__today { min-height: 40px; padding: 8px 11px; }
.session-month__view-toggle { display: flex; flex: 0 0 auto; gap: 4px; }
.session-month__body { padding: 12px 16px 16px; }
.session-month__weekdays, .session-month__grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.session-month__weekdays { gap: 6px; margin-bottom: 6px; }
.session-month__weekdays span { color: var(--color-text-secondary); font-size: 11px; font-weight: 650; text-align: center; }
.session-month__grid { gap: 6px; }
.session-month__day { min-width: 0; min-height: 118px; overflow: hidden; border: 1px solid var(--color-border); border-radius: 9px; padding: 6px; background: #fff; }
.session-month__day--outside { background: #f6f8f7; }
.session-month__day--outside .session-month__date-button { color: var(--color-text-muted); }
.session-month__day--today { border-color: var(--color-primary); box-shadow: inset 0 0 0 1px var(--color-primary); }
.session-month__day--selected { background: var(--color-primary-soft); }
.session-month__date-button { display: flex; width: 100%; min-height: 28px; align-items: center; justify-content: space-between; gap: 3px; border: 0; border-radius: 6px; padding: 2px 3px; color: var(--color-text); background: transparent; font-size: 13px; font-weight: 700; text-align: left; }
.session-month__date-button:hover { background: rgb(14 111 123 / 8%); }
.session-month__day-count { display: none; color: var(--color-primary-active); font-size: 10px; font-weight: 650; white-space: nowrap; }
.session-month__cell-events { display: grid; gap: 3px; margin-top: 4px; }
.session-month__event { display: grid; min-width: 0; gap: 1px; border: 1px solid transparent; border-radius: 6px; padding: 4px 5px; color: var(--color-text); text-align: left; }
.session-month__event-time { font-size: 10px; font-weight: 700; line-height: 1.25; }
.session-month__event-name { overflow: hidden; font-size: 10px; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.session-month__event-status { overflow: hidden; font-size: 9px; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.session-month__event--scheduled { border-color: #c8dce9; color: #285f78; background: #eaf2f6; }
.session-month__event--in-progress { border-color: #b8d8da; color: var(--color-primary-active); background: var(--color-primary-soft); }
.session-month__event--completed { border-color: #c0dbc8; color: var(--color-success); background: var(--color-success-soft); }
.session-month__event--cancelled { border-color: #e9c4c7; color: var(--color-danger); background: var(--color-danger-soft); }
.session-month__more { border: 0; padding: 2px 4px; color: var(--color-primary-active); background: transparent; font-size: 10px; font-weight: 650; text-align: left; }
.session-month__agenda { margin-top: 16px; border-top: 1px solid var(--color-border); padding-top: 14px; }
.session-month__agenda-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 9px; }
.session-month__agenda-heading h3 { margin: 0; font-size: 15px; font-weight: 700; }
.session-month__agenda-heading > span { color: var(--color-text-secondary); font-size: 12px; }
.session-month__empty-day { margin: 0; border-radius: 8px; padding: 14px; color: var(--color-text-secondary); background: #f7f9f8; font-size: 13px; }
.session-month__session-list { display: grid; gap: 8px; }
.session-month__session-card { display: flex; min-width: 0; min-height: 56px; align-items: center; gap: 12px; border: 1px solid var(--color-border); border-radius: 9px; padding: 10px 12px; color: var(--color-text); background: #fff; text-align: left; transition: border-color var(--motion-fast) ease, background-color var(--motion-fast) ease, box-shadow var(--motion-fast) ease; }
.session-month__session-card:hover, .session-month__session-card--selected { border-color: var(--color-primary); background: #f5faf9; }
.session-month__session-card--selected { box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary), transparent 82%); }
.session-month__session-time { min-width: 104px; color: var(--color-primary-active); font-size: 12px; font-weight: 700; }
.session-month__session-copy { display: grid; min-width: 0; flex: 1; gap: 2px; }
.session-month__session-copy strong { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.session-month__session-copy small { overflow: hidden; color: var(--color-text-secondary); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.session-month__body--list { display: grid; gap: 8px; }
.session-month__body--list .session-month__agenda-heading { margin: 0; }
.session-month__body--list .session-month__empty-day { margin-top: 2px; }
.session-month__body--list .session-month__session-time { min-width: 152px; }

@media (max-width: 767.98px) {
  .session-month__toolbar { align-items: stretch; padding: 12px; }
  .session-month__period-controls { justify-content: space-between; gap: 5px; }
  .session-month__title { min-width: 0; flex: 1; font-size: 14px; white-space: nowrap; }
  .session-month__title-full { display: none; }
  .session-month__title-compact { display: inline; }
  .session-month__today { padding-inline: 8px; font-size: 12px; }
  .session-month__view-toggle { display: grid; grid-template-columns: 1fr 1fr; }
  .session-month__body { padding: 10px 10px 14px; }
  .session-month__weekdays, .session-month__grid { gap: 3px; }
  .session-month__weekdays span { font-size: 10px; }
  .session-month__day { min-height: 52px; border-radius: 7px; padding: 3px; }
  .session-month__date-button { min-height: 42px; flex-direction: column; justify-content: center; gap: 0; padding: 2px; font-size: 12px; }
  .session-month__day-count { display: block; }
  .session-month__cell-events { display: none; }
  .session-month__agenda { margin-top: 14px; padding-top: 12px; }
  .session-month__session-card { align-items: flex-start; gap: 8px; padding: 10px; }
  .session-month__session-time { min-width: 82px; font-size: 11px; }
  .session-month__session-card .badge { flex: 0 0 auto; max-width: 92px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .session-month__body--list .session-month__session-time { min-width: 112px; }
}

@media (max-width: 359.98px) {
  .session-month__nav { width: 36px; min-width: 36px; }
  .session-month__today { padding-inline: 6px; }
  .session-month__body { padding-inline: 8px; }
  .session-month__day { min-height: 48px; }
  .session-month__date-button { gap: 0; font-size: 11px; }
  .session-month__day-count { font-size: 8px; }
}
</style>
