import { createElement, useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ElementType, type ReactNode } from 'react';
import type { ToneName } from '../engine/types';

type PanelProps = {
  id?: string;
  title?: string;
  flags?: string;
  tools?: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  dense?: boolean;
  tone?: ToneName;
  className?: string;
  titleAs?: 'h2' | 'h3' | 'h4';
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children: ReactNode;
};

export function Panel({
  id,
  title,
  flags,
  tools,
  footer,
  flush,
  dense,
  tone = 'phos',
  className,
  titleAs: TitleTag = 'h2',
  collapsible = true,
  defaultCollapsed = false,
  children,
}: PanelProps) {
  const storageKey = id ? `phosphor:panel:${id}:collapsed` : null;
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && storageKey) {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === '1') return true;
      if (saved === '0') return false;
    }
    return defaultCollapsed;
  });
  const toggleCollapsed = useCallback(() => {
    setCollapsedState((current) => {
      const next = !current;
      if (typeof window !== 'undefined' && storageKey) {
        window.localStorage.setItem(storageKey, next ? '1' : '0');
      }
      return next;
    });
  }, [storageKey]);

  const showHeader = Boolean(title || tools);
  const isCollapsed = collapsible && collapsed;
  const bodyId = id ? `panel-body-${id}` : undefined;

  const headerInner = (
    <>
      {collapsible && title && (
        <span className="panel__chevron" aria-hidden="true">{isCollapsed ? '\u25B8' : '\u25BE'}</span>
      )}
      {title && <span className="panel__signal" aria-hidden="true" />}
      {title && <TitleTag className="panel__title-text">{title}</TitleTag>}
      {flags && <span className="panel__flags">{flags}</span>}
    </>
  );

  return (
    <section
      className={`panel ${className ?? ''}`}
      data-tone={tone}
      aria-label={title}
      data-collapsed={isCollapsed ? 'true' : undefined}
    >
      {showHeader && (
        <div className="panel__bar">
          {collapsible && title ? (
            <button
              type="button"
              className="panel__title panel__toggle"
              onClick={toggleCollapsed}
              aria-expanded={!isCollapsed}
              aria-controls={bodyId}
            >
              {headerInner}
            </button>
          ) : (
            <div className="panel__title">{headerInner}</div>
          )}
          {tools && <div className="panel__tools">{tools}</div>}
        </div>
      )}
      <div
        id={bodyId}
        className={`panel__body ${flush ? 'panel__body--flush' : ''} ${dense ? 'panel__body--dense' : ''}`}
        hidden={isCollapsed || undefined}
      >
        {children}
      </div>
      {footer && !isCollapsed && <div className="panel__footer">{footer}</div>}
    </section>
  );
}

type SplitterProps = {
  orientation: 'vertical' | 'horizontal';
  onResize: (delta: number) => void;
  onCommit?: () => void;
  ariaLabel: string;
  className?: string;
};

export function Splitter({ orientation, onResize, onCommit, ariaLabel, className }: SplitterProps) {
  // Keep the callbacks in refs so the drag closure always calls the latest
  // version even if the parent re-renders mid-drag with a new function identity.
  const onResizeRef = useRef(onResize);
  const onCommitRef = useRef(onCommit);
  useEffect(() => { onResizeRef.current = onResize; }, [onResize]);
  useEffect(() => { onCommitRef.current = onCommit; }, [onCommit]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      let last = orientation === 'vertical' ? event.clientX : event.clientY;
      const previousCursor = document.body.style.cursor;
      const previousSelect = document.body.style.userSelect;
      document.body.style.cursor = orientation === 'vertical' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';

      const move = (ev: PointerEvent) => {
        const current = orientation === 'vertical' ? ev.clientX : ev.clientY;
        const delta = current - last;
        if (delta !== 0) {
          onResizeRef.current(delta);
          last = current;
        }
      };
      const up = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        document.removeEventListener('pointercancel', up);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousSelect;
        onCommitRef.current?.();
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', up);
    },
    [orientation], // onResize/onCommit are accessed via ref — no longer needed in deps
  );

  return (
    <div
      className={`splitter splitter--${orientation} ${className ?? ''}`}
      role="separator"
      aria-label={ariaLabel}
      aria-orientation={orientation === 'vertical' ? 'vertical' : 'horizontal'}
      tabIndex={-1}
      onPointerDown={handlePointerDown}
    />
  );
}

type PhosProps = {
  children: ReactNode;
  tone?: ToneName | 'dim';
  size?: number;
  className?: string;
  as?: ElementType;
};

export function Phos({ children, tone = 'phos', size = 20, className, as = 'span' }: PhosProps) {
  return createElement(
    as,
    {
      className: `phos ${className ?? ''}`,
      'data-tone': tone,
      style: { fontSize: size },
    },
    children,
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <span className="label">{children}</span>;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  tone?: 'default' | 'prim' | 'red';
  icon?: ReactNode;
  kbd?: string;
};

export function Button({ active, tone = 'default', icon, kbd, children, className, ...props }: ButtonProps) {
  return (
    <button className={`button ${active ? 'button--active' : ''} button--${tone} ${className ?? ''}`} {...props}>
      {icon && <span className="button__icon">{icon}</span>}
      {children && <span>{children}</span>}
      {kbd && <span className="button__kbd">{kbd}</span>}
    </button>
  );
}

type SegmentedProps<T extends string | number> = {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
};

export function Segmented<T extends string | number>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <Button key={String(option.value)} active={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </Button>
      ))}
    </div>
  );
}

type SliderRowProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
  animatable?: boolean;
  animated?: boolean;
  onAnimateClick?: () => void;
};

export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  animatable = false,
  animated = false,
  onAnimateClick,
}: SliderRowProps) {
  return (
    <label className={`slider-row ${animatable ? 'slider-row--animatable' : ''}`}>
      <span>{label}</span>
      <input
        min={min}
        max={max}
        step={step}
        type="range"
        value={value}
        aria-label={label}
        aria-valuetext={display}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <strong aria-hidden="true">{display}</strong>
      {animatable && onAnimateClick && (
        <button
          type="button"
          className={`slider-row__keyframe ${animated ? 'slider-row__keyframe--on' : ''}`}
          aria-label={
            animated ? `${label} is keyframed; add keyframe at playhead` : `Animate ${label} — add a keyframe at playhead`
          }
          aria-pressed={animated}
          title={animated ? 'animated — add keyframe at playhead' : 'add keyframe at playhead'}
          onClick={(event) => {
            event.preventDefault();
            onAnimateClick();
          }}
        >
          ◆
        </button>
      )}
    </label>
  );
}
