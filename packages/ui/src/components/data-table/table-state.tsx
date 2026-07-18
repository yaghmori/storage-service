import { Icons } from "@workspace/ui/config/icons";
import { cn } from "@workspace/ui/lib/utils";
import React from "react";
import { Card, CardContent } from "../ui/card";

interface EmptyStateProps {
  icon: React.ElementType<any> | React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function TableEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col  justify-center items-center px-8 py-10 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-transparent",
      )}
    >
      <div className="flex justify-center items-center mb-3 w-12 h-12 rounded-full bg-muted/50">
        {React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement<any>, {
              className: cn(
                "w-6 h-6 text-muted-foreground/70",
                (icon as any).props?.className,
              ),
            })
          : (() => {
              const IconComponent = icon as React.ElementType<any>;
              return (
                <IconComponent className="w-6 h-6 text-muted-foreground/70" />
              );
            })()}
      </div>
      <h3 className="mb-1 text-base font-medium text-foreground">{title}</h3>
      <p className="mb-4 max-w-xs text-sm text-center whitespace-pre-line text-muted-foreground/80">
        {description}
      </p>
      {action && (
        <div className="flex flex-col gap-1 items-center">{action}</div>
      )}
    </div>
  );
}

interface TableSearchEmptyProps {
  className?: string;
  searchTerm?: string;
  onClearSearch?: () => void;
}

export function TableSearchEmptyState({
  className,
  searchTerm,
  onClearSearch,
}: TableSearchEmptyProps) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="pt-6">
        <div className="flex flex-col justify-center items-center py-12 text-center">
          <div className="p-3 mb-4 rounded-full bg-muted">
            <Icons.search className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">No results found</h3>
          <p className="mb-4 max-w-sm text-sm text-muted-foreground">
            {searchTerm ? (
              <>
                No users found matching &quot;
                <span className="font-medium">{searchTerm}</span>&quot;. Try
                adjusting your search terms.
              </>
            ) : (
              "No users match your current filters. Try adjusting your search criteria."
            )}
          </p>
          {onClearSearch && (
            <button
              onClick={onClearSearch}
              className="inline-flex justify-center items-center px-4 py-2 h-10 text-sm font-medium rounded-md border transition-colors ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-input bg-background hover:bg-accent hover:text-accent-foreground"
            >
              Clear search
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
