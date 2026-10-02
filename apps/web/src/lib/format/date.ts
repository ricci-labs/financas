const DEFAULT_TIME_ZONE = 'America/Sao_Paulo'

export function formatDay(instant: string, timeZone = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(instant))
}
