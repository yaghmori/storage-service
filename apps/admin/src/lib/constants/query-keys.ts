export const QUERY_KEYS = {
  AUTH: { SESSION: ["auth", "session"] as const },
  DASHBOARD: { STATS: ["dashboard", "stats"] as const },
  FILES: { ALL: ["files"] as const },
  JOBS: { ALL: ["jobs"] as const },
  ANALYTICS: { ALL: ["analytics"] as const },
  PROVIDERS: { ALL: ["providers"] as const },
  API_KEYS: { ALL: ["api-keys"] as const },
  ORGS: { ALL: ["orgs"] as const },
  USERS: { ALL: ["users"] as const },
  ACCOUNT: { ME: ["account", "me"] as const },
} as const;

export const MUTATION_KEYS = {
  AUTH: {
    LOGIN: ["auth", "login"] as const,
    LOGOUT: ["auth", "logout"] as const,
    FORGOT_PASSWORD: ["auth", "forgot-password"] as const,
  },
} as const;
