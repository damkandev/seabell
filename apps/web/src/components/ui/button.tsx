import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[6px] border border-[rgba(0,0,0,0.1)] bg-clip-padding px-4 pb-[5px] font-mono text-[10.77px] font-normal leading-none whitespace-nowrap outline-none select-none transition-[background-color,box-shadow,padding-bottom,transform] duration-150 ease-out focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--sb-color-focus)] focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30 dark:aria-invalid:border-destructive dark:aria-invalid:ring-destructive/40 active:translate-y-[3px] active:pb-px [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-[var(--sb-color-brand)] text-[var(--sb-color-brand-text)] shadow-[0_4px_3.3px_rgba(0,0,0,0.03),inset_0_-4px_0_var(--sb-color-focus)] hover:bg-[var(--sb-color-brand-hover)] active:bg-[var(--sb-color-brand-pressed)] active:shadow-[0_1px_1.5px_rgba(0,0,0,0.02),inset_0_-1px_0_var(--sb-color-focus)]",
        outline:
          "bg-[var(--sb-color-surface)] text-[var(--sb-color-brand-text)] shadow-[0_4px_3.3px_rgba(0,0,0,0.03),inset_0_-4px_0_#a8b9a8] hover:bg-[var(--sb-color-surface-muted)] aria-expanded:bg-[var(--sb-color-surface-muted)] aria-expanded:text-foreground active:bg-[var(--sb-color-surface-pressed)] active:shadow-[0_1px_1.5px_rgba(0,0,0,0.02),inset_0_-1px_0_#a8b9a8] dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-[var(--sb-color-surface)] text-[var(--sb-color-brand-text)] shadow-[0_4px_3.3px_rgba(0,0,0,0.03),inset_0_-4px_0_#a8b9a8] hover:bg-[var(--sb-color-surface-muted)] aria-expanded:bg-[var(--sb-color-surface-muted)] aria-expanded:text-foreground active:bg-[var(--sb-color-surface-pressed)] active:shadow-[0_1px_1.5px_rgba(0,0,0,0.02),inset_0_-1px_0_#a8b9a8]",
        ghost:
          "border-transparent bg-transparent shadow-none hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "border-transparent bg-transparent px-0 pb-0 font-sans text-primary shadow-none active:translate-y-0 active:pb-0 underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-11 gap-1.5 px-4 sm:h-[2.0625rem] sm:px-4 lg:h-9 lg:text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-11 gap-1 rounded-[6px] px-3 text-[10.77px] sm:h-[2.0625rem] sm:px-3 lg:h-9 lg:text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-1.5 px-4 sm:h-[2.0625rem] sm:px-4 lg:h-9 lg:text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-11 p-0 sm:size-[2.0625rem] lg:size-9",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
