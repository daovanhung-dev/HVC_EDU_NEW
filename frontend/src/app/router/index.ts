import { createRouter, createWebHashHistory } from 'vue-router'
import AuthLayout from '@/app/layouts/AuthLayout.vue'
import AppLayout from '@/app/layouts/AppLayout.vue'
import LoginPage from '@/modules/auth/pages/LoginPage.vue'
import ChangePasswordPage from '@/modules/auth/pages/ChangePasswordPage.vue'
import StudentsPage from '@/modules/admin/pages/StudentsPage.vue'
import StudentDetailPage from '@/modules/admin/pages/StudentDetailPage.vue'
import StaffPage from '@/modules/admin/pages/StaffPage.vue'
import ClassesPage from '@/modules/admin/pages/ClassesPage.vue'
import ClassDetailPage from '@/modules/admin/pages/ClassDetailPage.vue'
import SessionsPage from '@/modules/admin/pages/AdminSessionsPage.vue'
import StaffSessionsPage from '@/modules/staff/pages/SessionsPage.vue'
import StaffProfilePage from '@/modules/staff/pages/StaffProfilePage.vue'
import StudentPage from '@/modules/student/pages/StudentPage.vue'
import StudentReviewPage from '@/modules/student/pages/StudentReviewPage.vue'
import StudentAiChatPage from '@/modules/student/pages/StudentAiChatPage.vue'
import StaffTimesheetsPage from '@/modules/staff/pages/StaffTimesheetsPage.vue'
import AdminTimesheetsPage from '@/modules/admin/pages/AdminTimesheetsPage.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useAppErrorStore } from '@/stores/app-error.store'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: AppLayout, children: [{ path: '', component: StudentsPage, meta: { requiresAuth: true, adminOnly: true } }] },
    { path: '/dashboard', redirect: '/' },
    { path: '/auth', component: AuthLayout, children: [{ path: 'change-password', name: 'change-password', component: ChangePasswordPage, meta: { requiresAuth: true } }] },
    { path: '/login', component: AuthLayout, children: [{ path: '', name: 'login', component: LoginPage }] },
    { path: '/admin/students', component: AppLayout, children: [{ path: '', component: StudentsPage, meta: { requiresAuth: true, adminOnly: true } }] },
    { path: '/admin/students/:studentId', component: AppLayout, children: [{ path: '', component: StudentDetailPage, meta: { requiresAuth: true, adminOnly: true } }] },
    { path: '/admin/staff', component: AppLayout, children: [{ path: '', component: StaffPage, meta: { requiresAuth: true, adminOnly: true } }] },
    { path: '/admin/classes', component: AppLayout, children: [{ path: '', component: ClassesPage, meta: { requiresAuth: true, adminOnly: true } }] },
    { path: '/admin/classes/:classId', component: AppLayout, children: [{ path: '', component: ClassDetailPage, meta: { requiresAuth: true, adminOnly: true } }] },
    { path: '/admin/sessions', component: AppLayout, children: [{ path: '', component: SessionsPage, meta: { requiresAuth: true, adminOnly: true } }] },
    { path: '/admin/timesheets', component: AppLayout, children: [{ path: '', component: AdminTimesheetsPage, meta: { requiresAuth: true, adminOnly: true } }] },
    { path: '/staff/sessions', component: AppLayout, children: [{ path: '', component: StaffSessionsPage, meta: { requiresAuth: true, staffOnly: true } }] },
    { path: '/staff/timesheets', component: AppLayout, children: [{ path: '', component: StaffTimesheetsPage, meta: { requiresAuth: true, staffOnly: true } }] },
    { path: '/staff/profile', component: AppLayout, children: [{ path: '', component: StaffProfilePage, meta: { requiresAuth: true, staffOnly: true } }] },
    { path: '/student/:module(schedule|attendance)', component: AppLayout, children: [{ path: '', component: StudentPage, meta: { requiresAuth: true, learnerOnly: true } }] },
    { path: '/student/review', component: AppLayout, children: [{ path: '', component: StudentReviewPage, meta: { requiresAuth: true, learnerOnly: true } }] },
    { path: '/student/ai', component: AppLayout, children: [{ path: '', component: StudentAiChatPage, meta: { requiresAuth: true, learnerOnly: true } }] },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

function landingPath(auth: ReturnType<typeof useAuthStore>) {
  if (auth.isAdmin) return '/admin/students'
  if (auth.isTeacher) return '/staff/sessions'
  if (auth.isLearner) return '/student/schedule'
  return '/login'
}

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const appErrors = useAppErrorStore()
  if (!auth.initialized) {
    try {
      await auth.initialize()
    } catch (error) {
      appErrors.report(error, 'Không thể khởi tạo phiên đăng nhập. Vui lòng thử lại sau.')
      return '/login'
    }
  }
  if ((to.path === '/' || to.path === '/dashboard') && auth.isAuthenticated) return landingPath(auth)
  if (to.meta.requiresAuth && !auth.isAuthenticated) return '/login'
  if (to.name === 'login' && auth.isAuthenticated) return landingPath(auth)
  if (to.meta.adminOnly && !auth.isAdmin) return landingPath(auth)
  if (to.meta.staffOnly && !auth.isStaff) return landingPath(auth)
  if (to.meta.learnerOnly && !auth.isLearner) return landingPath(auth)
  return true
})

router.onError((error) => {
  useAppErrorStore().report(error, 'Không thể mở chức năng. Vui lòng thử lại sau.')
})

export default router
