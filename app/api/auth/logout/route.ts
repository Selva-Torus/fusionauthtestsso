// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fusionAuthConfig } from "@/lib/fusionauth";

const FULL_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const COOKIE_PREFIX = FULL_BASE_PATH.replace(/^\/|\/$/g, "").replace(
  /\//g,
  "_",
);

export async function GET(request: NextRequest) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const postLogoutUri = encodeURIComponent(
    `${process.env.NEXT_PUBLIC_APP_URL}${basePath}/`,
  );
  const fusionAuthLogoutUrl =
    `${fusionAuthConfig.baseUrl}/oauth2/logout` +
    `?client_id=${fusionAuthConfig.clientId}`;

  const response = NextResponse.redirect(fusionAuthLogoutUrl);
  response.cookies.delete(`${COOKIE_PREFIX}_token`);
  return response;
}
