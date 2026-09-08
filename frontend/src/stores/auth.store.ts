import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/services/supabase'
import { invokeFunction } from '@/services/edge-functions'
import type { Profile } from '@/shared/types/domain'
import type { Role } from '@/shared/constants/roles'

interface LoginResult {
  session: Session | null
  profile: Profile
}

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const profile = ref<Profile | null>(null)
  const initialized = ref(false)
  const loading = ref(false)

  const isAuthenticated = computed(() => Boolean(session.value && user.value && profile.value))
  const role = computed<Role | null>(() => profile.value?.role || null)
  const username = computed(() => profile.value?.username || null)
  const displayName = computed(() => profile.value?.display_name || null)
  const forcePasswordChange = computed(() => profile.value?.force_password_change ?? false)
  const isAdmin = computed(() => role.value === 'ROOT_ADMIN' || role.value === 'ADMIN')
  const isStaff = computed(() => role.value === 'TEACHER' || role.value === 'ASSISTANT')
  const isTeacher = computed(() => role.value === 'TEACHER')
  const isAssistant = computed(() => role.value === 'ASSISTANT')
  const isStudent = computed(() => role.value === 'STUDENT')

  async function hydrate(currentSession: Session | null) {
    session.value = currentSession
    user.value = currentSession?.user || null
    profile.value = null
    if (currentSession?.user) {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', currentSession.user.id).maybeSingle()
      profile.value = data as Profile | null
    }
  }

  async function initialize() {
    if (initialized.value) return
    loading.value = true
    try {
      if (!isSupabaseConfigured) return
      const { data } = await supabase.auth.getSession()
      await hydrate(data.session)
      supabase.auth.onAuthStateChange((_event, nextSession) => {
        void hydrate(nextSession)
      })
    } finally {
      initialized.value = true
      loading.value = false
    }
  }

  async function login(identifier: string, password: string) {
    loading.value = true
    try {
      const result = await invokeFunction<{ identifier: string; password: string }, LoginResult>('login-by-identifier', { identifier, password })
      if (result.session) await supabase.auth.setSession({ access_token: result.session.access_token, refresh_token: result.session.refresh_token })
      await hydrate(result.session)
    } finally {
      loading.value = false
    }
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    if (profile.value) {
      profile.value = { ...profile.value, force_password_change: false }
      const { error: profileError } = await supabase.rpc('clear_force_password_change')
      if (profileError) throw profileError
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    session.value = null
    user.value = null
    profile.value = null
  }

  return {
    session, user, profile, initialized, loading, isAuthenticated, role, username, displayName,
    forcePasswordChange, isAdmin, isStaff, isTeacher, isAssistant, isStudent,
    initialize, login, updatePassword, signOut,
  }
})
