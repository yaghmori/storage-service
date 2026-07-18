import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import {
  fieldControlInvalidClass,
  fieldControlSurfaceClass,
} from "@workspace/ui/lib/field-control-styles";
import { cn } from "@workspace/ui/lib/utils";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";
import { FormBase, FormControlProps } from "./form-base";
import { useFieldContext } from "./useForm";

export type MultiSelectOption = {
  value: string;
  label: string;
  id: number;
};

export type FormMultiSelectProps = FormControlProps & {
  options: MultiSelectOption[];
  isLoading?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  showAllOption?: boolean;
  allOptionLabel?: string;
  renderBadges?: boolean;
};

export function FormMultiSelect({
  options,
  isLoading = false,
  placeholder = "Select items...",
  searchPlaceholder = "Search...",
  emptyText = "No items found.",
  showAllOption = true,
  allOptionLabel = "All Items",
  renderBadges = true,
  ...props
}: FormMultiSelectProps) {
  const field = useFieldContext<number[]>();
  const [open, setOpen] = useState(false);
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

  const selectedIds = field.state.value || [];
  const allOptionIds = options.map((opt) => opt.id);
  const isAllSelected =
    selectedIds.length === options.length && options.length > 0;

  const handleToggle = (id: number) => {
    if (selectedIds.includes(id)) {
      field.handleChange(selectedIds.filter((selectedId) => selectedId !== id));
    } else {
      field.handleChange([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      field.handleChange([]);
    } else {
      field.handleChange(allOptionIds);
    }
  };

  const selectedLabel = (() => {
    if (selectedIds.length === 0) return placeholder;
    if (isAllSelected) return allOptionLabel;
    if (selectedIds.length === 1) {
      const selected = options.find((opt) => opt.id === selectedIds[0]);
      return selected?.label || placeholder;
    }
    return `${selectedIds.length} selected`;
  })();

  return (
    <FormBase {...props}>
      <div className="space-y-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-invalid={isInvalid}
              className={cn(
                "w-full justify-between shadow-xs",
                fieldControlSurfaceClass,
                fieldControlInvalidClass
              )}
              disabled={isLoading}
              onBlur={field.handleBlur}
              id={field.name}
            >
              <span className="truncate ">{selectedLabel}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
            side="bottom"
          >
            <Command>
              <CommandInput placeholder={searchPlaceholder} />
              <CommandList>
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup>
                  {showAllOption && (
                    <CommandItem
                      onSelect={handleSelectAll}
                      className="font-medium"
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-[4px] border border-primary",
                          isAllSelected
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible"
                        )}
                      >
                        <Check className="size-3 text-white" />
                      </div>
                      {allOptionLabel}
                    </CommandItem>
                  )}
                  {options.map((option) => {
                    const isSelected = selectedIds.includes(option.id);
                    return (
                      <CommandItem
                        key={option.id}
                        onSelect={() => handleToggle(option.id)}
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-[4px] border border-primary",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}
                        >
                          <Check className="size-3 text-white" />
                        </div>
                        {option.label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {renderBadges && selectedIds.length > 0 && !isAllSelected && (
          <div className="flex flex-wrap gap-1">
            {selectedIds.map((id) => {
              const option = options.find((opt) => opt.id === id);
              if (!option) return null;
              return (
                <Badge key={id} variant="secondary" className="text-xs">
                  {option.label}
                  <button
                    type="button"
                    className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onClick={() => handleToggle(id)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    </FormBase>
  );
}
