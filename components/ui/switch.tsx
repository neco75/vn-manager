"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-11 w-11 shrink-0 items-center rounded-full border border-transparent bg-transparent shadow-xs outline-none transition-colors duration-150 before:absolute before:left-1/2 before:top-1/2 before:h-[1.15rem] before:w-8 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-input before:transition-colors data-[state=checked]:before:bg-primary focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "relative z-10 ml-[6px] bg-background pointer-events-none block size-4 shrink-0 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
