export const formMessages = {
  required: 'Preencha este campo.',
  tooShort: (minimum: number) => `Use pelo menos ${minimum} caracteres.`,
  tooLong: (maximum: number) => `Use no máximo ${maximum} caracteres.`,
  email: 'Informe um e-mail válido, como nome@exemplo.com.',
  invalid: 'Confira o valor deste campo.',
  requiredMark: '*',
} as const
