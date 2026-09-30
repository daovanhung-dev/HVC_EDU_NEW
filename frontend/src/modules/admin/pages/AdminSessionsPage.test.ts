import { mount, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminSessionsPage from './AdminSessionsPage.vue'

const mockGetMySessions = vi.hoisted(() => vi.fn())
const mockGetSessionStudents = vi.hoisted(() => vi.fn())
const mockUpdateSessionOccurrence = vi.hoisted(() => vi.fn())

vi.mock('@/services/data-queries', () => ({
  getMySessions: mockGetMySessions,
  getSessionStudents: mockGetSessionStudents,
}))

vi.mock('@/services/commands', () => ({
  updateSessionOccurrence: mockUpdateSessionOccurrence,
}))

describe('AdminSessionsPage', () => {
  beforeEach(() => {
    mockGetMySessions.mockResolvedValue([])
    mockGetSessionStudents.mockResolvedValue([])
    mockUpdateSessionOccurrence.mockResolvedValue(undefined)
  })

  it('links admins to class scheduling', () => {
    const wrapper = mount(AdminSessionsPage, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    })

    const scheduleLink = wrapper.findComponent(RouterLinkStub)
    expect(scheduleLink.exists()).toBe(true)
    expect(scheduleLink.props('to')).toBe('/admin/classes')
    expect(scheduleLink.text()).toBe('Xếp lịch lớp')
  })
})
