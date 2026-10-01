import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/** `QBT_URL=` (vazio no .env) significa "não configurado". */
const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

/**
 * Lê o valor bruto (`obj[key]`), não o `value`: com enableImplicitConversion o
 * class-transformer já teria convertido 'false' em Boolean('false') === true.
 */
const toBoolean = ({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
  const raw = obj[key];
  return typeof raw === 'string' ? ['true', '1', 'yes'].includes(raw.trim().toLowerCase()) : raw;
};

/**
 * Variáveis de ambiente aceitas pela API. A aplicação não sobe se alguma
 * obrigatória estiver ausente ou inválida (falha rápida e com mensagem clara).
 *
 * Os tipos ficam anotados explicitamente (`PORT: number = 3000`): a conversão de
 * string para número usa os metadados de tipo, e o SWC (usado nos testes) só os
 * gera quando há anotação.
 */
export class Env {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  DATABASE_URL!: string;

  /** Segredo HS256 do access token. 32+ caracteres aleatórios. */
  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @IsInt()
  @Min(60)
  @Max(3600)
  JWT_ACCESS_TTL_SECONDS: number = 900;

  /** Expiração do refresh token por inatividade (renovada a cada rotação). */
  @IsInt()
  @Min(1)
  @Max(90)
  REFRESH_TOKEN_IDLE_DAYS: number = 7;

  /** Duração máxima de uma sessão, contada a partir do login. */
  @IsInt()
  @Min(1)
  @Max(365)
  SESSION_ABSOLUTE_DAYS: number = 30;

  /**
   * Seguro por padrão. Chrome e Firefox aceitam cookies `Secure` em http://localhost;
   * só desative se precisar testar por HTTP em outro host.
   */
  @Transform(toBoolean)
  @IsBoolean()
  COOKIE_SECURE: boolean = true;

  /**
   * Origens do frontend, separadas por vírgula (ex.: http://localhost:5173).
   * São liberadas no CORS e confiáveis na proteção contra CSRF. Vazio = só mesma origem.
   */
  @IsString()
  CORS_ORIGINS: string = '';

  /** Número de proxies confiáveis à frente da API (para obter o IP real no rate limit). */
  @IsInt()
  @Min(0)
  TRUST_PROXY_HOPS: number = 0;

  // ---------- Redis (opcional) ----------

  /**
   * Compartilha snapshots e eventos de download entre instâncias da API. Sem ele, ficam
   * na memória do processo (suficiente para uma instância só).
   */
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  REDIS_URL?: string;

  // ---------- Downloads via qBittorrent (opcional) ----------

  /** Endereço da WebUI do qBittorrent, acessível só pela rede interna. Vazio = downloads desativados. */
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true })
  QBT_URL?: string;

  @IsString()
  QBT_USERNAME: string = 'admin';

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  QBT_PASSWORD?: string;

  /** Raiz dos downloads como o qBittorrent a enxerga (dentro do container). */
  @IsString()
  QBT_SAVE_ROOT: string = '/downloads';

  @IsInt()
  @Min(200)
  @Max(60_000)
  QBT_TIMEOUT_MS: number = 5000;

  /** Novas tentativas após falha de rede/timeout (com backoff exponencial). */
  @IsInt()
  @Min(0)
  @Max(5)
  QBT_RETRIES: number = 2;

  /**
   * A mesma pasta de QBT_SAVE_ROOT, vista pela API. Necessária só para excluir arquivos
   * de um download cancelado; sem ela, essa ação responde 503.
   */
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  DOWNLOADS_DIR?: string;

  /** Intervalo do monitor que consulta o qBittorrent. 0 = não iniciar (usado nos testes). */
  @IsInt()
  @Min(0)
  @Max(60_000)
  DOWNLOADS_MONITOR_INTERVAL_MS: number = 2000;

  /** Política de compartilhamento (seeding) aplicada a cada torrent. */
  @IsInt()
  @Min(1)
  DOWNLOADS_UPLOAD_LIMIT_KIB: number = 256;

  @IsNumber()
  @Min(0)
  @Max(100)
  DOWNLOADS_SEED_RATIO_LIMIT: number = 1;

  @IsInt()
  @Min(0)
  DOWNLOADS_SEED_TIME_LIMIT_MINUTES: number = 30;
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const env = plainToInstance(Env, raw, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((error) => `${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`)
      .join('\n  ');
    throw new Error(`Variáveis de ambiente inválidas:\n  ${details}`);
  }
  return env;
}
