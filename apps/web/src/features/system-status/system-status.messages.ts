export const systemStatusMessages = {
  checking: 'Verificando API…',
  online: (version: string) => `API online · ${version}`,
  offline: 'API offline',
} as const
