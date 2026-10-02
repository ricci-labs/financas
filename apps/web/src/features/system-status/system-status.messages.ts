export const systemStatusMessages = {
  productName: 'Twise',
  slogan: 'Leve, claro, a dois.',
  checking: 'Verificando API…',
  online: (version: string) => `API online · ${version}`,
  offline: 'API offline',
} as const
