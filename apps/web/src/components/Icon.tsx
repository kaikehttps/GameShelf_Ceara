interface IconProps {
  /** Nome do ícone Material Symbols, ex.: "search". */
  name: string;
  className?: string;
  filled?: boolean;
}

/** Ícone decorativo: leitores de tela ignoram (o texto ao lado dá o significado). */
export function Icon({ name, className = 'text-[18px]', filled = false }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined ${filled ? 'icon-filled' : ''} ${className}`}
    >
      {name}
    </span>
  );
}
