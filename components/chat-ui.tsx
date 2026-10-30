'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  File,
  FileSpreadsheet,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from 'react';

/* -------------------------------------------------------------------------- */
/*  Shared focus ring                                                          */
/* -------------------------------------------------------------------------- */

export const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-[var(--qp-focus-ring)]/70 focus-visible:ring-offset-0';

/* -------------------------------------------------------------------------- */
/*  IconButton                                                                 */
/*  forwardRef + prop spreading so it also works as <MenuTrigger asChild>.     */
/* -------------------------------------------------------------------------- */

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** Accessible name; also used as the tooltip. */
  label: string;
  icon: LucideIcon;
  size?: number;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon: Icon, size = 18, className = '', type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={`grid size-9 flex-none place-items-center rounded-lg text-zinc-400 transition-colors duration-150 hover:bg-white/[0.07] hover:text-zinc-100 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none ${focusRing} ${className}`}
      {...props}
    >
      <Icon size={size} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
});

/* -------------------------------------------------------------------------- */
/*  Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
};

const BUTTON_VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-zinc-100 text-zinc-950 hover:bg-white active:bg-zinc-200',
  secondary: 'bg-white/[0.06] text-zinc-100 ring-1 ring-inset ring-white/[0.1] hover:bg-white/[0.1]',
  ghost: 'text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-100',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', className = '', type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-[16px] font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none ${BUTTON_VARIANTS[variant]} ${focusRing} ${className}`}
      {...props}
    />
  );
});

/* -------------------------------------------------------------------------- */
/*  Menu (Radix dropdown menu with the app's styling)                          */
/* -------------------------------------------------------------------------- */

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export const MenuContent = forwardRef<
  ElementRef<typeof DropdownMenu.Content>,
  ComponentPropsWithoutRef<typeof DropdownMenu.Content>
>(function MenuContent({ className = '', sideOffset = 6, collisionPadding = 8, ...props }, ref) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={`qp-menu z-[60] min-w-[200px] max-w-[92vw] rounded-xl border border-[var(--qp-border)] bg-[var(--qp-surface)] p-1.5 font-sans text-[var(--qp-text-primary)] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)] ${className}`}
        {...props}
      />
    </DropdownMenu.Portal>
  );
});

type MenuItemProps = ComponentPropsWithoutRef<typeof DropdownMenu.Item> & {
  /** Red text for destructive actions such as Delete or Sign out. */
  danger?: boolean;
};

export const MenuItem = forwardRef<ElementRef<typeof DropdownMenu.Item>, MenuItemProps>(function MenuItem(
  { className = '', danger = false, ...props },
  ref
) {
  return (
    <DropdownMenu.Item
      ref={ref}
      className={`flex h-10 w-full cursor-pointer select-none items-center gap-3 rounded-lg px-2.5 text-[16px] outline-none transition-colors duration-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-[var(--qp-surface-hover)] ${
        danger ? 'text-red-300 data-[highlighted]:text-red-200' : 'text-[var(--qp-text-primary)] data-[highlighted]:text-white'
      } ${className}`}
      {...props}
    />
  );
});

export const MenuLabel = forwardRef<
  ElementRef<typeof DropdownMenu.Label>,
  ComponentPropsWithoutRef<typeof DropdownMenu.Label>
>(function MenuLabel({ className = '', ...props }, ref) {
  return (
    <DropdownMenu.Label
      ref={ref}
      className={`truncate px-2.5 pb-1.5 pt-1.5 text-[13px] font-medium text-[var(--qp-text-muted)] ${className}`}
      {...props}
    />
  );
});

export const MenuSeparator = forwardRef<
  ElementRef<typeof DropdownMenu.Separator>,
  ComponentPropsWithoutRef<typeof DropdownMenu.Separator>
>(function MenuSeparator({ className = '', ...props }, ref) {
  return <DropdownMenu.Separator ref={ref} className={`my-1.5 h-px bg-[var(--qp-border)] ${className}`} {...props} />;
});

/** Open/close animation for every menu. Render it once near the app root. */
export function MenuStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
        @keyframes qp-menu-in { 0% { opacity: 0; transform: translateY(-4px) scale(0.98); } 100% { opacity: 1; transform: none; } }
        @keyframes qp-menu-out { 0% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(-4px) scale(0.98); } }
        .qp-menu[data-state="open"] { animation: qp-menu-in 120ms ease-out both; transform-origin: var(--radix-dropdown-menu-content-transform-origin); }
        .qp-menu[data-state="closed"] { animation: qp-menu-out 90ms ease-in both; transform-origin: var(--radix-dropdown-menu-content-transform-origin); }
        @media (prefers-reduced-motion: reduce) {
          .qp-menu[data-state="open"], .qp-menu[data-state="closed"] { animation: none; }
        }
      `,
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  File kinds (used by the Sources list in the sidebar)                       */
/* -------------------------------------------------------------------------- */

export type FileKind = {
  label: string;
  Icon: LucideIcon;
  /** Classes for the square badge behind the icon. */
  badge: string;
};

const BADGE = 'bg-white/[0.06] text-zinc-300';

export function fileKind(name: string): FileKind {
  const ext = name.trim().toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'pdf':
      return { label: 'PDF', Icon: FileText, badge: BADGE };
    case 'doc':
    case 'docx':
      return { label: 'Word', Icon: FileText, badge: BADGE };
    case 'xls':
    case 'xlsx':
    case 'xlsm':
      return { label: 'Excel', Icon: FileSpreadsheet, badge: BADGE };
    case 'csv':
      return { label: 'CSV', Icon: FileSpreadsheet, badge: BADGE };
    case 'tsv':
      return { label: 'TSV', Icon: FileSpreadsheet, badge: BADGE };
    case 'txt':
    case 'md':
      return { label: 'Text', Icon: FileText, badge: BADGE };
    default:
      return { label: 'File', Icon: File, badge: BADGE };
  }
}