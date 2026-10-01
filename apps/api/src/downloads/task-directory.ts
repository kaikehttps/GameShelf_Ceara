import { lstat, realpath, rm } from 'node:fs/promises';
import path from 'node:path';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TaskDirectoryError extends Error {}

/**
 * Pasta de um download: `<raiz>/<id do download>`. O usuário nunca informa caminhos; o id
 * é um UUID gerado pela API. Mesmo assim validamos, para que nenhum valor inesperado
 * (ex.: "../..") escape da raiz.
 */
export function taskDirectory(root: string, downloadId: string): string {
  if (!UUID_PATTERN.test(downloadId)) {
    throw new TaskDirectoryError('Id de download inválido para montar o caminho');
  }
  const base = path.resolve(root);
  const directory = path.resolve(base, downloadId);
  if (path.dirname(directory) !== base) {
    throw new TaskDirectoryError('O caminho saiu da raiz de downloads');
  }
  return directory;
}

/** Caminho que o qBittorrent (Linux, dentro do container) usa para salvar o download. */
export function clientSavePath(clientRoot: string, downloadId: string): string {
  if (!UUID_PATTERN.test(downloadId)) {
    throw new TaskDirectoryError('Id de download inválido para montar o caminho');
  }
  return path.posix.join(clientRoot, downloadId);
}

/**
 * Apaga a pasta de UM download e tudo dentro dela. Recusa links simbólicos (inclusive
 * junctions do Windows) e qualquer coisa que não seja um diretório comum, para a exclusão
 * nunca alcançar arquivos fora da tarefa. Devolve "missing" se a pasta não existe
 * (o download nem chegou a gravar nada, ou já foi apagada).
 */
export async function deleteTaskDirectory(
  root: string,
  downloadId: string,
): Promise<'deleted' | 'missing'> {
  const directory = taskDirectory(root, downloadId);

  const stats = await lstat(directory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  });
  if (!stats) {
    return 'missing';
  }
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new TaskDirectoryError('A pasta do download não é um diretório comum; nada foi apagado');
  }

  // Confere também o caminho real (resolve links em pastas acima da tarefa).
  const [realRoot, realDirectory] = await Promise.all([realpath(root), realpath(directory)]);
  if (path.dirname(realDirectory) !== realRoot) {
    throw new TaskDirectoryError(
      'A pasta do download está fora da raiz de downloads; nada foi apagado',
    );
  }

  await rm(directory, { recursive: true });
  return 'deleted';
}
