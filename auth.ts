import NextAuth from "next-auth";
import FusionAuth from "next-auth/providers/fusionauth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    FusionAuth({
      clientId: process.env.AUTH_FUSIONAUTH_ID,
      clientSecret: process.env.AUTH_FUSIONAUTH_SECRET,
      tenantId: process.env.AUTH_FUSIONAUTH_TENANT_ID,
      issuer: process.env.AUTH_FUSIONAUTH_ISSUER,
      wellKnown: `${process.env.AUTH_FUSIONAUTH_ISSUER}/.well-known/openid-configuration/${process.env.AUTH_FUSIONAUTH_TENANT_ID}`,
      userinfo: `${process.env.AUTH_FUSIONAUTH_ISSUER}/oauth2/userinfo`,
      token: `${process.env.AUTH_FUSIONAUTH_ISSUER}/oauth2/token`,
    }),
  ],
  callbacks: {
    async signIn(params) {
      console.log(params, "signin params");
      return true;
    },
  },
});
