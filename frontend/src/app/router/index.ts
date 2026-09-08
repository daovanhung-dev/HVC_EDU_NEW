import { createRouter, createWebHashHistory } from 'vue-router'
import AuthLayout from '@/app/layouts/AuthLayout.vue'
import AppLayout from '@/app/layouts/AppLayout.vue'
import LoginPage from '@/modules/auth/pages/LoginPage.vue'
import ChangePasswordPage from '@/modules/auth/pages/ChangePasswordPage.vue'
import DashboardPage from '@/modules/dashboard/pages/DashboardPage.vue'
import StudentsPage from '@/modules/admin/pages/StudentsPage.vue'
import StaffPage from '@/modules/admin/pages/StaffPage.vue'
import ClassesPage from '@/modules/admin/pages/ClassesPage.vue'
import ClassMonthsPage from '@/modules/admin/pages/ClassMonthsPage.vue'
import SessionsPage from '@/modules/staff/pages/SessionsPage.vue'
import FinancePage from '@/modules/admin/pages/FinancePage.vue'
import StudentPage from '@/modules/student/pages/StudentPage.vue'
import TimesheetsPage from '@/modules/staff/pages/TimesheetsPage.vue'
import PayrollPage from '@/modules/staff/pages/PayrollPage.vue'
import ReportsPage from '@/modules/admin/pages/ReportsPage.vue'
import AuditPage from '@/modules/admin/pages/AuditPage.vue'
import AdminSessionsPage from '@/modules/admin/pages/AdminSessionsPage.vue'
import PermissionsPage from '@/modules/admin/pages/PermissionsPage.vue'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissionStore } from '@/stores/permission.store'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/auth', component: AuthLayout, children: [
      { path: 'change-password', name: 'change-password', component: ChangePasswordPage, meta: { requiresAuth: true } },
    ] },
    { path: '/login', component: AuthLayout, children: [{ path: '', name: 'login', component: LoginPage }] },
    { path: '/dashboard', component: AppLayout, children: [{ path: '', component: DashboardPage, meta: { requiresAuth: true } }] },
    { path: '/admin/students', component: AppLayout, children: [{ path: '', component: StudentsPage, meta: { requiresAuth: true, adminOnly: true, permission: 'STUDENTS_VIEW' } }] },
    { path: '/admin/staff', component: AppLayout, children: [{ path: '', component: StaffPage, meta: { requiresAuth: true, adminOnly: true, permission: 'STAFF_VIEW' } }] },
    { path: '/admin/classes', component: AppLayout, children: [{ path: '', component: ClassesPage, meta: { requiresAuth: true, adminOnly: true, permission: 'CLASS_VIEW' } }] },
    { path: '/admin/class-months', component: AppLayout, children: [{ path: '', component: ClassMonthsPage, meta: { requiresAuth: true, adminOnly: true, permission: 'CLASS_MONTH_MANAGE' } }] },
    { path: '/admin/sessions', component: AppLayout, children: [{ path: '', component: AdminSessionsPage, meta: { requiresAuth: true, adminOnly: true, permission: 'CLASS_MONTH_MANAGE' } }] },
    { path: '/admin/finance', component: AppLayout, children: [{ path: '', component: FinancePage, meta: { requiresAuth: true, adminOnly: true, permission: 'ACCOUNTING_VIEW' } }] },
    { path: '/admin/reports', component: AppLayout, children: [{ path: '', component: ReportsPage, meta: { requiresAuth: true, adminOnly: true, permission: 'REPORTS_VIEW' } }] },
    { path: '/admin/audit', component: AppLayout, children: [{ path: '', component: AuditPage, meta: { requiresAuth: true, adminOnly: true, permission: 'REPORTS_VIEW' } }] },
    { path: '/admin/permissions', component: AppLayout, children: [{ path: '', component: PermissionsPage, meta: { requiresAuth: true, adminOnly: true, rootOnly: true } }] },
    { path: '/admin/timesheets', component: AppLayout, children: [{ path: '', component: TimesheetsPage, meta: { requiresAuth: true, adminOnly: true, permission: 'TIMESHEET_VIEW' } }] },
    { path: '/admin/payroll', component: AppLayout, children: [{ path: '', component: PayrollPage, meta: { requiresAuth: true, adminOnly: true, permission: 'PAYROLL_VIEW' } }] },
    { path: '/staff/sessions', component: AppLayout, children: [{ path: '', component: SessionsPage, meta: { requiresAuth: true, staffOnly: true, permission: 'ACADEMIC_VIEW' } }] },
    { path: '/staff/timesheets', component: AppLayout, children: [{ path: '', component: TimesheetsPage, meta: { requiresAuth: true, staffOnly: true, permission: 'TIMESHEET_VIEW' } }] },
    { path: '/staff/payroll', component: AppLayout, children: [{ path: '', component: PayrollPage, meta: { requiresAuth: true, staffOnly: true, permission: 'PAYROLL_VIEW' } }] },
    { path: '/student/:module(schedule|tuition|attendance)', component: AppLayout, children: [{ path: '', component: StudentPage, meta: { requiresAuth: true, studentOnly: true } }] },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const permissions = usePermissionStore()
  if (!auth.initialized) await auth.initialize()
  if (to.meta.requiresAuth && !auth.isAuthenticated) return '/login'
  if (to.name === 'login' && auth.isAuthenticated) return '/dashboard'
  if (auth.isAuthenticated) await permissions.load()
  if (auth.isAuthenticated && auth.forcePasswordChange && to.name !== 'change-password') return '/auth/change-password'
  if (to.meta.adminOnly && !auth.isAdmin) return '/dashboard'
  if (to.meta.rootOnly && auth.role !== 'ROOT_ADMIN') return '/dashboard'
  if (to.meta.staffOnly && !auth.isStaff) return '/dashboard'
  if (to.meta.studentOnly && !auth.isStudent) return '/dashboard'
  if (to.meta.permission && !permissions.can(String(to.meta.permission))) return '/dashboard'
  return true
})

export default router
