// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizationUrl } from "@/lib/fusionauth";

const FULL_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const COOKIE_PREFIX = FULL_BASE_PATH.replace(/^\/|\/$/g, "").replace(
  /\//g,
  "_",
);
function generateRandomString(length: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => chars[b % chars.length])
    .join("");
}

function decodeTokenPayload(token: string): any {
  try {
    return JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString("utf8"),
    );
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Always bypass these paths ────────────────────────────────────────────
  if (
    pathname.includes("/api/auth/callback") ||
    pathname.includes("/api/auth/logout") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(`${COOKIE_PREFIX}_token`)?.value;
  const isRootOrAuth =
    pathname === FULL_BASE_PATH ||
    pathname === `${FULL_BASE_PATH}/` ||
    pathname === `${FULL_BASE_PATH}/forgot-password`;

  // ── No token → redirect to FusionAuth ───────────────────────────────────
  if (!token) {
    const state = generateRandomString(32);
    const authUrl = buildAuthorizationUrl(state);
    const response = NextResponse.redirect(authUrl);
    response.cookies.set(`${COOKIE_PREFIX}_oauth_state`, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
    return response;
  }

  // ── Has token + on auth route → redirect to app ──────────────────────────
  if (token && isRootOrAuth) {
    const parsed = decodeTokenPayload(token);
    const destination = parsed?.psCode
      ? `${FULL_BASE_PATH}/`
      : `${FULL_BASE_PATH}/select-context`;
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth/callback|api/auth/logout|_next/static|_next/image|robots.txt|public|images|manifest.json|sw.js|favicon.ico|workbox-*).*)",
    "/",
  ],
};
