import { ValidateIf } from 'class-validator';

/**
 * Como `@IsOptional()`, mas só para campo AUSENTE. O `@IsOptional()` também pula a
 * validação quando o valor é `null`, e aí `{"displayName": null}` chegaria ao Prisma
 * numa coluna NOT NULL (erro 500). Com este decorator, `null` é validado e vira 400.
 *
 * Use em campos opcionais em que `null` não tem significado (para "remover um valor",
 * como a bio, o `@IsOptional()` continua correto).
 */
export const IsOptionalNotNull = () => ValidateIf((_object, value) => value !== undefined);
