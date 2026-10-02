import { formatMinutesAndSeconds, formatSeconds } from '@web/lib/format/countdown'

export const authMessages = {
  login: {
    title: 'Entrar no Twise',
    subtitle: 'Bom te ver de novo! Vamos ver como anda o mês?',
    email: 'E-mail',
    emailPlaceholder: 'nome@exemplo.com',
    password: 'Senha',
    required: { email: 'Informe seu e-mail.', password: 'Informe sua senha.' },
    submit: 'Entrar',
    submitting: 'Entrando…',
    retryIn: (seconds: number) => `Tente de novo em ${formatMinutesAndSeconds(seconds)}`,
    forgotPassword: 'Esqueci minha senha',
    noAccount: 'Ainda não tem conta?',
    createAccount: 'Criar conta',
    limitedHint: 'Enquanto isso, você pode trocar a senha em “Esqueci minha senha”.',
    offlineHint: 'Sem conexão. Assim que a internet voltar, o botão libera.',
    resendVerification: 'Reenviar e-mail de confirmação',
    resendIn: (seconds: number) => `Reenviar em ${formatSeconds(seconds)}`,
    notices: {
      'session-ended': 'Sua sessão terminou. Entre de novo.',
      'logged-out': 'Você saiu.',
      'password-changed':
        'Senha trocada. Entre com a nova senha. Por segurança, saímos de todos os aparelhos.',
      'email-verified': 'E-mail confirmado',
    },
  },
  logOut: 'Sair',
} as const
