import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium tracking-wide transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Default = white block, black text. The signature Starlink CTA.
        default:
          'bg-foreground text-background hover:bg-foreground/90 active:bg-foreground/80',
        // Outline = thin border, transparent.
        outline:
          'border border-foreground/40 bg-transparent text-foreground hover:bg-foreground/5 hover:border-foreground/80',
        // Destructive — used sparingly.
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        // Secondary = dark gray block.
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border',
        // Ghost — text-only.
        ghost:
          'text-foreground hover:bg-foreground/5',
        // Link — underline only.
        link:
          'text-foreground underline-offset-4 hover:underline',
        // Legacy "gradient" alias kept for compat — same as default.
        gradient:
          'bg-foreground text-background hover:bg-foreground/90 active:bg-foreground/80',
      },
      size: {
        default: 'h-10 px-5 py-2 uppercase text-xs tracking-[0.18em]',
        sm:      'h-8  px-3 text-[11px] uppercase tracking-[0.16em]',
        lg:      'h-12 px-7 uppercase text-xs tracking-[0.20em]',
        xl:      'h-14 px-9 uppercase text-sm tracking-[0.20em]',
        icon:    'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
