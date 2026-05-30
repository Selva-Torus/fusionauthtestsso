// lib/fusionauth.ts
export const fusionAuthConfig = {
  baseUrl: process.env.AUTH_FUSIONAUTH_ISSUER!,
  clientId: process.env.AUTH_FUSIONAUTH_ID!,
  clientSecret: process.env.AUTH_FUSIONAUTH_SECRET!,
  tenantId: process.env.AUTH_FUSIONAUTH_TENANT_ID!,
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}${process.env.NEXT_PUBLIC_BASE_PATH}/api/auth/callback`,
}

export function buildAuthorizationUrl(state: string, codeChallenge: string) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: fusionAuthConfig.clientId,
    redirect_uri: fusionAuthConfig.redirectUri,
    scope: 'openid profile email offline_access',
    tenantId: fusionAuthConfig.tenantId,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${fusionAuthConfig.baseUrl}/oauth2/authorize?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: fusionAuthConfig.redirectUri,
    client_id: fusionAuthConfig.clientId,
    client_secret: fusionAuthConfig.clientSecret,
    code_verifier: codeVerifier,
  })

  const res = await fetch(`${fusionAuthConfig.baseUrl}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-FusionAuth-TenantId': fusionAuthConfig.tenantId,
    },
    body: params.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token exchange failed: ${err}`)
  }
  return res.json()
}