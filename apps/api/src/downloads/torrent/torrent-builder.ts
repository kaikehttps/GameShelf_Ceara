import { createHash } from 'node:crypto';
import { encodeBencode, type BencodeValue } from './bencode.js';

export const DEFAULT_PIECE_LENGTH = 256 * 1024;

interface BuildOptions {
  name: string;
  content: Buffer;
  pieceLength?: number;
  /** Web seeds (BEP 19): servidores HTTP que também entregam o arquivo. */
  webSeeds?: string[];
  comment?: string;
}

/**
 * Gera um .torrent de um único arquivo. Usado só para criar o arquivo de teste da
 * demonstração (conteúdo nosso, distribuição autorizada por definição).
 */
export function buildSingleFileTorrent({
  name,
  content,
  pieceLength = DEFAULT_PIECE_LENGTH,
  webSeeds,
  comment,
}: BuildOptions): Buffer {
  const pieces: Buffer[] = [];
  for (let offset = 0; offset < content.length; offset += pieceLength) {
    pieces.push(
      createHash('sha1')
        .update(content.subarray(offset, offset + pieceLength))
        .digest(),
    );
  }
  const torrent: Record<string, BencodeValue> = {
    'created by': Buffer.from('GameShelf'),
    'creation date': Math.floor(Date.now() / 1000),
    info: {
      length: content.length,
      name: Buffer.from(name),
      'piece length': pieceLength,
      pieces: Buffer.concat(pieces),
    },
  };
  if (comment) {
    torrent.comment = Buffer.from(comment);
  }
  if (webSeeds?.length) {
    torrent['url-list'] = webSeeds.map((url) => Buffer.from(url));
  }
  return encodeBencode(torrent);
}
