import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/services/supabase'
import { useAuthStore } from './auth.store'

import type { RealtimeChannel } from '@supabase/supabase-js'
import type { NotificationRow } from '@/shared/types/domain'

export const useNotificationStore = defineStore('notifications', () => {
  const auth = useAuthStore()
  const items = ref<NotificationRow[]>([])
  let channel: RealtimeChannel | null = null
  const unreadCount = computed(() => items.value.filter((item) => !item.read_at).length)

  async function refresh() {
    if (!auth.user) return
    const { data } = await supabase.from('notifications').select('id,title,body,data,read_at,created_at').eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(20)
    items.value = data || []
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', auth.user?.id || '')
    const item = items.value.find((row) => row.id === id)
    if (item) item.read_at = new Date().toISOString()
  }

  async function markAllRead() {
    if (!auth.user) return
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', auth.user.id).is('read_at', null)
    items.value = items.value.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() }))
  }

  function subscribe() {
    if (!auth.user || channel) return
    channel = supabase.channel(`notifications:${auth.user.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${auth.user.id}` }, (payload) => {
      items.value = [payload.new as NotificationRow, ...items.value].slice(0, 50)
    }).subscribe()
  }

  function unsubscribe() {
    if (channel) void supabase.removeChannel(channel)
    channel = null
  }

  return { items, unreadCount, refresh, markRead, markAllRead, subscribe, unsubscribe }
})
