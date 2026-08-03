"use client";

import { useProcessorBackendModelsQuery } from "@/features/processor-backends/hooks/use-processor-backends-queries";
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components";
import { cn } from "@workspace/ui/lib/utils";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

/**
 * Combobox for picking a model from an OpenAI-compatible backend's /models
 * list, with free-text entry when the list is unavailable or incomplete.
 */
export function BackendModelPicker({
  orgId,
  backendId,
  value,
  onChange,
  label,
  description,
  placeholder = "llava",
  disabled,
}: {
  orgId: string;
  backendId?: string | null;
  value: string;
  onChange: (value: string) => void;
  label: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const modelsQuery = useProcessorBackendModelsQuery(
    orgId,
    backendId,
    !!backendId && !disabled,
  );

  const items = useMemo(() => {
    const ids = new Set<string>();
    const list: string[] = [];
    for (const item of modelsQuery.data?.items ?? []) {
      if (!ids.has(item.id)) {
        ids.add(item.id);
        list.push(item.id);
      }
    }
    if (value.trim() && !ids.has(value.trim())) {
      list.unshift(value.trim());
    }
    return list;
  }, [modelsQuery.data?.items, value]);

  const hasBackend = !!backendId;
  const listFailed = !!modelsQuery.error;
  const listLoading = modelsQuery.isFetching;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}

      {!hasBackend ? (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className="h-10 w-full max-w-md justify-between font-normal"
            >
              <span
                className={cn(
                  "truncate",
                  !value.trim() && "text-muted-foreground",
                )}
              >
                {value.trim() || placeholder}
              </span>
              {listLoading ? (
                <Loader2 className="ml-2 size-4 shrink-0 animate-spin opacity-50" />
              ) : (
                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-(--anchor-width) p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search or type a model…"
                value={value}
                onValueChange={onChange}
              />
              <CommandList>
                <CommandEmpty>
                  {listFailed
                    ? "Could not load models — type a model id and press Enter."
                    : "No model found. Type a custom model id."}
                </CommandEmpty>
                <CommandGroup>
                  {items.map((modelId) => (
                    <CommandItem
                      key={modelId}
                      value={modelId}
                      onSelect={() => {
                        onChange(modelId);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4",
                          value === modelId ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate font-mono text-xs">
                        {modelId}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {hasBackend && listFailed ? (
        <p className="text-xs text-muted-foreground">
          Model list unavailable from this backend; enter the model name
          manually.
        </p>
      ) : null}
    </div>
  );
}
