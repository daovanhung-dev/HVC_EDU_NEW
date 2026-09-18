import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/services/supabase'
import { useAuthStore } from './auth.store'

import type { RealtimeChannel } from '@supabase/supabase-js'
import type { NotificationRow } from '@/shared/types/domain'
import { useAppErrorStore } from './app-error.store'

export const useNotificationStore = defineStore('notifications', () => {
  const auth = useAuthStore()
  const appErrors = useAppErrorStore()
  const items = ref<NotificationRow[]>([])
  let channel: RealtimeChannel | null = null
  const unreadCount = computed(() => items.value.filter((item) => !item.read_at).length)

  async function refresh() {
    if (!auth.user) return
    try {
      const { data, error } = await supabase.from('notifications').select('id,title,body,data,read_at,created_at').eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(20)
      if (error) throw error
      items.value = data || []
    } catch (error) {
      appErrors.report(error, 'Không thể tải thông báo. Vui lòng thử lại sau.')
    }
  }

  async function markRead(id: string) {
    try {
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', auth.user?.id || '')
      if (error) throw error
      const item = items.value.find((row) => row.id === id)
      if (item) item.read_at = new Date().toISOString()
    } catch (error) {
      appErrors.report(error, 'Không thể cập nhật thông báo.')
    }
  }

  async function markAllRead() {
    if (!auth.user) return
    try {
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', auth.user.id).is('read_at', null)
      if (error) throw error
      items.value = items.value.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() }))
    } catch (error) {
      appErrors.report(error, 'Không thể đánh dấu đã đọc thông báo.')
    }
  }

  function subscribe() {
    if (!auth.user || channel) return
    channel = supabase.channel(`notifications:${auth.user.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${auth.user.id}` }, (payload) => {
      items.value = [payload.new as NotificationRow, ...items.value].slice(0, 50)
    }).subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        appErrors.report(new Error(status), 'Không thể kết nối thông báo realtime.')
      }
    })
  }

  function unsubscribe() {
    if (channel) void supabase.removeChannel(channel)
    channel = null
  }

  return { items, unreadCount, refresh, markRead, markAllRead, subscribe, unsubscribe }
})
