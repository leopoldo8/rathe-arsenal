export const apiErrors = {
  // Auth error codes (EAuthErrorCode) — client maps envelope.code → message
  INVALID_CREDENTIALS: 'E-mail ou senha inválidos.',
  EMAIL_NOT_VERIFIED: 'Verifique seu e-mail antes de entrar.',
  INVALID_TOKEN: 'Este link é inválido ou expirou.',
  TOKEN_EXPIRED: 'Este link é inválido ou expirou.',
  EMAIL_DELIVERY_FAILED: 'Não foi possível enviar o e-mail. Tente novamente mais tarde.',
  USER_NOT_FOUND: 'Usuário não encontrado.',
  generic: 'Algo deu errado. Tente novamente.',
  // Rate limit (HTTP 429) — count-based plural
  rateLimitGeneric: 'Muitas tentativas. Aguarde um momento e tente novamente.',
  rateLimitSeconds_one: 'Muitas tentativas. Aguarde {{count}} segundo e tente novamente.',
  rateLimitSeconds_other: 'Muitas tentativas. Aguarde {{count}} segundos e tente novamente.',
  rateLimitMinutes_one: 'Muitas tentativas. Aguarde {{count}} minuto e tente novamente.',
  rateLimitMinutes_other: 'Muitas tentativas. Aguarde {{count}} minutos e tente novamente.',
} as const;
