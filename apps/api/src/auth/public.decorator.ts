import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Todas as rotas exigem access token por padrão (guard global).
 * Use @Public() apenas nas rotas que realmente precisam ser abertas.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
