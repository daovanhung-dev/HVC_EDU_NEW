import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/services/supabase'
import { useAuthStore } from './auth.store'

export const usePermissionStore = defineStore('permission', () => {
  const auth = useAuthStore()
  const codes = ref<string[]>([])
  const loaded = ref(false)
  const can = (code: string) => auth.role === 'ROOT_ADMIN' || codes.value.includes(code)
  const canAny = (values: string[]) => values.some(can)
  const hasPermissions = computed(() => codes.value.length > 0 || auth.role === 'ROOT_ADMIN')

  async function load() {
    if (loaded.value || !auth.user) return
    const { data } = await supabase.from('admin_permission_groups').select('permission_groups(permission_group_permissions(permissions(code)))').eq('user_id', auth.user.id)
    codes.value = (data || []).flatMap((row: any) => (row.permission_groups?.permission_group_permissions || []).map((item: any) => item.permissions?.code).filter(Boolean))
    loaded.value = true
  }

  function clear() {
    codes.value = []
    loaded.value = false
  }

  return { codes, loaded, hasPermissions, can, canAny, load, clear }
})
