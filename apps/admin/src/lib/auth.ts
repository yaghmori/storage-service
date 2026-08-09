import { sealData, unsealData } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

/** Cookie / seal TTL in seconds. Override with SESSION_MAX_AGE (default: 365 days). */
function resolveSessionMaxAge(): number {
  const raw = process.env.SESSION_MAX_AGE;
  if (raw !== undefined && raw !== "") {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 60 * 60 * 24 * 365;
}

const SESSION_OPTIONS = {
  password: process.env.AUTH_SECRET!,
  cookieName: "storage_admin_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax" as const,
    maxAge: resolveSessionMaxAge(),
    path: "/",
  },
};

export interface SessionUser {
  id: string;
  email: string;
  role?: string;
  name?: string | null;
  avatar?: string | null;
  [key: string]: unknown;
}

interface InternalSession {
  user: SessionUser;
  accessToken: string;
}

export interface Session {
  user: SessionUser;
}

export interface Token {
  user: SessionUser;
  accessToken: string;
}

export async function createSession({
  token,
  user,
}: {
  token: string;
  user: SessionUser;
}) {
  const internalSession: InternalSession = {
    user,
    accessToken: token,
  };

  const encryptedSession = await sealData(internalSession, {
    password: SESSION_OPTIONS.password,
    ttl: SESSION_OPTIONS.cookieOptions.maxAge,
  });

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_OPTIONS.cookieName,
    encryptedSession,
    SESSION_OPTIONS.cookieOptions,
  );
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const encryptedSession = cookieStore.get(SESSION_OPTIONS.cookieName);
  if (!encryptedSession) return null;

  try {
    const internal = await unsealData<InternalSession>(encryptedSession.value, {
      password: SESSION_OPTIONS.password,
      ttl: SESSION_OPTIONS.cookieOptions.maxAge,
    });

    return {
      user: {
        id: internal.user.id,
        email: internal.user.email,
        role: internal.user.role,
        name: internal.user.name ?? internal.user.email,
        avatar: internal.user.avatar ?? null,
      },
    };
  } catch {
    return null;
  }
}

export async function getToken(): Promise<Token | null> {
  const cookieStore = await cookies();
  const encryptedSession = cookieStore.get(SESSION_OPTIONS.cookieName);
  if (!encryptedSession) return null;

  try {
    const internal = await unsealData<InternalSession>(encryptedSession.value, {
      password: SESSION_OPTIONS.password,
      ttl: SESSION_OPTIONS.cookieOptions.maxAge,
    });

    return {
      user: internal.user,
      accessToken: internal.accessToken,
    };
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(
  request: NextRequest,
): Promise<Session | null> {
  const encryptedSession = request.cookies.get(SESSION_OPTIONS.cookieName);
  if (!encryptedSession) return null;

  try {
    const internal = await unsealData<InternalSession>(encryptedSession.value, {
      password: SESSION_OPTIONS.password,
      ttl: SESSION_OPTIONS.cookieOptions.maxAge,
    });

    return {
      user: {
        id: internal.user.id,
        email: internal.user.email,
        role: internal.user.role,
        name: internal.user.name ?? internal.user.email,
        avatar: internal.user.avatar ?? null,
      },
    };
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_OPTIONS.cookieName, "", {
    ...SESSION_OPTIONS.cookieOptions,
    maxAge: 0,
  });
}
