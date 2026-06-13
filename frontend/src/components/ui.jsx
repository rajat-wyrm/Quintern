// ============================================================================
//  DESIGN SYSTEM — 2026 MAANG-style primitives
// ============================================================================
//  Every component is designed for:
//    • Light + dark mode (uses CSS variables)
//    • Mobile + tablet + desktop + ultrawide
//    • Reduced-motion users (handled in index.css)
//    • Touch targets ≥ 36px where interactive
// ============================================================================

import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { Link } from 'react-router-dom';

// ----------------------------------------------------------------------------
// 1.  CLASS NAMES
// ----------------------------------------------------------------------------
export function cx(...parts) {
  return parts.flat(Infinity).filter(Boolean).join(' ');
}

// ----------------------------------------------------------------------------
// 2.  AVATAR — initials + status dot + image
// ----------------------------------------------------------------------------
function initialsOf(name = '') {
  return (
    String(name)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || '')
      .join('') || '?'
  );
}

const SIZE = {
  xs: {
    box: 'w-6 h-6 text-[10px]',
    dot: 'w-1.5 h-1.5 border',
    statusOffset: '-bottom-0 -right-0',
  },
  sm: {
    box: 'w-8 h-8 text-xs',
    dot: 'w-2 h-2 border-2',
    statusOffset: '-bottom-0 -right-0',
  },
  md: {
    box: 'w-10 h-10 text-sm',
    dot: 'w-2.5 h-2.5 border-2',
    statusOffset: '-bottom-0.5 -right-0.5',
  },
  lg: {
    box: 'w-12 h-12 text-base',
    dot: 'w-3 h-3 border-2',
    statusOffset: '-bottom-0.5 -right-0.5',
  },
  xl: {
    box: 'w-16 h-16 text-lg',
    dot: 'w-3.5 h-3.5 border-2',
    statusOffset: '-bottom-0.5 -right-0.5',
  },
};

const STATUS_TONES = {
  online: 'bg-emerald-500',
  busy: 'bg-amber-500',
  away: 'bg-amber-400',
  offline: 'bg-zinc-400',
  suspended: 'bg-danger-500',
};

export function Avatar({
  name,
  email,
  src,
  size = 'md',
  status,
  className = '',
  ring = false,
}) {
  const sz = SIZE[size] || SIZE.md;
  const initials = useMemo(
    () => initialsOf(name || email || ''),
    [name, email]
  );
  const hue = useMemo(() => {
    const s = String(name || email || 'x');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }, [name, email]);
  const gradient = `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 50) % 360} 65% 50%))`;
  return (
    <span
      className={cx(
        'relative inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 select-none',
        sz.box,
        ring &&
          'ring-2 ring-offset-2 ring-offset-surface-base ring-brand-500/50',
        className
      )}
      style={!src ? { background: gradient } : undefined}
      aria-label={name || email}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="w-full h-full rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="tracking-tight">{initials}</span>
      )}
      {status && (
        <span
          aria-hidden="true"
          className={cx(
            'absolute rounded-full ring-2 ring-surface-raised',
            sz.dot,
            sz.statusOffset,
            STATUS_TONES[status] || STATUS_TONES.offline
          )}
        />
      )}
    </span>
  );
}

// ----------------------------------------------------------------------------
// 3.  BADGE — small status pill
// ----------------------------------------------------------------------------
const BADGE_TONES = {
  brand: 'bg-brand-50 text-brand-700 border-brand-100',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  danger: 'bg-rose-50 text-rose-700 border-rose-100',
  info: 'bg-sky-50 text-sky-700 border-sky-100',
  neutral: 'bg-surface-sunken text-fg-muted border-border',
};
const BADGE_TONES_DARK = {
  brand: 'bg-brand-500/15 text-brand-300 border-brand-500/20',
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  danger: 'bg-rose-500/15 text-rose-300 border-rose-500/20',
  info: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
  neutral: 'bg-surface-sunken text-fg-muted border-border',
};
const BADGE_SIZES = {
  xs: 'px-1.5 py-0 text-[10px] gap-1',
  sm: 'px-1.5 py-0.5 text-[11px] gap-1',
  md: 'px-2 py-0.5 text-xs gap-1.5',
  lg: 'px-2.5 py-1 text-sm gap-1.5',
};

export function Badge({
  tone = 'neutral',
  size = 'sm',
  dot,
  children,
  className = '',
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border font-medium whitespace-nowrap',
        BADGE_SIZES[size],
        BADGE_TONES[tone],
        'dark:' + BADGE_TONES_DARK[tone],
        className
      )}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cx(
            'w-1.5 h-1.5 rounded-full',
            {
              brand: 'bg-brand-500',
              success: 'bg-emerald-500',
              warning: 'bg-amber-500',
              danger: 'bg-rose-500',
              info: 'bg-sky-500',
              neutral: 'bg-fg-muted',
            }[tone] || 'bg-fg-muted'
          )}
        />
      )}
      {children}
    </span>
  );
}

// ----------------------------------------------------------------------------
// 4.  BUTTON — variants × sizes
// ----------------------------------------------------------------------------
const BTN_VARIANTS = {
  primary:
    'bg-brand-600 hover:bg-brand-500 text-white shadow-sm shadow-brand-600/20',
  secondary:
    'bg-surface-raised hover:bg-surface-sunken text-fg border border-border',
  ghost: 'bg-transparent hover:bg-surface-sunken text-fg-muted hover:text-fg',
  outline:
    'bg-transparent hover:bg-surface-sunken text-fg border border-border-strong',
  danger:
    'bg-danger-500 hover:bg-danger-600 text-white shadow-sm shadow-danger-500/20',
  success:
    'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/20',
  link: 'bg-transparent text-brand-600 hover:text-brand-700 hover:bg-transparent',
};
const BTN_SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1.5',
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
  xl: 'h-12 px-6 text-base gap-2.5',
  icon: 'h-9 w-9 p-0',
  'icon-sm': 'h-8 w-8 p-0',
};

export const Button = forwardRef(function Button(
  {
    variant = 'secondary',
    size = 'md',
    type = 'button',
    leftIcon,
    rightIcon,
    loading = false,
    children,
    className = '',
    disabled,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={cx(
        'inline-flex items-center justify-center font-medium rounded-md whitespace-nowrap',
        'transition-all duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        BTN_SIZES[size],
        BTN_VARIANTS[variant],
        className
      )}
      {...rest}
    >
      {loading ? (
        <svg
          className="animate-spin w-3.5 h-3.5"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            strokeOpacity="0.25"
          />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        leftIcon
      )}
      {children && <span className="truncate">{children}</span>}
      {rightIcon}
    </button>
  );
});

export const Btn = Button; // back-compat alias

// ----------------------------------------------------------------------------
// 5.  INPUT — text, email, password, number, search
// ----------------------------------------------------------------------------
const INPUT_BASE =
  'w-full rounded-md border bg-surface-raised text-fg placeholder:text-fg-subtle transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed';
const INPUT_NORMAL = 'border-border hover:border-border-strong';
const INPUT_ERROR =
  'border-danger-500 focus:ring-danger-500/30 focus:border-danger-500';
const INPUT_SIZES = {
  sm: 'h-8 text-sm',
  md: 'h-9 text-sm',
  lg: 'h-11 text-[15px]',
};

export const Input = forwardRef(function Input(
  {
    label,
    hint,
    error,
    leftIcon,
    rightIcon,
    size = 'md',
    className = '',
    id,
    wrapperClassName = '',
    ...rest
  },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className={cx('space-y-1.5', wrapperClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-fg-muted"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cx(
            INPUT_BASE,
            INPUT_SIZES[size],
            leftIcon ? 'pl-9' : 'pl-3',
            rightIcon ? 'pr-9' : 'pr-3',
            error ? INPUT_ERROR : INPUT_NORMAL,
            className
          )}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={hint || error ? `${inputId}-desc` : undefined}
          {...rest}
        />
        {rightIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle">
            {rightIcon}
          </span>
        )}
      </div>
      {(hint || error) && (
        <p
          id={`${inputId}-desc`}
          className={cx(
            'text-[11px]',
            error ? 'text-danger-600' : 'text-fg-muted'
          )}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
});

// ----------------------------------------------------------------------------
// 6.  TEXTAREA
// ----------------------------------------------------------------------------
export const Textarea = forwardRef(function Textarea(
  { label, hint, error, className = '', id, rows = 3, ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-fg-muted"
        >
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={cx(
          INPUT_BASE,
          'px-3 py-2 resize-y',
          error ? INPUT_ERROR : INPUT_NORMAL,
          className
        )}
        aria-describedby={hint || error ? `${inputId}-desc` : undefined}
        {...rest}
      />
      {(hint || error) && (
        <p
          id={`${inputId}-desc`}
          className={cx(
            'text-[11px]',
            error ? 'text-danger-600' : 'text-fg-muted'
          )}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
});

// ----------------------------------------------------------------------------
// 7.  SELECT
// ----------------------------------------------------------------------------
export const Select = forwardRef(function Select(
  { label, hint, error, children, className = '', id, ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-fg-muted"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={inputId}
          className={cx(
            INPUT_BASE,
            'h-9 pl-3 pr-9 text-sm appearance-none cursor-pointer',
            error ? INPUT_ERROR : INPUT_NORMAL,
            className
          )}
          {...rest}
        >
          {children}
        </select>
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-subtle pointer-events-none"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </div>
      {(hint || error) && (
        <p
          className={cx(
            'text-[11px]',
            error ? 'text-danger-600' : 'text-fg-muted'
          )}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
});

// ----------------------------------------------------------------------------
// 8.  CHECKBOX + SWITCH
// ----------------------------------------------------------------------------
export function Checkbox({ id, label, description, className = '', ...rest }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <label
      htmlFor={inputId}
      className={cx(
        'inline-flex items-start gap-2.5 cursor-pointer group',
        className
      )}
    >
      <span className="relative inline-flex shrink-0 mt-0.5">
        <input
          type="checkbox"
          id={inputId}
          className="peer sr-only"
          {...rest}
        />
        <span className="w-4 h-4 rounded border-2 border-border-strong bg-surface-raised transition-colors peer-checked:bg-brand-600 peer-checked:border-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/30 group-hover:border-brand-500" />
        <svg
          className="absolute inset-0 w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M13.5 4.5L6 12L2.5 8.5L3.91 7.09L6 9.17L12.09 3.09L13.5 4.5Z" />
        </svg>
      </span>
      {(label || description) && (
        <span className="min-w-0">
          {label && (
            <span className="block text-sm font-medium text-fg select-none">
              {label}
            </span>
          )}
          {description && (
            <span className="block text-xs text-fg-muted mt-0.5">
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  );
}

// ----------------------------------------------------------------------------
// 9.  CARD
// ----------------------------------------------------------------------------
export function Card({
  children,
  className = '',
  interactive = false,
  padded = true,
  ...rest
}) {
  return (
    <div
      className={cx(
        'bg-surface-raised border border-border rounded-lg overflow-hidden',
        interactive && 'lift cursor-pointer',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div
      className={cx(
        'flex items-start justify-between gap-3 px-5 pt-4.5 pb-3',
        !subtitle && title && 'py-3.5',
        className
      )}
    >
      <div className="min-w-0">
        {title && (
          <h3 className="text-sm font-semibold text-fg tracking-tight">
            {title}
          </h3>
        )}
        {subtitle && <p className="text-xs text-fg-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && (
        <div className="shrink-0 flex items-center gap-1.5">{actions}</div>
      )}
    </div>
  );
}

export function CardBody({ children, className = '', padded = true }) {
  return <div className={cx(padded && 'p-5', className)}>{children}</div>;
}

// ----------------------------------------------------------------------------
// 10. BANNER
// ----------------------------------------------------------------------------
const BANNER_TONES = {
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200',
  danger:
    'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200',
  info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200',
};
const BANNER_ICONS = {
  success: (
    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
  ),
  warning: (
    <path d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
  ),
  danger: (
    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
  ),
  info: (
    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" />
  ),
};

export function Banner({
  kind = 'info',
  children,
  className = '',
  icon,
  onClose,
}) {
  return (
    <div
      role="alert"
      className={cx(
        'flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-sm',
        BANNER_TONES[kind],
        className
      )}
    >
      {icon !== false && (
        <svg
          className="w-4 h-4 mt-0.5 shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          {BANNER_ICONS[kind] || BANNER_ICONS.info}
        </svg>
      )}
      <div className="flex-1 min-w-0">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="opacity-60 hover:opacity-100 shrink-0 -mt-0.5"
          aria-label="Dismiss"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 11. PROGRESS
// ----------------------------------------------------------------------------
const PROGRESS_TONES = {
  brand: 'bg-brand-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-sky-500',
};
export function Progress({
  value = 0,
  max = 100,
  tone = 'brand',
  className = '',
  showLabel = false,
}) {
  const pct = Math.max(0, Math.min(100, (Number(value) / Number(max)) * 100));
  return (
    <div className={cx('w-full', className)}>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div
          className={cx(
            'h-full rounded-full transition-all duration-500 ease-out',
            PROGRESS_TONES[tone] || PROGRESS_TONES.brand
          )}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showLabel && (
        <p className="text-[10px] text-fg-muted mt-1 tabular-nums">
          {Math.round(pct)}%
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 12. STAT CARD
// ----------------------------------------------------------------------------
export function StatCard({
  label,
  value,
  hint,
  icon,
  gradient = 'from-brand-500 to-violet-600',
  trend,
  className = '',
  children,
}) {
  return (
    <Card className={cx('relative overflow-hidden', className)}>
      <div
        className={cx(
          'absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.08] -mr-8 -mt-8 bg-gradient-to-br pointer-events-none',
          gradient
        )}
        aria-hidden="true"
      />
      <CardBody className="relative">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-[11px] font-medium text-fg-muted uppercase tracking-wider">
            {label}
          </p>
          {icon && (
            <span
              className={cx(
                'w-7 h-7 rounded-md flex items-center justify-center text-white shadow-sm bg-gradient-to-br',
                gradient
              )}
              aria-hidden="true"
            >
              {icon}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-semibold text-fg tabular-nums tracking-tight">
            {value}
          </p>
          {trend && (
            <Badge
              tone={
                trend.direction === 'up'
                  ? 'success'
                  : trend.direction === 'down'
                    ? 'danger'
                    : 'neutral'
              }
              size="xs"
              dot
            >
              {trend.value}
            </Badge>
          )}
        </div>
        {hint && <p className="text-[11px] text-fg-muted mt-1">{hint}</p>}
        {children && <div className="mt-2">{children}</div>}
      </CardBody>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// 13. SPINNER / SKELETON
// ----------------------------------------------------------------------------
export function Spinner({ size = 'md', label, className = '' }) {
  const sizes = {
    sm: 'w-3.5 h-3.5 border-2',
    md: 'w-5 h-5 border-2',
    lg: 'w-8 h-8 border-[3px]',
  };
  return (
    <div
      className={cx(
        'inline-flex items-center gap-2.5 text-fg-muted',
        className
      )}
      role="status"
      aria-label={label || 'Loading'}
    >
      <span
        className={cx(
          'inline-block rounded-full border-current border-t-transparent animate-spin',
          sizes[size] || sizes.md
        )}
        aria-hidden="true"
      />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function Skeleton({ className = '', ...rest }) {
  return (
    <div
      className={cx('skeleton h-3.5 w-full', className)}
      aria-hidden="true"
      {...rest}
    />
  );
}

export function SkeletonStat({ className = '' }) {
  return (
    <Card className={className}>
      <CardBody>
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-28 mt-2.5" />
        <Skeleton className="h-2.5 w-32 mt-2" />
      </CardBody>
    </Card>
  );
}

export function SkeletonTable({ rows = 5, cols = 5, className = '' }) {
  return (
    <Card className={className}>
      <div className="p-4 border-b border-border bg-surface-sunken/50">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols }, (_, i) => (
            <Skeleton key={i} className="h-2.5" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="p-4 grid gap-3"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {Array.from({ length: cols }, (_, j) => (
              <Skeleton key={j} className="h-3" />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// 14. EMPTY STATE
// ----------------------------------------------------------------------------
export function EmptyState({
  icon = '✨',
  title,
  description,
  action,
  illustration,
  className = '',
}) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center text-center py-12 px-6',
        className
      )}
    >
      {illustration ? (
        <div className="mb-4">{illustration}</div>
      ) : (
        <div
          className="w-14 h-14 rounded-md bg-surface-sunken text-fg-muted flex items-center justify-center text-2xl mb-3"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      {title && (
        <h3 className="text-sm font-semibold text-fg tracking-tight">
          {title}
        </h3>
      )}
      {description && (
        <p className="text-xs text-fg-muted mt-1.5 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 15. TOOLTIP
// ----------------------------------------------------------------------------
export function Tooltip({ content, children, side = 'top', className = '' }) {
  const [open, setOpen] = useState(false);
  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };
  return (
    <span
      className={cx('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && content && (
        <span
          role="tooltip"
          className={cx(
            'absolute z-50 px-2 py-1 rounded-md bg-fg text-fg-inverse text-[11px] font-medium whitespace-nowrap shadow-lg pointer-events-none',
            positions[side]
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}

// ----------------------------------------------------------------------------
// 16. STARS — 1-10 segmented
// ----------------------------------------------------------------------------
export function Stars({ value = 0, max = 10, size = 'sm', className = '' }) {
  const sizes = { xs: 'h-2 w-1.5', sm: 'h-2.5 w-1.5', md: 'h-3 w-2' };
  const filled = Math.round(Math.max(0, Math.min(max, Number(value) || 0)));
  const pct = filled / max;
  const tone =
    pct >= 0.8 ? 'bg-emerald-500' : pct >= 0.6 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div
      className={cx('inline-flex items-center gap-0.5', className)}
      role="img"
      aria-label={`${value} out of ${max}`}
    >
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={cx(
            'inline-block rounded-sm transition-colors',
            sizes[size] || sizes.sm,
            i < filled ? tone : 'bg-border'
          )}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 17. MODAL — accessible dialog
// ----------------------------------------------------------------------------
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  footer,
  children,
  className = '',
}) {
  const SIZES = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="absolute inset-0 bg-surface-overlay/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        className={cx(
          'relative w-full bg-surface-raised border border-border rounded-lg shadow-2xl flex flex-col max-h-[90vh] animate-scale-in',
          SIZES[size] || SIZES.md,
          className
        )}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-3 px-5 pt-4.5 pb-3 border-b border-border">
            <div>
              {title && (
                <h2
                  id="modal-title"
                  className="text-base font-semibold text-fg tracking-tight"
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs text-fg-muted mt-0.5">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 -mt-1 -mr-1 rounded hover:bg-surface-sunken text-fg-muted hover:text-fg transition-colors"
              aria-label="Close dialog"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.11.05 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 bg-surface-sunken/30">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 18. CONFIRM DIALOG
// ----------------------------------------------------------------------------
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-fg-muted leading-relaxed">{message}</p>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// 19. DRAWER
// ----------------------------------------------------------------------------
export function Drawer({
  open,
  onClose,
  side = 'right',
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}) {
  const SIZES = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-surface-overlay/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cx(
          'absolute top-0 bottom-0 w-full bg-surface-raised border-border flex flex-col shadow-2xl animate-slide-in-right',
          side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          SIZES[size] || SIZES.md
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-border">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-fg tracking-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-fg-muted mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-surface-sunken text-fg-muted hover:text-fg"
            aria-label="Close"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.11.05 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 bg-surface-sunken/30">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 20. TABS
// ----------------------------------------------------------------------------
export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div
      className={cx(
        'flex items-center gap-1 border-b border-border overflow-x-auto',
        className
      )}
      role="tablist"
    >
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            'relative px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
            value === t.value ? 'text-fg' : 'text-fg-muted hover:text-fg'
          )}
        >
          {t.label}
          {t.badge != null && (
            <span className="ml-1.5 text-[10px] text-fg-muted tabular-nums">
              ({t.badge})
            </span>
          )}
          {value === t.value && (
            <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-fg rounded-t-full" />
          )}
        </button>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 21. DROPDOWN — accessible menu
// ----------------------------------------------------------------------------
export function Dropdown({
  trigger,
  children,
  align = 'right',
  className = '',
  menuClassName = '',
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const close = useCallback(() => setOpen(false), []);
  return (
    <div ref={ref} className={cx('relative inline-block', className)}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          role="menu"
          className={cx(
            'absolute z-40 min-w-[200px] mt-1 py-1 bg-surface-raised border border-border rounded-lg shadow-xl overflow-hidden animate-slide-down',
            align === 'right'
              ? 'right-0'
              : align === 'left'
                ? 'left-0'
                : 'left-1/2 -translate-x-1/2',
            menuClassName
          )}
        >
          {typeof children === 'function' ? children({ close }) : children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  icon,
  onClick,
  children,
  danger = false,
  className = '',
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cx(
        'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left transition-colors',
        danger
          ? 'text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-500/10'
          : 'text-fg hover:bg-surface-sunken',
        className
      )}
    >
      {icon && (
        <span
          className={cx(
            'shrink-0',
            danger ? 'text-danger-500' : 'text-fg-muted'
          )}
        >
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{children}</span>
    </button>
  );
}

export function DropdownLabel({ children }) {
  return (
    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
      {children}
    </div>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 border-t border-border" />;
}

// ----------------------------------------------------------------------------
// 22. TOAST
// ----------------------------------------------------------------------------
let toastIdCounter = 0;
let externalPush = null;
export function toast({ kind = 'info', title, description, duration = 4000 }) {
  if (externalPush)
    externalPush({ id: ++toastIdCounter, kind, title, description, duration });
}

const TOAST_TONES = {
  success:
    'border-emerald-200 bg-surface-raised text-fg dark:border-emerald-500/30',
  warning:
    'border-amber-200 bg-surface-raised text-fg dark:border-amber-500/30',
  danger: 'border-rose-200 bg-surface-raised text-fg dark:border-rose-500/30',
  info: 'border-sky-200 bg-surface-raised text-fg dark:border-sky-500/30',
};
const TOAST_ICON_TONES = {
  success: 'bg-emerald-100 text-emerald-600',
  warning: 'bg-amber-100 text-amber-600',
  danger: 'bg-rose-100 text-rose-600',
  info: 'bg-sky-100 text-sky-600',
};

export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    externalPush = (t) => {
      setItems((prev) => [...prev, t]);
      setTimeout(
        () => setItems((prev) => prev.filter((x) => x.id !== t.id)),
        t.duration
      );
    };
    return () => {
      externalPush = null;
    };
  }, []);
  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm"
      aria-live="polite"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cx(
            'pointer-events-auto flex items-start gap-3 rounded-lg border shadow-lg px-3.5 py-2.5 w-80 animate-slide-in-right',
            TOAST_TONES[t.kind] || TOAST_TONES.info
          )}
        >
          <div
            className={cx(
              'shrink-0 w-6 h-6 rounded-full flex items-center justify-center',
              TOAST_ICON_TONES[t.kind] || TOAST_ICON_TONES.info
            )}
            aria-hidden="true"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              {t.kind === 'success' && (
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
              )}
              {t.kind === 'danger' && (
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
              )}
              {t.kind === 'warning' && (
                <path d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
              )}
              {(t.kind === 'info' || !t.kind) && (
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" />
              )}
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            {t.title && (
              <div className="text-sm font-medium text-fg leading-snug">
                {t.title}
              </div>
            )}
            {t.description && (
              <div className="text-xs text-fg-muted mt-0.5 leading-relaxed">
                {t.description}
              </div>
            )}
          </div>
          <button
            onClick={() =>
              setItems((prev) => prev.filter((x) => x.id !== t.id))
            }
            aria-label="Dismiss"
            className="shrink-0 text-fg-muted hover:text-fg"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.11.05 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 23. COMMAND PALETTE
// ----------------------------------------------------------------------------
export function CommandPalette({
  open,
  onClose,
  items = [],
  placeholder = 'Search…',
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        (it.hint || '').toLowerCase().includes(q)
    );
  }, [items, query]);
  useEffect(() => {
    setActive(0);
  }, [query]);
  const run = (it) => {
    onClose();
    setTimeout(() => it.onSelect?.(), 50);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        filtered[active] && run(filtered[active]);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, filtered, active]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="absolute inset-0 bg-surface-overlay/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-xl bg-surface-raised border border-border rounded-lg shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-border">
          <svg
            className="w-4 h-4 text-fg-muted shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-fg text-sm outline-none placeholder:text-fg-subtle"
          />
          <kbd className="text-[10px] font-mono text-fg-muted bg-surface-sunken border border-border rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <div className="px-3.5 py-8 text-center text-sm text-fg-muted">
              No results for "{query}"
            </div>
          ) : (
            filtered.map((it, i) => (
              <button
                key={i}
                onClick={() => run(it)}
                onMouseEnter={() => setActive(i)}
                className={cx(
                  'w-full flex items-center gap-3 px-3.5 py-2 text-sm text-left transition-colors',
                  i === active ? 'bg-surface-sunken' : 'bg-transparent'
                )}
              >
                <span className="shrink-0 text-fg-muted">{it.icon}</span>
                <span className="flex-1 truncate text-fg">{it.label}</span>
                {it.hint && (
                  <kbd className="text-[10px] font-mono text-fg-muted bg-surface-base border border-border rounded px-1.5 py-0.5 truncate max-w-[160px]">
                    {it.hint}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
        <div className="flex items-center justify-between gap-3 px-3.5 py-2 border-t border-border bg-surface-sunken/40 text-[10px] text-fg-muted">
          <span>
            <kbd className="font-mono">↑↓</kbd> navigate ·{' '}
            <kbd className="font-mono">↵</kbd> open ·{' '}
            <kbd className="font-mono">esc</kbd> close
          </span>
          <span className="text-fg-muted">Quintern</span>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 24. PAGE HEADER + BREADCRUMB
// ----------------------------------------------------------------------------
export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  className = '',
}) {
  return (
    <div
      className={cx(
        'mb-6 flex items-start justify-between gap-3 flex-wrap',
        className
      )}
    >
      <div className="min-w-0">
        {breadcrumbs && (
          <nav
            className="flex items-center gap-1.5 text-[11px] font-medium text-fg-muted mb-1.5"
            aria-label="Breadcrumb"
          >
            {breadcrumbs.map((it, i) => {
              const last = i === breadcrumbs.length - 1;
              return (
                <span key={i} className="flex items-center gap-1.5">
                  {it.href && !last ? (
                    <Link
                      to={it.href}
                      className="hover:text-fg transition-colors"
                    >
                      {it.label}
                    </Link>
                  ) : (
                    <span className={last ? 'text-fg' : ''}>{it.label}</span>
                  )}
                  {!last && (
                    <svg
                      className="w-2.5 h-2.5"
                      viewBox="0 0 12 12"
                      fill="currentColor"
                    >
                      <path d="M4.5 2.5L8 6L4.5 9.5L3.5 8.5L6 6L3.5 3.5L4.5 2.5Z" />
                    </svg>
                  )}
                </span>
              );
            })}
          </nav>
        )}
        {title && (
          <h1 className="text-2xl font-semibold tracking-tight text-fg">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="text-sm text-fg-muted mt-1.5 leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export function SectionHeader({ title, description, action, className = '' }) {
  return (
    <div
      className={cx('flex items-start justify-between gap-3 mb-3', className)}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-fg tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-fg-muted mt-0.5">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
