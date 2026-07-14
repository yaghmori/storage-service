export type ClientAuth =
  | { type: 'apiKey'; apiKey: string }
  | { type: 'bearer'; token: string }
  | { apiKey: string; bearerToken?: never }
  | { bearerToken: string; apiKey?: never }
  | { apiKey?: string; bearerToken?: string };

export const AUTH_HEADERS = {
  apiKey: 'x-api-key',
  authorization: 'authorization',
} as const;

export function buildAuthHeaders(
  auth?: ClientAuth | string,
  envApiKeyVar = 'STORAGE_SERVICE_API_KEY',
): Record<string, string> {
  if (!auth) {
    const fromEnv =
      process.env[envApiKeyVar] ||
      process.env.SERVICE_API_KEY ||
      process.env.API_KEY;
    if (fromEnv) return { [AUTH_HEADERS.apiKey]: fromEnv };
    const bearer = process.env.STORAGE_SERVICE_BEARER || process.env.SERVICE_BEARER_TOKEN;
    if (bearer) return { [AUTH_HEADERS.authorization]: `Bearer ${bearer}` };
    return {};
  }

  if (typeof auth === 'string') {
    return { [AUTH_HEADERS.apiKey]: auth };
  }

  if ('type' in auth) {
    if (auth.type === 'apiKey') return { [AUTH_HEADERS.apiKey]: auth.apiKey };
    return { [AUTH_HEADERS.authorization]: `Bearer ${auth.token}` };
  }

  const headers: Record<string, string> = {};
  if (auth.apiKey) headers[AUTH_HEADERS.apiKey] = auth.apiKey;
  if (auth.bearerToken) headers[AUTH_HEADERS.authorization] = `Bearer ${auth.bearerToken}`;
  return headers;
}
