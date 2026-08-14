import type {
  BaseRecord,
  CreateParams,
  DataProvider,
  DeleteOneParams,
  GetListParams,
  UpdateParams,
} from '@refinedev/core'
import {
  createService,
  deleteService,
  listServicesResource,
  toggleServiceActive,
  updateService,
  type ServiceActionState,
} from '@/lib/admin/actions'

const RESOURCE = 'services'

function fail(message: string, statusCode: number): never {
  throw Object.assign(new Error(message), { statusCode })
}

function requireResource(resource: string): void {
  if (resource !== RESOURCE) fail('Resursen är inte tillåten.', 403)
}

function requireRecord<TData extends BaseRecord>(state: ServiceActionState): TData {
  if (state.error) fail(state.error, 400)
  if (!state.record) fail('Något gick fel. Försök igen.', 500)
  return state.record as unknown as TData
}

function serviceFormData(values: unknown, id?: string): FormData {
  const fields = values && typeof values === 'object' ? (values as Record<string, unknown>) : {}
  const formData = new FormData()
  if (id) formData.set('id', id)
  formData.set('name', String(fields.name ?? ''))
  formData.set('category', String(fields.category ?? ''))
  formData.set('duration_min', String(fields.duration_min ?? ''))
  formData.set('price', String(fields.price ?? ''))
  return formData
}

function isToggle(values: unknown): values is { active: boolean } {
  if (!values || typeof values !== 'object') return false
  const keys = Object.keys(values)
  return (
    keys.length === 1 &&
    keys[0] === 'active' &&
    typeof (values as { active?: unknown }).active === 'boolean'
  )
}

async function getList<TData extends BaseRecord = BaseRecord>({ resource }: GetListParams) {
  requireResource(resource)
  const result = await listServicesResource()
  if (result.error) fail(result.error, 400)
  const data = (result.records ?? []) as unknown as TData[]
  return { data, total: data.length }
}

async function create<TData extends BaseRecord = BaseRecord, TVariables = {}>({
  resource,
  variables,
}: CreateParams<TVariables>) {
  requireResource(resource)
  const state = await createService({}, serviceFormData(variables))
  return { data: requireRecord<TData>(state) }
}

async function update<TData extends BaseRecord = BaseRecord, TVariables = {}>({
  resource,
  id,
  variables,
}: UpdateParams<TVariables>) {
  requireResource(resource)
  let state: ServiceActionState
  if (isToggle(variables)) {
    const formData = new FormData()
    formData.set('id', String(id))
    formData.set('active', String(variables.active))
    state = await toggleServiceActive({}, formData)
  } else {
    state = await updateService({}, serviceFormData(variables, String(id)))
  }
  return { data: requireRecord<TData>(state) }
}

async function deleteOne<TData extends BaseRecord = BaseRecord, TVariables = {}>({
  resource,
  id,
}: DeleteOneParams<TVariables>) {
  requireResource(resource)
  const formData = new FormData()
  formData.set('id', String(id))
  return { data: requireRecord<TData>(await deleteService({}, formData)) }
}

export const corevoDataProvider: DataProvider = {
  getList,
  getOne: async ({ resource }) => {
    requireResource(resource)
    return fail('Operationen är inte tillåten.', 405)
  },
  create,
  update,
  deleteOne,
  getApiUrl: () => '',
}
