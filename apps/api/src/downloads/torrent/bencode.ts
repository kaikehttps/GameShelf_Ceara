/**
 * Bencode: o formato dos arquivos .torrent (BEP 3). Implementação mínima para:
 * - ler um .torrent e achar os bytes exatos do dicionário `info` (o info hash é o SHA-1
 *   desses bytes, então não dá para decodificar e codificar de novo);
 * - gerar o .torrent de teste usado na demonstração.
 *
 * Tipos: inteiro (`i42e`), texto em bytes (`4:spam`), lista (`l...e`) e dicionário (`d...e`).
 */
export type BencodeValue = number | Buffer | BencodeValue[] | { [key: string]: BencodeValue };

export class BencodeError extends Error {}

/** Proteção contra arquivos maliciosos com aninhamento profundo. */
const MAX_DEPTH = 64;

interface Decoded {
  value: BencodeValue;
  /** Posição de início e fim (exclusivo) do valor da chave `info` no dicionário raiz. */
  infoRange?: [number, number];
}

export function decodeBencode(data: Buffer): Decoded {
  const decoder = new Decoder(data);
  const value = decoder.read(0);
  if (decoder.pos !== data.length) {
    throw new BencodeError('Dados extras depois do fim do bencode');
  }
  return { value, infoRange: decoder.infoRange };
}

class Decoder {
  pos = 0;
  infoRange?: [number, number];

  constructor(private readonly data: Buffer) {}

  read(depth: number): BencodeValue {
    if (depth > MAX_DEPTH) {
      throw new BencodeError('Bencode aninhado demais');
    }
    const byte = this.data[this.pos];
    if (byte === undefined) {
      throw new BencodeError('Bencode terminou antes do esperado');
    }
    if (byte === 0x69 /* i */) {
      return this.readInteger();
    }
    if (byte === 0x6c /* l */) {
      this.pos++;
      const list: BencodeValue[] = [];
      while (this.data[this.pos] !== 0x65 /* e */) {
        list.push(this.read(depth + 1));
      }
      this.pos++;
      return list;
    }
    if (byte === 0x64 /* d */) {
      this.pos++;
      const dict: Record<string, BencodeValue> = {};
      while (this.data[this.pos] !== 0x65 /* e */) {
        const key = this.readBytes().toString('utf8');
        const start = this.pos;
        dict[key] = this.read(depth + 1);
        if (depth === 0 && key === 'info') {
          this.infoRange = [start, this.pos];
        }
      }
      this.pos++;
      return dict;
    }
    if (byte >= 0x30 && byte <= 0x39 /* 0-9 */) {
      return this.readBytes();
    }
    throw new BencodeError(`Byte inesperado na posição ${this.pos}`);
  }

  private readInteger(): number {
    const end = this.data.indexOf(0x65 /* e */, this.pos);
    if (end === -1) {
      throw new BencodeError('Inteiro sem fim');
    }
    const text = this.data.toString('ascii', this.pos + 1, end);
    if (!/^(0|-?[1-9]\d*)$/.test(text)) {
      throw new BencodeError(`Inteiro inválido: ${text}`);
    }
    const value = Number(text);
    if (!Number.isSafeInteger(value)) {
      throw new BencodeError('Inteiro grande demais');
    }
    this.pos = end + 1;
    return value;
  }

  private readBytes(): Buffer {
    const colon = this.data.indexOf(0x3a /* : */, this.pos);
    if (colon === -1) {
      throw new BencodeError('Texto sem ":"');
    }
    const lengthText = this.data.toString('ascii', this.pos, colon);
    if (!/^(0|[1-9]\d*)$/.test(lengthText)) {
      throw new BencodeError(`Tamanho inválido: ${lengthText}`);
    }
    const start = colon + 1;
    const end = start + Number(lengthText);
    if (end > this.data.length) {
      throw new BencodeError('Texto maior que os dados');
    }
    this.pos = end;
    return this.data.subarray(start, end);
  }
}

/** Codifica em bencode. Chaves de dicionário saem em ordem, como a especificação exige. */
export function encodeBencode(value: BencodeValue | string): Buffer {
  if (typeof value === 'string') {
    return encodeBencode(Buffer.from(value, 'utf8'));
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new BencodeError('Só inteiros podem ser codificados');
    }
    return Buffer.from(`i${value}e`, 'ascii');
  }
  if (Buffer.isBuffer(value)) {
    return Buffer.concat([Buffer.from(`${value.length}:`, 'ascii'), value]);
  }
  if (Array.isArray(value)) {
    return Buffer.concat([Buffer.from('l'), ...value.map(encodeBencode), Buffer.from('e')]);
  }
  const keys = Object.keys(value).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  return Buffer.concat([
    Buffer.from('d'),
    ...keys.flatMap((key) => [encodeBencode(key), encodeBencode(value[key])]),
    Buffer.from('e'),
  ]);
}
