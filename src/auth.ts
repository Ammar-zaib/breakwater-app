import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";

/**
 * GitHub OAuth scope: we ask for `repo` (not just default `read:user`)
 * because Breakwater needs to read the contents of a user's chosen
 * repositories to scan them. Public-repo-only apps could use `public_repo`
 * instead — see README if you want to narrow this.
 *
 * GitHub is the one provider every account needs, since it's what grants
 * repo read access — signing in with it is what actually lets Breakwater
 * scan anything. Google and Microsoft (below) are optional, additional
 * sign-in methods for teams that want "log in with your work identity"
 * rather than a full SAML/SSO integration (which is a bigger, separate
 * project — see DEPLOY_COOLIFY.md). They're safe to auto-link by email
 * (`allowDangerousEmailAccountLinking: true`) because both Google and
 * Microsoft verify the email address before issuing a token, unlike a
 * provider that lets anyone claim an unverified address.
 */
const providers: Provider[] = [
  GitHub({
    authorization: {
      params: { scope: "read:user user:email repo" },
    },
    // Lets someone who first signed in with Google/Microsoft later connect
    // GitHub (or vice versa) and land on the SAME account, matched by
    // verified email, instead of silently creating a second account.
    allowDangerousEmailAccountLinking: true,
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google({ allowDangerousEmailAccountLinking: true }));
}

if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) {
  providers.push(
    MicrosoftEntraID({
      allowDangerousEmailAccountLinking: true,
      // No `issuer` override — this deliberately uses Auth.js's default
      // "common" tenant, so any Microsoft account (personal, school, or
      // work, from any organization) can sign in. Restricting to one
      // organization's tenant would mean re-registering the app per
      // customer, which doesn't fit a multi-tenant product.
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Required for self-hosted deployments behind a reverse proxy (Coolify's
  // Traefik, in our case). Without this, Auth.js refuses every request with
  // an "UntrustedHost" error because it can't otherwise verify the Host
  // header it's receiving is legitimate. Vercel/Netlify set this
  // automatically via their own platform env vars, which is why this
  // wasn't needed there.
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  providers,
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
