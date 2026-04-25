import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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

type Anchor = { left: number; top: number; right: number };

/**
 * Renders the dropdown panel via a portal so it escapes the workspace's
 * `overflow: hidden`. Position is computed from the trigger's bounding
 * rect each time the menu opens; we don't track scroll/resize because the
 * titlebar itself is fixed at the top of the workspace grid.
 */
export function TitlebarMenu({ label, items, align = 'left', preface }: TitlebarMenuProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setAnchor({ left: rect.left, top: rect.bottom + 2, right: rect.right });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleAway(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
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
    <div className="titlebar-menu" data-open={open || undefined}>
      <button
        ref={triggerRef}
        type="button"
        className="titlebar-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open && anchor && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              className={`titlebar-menu__panel titlebar-menu__panel--${align}`}
              role="menu"
              style={
                align === 'right'
                  ? { top: anchor.top, right: window.innerWidth - anchor.right }
                  : { top: anchor.top, left: anchor.left }
              }
            >
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export type { MenuItem };
