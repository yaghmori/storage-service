import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import {
  AlertTriangle,
  Bot,
  Building2,
  Cpu,
  Gauge,
  KeyRound,
  Server,
  Timer,
  type LucideIcon,
} from "lucide-react";

export type OrgSettingsSection =
  | "general"
  | "limits"
  | "providers"
  | "processor-backends"
  | "processing"
  | "tokens"
  | "retention"
  | "danger";

export type OrgSettingsNavItem = {
  title: string;
  description: string;
  section: OrgSettingsSection;
  icon: LucideIcon;
  href: (slug: string) => string;
};

export const orgSettingsNavItems: OrgSettingsNavItem[] = [
  {
    title: "General",
    description: "Name, slug, and optional external mapping for this organization.",
    section: "general",
    icon: Building2,
    href: PAGE_ROUTES.settingsGeneral,
  },
  {
    title: "Limits & quota",
    description:
      "Max file size, MIME allowlist, storage quota, and object count.",
    section: "limits",
    icon: Gauge,
    href: PAGE_ROUTES.settingsLimits,
  },
  {
    title: "Storage providers",
    description: "Configure storage backends (local, MinIO, S3) for uploads.",
    section: "providers",
    icon: Server,
    href: PAGE_ROUTES.settingsProviders,
  },
  {
    title: "Processor backends",
    description:
      "OpenAI-compatible endpoints selected from Processing for AI Vision and OCR.",
    section: "processor-backends",
    icon: Bot,
    href: PAGE_ROUTES.settingsProcessorBackends,
  },
  {
    title: "Processing",
    description:
      "Enable processors, options, and per-processor concurrency / rate limits.",
    section: "processing",
    icon: Cpu,
    href: PAGE_ROUTES.settingsProcessing,
  },
  {
    title: "Tokens",
    description: "API keys and service credentials for this organization.",
    section: "tokens",
    icon: KeyRound,
    href: PAGE_ROUTES.settingsTokens,
  },
  {
    title: "Retention",
    description: "How long soft-deleted files are kept before permanent purge.",
    section: "retention",
    icon: Timer,
    href: PAGE_ROUTES.settingsRetention,
  },
  {
    title: "Danger zone",
    description: "Irreversible or high-impact actions for this organization.",
    section: "danger",
    icon: AlertTriangle,
    href: PAGE_ROUTES.settingsDanger,
  },
];
