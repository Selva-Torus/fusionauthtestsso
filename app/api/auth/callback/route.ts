// app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/fusionauth";

const FULL_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const COOKIE_PREFIX = FULL_BASE_PATH.replace(/^\/|\/$/g, "").replace(
  /\//g,
  "_",
);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`${FULL_BASE_PATH}/?error=${error}`, request.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL(`${FULL_BASE_PATH}/`, request.url));
  }

  // Validate state
  const storedState = request.cookies.get(`${COOKIE_PREFIX}_oauth_state`)?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL(`${FULL_BASE_PATH}/?error=invalid_state`, request.url),
    );
  }

  try {
    // 1. Exchange code for tokens
    const fusionAuthTokens = await exchangeCodeForTokens(code);

    console.log(fusionAuthTokens, "fusionAuthTokens");

    // 2. Get user info
    const userInfoRes = await fetch(
      `${process.env.AUTH_FUSIONAUTH_ISSUER}/oauth2/userinfo`,
      { headers: { Authorization: `Bearer ${fusionAuthTokens.access_token}` } },
    );
    const userInfo = await userInfoRes.json();
    const username = userInfo.email ?? userInfo.preferred_username;

    // 3. Call your Torus backend
    const torusRes = await fetch(
      `${process.env.NEXT_PUBLIC_TORUS_API_URL}/UF/signin`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          ufClientType: "UFW",
          isOauthUser: true,
          fusionAuthLoginResponse: fusionAuthTokens,
        }),
      },
    );

    if (!torusRes.ok) {
      const errBody = await torusRes.json().catch(() => ({}));
      return NextResponse.redirect(
        new URL(
          `${FULL_BASE_PATH}/?error=${encodeURIComponent(errBody?.message ?? "auth_failed")}`,
          request.url,
        ),
      );
    }

    const { token, redirectToORPSelector } = await torusRes.json();
    const destination = redirectToORPSelector
      ? `${FULL_BASE_PATH}/select-context`
      : `${FULL_BASE_PATH}/`;

    const response = NextResponse.redirect(new URL(destination, request.url));
    response.cookies.set(`${COOKIE_PREFIX}_token`, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    response.cookies.delete(`${COOKIE_PREFIX}_oauth_state`);

    return response;
  } catch (err: any) {
    console.error("Callback error:", err);
    return NextResponse.redirect(
      new URL(`${FULL_BASE_PATH}/?error=server_error`, request.url),
    );
  }
}
