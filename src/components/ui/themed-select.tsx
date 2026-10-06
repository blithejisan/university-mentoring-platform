"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { Children, isValidElement, type ReactNode } from "react";

type OptionProps = {
  value?: string;
  disabled?: boolean;
  children?: ReactNode;
};

const EMPTY_OPTION_VALUE = "__themed_select_empty_option__";

type ThemedSelectProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  value?: string;
  defaultValue?: string;
  onChange?: (event: { target: { value: string } }) => void;
};

function getOptions(children: ReactNode) {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<OptionProps>(child) || child.type !== "option") return [];
    return [child];
  });
}

export function ThemedSelect({
  children,
  value,
  defaultValue,
  onChange,
  className,
  id,
  name,
  required,
  disabled,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: ThemedSelectProps) {
  const options = getOptions(children);
  const placeholder = options.find((option) => option.props.value === "");
  const emptyValue = placeholder ? EMPTY_OPTION_VALUE : undefined;
  const selectedValue = value === undefined
    ? undefined
    : value || emptyValue;
  const initialValue = defaultValue === undefined
    ? undefined
    : defaultValue || emptyValue;

  return (
    <SelectPrimitive.Root
      name={name}
      required={required}
      disabled={disabled}
      value={selectedValue}
      defaultValue={initialValue}
      onValueChange={(nextValue) =>
        onChange?.({
          target: { value: nextValue === EMPTY_OPTION_VALUE ? "" : nextValue },
        })
      }
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        className={`inline-flex min-h-10 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:min-w-0 [&>span]:truncate ${className ?? ""}`}
      >
        <SelectPrimitive.Value placeholder={placeholder?.props.children} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 opacity-70" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-[100] max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-slate-800 bg-slate-900 text-slate-100 shadow-xl"
        >
          <SelectPrimitive.Viewport className="max-h-80 overflow-y-auto p-1">
            {options.map((option, index) => {
              const rawValue = option.props.value ?? "";
              const optionValue = rawValue || EMPTY_OPTION_VALUE;
              return (
                <SelectPrimitive.Item
                  key={option.key ?? `${optionValue}-${index}`}
                  value={optionValue}
                  disabled={option.props.disabled}
                  className="relative flex min-h-9 cursor-default select-none items-center rounded-md px-3 py-2 pr-8 text-sm outline-none data-[highlighted]:bg-slate-800 data-[highlighted]:text-slate-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <SelectPrimitive.ItemText>{option.props.children}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-cyan-300" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              );
            })}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
