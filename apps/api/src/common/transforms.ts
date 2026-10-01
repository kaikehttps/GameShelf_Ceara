/** Remove espaços nas pontas. Valores que não são string seguem intactos para a validação. */
export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Para slugs e e-mails: compara sem diferenciar maiúsculas. */
export const trimLowercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
