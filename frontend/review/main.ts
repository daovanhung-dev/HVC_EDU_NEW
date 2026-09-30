import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import '../src/styles.css'
import ReviewApp from '../src/devtools/ui-review/ReviewApp.vue'
import AuthLayout from '../src/app/layouts/AuthLayout.vue'
import AppLayout from '../src/app/layouts/AppLayout.vue'
import LoginPage from '../src/modules/auth/pages/LoginPage.vue'
import ChangePasswordPage from '../src/modules/auth/pages/ChangePasswordPage.vue'
import StudentsPage from '../src/modules/admin/pages/StudentsPage.vue'
import StudentDetailPage from '../src/modules/admin/pages/StudentDetailPage.vue'
import StaffPage from '../src/modules/admin/pages/StaffPage.vue'
import ClassesPage from '../src/modules/admin/pages/ClassesPage.vue'
import ClassDetailPage from '../src/modules/admin/pages/ClassDetailPage.vue'
import AdminSessionsPage from '../src/modules/admin/pages/AdminSessionsPage.vue'
import AdminTimesheetsPage from '../src/modules/admin/pages/AdminTimesheetsPage.vue'
import StaffSessionsPage from '../src/modules/staff/pages/SessionsPage.vue'
import StaffProfilePage from '../src/modules/staff/pages/StaffProfilePage.vue'
import StaffTimesheetsPage from '../src/modules/staff/pages/StaffTimesheetsPage.vue'
import StudentPage from '../src/modules/student/pages/StudentPage.vue'

const routes = [
  { path: '/login', component: AuthLayout, children: [{ path: '', component: LoginPage }] },
  { path: '/auth/change-password', component: AuthLayout, children: [{ path: '', component: ChangePasswordPage }] },
  { path: '/admin/students', component: AppLayout, children: [{ path: '', component: StudentsPage }] },
  { path: '/admin/students/:studentId', component: AppLayout, children: [{ path: '', component: StudentDetailPage }] },
  { path: '/admin/staff', component: AppLayout, children: [{ path: '', component: StaffPage }] },
  { path: '/admin/classes', component: AppLayout, children: [{ path: '', component: ClassesPage }] },
  { path: '/admin/classes/:classId', component: AppLayout, children: [{ path: '', component: ClassDetailPage }] },
  { path: '/admin/sessions', component: AppLayout, children: [{ path: '', component: AdminSessionsPage }] },
  { path: '/admin/timesheets', component: AppLayout, children: [{ path: '', component: AdminTimesheetsPage }] },
  { path: '/staff/sessions', component: AppLayout, children: [{ path: '', component: StaffSessionsPage }] },
  { path: '/staff/profile', component: AppLayout, children: [{ path: '', component: StaffProfilePage }] },
  { path: '/staff/timesheets', component: AppLayout, children: [{ path: '', component: StaffTimesheetsPage }] },
  { path: '/student/schedule', component: AppLayout, children: [{ path: '', component: StudentPage, props: { module: 'schedule' } }] },
  { path: '/student/attendance', component: AppLayout, children: [{ path: '', component: StudentPage, props: { module: 'attendance' } }] },
  { path: '/:pathMatch(.*)*', redirect: '/admin/students' },
]

const router = createRouter({ history: createWebHashHistory(), routes })
createApp(ReviewApp).use(createPinia()).use(router).mount('#app')
