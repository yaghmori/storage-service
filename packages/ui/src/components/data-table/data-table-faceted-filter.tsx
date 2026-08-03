"use client";

import type { Column } from "@tanstack/react-table";
import { PlusCircle, XCircle } from "lucide-react";
import * as React from "react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@workspace/ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { Separator } from "@workspace/ui/components/separator";
import type { Option } from "@workspace/ui/types/data-table";

interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title?: string;
  options: Option[];
  loadOptions?: (query: string) => Promise<Option[]>;
  renderOption?: (option: Option) => React.ReactNode;
  multiple?: boolean;
}

const SELECTED_TRIGGER_BADGE_CLASS =
  "rounded-sm px-1 font-normal bg-muted-foreground/10 text-foreground hover:bg-muted-foreground/10";

export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
  loadOptions,
  renderOption,
  multiple,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [asyncOptions, setAsyncOptions] = React.useState<Option[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const reqIdRef = React.useRef(0);

  const columnFilterValue = column?.getFilterValue();
  const selectedValues = React.useMemo(
    () => new Set(Array.isArray(columnFilterValue) ? columnFilterValue : []),
    [columnFilterValue],
  );
  const resolvedOptions = loadOptions ? asyncOptions : options;
  const selectedOptionList = React.useMemo(
    () => resolvedOptions.filter((option) => selectedValues.has(option.value)),
    [resolvedOptions, selectedValues],
  );
  const selectedAreAvatarOptions = React.useMemo(
    () =>
      selectedOptionList.length > 0 &&
      selectedOptionList.every(
        (option) => option.avatarText || option.avatarImageUrl,
      ),
    [selectedOptionList],
  );

  React.useEffect(() => {
    if (!open || !loadOptions) return;
    let mounted = true;
    const currentReqId = ++reqIdRef.current;
    setIsLoading(true);
    void loadOptions(query)
      .then((items) => {
        if (!mounted || currentReqId !== reqIdRef.current) return;
        setAsyncOptions(items ?? []);
      })
      .finally(() => {
        if (!mounted || currentReqId !== reqIdRef.current) return;
        setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [open, loadOptions, query]);

  const onItemSelect = React.useCallback(
    (option: Option, isSelected: boolean) => {
      if (!column) return;

      if (multiple) {
        const newSelectedValues = new Set(selectedValues);
        if (isSelected) {
          newSelectedValues.delete(option.value);
        } else {
          newSelectedValues.add(option.value);
        }
        const filterValues = Array.from(newSelectedValues);
        column.setFilterValue(filterValues.length ? filterValues : undefined);
      } else {
        column.setFilterValue(isSelected ? undefined : [option.value]);
        setOpen(false);
      }
    },
    [column, multiple, selectedValues],
  );

  const onReset = React.useCallback(
    (event?: React.MouseEvent) => {
      event?.stopPropagation();
      column?.setFilterValue(undefined);
    },
    [column],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-dashed">
          {selectedValues?.size > 0 ? (
            <div
              role="button"
              aria-label={`Clear ${title} filter`}
              tabIndex={0}
              onClick={onReset}
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <XCircle />
            </div>
          ) : (
            <PlusCircle />
          )}
          {title}
          {selectedValues?.size > 0 && (
            <>
              <Separator
                orientation="vertical"
                className="mx-0.5 data-[orientation=vertical]:h-4"
              />
              <Badge
                variant="default"
                className={`lg:hidden ${SELECTED_TRIGGER_BADGE_CLASS}`}
              >
                {selectedValues.size}
              </Badge>
              <div className="hidden items-center gap-1 lg:flex">
                {selectedAreAvatarOptions ? (
                  <div className="flex items-center gap-1">
                    <div className="flex -space-x-1">
                      {selectedOptionList.slice(0, 4).map((option) => (
                        <Avatar
                          key={option.value}
                          className="h-5 w-5 border border-border bg-background"
                        >
                          {option.avatarImageUrl ? (
                            <AvatarImage
                              src={option.avatarImageUrl}
                              alt={option.label}
                            />
                          ) : null}
                          <AvatarFallback className="text-[9px] font-medium">
                            {option.avatarText ??
                              option.label.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {selectedOptionList.length > 4 ? (
                        <Avatar className="h-5 w-5 border border-border bg-muted-foreground/10">
                          <AvatarFallback className="text-[9px] font-medium text-foreground">
                            +{selectedOptionList.length - 4}
                          </AvatarFallback>
                        </Avatar>
                      ) : null}
                    </div>
                    <span className="max-w-[120px] truncate text-xs text-muted-foreground">
                      {selectedOptionList
                        .slice(0, 2)
                        .map((option) => option.label)
                        .join(", ")}
                    </span>
                  </div>
                ) : selectedValues.size > 2 ? (
                  <Badge
                    variant="default"
                    className={SELECTED_TRIGGER_BADGE_CLASS}
                  >
                    {selectedValues.size} selected
                  </Badge>
                ) : (
                  selectedOptionList.map((option) =>
                    option.avatarText || option.avatarImageUrl ? (
                      <div
                        key={option.value}
                        className="inline-flex items-center"
                      >
                        <Avatar className="h-5 w-5 border border-border bg-background">
                          {option.avatarImageUrl ? (
                            <AvatarImage
                              src={option.avatarImageUrl}
                              alt={option.label}
                            />
                          ) : null}
                          <AvatarFallback className="text-[9px] font-medium">
                            {option.avatarText ??
                              option.label.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    ) : (
                      <Badge
                        variant="default"
                        key={option.value}
                        className={SELECTED_TRIGGER_BADGE_CLASS}
                      >
                        {option.label}
                      </Badge>
                    ),
                  )
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[12.5rem] p-0" align="start">
        <Command shouldFilter={!loadOptions}>
          <CommandInput
            placeholder={title}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-full">
            <CommandEmpty>
              {isLoading ? "Loading..." : "No results found."}
            </CommandEmpty>
            <CommandGroup className="max-h-[18.75rem] overflow-y-auto overflow-x-hidden">
              {resolvedOptions.map((option) => {
                const isSelected = selectedValues.has(option.value);

                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => onItemSelect(option, isSelected)}
                  >
                    <Checkbox
                      checked={isSelected}
                      aria-hidden="true"
                      tabIndex={-1}
                      className="pointer-events-none"
                    />
                    {renderOption ? (
                      <div className="min-w-0 flex-1">
                        {renderOption(option)}
                      </div>
                    ) : (
                      <>
                        {option.icon && <option.icon />}
                        <span className="truncate">{option.label}</span>
                      </>
                    )}
                    {option.count && (
                      <span className="ml-auto font-mono text-xs">
                        {option.count}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onReset()}
                    className="justify-center text-center"
                  >
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
