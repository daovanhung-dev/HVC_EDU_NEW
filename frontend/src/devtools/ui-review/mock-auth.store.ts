import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type ReviewRole = 'ADMIN' | 'TEACHER' | 'STUDENT'

export const useAuthStore = defineStore('review-auth', () => {
  const role = ref<ReviewRole>('ADMIN')
  const loading = ref(false)
  const displayName = ref('Tài khoản QA')
  const username = ref('qa-review')
  const isAdmin = computed(() => role.value === 'ADMIN')
  const isTeacher = computed(() => role.value === 'TEACHER')
  const isStaff = computed(() => isTeacher.value)
  const isLearner = computed(() => role.value === 'STUDENT')
  const isAuthenticated = computed(() => true)
  async function login() { role.value = 'ADMIN' }
  async function signOut() { role.value = 'ADMIN' }
  async function updatePassword() {}
  async function refreshProfile() {}
  function setRole(value: ReviewRole) { role.value = value }
  async function initialize() {}
  return { role, loading, displayName, username, isAdmin, isTeacher, isStaff, isLearner, isAuthenticated, login, signOut, updatePassword, refreshProfile, setRole, initialize }
})
