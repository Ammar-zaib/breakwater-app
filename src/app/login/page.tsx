import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Logo } from "@/components/logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const { callbackUrl } = await searchParams;

  const hasGoogle = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const hasMicrosoft = !!(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET);

  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo className="text-xl" />
        </div>
        <div className="bg-surface border border-line rounded-2xl p-8 shadow-[0_22px_44px_-30px_rgba(0,0,0,0.65)] text-center">
          <h1 className="font-display font-medium text-lg">Sign in to Breakwater</h1>
          <p className="mt-2 text-sm text-ink-dim leading-relaxed">
            We use GitHub to read the repositories you choose to watch — nothing is accessed
            without you picking it explicitly on the next screen.
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: callbackUrl || "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="mt-6 w-full inline-flex items-center justify-center gap-2 text-sm font-semibold bg-accent text-accent-ink rounded-lg px-5 py-3 hover:opacity-90 transition-opacity"
            >
              <GithubMark />
              Continue with GitHub
            </button>
          </form>

          {hasGoogle || hasMicrosoft ? (
            <>
              <div className="flex items-center gap-3 my-5">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[11px] text-ink-dim">or sign in with your work identity</span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <p className="text-[11px] text-ink-dim leading-relaxed mb-3">
                You&apos;ll still need to connect GitHub afterward — that&apos;s a separate step, since it&apos;s
                what grants repo access.
              </p>
              <div className="space-y-2">
                {hasGoogle ? (
                  <form
                    action={async () => {
                      "use server";
                      await signIn("google", { redirectTo: callbackUrl || "/dashboard" });
                    }}
                  >
                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold bg-surface-2 border border-line rounded-lg px-5 py-2.5 hover:bg-surface transition-colors"
                    >
                      <GoogleMark />
                      Continue with Google
                    </button>
                  </form>
                ) : null}
                {hasMicrosoft ? (
                  <form
                    action={async () => {
                      "use server";
                      await signIn("microsoft-entra-id", { redirectTo: callbackUrl || "/dashboard" });
                    }}
                  >
                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold bg-surface-2 border border-line rounded-lg px-5 py-2.5 hover:bg-surface transition-colors"
                    >
                      <MicrosoftMark />
                      Continue with Microsoft
                    </button>
                  </form>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GithubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.98 5.24.98 11.52c0 5.02 3.26 9.28 7.78 10.78.57.1.78-.25.78-.55v-1.94c-3.16.69-3.83-1.52-3.83-1.52-.52-1.31-1.26-1.66-1.26-1.66-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.73 2.65 1.23 3.3.94.1-.73.4-1.23.72-1.51-2.52-.29-5.17-1.26-5.17-5.6 0-1.24.44-2.25 1.17-3.04-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.14 1.16a10.9 10.9 0 0 1 5.72 0c2.18-1.47 3.14-1.16 3.14-1.16.62 1.57.23 2.73.11 3.02.73.79 1.17 1.8 1.17 3.04 0 4.35-2.66 5.31-5.19 5.59.41.35.77 1.04.77 2.11v3.13c0 .3.21.66.79.55A10.53 10.53 0 0 0 23.02 11.52C23.02 5.24 18.27.5 12 .5Z" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.1A11.99 11.99 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.26a12 12 0 0 0 0 10.74l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.26 6.63l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="1" width="10.4" height="10.4" fill="#F25022" />
      <rect x="12.6" y="1" width="10.4" height="10.4" fill="#7FBA00" />
      <rect x="1" y="12.6" width="10.4" height="10.4" fill="#00A4EF" />
      <rect x="12.6" y="12.6" width="10.4" height="10.4" fill="#FFB900" />
    </svg>
  );
}
