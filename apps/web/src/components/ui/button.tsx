import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[3px] font-sans text-[13px] whitespace-nowrap outline-none select-none press focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-ink text-surface shadow-[inset_0_-2px_0_rgb(0_0_0/35%)] hover:bg-[#2b2f35]",
        outline: "bg-paper text-ink shadow-[inset_0_0_0_1px_var(--line)] hover:shadow-[inset_0_0_0_1px_var(--ink-3)]",
        secondary: "bg-surface-3 text-ink hover:bg-line",
        ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
        destructive: "text-destructive hover:bg-destructive/10",
        link: "text-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3",
        xs: "h-6 px-2 text-xs",
        sm: "h-7 px-2.5 text-xs",
        lg: "h-9 px-4",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
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
