import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TeacherPicker from './TeacherPicker.vue'

const teachers = [
  { id: 'qa-teacher-1', staff_code: 'QA-T-001', full_name: 'QA Giáo viên An' },
  { id: 'qa-teacher-2', staff_code: 'QA-T-002', full_name: 'QA Giáo viên Bình' },
]

describe('TeacherPicker', () => {
  it('filters by teacher name or staff code and emits multiple selections', async () => {
    const wrapper = mount(TeacherPicker, {
      props: { id: 'qa-teachers', modelValue: [], teachers, multiple: true },
    })
    const search = wrapper.get('#qa-teachers')
    await search.trigger('focus')
    await search.setValue('giao vien binh')

    expect(wrapper.findAll('.teacher-picker__option')).toHaveLength(1)
    expect(wrapper.text()).toContain('QA Giáo viên Bình')
    await search.setValue('qa-t-002')

    expect(wrapper.findAll('.teacher-picker__option')).toHaveLength(1)
    expect(wrapper.text()).toContain('QA Giáo viên Bình')
    await wrapper.get('#qa-teachers-option-qa-teacher-2').setValue(true)

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['qa-teacher-2']])
  })

  it('shows selected teachers as removable chips and disables choices at the limit', async () => {
    const wrapper = mount(TeacherPicker, {
      props: {
        id: 'qa-teachers',
        modelValue: ['qa-teacher-1'],
        teachers,
        multiple: true,
        disabledIds: ['qa-teacher-2'],
      },
    })
    expect(wrapper.text()).toContain('QA-T-001')
    await wrapper.get('#qa-teachers').trigger('focus')
    expect((wrapper.get('#qa-teachers-option-qa-teacher-2').element as HTMLInputElement).disabled).toBe(true)
    await wrapper.get('button[aria-label="Bỏ chọn QA Giáo viên An"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[]])
  })

  it('supports single selection and keyboard focus into the results', async () => {
    const wrapper = mount(TeacherPicker, {
      attachTo: document.body,
      props: { id: 'qa-teacher', modelValue: '', teachers },
    })
    const search = wrapper.get('#qa-teacher')
    await search.trigger('focus')
    await search.trigger('keydown', { key: 'Enter' })

    expect(document.activeElement).toBe(wrapper.get('[data-teacher-option]').element)
    await wrapper.get('[data-teacher-option]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('.teacher-picker__options').exists()).toBe(false)
    expect(document.activeElement).toBe(search.element)

    await search.setValue('an')
    expect(wrapper.find('.teacher-picker__options').exists()).toBe(true)
    await wrapper.get('#qa-teacher-option-qa-teacher-1').setValue(true)

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['qa-teacher-1'])
    expect(wrapper.find('.teacher-picker__options').exists()).toBe(false)
    wrapper.unmount()
  })
})
