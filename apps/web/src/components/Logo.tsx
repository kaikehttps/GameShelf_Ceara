/**
 * Marca do sidebar: o sol da logo com o nome em texto (nítido em qualquer tamanho).
 * Em telas menores o sidebar fica estreito e só o sol aparece.
 */
export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-app-border bg-app-surface">
        <img src="/logo-mark.png" alt="GameShelf Ceará" className="h-5 w-5 object-contain" />
      </div>
      <div className="hidden flex-col lg:flex" aria-hidden="true">
        <span className="text-[16px] leading-none font-bold tracking-tight">GameShelf</span>
        <span className="mt-0.5 text-[10px] font-semibold tracking-widest text-app-accent uppercase">
          Ceará
        </span>
      </div>
    </div>
  );
}
