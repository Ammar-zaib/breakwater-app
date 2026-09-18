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
