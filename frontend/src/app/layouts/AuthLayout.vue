<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import logoUrl from '../../../../assets/logo.jpg'

const route = useRoute()
</script>

<template>
  <main class="auth-layout">
    <a class="skip-link" href="#auth-content">Bỏ qua phần giới thiệu</a>
    <div class="auth-layout__content" :class="{ 'auth-layout__content--wide': route.path === '/parent-feedback' }">
      <div class="auth-layout__brand">
        <img :src="logoUrl" alt="Logo Hùng Cường Education" />
        <h1>Hùng Cường Education</h1>
        <p>Không gian học tập và quản lý trung tâm</p>
      </div>
      <div id="auth-content">
        <RouterView v-slot="{ Component, route }">
          <Transition name="app" mode="out-in">
            <div :key="route.path" class="auth-route-view"><component :is="Component" /></div>
          </Transition>
        </RouterView>
      </div>
    </div>
  </main>
</template>
