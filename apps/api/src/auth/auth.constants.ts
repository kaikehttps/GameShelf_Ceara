export const REFRESH_COOKIE_NAME = 'gs_refresh';
export const REFRESH_COOKIE_PATH = '/auth';

/**
 * Janela em que reapresentar um refresh token recém-rotacionado é tratado como
 * corrida legítima (duas abas, retry de rede) e não como roubo de token.
 */
export const REFRESH_REUSE_GRACE_MS = 10_000;

const ONE_MINUTE_MS = 60_000;

/**
 * Limites por IP e por rota (memória do processo). São mais rígidos que o limite
 * global porque protegem contra força bruta e criação de contas em massa.
 */
export const AUTH_RATE_LIMIT = {
  login: { limit: 5, ttl: ONE_MINUTE_MS },
  register: { limit: 5, ttl: ONE_MINUTE_MS },
  refresh: { limit: 30, ttl: ONE_MINUTE_MS },
} as const;
