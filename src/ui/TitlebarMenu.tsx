import { useEffect, useRef, useState, type ReactNode } from 'react';

type MenuItem =
  | { kind: 'item'; label: string; shortcut?: string; disabled?: boolean; danger?: boolean; onSelect: () => void }
  | { kind: 'divider' }
  | { kind: 'header'; label: string };

type TitlebarMenuProps = {
  label: string;
  items: MenuItem[];
  align?: 'left' | 'right';
  /** Optional rendered preface inside the dropdown above the items (e.g. an active project hint). */
  preface?: ReactNode;
};

export function TitlebarMenu({ label, items, align = 'left', preface }: TitlebarMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleAway(event: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleAway);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleAway);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div className="titlebar-menu" ref={ref} data-open={open || undefined}>
      <button
        type="button"
        className="titlebar-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open && (
        <div className={`titlebar-menu__panel titlebar-menu__panel--${align}`} role="menu">
          {preface}
          {items.map((item, index) => {
            if (item.kind === 'divider') {
              return <div key={`d${index}`} className="titlebar-menu__divider" role="separator" />;
            }
            if (item.kind === 'header') {
              return (
                <div key={`h${index}`} className="titlebar-menu__header" role="presentation">
                  {item.label}
                </div>
              );
            }
            return (
              <button
                key={`i${index}`}
                type="button"
                role="menuitem"
                className={`titlebar-menu__item ${item.danger ? 'titlebar-menu__item--danger' : ''}`}
                disabled={item.disabled}
                onClick={() => {
                  item.onSelect();
                  setOpen(false);
                }}
              >
                <span>{item.label}</span>
                {item.shortcut && <kbd>{item.shortcut}</kbd>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { MenuItem };
