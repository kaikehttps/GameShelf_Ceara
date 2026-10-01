import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import type { AddTorrentOptions, TorrentInfo } from './qbittorrent.types.js';

/** Tag aplicada a todo torrent criado pelo GameShelf; o monitor só olha estes. */
export const MANAGED_TAG = 'gameshelf';
export const downloadTag = (downloadId: string) => `gs-${downloadId}`;

export type TorrentClientErrorKind = 'disabled' | 'unavailable' | 'auth' | 'rejected';

export class TorrentClientError extends Error {
  constructor(
    message: string,
    readonly kind: TorrentClientErrorKind,
  ) {
    super(message);
    this.name = 'TorrentClientError';
  }
}

const BACKOFF_BASE_MS = 250;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cliente da WebUI API v2 do qBittorrent 5.x. Credenciais e endereço ficam só aqui
 * (variáveis de ambiente da API); o navegador nunca fala com o qBittorrent.
 *
 * - Autenticação por cookie `SID` (`POST /api/v2/auth/login`). Na 5.2, login errado
 *   responde 401; sessão expirada faz as outras rotas responderem 403 (aí refazemos o login).
 * - O qBittorrent exige `Referer`/`Origin` igual ao endereço da WebUI (proteção CSRF).
 * - Cada chamada tem timeout; falhas de rede, timeouts e 5xx são repetidos poucas vezes,
 *   com espera crescente (250 ms, 500 ms...). As operações usadas são idempotentes.
 */
@Injectable()
export class QbittorrentClient {
  private readonly logger = new Logger(QbittorrentClient.name);
  private readonly baseUrl?: string;
  private readonly username: string;
  private readonly password?: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private sid: string | null = null;
  private loginInFlight: Promise<void> | null = null;

  constructor(config: ConfigService<Env, true>) {
    this.baseUrl = config.get('QBT_URL', { infer: true })?.replace(/\/$/, '');
    this.username = config.get('QBT_USERNAME', { infer: true });
    this.password = config.get('QBT_PASSWORD', { infer: true });
    this.timeoutMs = config.get('QBT_TIMEOUT_MS', { infer: true });
    this.retries = config.get('QBT_RETRIES', { infer: true });
  }

  get enabled(): boolean {
    return this.baseUrl !== undefined;
  }

  async version(): Promise<string> {
    const res = await this.call('/api/v2/app/version', { method: 'GET' });
    return (await res.text()).trim();
  }

  /** Todos os torrents com a tag do GameShelf (os demais do cliente são ignorados). */
  async listManaged(): Promise<TorrentInfo[]> {
    const res = await this.call('/api/v2/torrents/info', {
      method: 'GET',
      query: { tag: MANAGED_TAG },
    });
    return (await res.json()) as TorrentInfo[];
  }

  async get(hash: string): Promise<TorrentInfo | null> {
    const res = await this.call('/api/v2/torrents/info', {
      method: 'GET',
      query: { hashes: hash },
    });
    const [torrent] = (await res.json()) as TorrentInfo[];
    return torrent ?? null;
  }

  /** "exists" quando o qBittorrent já tem um torrent com o mesmo info hash (409). */
  async add(options: AddTorrentOptions): Promise<'added' | 'exists'> {
    const form = new FormData();
    if (options.magnet) {
      form.set('urls', options.magnet);
    }
    if (options.torrentFile) {
      form.set(
        'torrents',
        new Blob([new Uint8Array(options.torrentFile.data)], { type: 'application/x-bittorrent' }),
        options.torrentFile.filename,
      );
    }
    form.set('savepath', options.savePath);
    form.set('tags', options.tags.join(','));
    form.set('upLimit', String(options.upLimitBytes));
    form.set('ratioLimit', String(options.ratioLimit));
    form.set('seedingTimeLimit', String(options.seedingTimeLimitMinutes));
    // Ao atingir o limite, para de compartilhar (não remove a tarefa).
    form.set('shareLimitAction', 'Stop');
    // Gerenciamento automático desligado: o savepath acima é respeitado.
    form.set('autoTMM', 'false');

    const res = await this.call('/api/v2/torrents/add', { method: 'POST', body: form });
    if (res.status === 409) {
      return 'exists';
    }
    if (!res.ok) {
      throw new TorrentClientError(
        `O qBittorrent recusou o torrent (HTTP ${res.status}): ${await res.text()}`,
        'rejected',
      );
    }
    return 'added';
  }

  /** Pausar (no 5.x a rota se chama "stop"). */
  async stop(hash: string): Promise<void> {
    await this.post('/api/v2/torrents/stop', { hashes: hash });
  }

  /** Retomar (no 5.x a rota se chama "start"). */
  async start(hash: string): Promise<void> {
    await this.post('/api/v2/torrents/start', { hashes: hash });
  }

  /** Remove a tarefa do cliente. Com `deleteFiles=false` os arquivos ficam no disco. */
  async remove(hash: string, deleteFiles = false): Promise<void> {
    await this.post('/api/v2/torrents/delete', { hashes: hash, deleteFiles: String(deleteFiles) });
  }

  private async post(path: string, fields: Record<string, string>): Promise<void> {
    const res = await this.call(path, { method: 'POST', body: new URLSearchParams(fields) });
    if (!res.ok) {
      throw new TorrentClientError(
        `O qBittorrent respondeu HTTP ${res.status} em ${path}`,
        'rejected',
      );
    }
  }

  private async call(
    path: string,
    init: {
      method: 'GET' | 'POST';
      body?: FormData | URLSearchParams;
      query?: Record<string, string>;
    },
  ): Promise<Response> {
    if (!this.baseUrl) {
      throw new TorrentClientError('Downloads desativados: QBT_URL não configurada', 'disabled');
    }
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (attempt > 0) {
        await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
      }
      try {
        await this.ensureSession();
        let res = await this.send(path, init);
        if (res.status === 403 && this.password !== undefined) {
          // Sessão expirada (o qBittorrent reiniciou, por exemplo): refaz o login uma vez.
          this.sid = null;
          await this.ensureSession();
          res = await this.send(path, init);
        }
        if (res.status === 403) {
          throw new TorrentClientError(
            'O qBittorrent recusou o acesso (verifique as credenciais)',
            'auth',
          );
        }
        if (res.status >= 500) {
          lastError = new Error(`HTTP ${res.status}`);
          continue;
        }
        return res;
      } catch (error) {
        // Credenciais erradas não melhoram tentando de novo.
        if (error instanceof TorrentClientError && error.kind === 'auth') {
          throw error;
        }
        lastError = error;
      }
    }
    this.logger.warn(`qBittorrent indisponível em ${path}: ${describe(lastError)}`);
    throw new TorrentClientError('O cliente torrent está indisponível no momento', 'unavailable');
  }

  private send(
    path: string,
    init: {
      method: 'GET' | 'POST';
      body?: FormData | URLSearchParams;
      query?: Record<string, string>;
    },
  ): Promise<Response> {
    const query = init.query ? `?${new URLSearchParams(init.query).toString()}` : '';
    return fetch(`${this.baseUrl}${path}${query}`, {
      method: init.method,
      body: init.body,
      headers: { Referer: this.baseUrl!, ...(this.sid ? { Cookie: `SID=${this.sid}` } : {}) },
      signal: AbortSignal.timeout(this.timeoutMs),
      redirect: 'manual',
    });
  }

  /** Faz login uma vez e reaproveita o cookie. Sem senha configurada, não faz login. */
  private async ensureSession(): Promise<void> {
    if (this.sid || this.password === undefined) {
      return;
    }
    this.loginInFlight ??= this.login().finally(() => {
      this.loginInFlight = null;
    });
    await this.loginInFlight;
  }

  private async login(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v2/auth/login`, {
      method: 'POST',
      body: new URLSearchParams({ username: this.username, password: this.password ?? '' }),
      headers: { Referer: this.baseUrl! },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (res.status === 401 || res.status === 403) {
      const reason =
        res.status === 403 ? 'IP bloqueado por tentativas erradas' : 'usuário ou senha incorretos';
      throw new TorrentClientError(`Login no qBittorrent falhou: ${reason}`, 'auth');
    }
    const cookie = res.headers.getSetCookie().find((value) => value.startsWith('SID='));
    if (!res.ok || !cookie) {
      // Versões antigas respondem 200 com "Fails." e sem cookie.
      throw new TorrentClientError('Login no qBittorrent falhou: resposta sem sessão', 'auth');
    }
    this.sid = cookie.slice('SID='.length).split(';')[0];
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    return error.name === 'TimeoutError' ? 'timeout' : error.message;
  }
  return String(error);
}
