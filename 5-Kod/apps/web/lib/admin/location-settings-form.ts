export type LocationBookingHourInput = {
  weekday: number
  start_time: string
  end_time: string
}

export type ParsedLocationBookingSettings = {
  locationId: string
  hours: LocationBookingHourInput[]
  slotStepMin: number
  minNoticeMin: number
  maxAdvanceDays: number
}

export type LocationSettingsRpc = {
  rpc(
    fn: 'save_location_booking_settings',
    args: {
      p_location: string
      p_hours: LocationBookingHourInput[]
      p_slot_step_min: number
      p_min_notice_min: number
      p_max_advance_days: number
    },
  ): Promise<{ error: { message: string; code?: string } | null }>
}

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/

export function parseLocationBookingSettings(fd: FormData): { error: string } | ParsedLocationBookingSettings {
  const locationId = String(fd.get('location_id') ?? '')
  if (!locationId) return { error: 'Välj vilken plats tiderna gäller.' }

  const weekdays = fd.getAll('weekday').map(Number)
  const starts = fd.getAll('start_time').map(String)
  const ends = fd.getAll('end_time').map(String)
  if (weekdays.length !== starts.length || weekdays.length !== ends.length || weekdays.length > 28) {
    return { error: 'Kontrollera veckans öppettider och försök igen.' }
  }

  const hours = weekdays
    .map((weekday, index) => ({ weekday, start_time: starts[index] ?? '', end_time: ends[index] ?? '' }))
    .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))
  if (hours.length === 0) return { error: 'Lägg in minst ett öppet pass innan tiderna kan bekräftas.' }

  for (let index = 0; index < hours.length; index += 1) {
    const row = hours[index]!
    if (!Number.isInteger(row.weekday) || row.weekday < 0 || row.weekday > 6 || !TIME_RE.test(row.start_time) || !TIME_RE.test(row.end_time) || row.end_time <= row.start_time) {
      return { error: 'Varje öppet pass måste ha en giltig start- och sluttid.' }
    }
    const previous = hours[index - 1]
    if (previous?.weekday === row.weekday && row.start_time < previous.end_time) {
      return { error: 'Öppettider samma dag får inte överlappa varandra.' }
    }
  }

  const slotStepMin = Number(fd.get('slot_step_min'))
  const minNoticeMin = Number(fd.get('min_notice_min'))
  const maxAdvanceDays = Number(fd.get('max_advance_days'))
  if (!Number.isInteger(slotStepMin) || slotStepMin < 1 || slotStepMin > 240) return { error: 'Tidsintervallet måste vara mellan 1 och 240 minuter.' }
  if (!Number.isInteger(minNoticeMin) || minNoticeMin < 0 || minNoticeMin > 525_600) return { error: 'Framförhållningen måste vara mellan 0 och 525 600 minuter.' }
  if (!Number.isInteger(maxAdvanceDays) || maxAdvanceDays < 1 || maxAdvanceDays > 1095) return { error: 'Bokningshorisonten måste vara mellan 1 och 1 095 dagar.' }

  return { locationId, hours, slotStepMin, minNoticeMin, maxAdvanceDays }
}
