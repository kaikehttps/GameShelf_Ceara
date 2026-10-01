import { createHash } from 'node:crypto';
import { decodeBencode, type BencodeValue } from './bencode.js';

/** Erro de cadastro de fonte: magnet ou .torrent que não serve para o MVP. */
export class InvalidTorrentError extends Error {}

export const MAX_TORRENT_FILE_BYTES = 2 * 1024 * 1024;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Extrai o info hash v1 de um link magnet (`xt=urn:btih:<40 hex | 32 base32>`) e o
 * normaliza para 40 caracteres hex minúsculos, o mesmo formato que o qBittorrent usa
 * como id do torrent. Magnets só v2 (`urn:btmh`) ficam de fora do MVP.
 */
export function infoHashFromMagnet(magnet: string): string {
  let url: URL;
  try {
    url = new URL(magnet);
  } catch {
    throw new InvalidTorrentError('Link magnet inválido');
  }
  if (url.protocol !== 'magnet:') {
    throw new InvalidTorrentError('O link precisa começar com "magnet:?"');
  }
  for (const xt of url.searchParams.getAll('xt')) {
    const match = /^urn:btih:(.+)$/i.exec(xt);
    if (!match) {
      continue;
    }
    const value = match[1];
    if (/^[0-9a-f]{40}$/i.test(value)) {
      return value.toLowerCase();
    }
    if (/^[A-Z2-7]{32}$/i.test(value)) {
      return base32ToHex(value.toUpperCase());
    }
    throw new InvalidTorrentError('Info hash do magnet em formato desconhecido');
  }
  throw new InvalidTorrentError('O magnet não tem info hash v1 (xt=urn:btih:...)');
}

function base32ToHex(value: string): string {
  let bits = '';
  for (const char of value) {
    bits += BASE32_ALPHABET.indexOf(char).toString(2).padStart(5, '0');
  }
  let hex = '';
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    hex += parseInt(bits.slice(i, i + 8), 2)
      .toString(16)
      .padStart(2, '0');
  }
  return hex;
}

export interface TorrentFileMetadata {
  infoHash: string;
  name: string;
  sizeBytes: number;
}

/**
 * Lê um .torrent: info hash v1 (SHA-1 dos bytes originais do dicionário `info`), nome e
 * tamanho total. Torrents só v2 (sem `pieces`) ficam de fora: o id deles no qBittorrent
 * é outro.
 */
export function parseTorrentFile(data: Buffer): TorrentFileMetadata {
  if (data.length === 0 || data.length > MAX_TORRENT_FILE_BYTES) {
    throw new InvalidTorrentError('O .torrent precisa ter entre 1 byte e 2 MiB');
  }
  let decoded: ReturnType<typeof decodeBencode>;
  try {
    decoded = decodeBencode(data);
  } catch (error) {
    throw new InvalidTorrentError(`Arquivo .torrent inválido: ${(error as Error).message}`);
  }
  const info = asDict(asDict(decoded.value)?.info);
  if (!info || !decoded.infoRange) {
    throw new InvalidTorrentError('O .torrent não tem o dicionário "info"');
  }
  if (!Buffer.isBuffer(info.pieces)) {
    throw new InvalidTorrentError('Torrents só v2 não são suportados (falta "pieces")');
  }
  const name = Buffer.isBuffer(info.name) ? info.name.toString('utf8') : '';
  const sizeBytes = typeof info.length === 'number' ? info.length : sumFileLengths(info.files);
  if (!name || sizeBytes <= 0) {
    throw new InvalidTorrentError('O .torrent não informa nome e tamanho');
  }
  const [start, end] = decoded.infoRange;
  const infoHash = createHash('sha1').update(data.subarray(start, end)).digest('hex');
  return { infoHash, name, sizeBytes };
}

function asDict(value: BencodeValue | undefined): Record<string, BencodeValue> | undefined {
  return value && typeof value === 'object' && !Buffer.isBuffer(value) && !Array.isArray(value)
    ? value
    : undefined;
}

function sumFileLengths(files: BencodeValue | undefined): number {
  if (!Array.isArray(files)) {
    return 0;
  }
  return files.reduce<number>((total, file) => {
    const length = asDict(file)?.length;
    return total + (typeof length === 'number' ? length : 0);
  }, 0);
}
