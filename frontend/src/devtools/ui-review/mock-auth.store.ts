import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type ReviewRole = 'ADMIN' | 'TEACHER' | 'STUDENT'

export const useAuthStore = defineStore('review-auth', () => {
  const reviewParams = new URLSearchParams(window.location.search)
  const requestedRole = reviewParams.get('role')
  const role = ref<ReviewRole>(requestedRole === 'STUDENT' || requestedRole === 'TEACHER' ? requestedRole : 'ADMIN')
  const forcePasswordChange = ref(['STUDENT', 'TEACHER'].includes(role.value) && reviewParams.get('forcePasswordChange') === 'true')
  const loading = ref(false)
  const displayName = ref('Tài khoản QA')
  const username = ref('qa-review')
  const isAdmin = computed(() => role.value === 'ADMIN')
  const isTeacher = computed(() => role.value === 'TEACHER')
  const isStudent = computed(() => role.value === 'STUDENT')
  const isStaff = computed(() => isTeacher.value)
  const isLearner = computed(() => role.value === 'STUDENT')
  const isAuthenticated = computed(() => true)
  async function login() { role.value = 'ADMIN' }
  async function signOut() { role.value = 'ADMIN' }
  async function updatePassword() { forcePasswordChange.value = false }
  async function refreshProfile() {}
  function setRole(value: ReviewRole) { role.value = value; if (!['STUDENT', 'TEACHER'].includes(value)) forcePasswordChange.value = false }
  async function initialize() {}
  return { role, loading, displayName, username, isAdmin, isTeacher, isStaff, isStudent, forcePasswordChange, isLearner, isAuthenticated, login, signOut, updatePassword, refreshProfile, setRole, initialize }
})
