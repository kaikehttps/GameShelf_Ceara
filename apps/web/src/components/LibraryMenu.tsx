import { useEffect, useRef, useState } from 'react';
import type { LibraryStatus } from '../api/types';
import { LIBRARY_STATUSES, STATUS_LABELS } from '../lib/format';
import { Icon } from './Icon';

interface LibraryMenuProps {
  gameName: string;
  status: LibraryStatus;
  disabled?: boolean;
  onChange: (status: LibraryStatus) => void;
  onRemove: () => void;
}

/** Menu "⋮" do card: troca o status ou remove o jogo da biblioteca. */
export function LibraryMenu({ gameName, status, disabled, onChange, onRemove }: LibraryMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Opções de ${gameName} na biblioteca`}
        className="flex h-6 w-6 items-center justify-center rounded text-app-muted transition-colors hover:bg-app-surface hover:text-app-text disabled:opacity-40"
      >
        <Icon name="more_vert" className="text-[16px]" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-40 mt-1 w-44 overflow-hidden rounded-md border border-app-border bg-app-card py-1 shadow-lg"
        >
          {LIBRARY_STATUSES.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === status}
              onClick={() => choose(() => option !== status && onChange(option))}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-app-text hover:bg-app-surface"
            >
              {STATUS_LABELS[option]}
              {option === status && <Icon name="check" className="text-[14px] text-app-accent" />}
            </button>
          ))}
          <div className="my-1 h-px bg-app-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(onRemove)}
            className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs text-app-danger hover:bg-app-surface"
          >
            <Icon name="delete" className="text-[14px]" />
            Remover da biblioteca
          </button>
        </div>
      )}
    </div>
  );
}
