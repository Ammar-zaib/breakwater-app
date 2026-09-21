import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { renderPrivacyPolicyHtml } from "@/lib/legal-docs";

export const metadata: Metadata = { title: "Privacy Policy — Breakwater" };

export default async function PrivacyPage() {
  const html = await renderPrivacyPolicyHtml();

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-6 py-5 border-b border-line">
        <Link href="/">
          <Logo className="text-base" />
        </Link>
      </header>
      <main className="flex-1 px-6 py-10">
        <div className="max-w-2xl mx-auto legal-doc" dangerouslySetInnerHTML={{ __html: html }} />
      </main>
    </div>
  );
}
