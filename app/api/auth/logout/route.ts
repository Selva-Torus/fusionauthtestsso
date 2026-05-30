// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { fusionAuthConfig } from '@/lib/fusionauth'

export async function GET(request: NextRequest) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
  const postLogoutUri = encodeURIComponent(
    `${process.env.NEXT_PUBLIC_APP_URL}${basePath}/`
  )
  const fusionAuthLogoutUrl =
    `${fusionAuthConfig.baseUrl}/oauth2/logout` +
    `?client_id=${fusionAuthConfig.clientId}&post_logout_redirect_uri=${postLogoutUri}`

  const response = NextResponse.redirect(fusionAuthLogoutUrl)
  response.cookies.delete('token')
  return response
}