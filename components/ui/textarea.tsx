import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground selection:bg-selection selection:text-selection-foreground focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-2 aria-invalid:ring-destructive/20 aria-invalid:border-destructive flex field-sizing-content min-h-11 w-full rounded-lg border bg-card px-3 py-2 text-base shadow-xs transition-[color,box-shadow] duration-150 outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
