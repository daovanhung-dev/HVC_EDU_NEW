<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { updateMyStaffProfile } from '@/services/commands'
import { getMyStaff } from '@/services/data-queries'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import AppPageHeader from '@/app/components/AppPageHeader.vue'
import AppState from '@/app/components/AppState.vue'

const auth = useAuthStore()
const toast = useToastStore()
const loading = ref(false)
const loaded = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const form = ref({ full_name: '', phone: '', email: '', address: '' })

async function load() {
  loading.value = true
  loaded.value = false
  errorMessage.value = ''
  try {
    const staff: any = await getMyStaff()
    if (!staff) throw new Error('Không tìm thấy hồ sơ giáo viên.')
    form.value = { full_name: staff.full_name || '', phone: staff.phone || '', email: staff.email || '', address: staff.address || '' }
    loaded.value = true
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể tải thông tin cá nhân.' }
  finally { loading.value = false }
}

onMounted(load)

async function save() {
  if (saving.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    await updateMyStaffProfile(form.value)
    await auth.refreshProfile()
    toast.success('Đã cập nhật thông tin cá nhân.')
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Không thể cập nhật thông tin cá nhân.' }
  finally { saving.value = false }
}
</script>

<template>
  <AppPageHeader title="Thông tin cá nhân" eyebrow="Hồ sơ giáo viên" description="Cập nhật thông tin liên hệ của bạn.">
    <template #actions><button class="btn btn-outline-primary" type="button" :disabled="loading" @click="load">Làm mới</button></template>
  </AppPageHeader>
  <AppState v-if="loading" kind="loading" title="Đang tải hồ sơ" />
  <AppState v-else-if="!loaded" kind="error" title="Không thể tải hồ sơ giáo viên" :message="errorMessage"><button class="btn btn-outline-primary" type="button" @click="load">Thử tải lại</button></AppState>
  <section v-else class="card"><form class="card-body" @submit.prevent="save"><div v-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }}</div><div class="row g-3"><div class="col-md-6"><label class="form-label" for="profile-full-name">Họ tên</label><input id="profile-full-name" v-model="form.full_name" class="form-control" autocomplete="name" required /></div><div class="col-md-6"><label class="form-label" for="profile-phone">Điện thoại</label><input id="profile-phone" v-model="form.phone" class="form-control" inputmode="tel" autocomplete="tel" /></div><div class="col-md-6"><label class="form-label" for="profile-email">Email</label><input id="profile-email" v-model="form.email" type="email" class="form-control" autocomplete="email" /></div><div class="col-12"><label class="form-label" for="profile-address">Địa chỉ</label><input id="profile-address" v-model="form.address" class="form-control" autocomplete="street-address" /></div></div><button class="btn btn-primary mt-3" type="submit" :disabled="saving || !form.full_name.trim()"><span v-if="saving" class="app-button__spinner" aria-hidden="true"></span>{{ saving ? 'Đang lưu…' : 'Lưu thông tin' }}</button></form></section>
</template>
