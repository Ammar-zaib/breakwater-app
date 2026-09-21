import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { renderTermsOfServiceHtml } from "@/lib/legal-docs";

export const metadata: Metadata = { title: "Terms of Service — Breakwater" };

export default async function TermsPage() {
  const html = await renderTermsOfServiceHtml();

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
