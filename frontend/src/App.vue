<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppErrorBanner from '@/app/components/AppErrorBanner.vue'
import AppToastHost from '@/app/components/AppToastHost.vue'

let tableObserver: MutationObserver | undefined

function labelResponsiveTables(root: ParentNode = document) {
  const tables = new Set(root.querySelectorAll<HTMLTableElement>('.table-responsive table:not(.calendar-grid):not([data-table-scroll])'))
  if (root instanceof Element) {
    const parentTable = root.closest<HTMLTableElement>('.table-responsive table:not(.calendar-grid):not([data-table-scroll])')
    if (parentTable) tables.add(parentTable)
  }
  tables.forEach((table) => {
    const headers = Array.from(table.querySelectorAll('thead th')).map((header) => header.textContent?.trim() || '')
    table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => {
      Array.from(row.cells).forEach((cell, index) => {
        if (cell.hasAttribute('colspan')) return
        if (headers[index] && cell.dataset.label !== headers[index]) cell.dataset.label = headers[index]
      })
    })
  })
}

onMounted(() => {
  labelResponsiveTables()
  tableObserver = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node instanceof HTMLElement) labelResponsiveTables(node)
    }))
  })
  tableObserver.observe(document.querySelector('#app') || document.body, { childList: true, subtree: true })
})
onBeforeUnmount(() => tableObserver?.disconnect())
</script>

<template>
  <AppErrorBanner />
  <RouterView />
  <AppToastHost />
</template>
