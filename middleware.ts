// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { buildAuthorizationUrl } from '@/lib/fusionauth'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

// Routes that don't require authentication
const PUBLIC_PATHS = [
  `${BASE_PATH}/api/auth/callback`,
  `${BASE_PATH}/api/auth/logout`,
  `${BASE_PATH}/api/`, // allow all api routes to pass through
]

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

// ---- PKCE helpers (must be Edge-compatible, no Node APIs) ----
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array).map((b) => chars[b % chars.length]).join('')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// ---- Token decode (no crypto needed, just base64) ----
function decodeTokenPayload(token: string): any {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

function getLandingScreen(token: string): string {
  const parsed = decodeTokenPayload(token)
  if (parsed?.psCode) return `${BASE_PATH}/logs`
  return `${BASE_PATH}/select-context`
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('token')?.value

  // Always allow public/api paths through
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // ── Unauthenticated: redirect to FusionAuth ──────────────────────────────
  if (!token) {
    const state = generateRandomString(32)
    const codeVerifier = generateRandomString(64)
    const codeChallenge = await generateCodeChallenge(codeVerifier)

    const authUrl = buildAuthorizationUrl(state, codeChallenge)
    const response = NextResponse.redirect(authUrl)

    // Store PKCE values in short-lived cookies for the callback to verify
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 10, // 10 minutes — enough for login flow
    }
    response.cookies.set('oauth_state', state, cookieOpts)
    response.cookies.set('oauth_code_verifier', codeVerifier, cookieOpts)

    return response
  }

  // ── Authenticated: redirect away from root / auth entry points ───────────
  const isRootOrAuth = pathname === `${BASE_PATH}/` || pathname === BASE_PATH || pathname === `${BASE_PATH}/forgot-password`
  if (token && isRootOrAuth) {
    return NextResponse.redirect(
      new URL(getLandingScreen(token), request.url)
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|robots.txt|public|images|manifest.json|sw.js|favicon.ico|workbox-*).*)',
    '/',
  ],
}