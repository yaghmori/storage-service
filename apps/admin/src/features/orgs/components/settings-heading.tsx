import { cn } from "@/lib/utils";

export function SettingsHeading({
  title,
  description,
  className,
  destructive,
}: {
  title: string;
  description: string;
  className?: string;
  destructive?: boolean;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <h2
        className={cn(
          "text-xl font-semibold tracking-tight",
          destructive && "text-destructive",
        )}
      >
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
