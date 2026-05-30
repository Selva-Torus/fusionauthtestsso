// app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens } from '@/lib/fusionauth'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

  // FusionAuth returned an error (user cancelled, etc.)
  if (error) {
    return NextResponse.redirect(new URL(`${basePath}/?error=${error}`, request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL(`${basePath}/`, request.url))
  }

  // Retrieve PKCE verifier and validate state from cookie
  const storedState = request.cookies.get('oauth_state')?.value
  const codeVerifier = request.cookies.get('oauth_code_verifier')?.value

  if (!storedState || storedState !== state || !codeVerifier) {
    return NextResponse.redirect(new URL(`${basePath}/?error=invalid_state`, request.url))
  }

  try {
    // 1. Exchange code for FusionAuth tokens
    const fusionAuthTokens = await exchangeCodeForTokens(code, codeVerifier)

    // 2. Get user info from the id_token or userinfo endpoint
    const userInfoRes = await fetch(
      `${process.env.AUTH_FUSIONAUTH_ISSUER}/oauth2/userinfo`,
      { headers: { Authorization: `Bearer ${fusionAuthTokens.access_token}` } }
    )
    const userInfo = await userInfoRes.json()
    const username = userInfo.email ?? userInfo.preferred_username

    // 3. Call your Torus backend — pass fusionAuthTokens so refresh_token is preserved
    const torusRes = await fetch(
      `${process.env.NEXT_PUBLIC_TORUS_API_URL}/auth/oauth-signin`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          ufClientType: 'UFW',
          isOauthUser: true,
          fusionAuthLoginResponse: fusionAuthTokens, // contains refresh_token, refresh_token_id
        }),
      }
    )

    if (!torusRes.ok) {
      const errBody = await torusRes.json().catch(() => ({}))
      const errMsg = errBody?.message ?? 'auth_failed'
      return NextResponse.redirect(
        new URL(`${basePath}/?error=${encodeURIComponent(errMsg)}`, request.url)
      )
    }

    const { token, redirectToORPSelector } = await torusRes.json()

    // 4. Set your Torus token cookie and clean up PKCE cookies
    const destination = redirectToORPSelector
      ? `${basePath}/select-context`
      : `${basePath}/logs` // or your landingScreen logic

    const response = NextResponse.redirect(new URL(destination, request.url))

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours — align with your accessTokenExpiryTime
    })

    // Clean up PKCE cookies
    response.cookies.delete('oauth_state')
    response.cookies.delete('oauth_code_verifier')

    return response
  } catch (err: any) {
    console.error('Callback error:', err)
    return NextResponse.redirect(
      new URL(`${basePath}/?error=server_error`, request.url)
    )
  }
}