<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { updateMyStaffProfile } from '@/services/commands'
import { getMyStaff } from '@/services/data-queries'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const form = ref({ full_name: '', phone: '', email: '', address: '' })

onMounted(async () => {
  loading.value = true
  try {
    const staff: any = await getMyStaff()
    if (!staff) { errorMessage.value = 'Không tìm thấy hồ sơ giáo viên.'; return }
    form.value = { full_name: staff.full_name || '', phone: staff.phone || '', email: staff.email || '', address: staff.address || '' }
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải thông tin cá nhân.' }
  finally { loading.value = false }
})

async function save() {
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await updateMyStaffProfile(form.value)
    await auth.refreshProfile()
    successMessage.value = 'Đã cập nhật thông tin cá nhân.'
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể cập nhật thông tin cá nhân.' }
}
</script>

<template>
  <div class="mb-4"><div class="small text-secondary">Tài khoản giáo viên</div><h1 class="h3 mb-0">Thông tin cá nhân</h1></div>
  <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div><div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
  <div class="card border-0 shadow-sm"><div class="card-body"><div class="row g-3"><div class="col-md-6"><label class="form-label">Họ tên</label><input v-model="form.full_name" class="form-control" /></div><div class="col-md-6"><label class="form-label">Điện thoại</label><input v-model="form.phone" class="form-control" /></div><div class="col-md-6"><label class="form-label">Email</label><input v-model="form.email" type="email" class="form-control" /></div><div class="col-12"><label class="form-label">Địa chỉ</label><input v-model="form.address" class="form-control" /></div></div><button class="btn btn-primary mt-3" :disabled="loading || !form.full_name.trim()" @click="save">Lưu thông tin</button></div></div>
</template>
