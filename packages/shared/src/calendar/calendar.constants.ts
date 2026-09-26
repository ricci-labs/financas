export const WEEKEND_RULES = ['keep', 'previous_business_day', 'next_business_day'] as const

export type WeekendRule = (typeof WEEKEND_RULES)[number]

export const NATIONAL_HOLIDAY_KEYS = [
  'new_year',
  'carnival_monday',
  'carnival_tuesday',
  'good_friday',
  'tiradentes',
  'labour_day',
  'corpus_christi',
  'independence_day',
  'our_lady_aparecida',
  'all_souls_day',
  'republic_day',
  'black_consciousness_day',
  'christmas',
] as const

export type NationalHolidayKey = (typeof NATIONAL_HOLIDAY_KEYS)[number]

export const FIRST_YEAR_OF_BLACK_CONSCIOUSNESS_HOLIDAY = 2024
