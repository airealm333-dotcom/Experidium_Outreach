"use client"

import { Combobox } from "@base-ui/react/combobox"
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react"

export interface MultiSelectOption {
  value: string
  label: string
}

export function MultiSelect({
  label,
  options,
  values,
  onChange,
  placeholder,
}: {
  label?: string
  options: MultiSelectOption[]
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}) {
  const selectedOptions = options.filter((o) => values.includes(o.value))

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      {label && <label className="text-base font-semibold">{label}</label>}
      <Combobox.Root
        items={options}
        multiple
        value={selectedOptions}
        onValueChange={(next) => onChange(next.map((o) => o.value))}
        isItemEqualToValue={(item, value) => item.value === value.value}
      >
        <div className="mt-1 flex min-h-11 items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5">
          <Combobox.Chips className="flex flex-1 flex-wrap items-center gap-1.5">
            {selectedOptions.map((o) => (
              <Combobox.Chip
                key={o.value}
                className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-sm text-secondary-foreground"
              >
                {o.label}
                <Combobox.ChipRemove className="cursor-pointer">
                  <XIcon className="h-3 w-3" />
                </Combobox.ChipRemove>
              </Combobox.Chip>
            ))}
            <Combobox.Input
              placeholder={selectedOptions.length === 0 ? placeholder : undefined}
              className="min-w-[6rem] flex-1 bg-transparent text-base outline-none"
            />
          </Combobox.Chips>
          <Combobox.Trigger
            aria-label={label ? `Toggle ${label} options` : "Toggle options"}
            className="flex shrink-0 items-center justify-center rounded p-1 text-muted-foreground outline-none hover:bg-muted hover:text-foreground"
          >
            <Combobox.Icon>
              <ChevronDownIcon className="h-4 w-4" />
            </Combobox.Icon>
          </Combobox.Trigger>
        </div>
        <Combobox.Portal>
          <Combobox.Positioner className="isolate z-50" sideOffset={4}>
            <Combobox.Popup className="max-h-64 w-(--anchor-width) overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
              <Combobox.Empty className="px-2 py-1.5 text-sm text-muted-foreground">
                No matches
              </Combobox.Empty>
              <Combobox.List>
                {(item: MultiSelectOption) => (
                  <Combobox.Item
                    key={item.value}
                    value={item}
                    className="flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  >
                    <Combobox.ItemIndicator>
                      <CheckIcon className="h-3.5 w-3.5" />
                    </Combobox.ItemIndicator>
                    {item.label}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  )
}
