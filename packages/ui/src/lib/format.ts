import { formatDistanceToNowStrict } from "date-fns";

export function formatDate(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {},
) {
  if (!date) return "";

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: opts.month ?? "long",
      day: opts.day ?? "numeric",
      year: opts.year ?? "numeric",
      ...opts,
    }).format(new Date(date));
  } catch (_err) {
    return "";
  }
}

export function formatRelativeDate(
  date: Date | string | number | undefined,
): { display: string; tooltip: string } {
  if (!date) return { display: "", tooltip: "" };

  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return { display: "", tooltip: "" };

    const display = formatDistanceToNowStrict(d, { addSuffix: true });
    const tooltip = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);

    return { display, tooltip };
  } catch (_err) {
    return { display: "", tooltip: "" };
  }
}
export const formatStorageBytes = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  // Remove unnecessary .00, keep decimals only when needed
  const display =
    size % 1 === 0 ? size.toFixed(0) : size.toFixed(2).replace(/\.?0+$/, '');

  return `${display} ${units[unitIndex]}`;
};

// Helper function to format price in cents to currency
export const formatCurrency = (
  cents: number | null,
  currency: string = 'USD'
): string => {
  if (cents === null) return 'Free';

  const amount = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

// ==================== DURATION FORMATTING ====================

/**
 * Formats duration in seconds to a human-readable string
 * @param seconds - Duration in seconds
 * @param options - Formatting options
 * @returns Formatted duration string
 */
export const formatDuration = (
  seconds?: number | null,
  options: {
    showSeconds?: boolean;
    compact?: boolean;
    includeZero?: boolean;
  } = {}
): string => {
  const { showSeconds = true, compact = false, includeZero = false } = options;

  if (!seconds || seconds === 0) {
    return includeZero ? '0s' : '';
  }

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (hours > 0) {
    if (compact) {
      return `${hours}h ${minutes}m`;
    }
    return showSeconds && remainingSeconds > 0
      ? `${hours}h ${minutes}m ${remainingSeconds}s`
      : `${hours}h ${minutes}m`;
  }

  if (compact) {
    return `${minutes}m`;
  }
  return showSeconds && remainingSeconds > 0
    ? `${minutes}m ${remainingSeconds}s`
    : `${minutes}m`;
};

/**
 * Formats duration in milliseconds to a human-readable string
 * @param milliseconds - Duration in milliseconds
 * @param options - Formatting options
 * @returns Formatted duration string
 */
export const formatDurationMs = (
  milliseconds?: number | null,
  options?: Parameters<typeof formatDuration>[1]
): string => {
  if (!milliseconds) return '';
  return formatDuration(milliseconds / 1000, options);
};

// ==================== STATUS FORMATTING ====================

/**
 * Common status types for consistent formatting across the app
 */
export type StatusType =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'pending'
  | 'cancelled'
  | 'queued'
  | 'building'
  | 'deploying'
  | 'ready'
  | 'failed'
  | 'active'
  | 'inactive'
  | 'online'
  | 'offline';

/**
 * Gets the appropriate color class for a status
 * @param status - The status string
 * @param variant - Color variant (bg, text, border)
 * @returns Tailwind CSS class
 */
export const getStatusColor = (
  status: string | StatusType,
  variant: 'bg' | 'text' | 'border' = 'bg'
): string => {
  const statusLower = status.toLowerCase();

  // Success states
  if (['success', 'ready', 'active', 'online'].includes(statusLower)) {
    return `${variant}-green-400`;
  }

  // Error states
  if (['error', 'failed', 'offline'].includes(statusLower)) {
    return `${variant}-red-400`;
  }

  // Warning/Processing states
  if (
    [
      'warning',
      'building',
      'installing',
      'deploying',
      'queued',
      'pending'
    ].includes(statusLower)
  ) {
    return `${variant}-yellow-400`;
  }

  // Info states
  if (['info'].includes(statusLower)) {
    return `${variant}-blue-400`;
  }

  // Neutral states
  if (['cancelled', 'inactive'].includes(statusLower)) {
    return `${variant}-gray-400`;
  }

  // Default fallback
  return `${variant}-gray-400`;
};

/**
 * Gets a user-friendly display text for a status
 * @param status - The status string
 * @returns Human-readable status text
 */
export const getStatusText = (status: string | StatusType): string => {
  const statusLower = status.toLowerCase();

  const statusMap: Record<string, string> = {
    // Success states
    success: 'Success',
    ready: 'Ready',
    active: 'Active',
    online: 'Online',

    // Error states
    error: 'Error',
    failed: 'Failed',
    offline: 'Offline',

    // Processing states
    warning: 'Warning',
    building: 'Building',
    installing: 'Installing',
    deploying: 'Deploying',
    queued: 'Queued',
    pending: 'Pending',

    // Neutral states
    cancelled: 'Cancelled',
    inactive: 'Inactive',
    info: 'Info'
  };

  return statusMap[statusLower] || status || 'Unknown';
};

// ==================== ID FORMATTING ====================

/**
 * Formats a GUID to show only the last part (short ID)
 * @param id - Full GUID string
 * @param length - Number of characters to show (default: last part)
 * @returns Shortened ID
 */
export const formatShortId = (id: string, length?: number): string => {
  if (!id) return '';

  if (length) {
    return id.substring(0, length);
  }

  // Split by hyphens and take the last part
  const parts = id.split('-');
  return parts[parts.length - 1] || id;
};

/**
 * Formats a commit hash to show only the first N characters
 * @param hash - Full commit hash
 * @param length - Number of characters to show (default: 7)
 * @returns Shortened commit hash
 */
export const formatCommitHash = (hash: string, length: number = 7): string => {
  if (!hash) return '';
  return hash.substring(0, length);
};

// ==================== TEXT FORMATTING ====================

/**
 * Truncates text with ellipsis and optional tooltip
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @param suffix - Suffix to add when truncated (default: '...')
 * @returns Truncated text
 */
export const truncateText = (
  text: string,
  maxLength: number,
  suffix: string = '...'
): string => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + suffix;
};

/**
 * Capitalizes the first letter of each word
 * @param text - Text to capitalize
 * @returns Capitalized text
 */
export const capitalizeWords = (text: string): string => {
  if (!text) return '';
  return text
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Converts text to a URL-friendly slug
 * @param text - Text to convert
 * @returns URL-friendly slug
 */
export const toSlug = (text: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
};

// ==================== NUMBER FORMATTING ====================

/**
 * Formats a number with appropriate suffix (K, M, B)
 * @param num - Number to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted number string
 */
export const formatNumber = (num: number, decimals: number = 1): string => {
  if (num < 1000) return num.toString();

  const suffixes = ['', 'K', 'M', 'B', 'T'];
  const magnitude = Math.floor(Math.log10(num) / 3);
  const scaled = num / Math.pow(1000, magnitude);

  return scaled.toFixed(decimals).replace(/\.?0+$/, '') + suffixes[magnitude];
};

/**
 * Formats a percentage
 * @param value - Value to format as percentage
 * @param total - Total value (default: 100)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export const formatPercentage = (
  value: number,
  total: number = 100,
  decimals: number = 1
): string => {
  const percentage = (value / total) * 100;
  return `${percentage.toFixed(decimals)}%`;
};

// ==================== FILE SIZE FORMATTING ====================

/**
 * Formats file size in bytes to human-readable format
 * @param bytes - Size in bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted file size string
 */
export const formatFileSize = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return (
    parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
  );
};




