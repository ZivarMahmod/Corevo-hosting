import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  toggle: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@/lib/admin/actions', () => ({
  listServicesResource: mocks.list,
  createService: mocks.create,
  updateService: mocks.update,
  toggleServiceActive: mocks.toggle,
  deleteService: mocks.remove,
}))

import { corevoDataProvider } from './corevo-data-provider'

const record = { id: 'service-1', name: 'Klippning' }
const values = { name: 'Klippning', category: 'Hår', duration_min: 30, price: '450' }

describe('Corevo services data provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.list.mockResolvedValue({ records: [record] })
    mocks.create.mockResolvedValue({ record })
    mocks.update.mockResolvedValue({ record })
    mocks.toggle.mockResolvedValue({ record: { ...record, active: false } })
    mocks.remove.mockResolvedValue({ record })
  })

  it('reads the canonical server resource without accepting a tenant id', async () => {
    await expect(corevoDataProvider.getList({ resource: 'services' })).resolves.toEqual({
      data: [record],
      total: 1,
    })
    expect(mocks.list).toHaveBeenCalledWith()
  })

  it('maps create, edit, toggle and delete to the existing server actions', async () => {
    await corevoDataProvider.create({ resource: 'services', variables: values })
    expect(mocks.create.mock.calls[0]?.[1].get('name')).toBe('Klippning')

    await corevoDataProvider.update({ resource: 'services', id: record.id, variables: values })
    expect(mocks.update.mock.calls[0]?.[1].get('id')).toBe(record.id)

    await corevoDataProvider.update({
      resource: 'services',
      id: record.id,
      variables: { active: false },
    })
    expect(mocks.toggle.mock.calls[0]?.[1].get('active')).toBe('false')

    await corevoDataProvider.update({
      resource: 'services',
      id: record.id,
      variables: { ...values, active: false },
    })
    expect(mocks.update).toHaveBeenCalledTimes(2)
    expect(mocks.toggle).toHaveBeenCalledTimes(1)

    await corevoDataProvider.deleteOne({ resource: 'services', id: record.id })
    expect(mocks.remove.mock.calls[0]?.[1].get('id')).toBe(record.id)
  })

  it('fails closed for unknown resources, unsupported operations and server errors', async () => {
    await expect(corevoDataProvider.getList({ resource: 'staff' })).rejects.toMatchObject({
      statusCode: 403,
    })
    await expect(
      corevoDataProvider.getOne({ resource: 'services', id: record.id }),
    ).rejects.toMatchObject({
      statusCode: 405,
    })

    mocks.create.mockResolvedValueOnce({ error: 'Ange ett giltigt pris större än 0 kr.' })
    await expect(
      corevoDataProvider.create({ resource: 'services', variables: values }),
    ).rejects.toThrow('Ange ett giltigt pris')
  })
})
