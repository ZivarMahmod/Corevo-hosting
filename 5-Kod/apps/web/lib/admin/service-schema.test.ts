import { describe, expect, it } from 'vitest'
import { parseServiceFormData, serviceFormSchema, servicePriceCents } from './service-schema'

describe('service form schema', () => {
  it('normalizes valid service input and Swedish money', () => {
    expect(
      serviceFormSchema.parse({
        name: '  Klippning  ',
        category: '  Hår  ',
        duration_min: 30,
        price: ' 450,50 ',
      }),
    ).toEqual({ name: 'Klippning', category: 'Hår', duration_min: 30, price: '450,50' })
    expect(servicePriceCents('450,50')).toBe(45_050)
  })

  it.each([
    [{ name: '', category: '', duration_min: 30, price: '450' }, 'Ange ett namn.'],
    [{ name: 'Klippning', category: '', duration_min: 0, price: '450' }, 'varaktighet'],
    [{ name: 'Klippning', category: '', duration_min: 1.5, price: '450' }, 'varaktighet'],
    [{ name: 'Klippning', category: '', duration_min: 30, price: '0' }, 'pris'],
    [{ name: 'Klippning', category: '', duration_min: 30, price: '12,345' }, 'pris'],
  ])('rejects invalid values on both client and server schema paths', (values, message) => {
    const result = serviceFormSchema.safeParse(values)
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error.issues[0]?.message.toLowerCase()).toContain(message.toLowerCase())
  })

  it('parses FormData through the same schema', () => {
    const formData = new FormData()
    formData.set('name', 'Klippning')
    formData.set('category', 'Hår')
    formData.set('duration_min', '-1')
    formData.set('price', '450')
    const result = parseServiceFormData(formData)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0]?.message).toContain('varaktighet')
  })
})
