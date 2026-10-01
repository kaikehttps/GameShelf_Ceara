import { starFill } from '../lib/format';
import { Icon } from './Icon';

/** Nota de 1 a 5 só para leitura (médias como 4,5 mostram meia estrela). */
export function Stars({ value, size = 'text-[15px]' }: { value: number; size?: string }) {
  return (
    <span
      className="inline-flex items-center"
      role="img"
      aria-label={`Nota ${value.toLocaleString('pt-BR')} de 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = starFill(value, star);
        return (
          <Icon
            key={star}
            name={fill === 'half' ? 'star_half' : 'star'}
            filled={fill !== 'empty'}
            className={`${size} ${fill === 'empty' ? 'text-app-border' : 'text-app-accent'}`}
          />
        );
      })}
    </span>
  );
}

interface StarInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/** Escolha da nota: um grupo de botões de rádio, acessível pelo teclado. */
export function StarInput({ value, onChange, disabled = false }: StarInputProps) {
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Sua nota">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} de 5`}
          disabled={disabled}
          onClick={() => onChange(star)}
          className="rounded p-0.5 transition-transform hover:scale-110 disabled:opacity-50"
        >
          <Icon
            name="star"
            filled={star <= value}
            className={`text-[24px] ${star <= value ? 'text-app-accent' : 'text-app-border'}`}
          />
        </button>
      ))}
    </div>
  );
}
