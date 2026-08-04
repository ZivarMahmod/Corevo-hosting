export type CalendarStaff = {
  id: string
  name: string
  start: string | null
  end: string | null
  color: string
  workedMinutes: number
  serviceIds: string[]
  locationIds: string[]
}

export type CalendarBlock = {
  id: string
  staffId: string
  startTs: string
  endTs: string
  reason: string
  seriesId: string | null
}
