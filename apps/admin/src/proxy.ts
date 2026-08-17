import {
  isInvitationRoute,
  isPublicRoute,
  PAGE_ROUTES,
  PLATFORM_PREFIX,
} from "@/lib/constants/page-routes";
import { getSessionFromRequest } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

/** Legacy flat paths that must not be treated as org slugs. */
const LEGACY_TENANT_LEAFS = new Set([
  "files",
  "jobs",
  "metrics",
  "analytics",
  "providers",
  "tokens",
  "api-keys",
  "settings",
]);

const LEGACY_PLATFORM = new Map<string, string>([
  ["orgs", PAGE_ROUTES.ORGS],
  ["users", PAGE_ROUTES.USERS],
  ["tenant-contexts", PAGE_ROUTES.ORGS],
]);

/** Public URL `/~/…` → internal App Router `/platform/…` (tilde folder is unreliable). */
function rewritePlatformPath(pathname: string): string | null {
  if (pathname === `/${PLATFORM_PREFIX}` || pathname === `/%7E`) {
    return "/platform";
  }
  if (pathname.startsWith(`/${PLATFORM_PREFIX}/`)) {
    return `/platform/${pathname.slice(`/${PLATFORM_PREFIX}/`.length)}`;
  }
  if (pathname.startsWith("/%7E/")) {
    return `/platform/${pathname.slice("/%7E/".length)}`;
  }
  return null;
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await getSessionFromRequest(req);
  const isPublic = isPublicRoute(pathname);

  if (!session && !isPublic) {
    const loginUrl = new URL(PAGE_ROUTES.AUTH.LOGIN, req.url);
    const returnUrl =
      pathname + (req.nextUrl.search?.length ? req.nextUrl.search : "");
    loginUrl.searchParams.set("returnUrl", returnUrl);
    return NextResponse.redirect(loginUrl);
  }

  // Allow signed-in users to accept invitations; other public auth pages bounce home.
  if (session && isPublic && !isInvitationRoute(pathname)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // `/` resolves client-side to first org or create-org when none exist.
  if (session && (pathname === "/" || pathname === "")) {
    return NextResponse.next();
  }

  // Legacy create-org URL
  if (pathname === "/onboarding/organization" || pathname === "/onboarding") {
    return NextResponse.redirect(new URL(PAGE_ROUTES.ORG_NEW, req.url));
  }

  // Keep public URLs as `/~/…` — `/platform/…` is internal-only.
  if (
    pathname === "/platform" ||
    pathname.startsWith("/platform/")
  ) {
    const publicPath =
      pathname === "/platform"
        ? `/${PLATFORM_PREFIX}`
        : `/${PLATFORM_PREFIX}/${pathname.slice("/platform/".length)}`;
    return NextResponse.redirect(new URL(publicPath, req.url));
  }

  const platformInternal = rewritePlatformPath(pathname);
  if (platformInternal) {
    const url = req.nextUrl.clone();
    url.pathname = platformInternal;
    return NextResponse.rewrite(url);
  }

  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  if (session && first && LEGACY_PLATFORM.has(first)) {
    const target = LEGACY_PLATFORM.get(first)!;
    const rest = segments.slice(1).join("/");
    return NextResponse.redirect(
      new URL(rest ? `${target}/${rest}` : target, req.url),
    );
  }

  if (session && first && LEGACY_TENANT_LEAFS.has(first)) {
    // Unknown tenant without slug — land on home resolver.
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.webp|.*\\.ico|.*\\.woff|.*\\.woff2|.*\\.ttf|.*\\.eot|.*\\.css|.*\\.js|.*\\.map).*)",
  ],
};
