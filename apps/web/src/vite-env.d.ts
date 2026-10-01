/// <reference types="vite/client" />

/** Variáveis de ambiente lidas pelo frontend (só as com prefixo VITE_ chegam ao navegador). */
interface ImportMetaEnv {
  /** Endereço da API. Padrão: http://localhost:3000. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
