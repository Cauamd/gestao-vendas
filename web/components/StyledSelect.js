'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

export function StyledSelect({ children, value, onChange, className = '', ...props }) {
  const options = React.Children.toArray(children).filter((child) => React.isValidElement(child) && child.type === 'option' && String(child.props.value ?? child.props.children) !== '');
  const selected = options.find((option) => String(option.props.value ?? option.props.children) === String(value));
  const widthClass = className.match(/(?:^|\s)(?:max-w-\S+|w-\S+)/g)?.join(' ') || '';
  return (
    <SelectPrimitive.Root value={value == null ? '' : String(value)} onValueChange={(next) => onChange?.({ target: { value: next } })}>
      <SelectPrimitive.Trigger className={`input flex items-center justify-between gap-2 text-left ${widthClass} ${className}`} {...props}>
        <SelectPrimitive.Value placeholder={selected?.props.children} />
        <SelectPrimitive.Icon asChild><ChevronDown className="h-4 w-4 shrink-0 opacity-75" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content position="popper" sideOffset={5} className="z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-lg border border-rose-200 bg-white p-1 text-ink shadow-xl shadow-rose-950/15">
          <SelectPrimitive.ScrollUpButton className="flex justify-center py-1 text-brand"><ChevronUp className="h-4 w-4" /></SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport>
            {options.map((option, index) => {
              const optionValue = String(option.props.value ?? option.props.children);
              return <SelectPrimitive.Item key={`${optionValue}-${index}`} value={optionValue} disabled={option.props.disabled} className="relative flex cursor-pointer select-none items-center rounded-md py-2 pl-3 pr-9 text-sm outline-none data-[highlighted]:bg-brand-soft data-[highlighted]:text-brand-dark data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                <SelectPrimitive.ItemText>{option.props.children}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-3 text-brand"><Check className="h-4 w-4" /></SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>;
            })}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex justify-center py-1 text-brand"><ChevronDown className="h-4 w-4" /></SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
