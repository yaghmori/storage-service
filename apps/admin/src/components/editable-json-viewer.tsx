"use client";

import { Input, Textarea } from "@workspace/ui/components";
import { cn } from "@workspace/ui/lib/utils";
import {
  Check,
  ChevronDown,
  Copy,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  JsonEditor,
  type TextEditorProps,
  type Theme,
  type UpdateFunctionProps,
} from "json-edit-react";
import JSON5 from "json5";
import { useCallback, useEffect, useRef, useState } from "react";

const THEME: Theme = {
  displayName: "StorageAdmin",
  styles: {
    container: {
      backgroundColor: "transparent",
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: "13px",
      lineHeight: "1.55",
      width: "100%",
    },
    property: { color: "#374151", fontWeight: "500" },
    bracket: { color: "#6b7280", fontWeight: "600" },
    itemCount: { color: "rgba(0, 0, 0, 0.35)", fontStyle: "italic" },
    string: { color: "#c2410c" },
    number: { color: "#2563eb" },
    boolean: { color: "#16a34a", fontWeight: "600" },
    null: { color: "#9ca3af", fontStyle: "italic" },
    input: {
      backgroundColor: "#fff",
      border: "1px solid #d1d5db",
      borderRadius: "6px",
      padding: "4px 8px",
      fontSize: "13px",
      lineHeight: "1.4",
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      color: "#111827",
      minHeight: "28px",
      boxSizing: "border-box",
    },
    iconCopy: "#268bd2",
    iconEdit: "#0d9488",
    iconDelete: "#ea580c",
    iconAdd: "#0d9488",
    iconOk: "#16a34a",
    iconCancel: "#ef4444",
  },
};

const ICONS = {
  add: <Plus className="size-3.5" />,
  edit: <Pencil className="size-3.5" />,
  delete: <Trash2 className="size-3.5" />,
  copy: <Copy className="size-3.5" />,
  ok: <Check className="size-3.5" />,
  cancel: <X className="size-3.5" />,
  chevron: <ChevronDown className="size-3.5" />,
};

function JsonCollectionTextEditor({
  value,
  onChange,
  onKeyDown,
}: TextEditorProps) {
  return (
    <Textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      className="min-h-40 w-full resize-y font-mono text-xs"
      spellCheck={false}
    />
  );
}

function stableJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "";
  }
}

/** Shared tree JSON editor, aligned with eallyfe/notification-service. */
export function EditableJsonViewer({
  value,
  onChange,
  className,
  disabled = false,
  validationError,
  rootName = "parameters",
}: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  className?: string;
  disabled?: boolean;
  validationError?: string | null;
  rootName?: string;
}) {
  const [data, setData] = useState<unknown>(value);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const lastExternalJson = useRef(stableJson(value));

  useEffect(() => {
    const nextJson = stableJson(value);
    if (nextJson === lastExternalJson.current) return;
    lastExternalJson.current = nextJson;
    setData(value);
  }, [value]);

  const handleUpdate = useCallback(
    (updated: UpdateFunctionProps) => {
      setEditorError(null);
      const next = updated.newData;
      if (!next || typeof next !== "object" || Array.isArray(next)) {
        setEditorError("Parameters must be a JSON object.");
        return;
      }
      const record = next as Record<string, unknown>;
      const nextJson = stableJson(record);
      setData(record);
      lastExternalJson.current = nextJson;
      onChange(record);
    },
    [onChange],
  );

  const errorMessage = validationError || editorError;

  return (
    <div
      className={cn(
        "jer-host flex max-h-[420px] min-h-40 w-full min-w-0 flex-col overflow-hidden rounded-lg border bg-background",
        className,
      )}
    >
      <style>{`
        .jer-host .jer-editor-container,
        .jer-host .jer-collection-node,
        .jer-host .jer-collection-element {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        .dark .jer-host .jer-key-text,
        .dark .jer-host [class*="property"] {
          color: hsl(var(--foreground)) !important;
        }
      `}</style>
      <div className="flex shrink-0 items-center justify-end border-b px-2 py-1.5">
        <div className="relative w-full max-w-52">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search parameters"
            className="h-8 pl-8 text-xs"
            disabled={disabled}
          />
        </div>
      </div>
      {errorMessage ? (
        <div className="m-2 mb-0 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {errorMessage}
        </div>
      ) : null}
      <div className="min-h-0 min-w-0 flex-1 overflow-auto p-2.5">
        <JsonEditor
          data={data}
          onUpdate={handleUpdate}
          onError={() => setEditorError("Invalid JSON")}
          theme={THEME}
          icons={ICONS}
          TextEditor={JsonCollectionTextEditor}
          jsonParse={JSON5.parse}
          jsonStringify={(next) => JSON5.stringify(next, null, 2)}
          showErrorMessages={false}
          showStringQuotes
          showCollectionCount="when-closed"
          showArrayIndices
          enableClipboard
          restrictEdit={disabled}
          restrictDelete={disabled}
          restrictAdd={disabled}
          restrictTypeSelection={disabled}
          rootName={rootName}
          searchText={searchText}
          searchFilter="all"
          defaultValue=""
          collapseAnimationTime={120}
          indent={2}
        />
      </div>
    </div>
  );
}
