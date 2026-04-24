import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { ToneName } from '../engine/types';

type PanelProps = {
  title?: string;
  flags?: string;
  tools?: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  dense?: boolean;
  tone?: ToneName;
  className?: string;
  children: ReactNode;
};

export function Panel({ title, flags, tools, footer, flush, dense, tone = 'phos', className, children }: PanelProps) {
  return (
    <section className={`panel ${className ?? ''}`} data-tone={tone}>
      {(title || tools) && (
        <div className="panel__bar">
          <div className="panel__title">
            {title && <span className="panel__signal" />}
            {title && <span>{title}</span>}
            {flags && <span className="panel__flags">{flags}</span>}
          </div>
          {tools && <div className="panel__tools">{tools}</div>}
        </div>
      )}
      <div className={`panel__body ${flush ? 'panel__body--flush' : ''} ${dense ? 'panel__body--dense' : ''}`}>
        {children}
      </div>
      {footer && <div className="panel__footer">{footer}</div>}
    </section>
  );
}

type PhosProps = {
  children: ReactNode;
  tone?: ToneName | 'dim';
  size?: number;
  className?: string;
};

export function Phos({ children, tone = 'phos', size = 20, className }: PhosProps) {
  return (
    <span className={`phos ${className ?? ''}`} data-tone={tone} style={{ fontSize: size }}>
      {children}
    </span>
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
};

export function SliderRow({ label, value, min, max, step, display, onChange }: SliderRowProps) {
  return (
    <label className="slider-row">
      <span>{label}</span>
      <input
        min={min}
        max={max}
        step={step}
        type="range"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <strong>{display}</strong>
    </label>
  );
}
