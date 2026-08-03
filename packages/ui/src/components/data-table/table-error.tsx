"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Icons } from "@workspace/ui/config/icons";
import { cn } from "@workspace/ui/lib/utils";
import { useState } from "react";

export interface TableErrorProps {
  error: any;
  onRetry?: () => void;
  className?: string;
  title?: string;
  description?: string;
  showRetryButton?: boolean;
  retryButtonText?: string;
  compact?: boolean;
}

export function TableError({
  error,
  onRetry,
  className,
  title,
  description,
  showRetryButton = true,
  retryButtonText = "Try Again",
  compact = false,
}: TableErrorProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  // Determine error type and appropriate messaging
  const getErrorInfo = () => {
    const status =
      error?.status || error?.statusCode || error?.response?.status;
    const message =
      error?.message ||
      error?.response?.data?.message ||
      "An unexpected error occurred";

    // Network errors
    if (status === 0 || !status) {
      return {
        icon: Icons.alertTriangle,
        title: title || "Connection Error",
        description:
          description ||
          "Unable to connect to the server. Please check your internet connection and try again.",
        variant: "destructive" as const,
        color: "text-amber-600",
        bgColor: "bg-amber-50 dark:bg-amber-950/20",
        borderColor: "border-amber-200 dark:border-amber-800",
        iconColor: "text-amber-600 dark:text-amber-400",
      };
    }

    // Authentication errors
    if (status === 401) {
      return {
        icon: Icons.lock,
        title: title || "Authentication Required",
        description:
          description ||
          "Your session has expired. Please log in again to continue.",
        variant: "destructive" as const,
        color: "text-blue-600",
        bgColor: "bg-blue-50 dark:bg-blue-950/20",
        borderColor: "border-blue-200 dark:border-blue-800",
        iconColor: "text-blue-600 dark:text-blue-400",
      };
    }

    // Permission errors
    if (status === 403) {
      return {
        icon: Icons.shield,
        title: title || "Access Denied",
        description:
          description ||
          "You don't have permission to access this resource. Please contact your administrator.",
        variant: "destructive" as const,
        color: "text-purple-600",
        bgColor: "bg-purple-50 dark:bg-purple-950/20",
        borderColor: "border-purple-200 dark:border-purple-800",
        iconColor: "text-purple-600 dark:text-purple-400",
      };
    }

    // Not found errors
    if (status === 404) {
      return {
        icon: Icons.helpCircle,
        title: title || "Resource Not Found",
        description:
          description ||
          "The requested data could not be found. It may have been moved or deleted.",
        variant: "destructive" as const,
        color: "text-gray-600",
        bgColor: "bg-gray-50 dark:bg-gray-950/20",
        borderColor: "border-gray-200 dark:border-gray-800",
        iconColor: "text-gray-600 dark:text-gray-400",
      };
    }

    // Server errors
    if (status >= 500) {
      return {
        icon: Icons.server,
        title: title || "Server Error",
        description:
          description ||
          "The server encountered an error while processing your request. Please try again later.",
        variant: "destructive" as const,
        color: "text-red-600",
        bgColor: "bg-red-50 dark:bg-red-950/20",
        borderColor: "border-red-200 dark:border-red-800",
        iconColor: "text-red-600 dark:text-red-400",
      };
    }

    // Rate limiting
    if (status === 429) {
      return {
        icon: Icons.clock,
        title: title || "Too Many Requests",
        description:
          description ||
          "You've made too many requests. Please wait a moment before trying again.",
        variant: "destructive" as const,
        color: "text-orange-600",
        bgColor: "bg-orange-50 dark:bg-orange-950/20",
        borderColor: "border-orange-200 dark:border-orange-800",
        iconColor: "text-orange-600 dark:text-orange-400",
      };
    }

    // Validation errors
    if (status === 422) {
      return {
        icon: Icons.alertCircle,
        title: title || "Validation Error",
        description: description || message,
        variant: "destructive" as const,
        color: "text-yellow-600",
        bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
        borderColor: "border-yellow-200 dark:border-yellow-800",
        iconColor: "text-yellow-600 dark:text-yellow-400",
      };
    }

    // Generic client errors
    if (status >= 400 && status < 500) {
      return {
        icon: Icons.alertCircle,
        title: title || "Request Error",
        description: description || message,
        variant: "destructive" as const,
        color: "text-red-600",
        bgColor: "bg-red-50 dark:bg-red-950/20",
        borderColor: "border-red-200 dark:border-red-800",
        iconColor: "text-red-600 dark:text-red-400",
      };
    }

    // Default error
    return {
      icon: Icons.alertTriangle,
      title: title || "Error",
      description: description || message,
      variant: "destructive" as const,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950/20",
      borderColor: "border-red-200 dark:border-red-800",
      iconColor: "text-red-600 dark:text-red-400",
    };
  };

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      // Add a small delay to show the loading state
      setTimeout(() => setIsRetrying(false), 1000);
    }
  };

  const errorInfo = getErrorInfo();
  const IconComponent = errorInfo.icon;

  const errorDetails = error?.response?.data || error?.details || error;

  return (
    <Card
      className={cn("transition-all duration-200 hover:shadow-sm", className)}
    >
      <CardContent>
        <div className="relative transition-all duration-200">
          <div className="flex items-start gap-3">
            <div className={cn("flex-shrink-0", errorInfo.iconColor)}>
              <IconComponent className={cn("h-5 w-5", compact && "h-4 w-4")} />
            </div>
            <div className="min-w-0 flex-1">
              <h3
                className={cn(
                  "leading-tight font-semibold",
                  errorInfo.color,
                  compact ? "text-sm" : "text-base"
                )}
              >
                {errorInfo.title}
              </h3>
              <p
                className={cn(
                  "mt-1 leading-relaxed",
                  compact ? "text-xs" : "text-sm",
                  "text-muted-foreground"
                )}
              >
                {errorInfo.description}
              </p>

              {errorDetails && (
                <div className="mt-3">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem
                      value="technical-details"
                      className="border-0"
                    >
                      <AccordionTrigger className="text-muted-foreground hover:text-foreground justify-start py-2 text-xs hover:no-underline">
                        Technical Details
                      </AccordionTrigger>
                      <AccordionContent>
                        <pre className="bg-muted/50 text-muted-foreground max-h-32 overflow-auto rounded p-2 text-xs">
                          {JSON.stringify(errorDetails, null, 2)}
                        </pre>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              )}

              {showRetryButton && onRetry && (
                <div className="mt-4">
                  <Button
                    onClick={handleRetry}
                    disabled={isRetrying}
                    variant="outlineDestructive"
                    size={compact ? "sm" : "default"}
                  >
                    {isRetrying ? (
                      <Icons.loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icons.refreshCw className="h-4 w-4" />
                    )}
                    {isRetrying ? "Retrying..." : retryButtonText}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Specialized error components for common scenarios
export function NetworkError({
  onRetry,
  className,
  compact = false,
}: {
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <TableError
      error={{ status: 0 }}
      onRetry={onRetry}
      className={className}
      showRetryButton={true}
      compact={compact}
    />
  );
}

export function UnauthorizedError({
  onRetry,
  className,
  compact = false,
}: {
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <TableError
      error={{ status: 401 }}
      onRetry={onRetry}
      className={className}
      showRetryButton={false}
      compact={compact}
    />
  );
}

export function ForbiddenError({
  onRetry,
  className,
  compact = false,
}: {
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <TableError
      error={{ status: 403 }}
      onRetry={onRetry}
      className={className}
      showRetryButton={false}
      compact={compact}
    />
  );
}

export function ServerError({
  onRetry,
  className,
  compact = false,
}: {
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <TableError
      error={{ status: 500 }}
      onRetry={onRetry}
      className={className}
      showRetryButton={true}
      compact={compact}
    />
  );
}

// Additional specialized components for better UX
export function NotFoundError({
  onRetry,
  className,
  compact = false,
}: {
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <TableError
      error={{ status: 404 }}
      onRetry={onRetry}
      className={className}
      showRetryButton={false}
      compact={compact}
    />
  );
}

export function ValidationError({
  error,
  onRetry,
  className,
  compact = false,
}: {
  error?: any;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <TableError
      error={error || { status: 422 }}
      onRetry={onRetry}
      className={className}
      showRetryButton={false}
      compact={compact}
    />
  );
}

export function RateLimitError({
  onRetry,
  className,
  compact = false,
}: {
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <TableError
      error={{ status: 429 }}
      onRetry={onRetry}
      className={className}
      showRetryButton={true}
      compact={compact}
    />
  );
}
