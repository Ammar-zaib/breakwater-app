import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Logo } from "@/components/logo";
import "./landing.css";

const TICKER_ITEMS = [
  { k: "STRIPE", v: "2026-08-26.dahlia confirmed · monitoring" },
  { k: "TWILIO", v: "regional domain shutdown, Apr 2026 · monitoring" },
  { k: "OPENAI", v: "model + Assistants API deprecations · monitoring" },
  { k: "SHOPIFY", v: "quarterly calendar versioning · monitoring" },
  { k: "SLACK", v: "legacy app + scope changes · monitoring" },
  { k: "TRACKING", v: "every named and unnamed Stripe release since acacia" },
];

// Deterministic (no Math.random) so server and client markup match exactly.
const TETRA_UNITS = Array.from({ length: Math.floor((1120 - 10) / 26) }, (_, i) => {
  const x = 10 + i * 26;
  return { x, y: 34 + Math.sin(x * 0.7) * 2 };
});

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex-1">
      <div className="lp-ticker-strip">
        <div className="lp-ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((it, i) => (
            <span className="lp-ticker-item" key={i}>
              <b>{it.k}</b> {it.v}
              <span className="sep">◆</span>
            </span>
          ))}
        </div>
      </div>

      <div className="lp-hero">
        <div className="lp-chart-grid" aria-hidden="true" />
        <div className="lp-radar" aria-hidden="true">
          <div className="ring" />
          <div className="ring" />
          <div className="ring" />
          <div className="ring" />
          <div className="sweep" />
        </div>

        <nav className="lp-navbar">
          <div className="lp-wrap">
            <Logo />
            <div className="lp-navbar-links">
              <a href="#how">How it works</a>
              <a href="#security">Security</a>
              <a href="#tracking">Tracking</a>
            </div>
            <div className="lp-navbar-right">
              <span className="lp-status-chip">
                <span className="dot" /> Monitoring live
              </span>
              <Link href="/login" className="lp-btn">
                <GithubMark />
                Sign in with GitHub
              </Link>
            </div>
          </div>
        </nav>

        <div className="lp-wrap lp-hero-inner">
          <span className="lp-eyebrow">
            <span className="dot" /> ACTIVE SYSTEM: 2026-08-26 · DAHLIA
          </span>
          <h1 className="font-display">
            Every vendor API is a <em>storm system</em>.
            <br />
            Breakwater tracks it before landfall.
          </h1>
          <p className="lede">
            Stripe names its breaking releases the way meteorologists name storms — alphabetically,
            on a schedule. Twilio, OpenAI, Shopify, and Slack all break in their own quieter ways.
            Breakwater tracks all five against your actual code and warns you before it makes
            landfall in production.
          </p>
          <div className="lp-cta-row">
            <Link href="/login" className="lp-btn">
              Connect a repository →
            </Link>
            <a href="#how" className="lp-btn lp-ghost">
              See how scanning works
            </a>
            <span className="fine">FREE · EARLY ACCESS</span>
          </div>

          <div className="lp-watch-strip">
            <span className="lbl">On watch:</span>
            <span className="lp-vendor-chip live">
              <span className="vdot" /> Stripe
            </span>
            <span className="lp-vendor-chip live">
              <span className="vdot" /> Twilio
            </span>
            <span className="lp-vendor-chip live">
              <span className="vdot" /> OpenAI
            </span>
            <span className="lp-vendor-chip live">
              <span className="vdot" /> Shopify
            </span>
            <span className="lp-vendor-chip live">
              <span className="vdot" /> Slack
            </span>
          </div>
        </div>

        <div className="lp-scene">
          <div className="lp-swell-track" aria-hidden="true">
            <svg
              className="lp-swell s1"
              viewBox="0 0 1600 300"
              preserveAspectRatio="none"
              style={{ position: "absolute", bottom: 0, height: "100%" }}
            >
              <path
                d="M0,180 C 100,140 200,140 300,180 C 400,220 500,220 600,180 C 700,140 800,140 900,180 C 1000,220 1100,220 1200,180 C 1300,140 1400,140 1500,180 L1600,300 L0,300 Z
                   M800,180 C 900,140 1000,140 1100,180 C 1200,220 1300,220 1400,180 C 1500,140 1600,140 1700,180 C 1800,220 1900,220 2000,180 C 2100,140 2200,140 2300,180 L2300,300 L800,300 Z"
                fill="rgba(229,182,74,0.10)"
              />
            </svg>
            <svg
              className="lp-swell s2"
              viewBox="0 0 1600 300"
              preserveAspectRatio="none"
              style={{ position: "absolute", bottom: 0, height: "100%" }}
            >
              <path
                d="M0,210 C 120,170 260,170 380,210 C 500,250 640,250 760,210 C 880,170 1020,170 1140,210 C 1260,250 1400,250 1520,210 L1600,300 L0,300 Z
                   M800,210 C 920,170 1060,170 1180,210 C 1300,250 1440,250 1560,210 C 1680,170 1820,170 1940,210 C 2060,250 2200,250 2320,210 L2320,300 L800,300 Z"
                fill="rgba(82,211,166,0.09)"
              />
            </svg>
            <svg
              className="lp-swell s3"
              viewBox="0 0 1600 300"
              preserveAspectRatio="none"
              style={{ position: "absolute", bottom: 0, height: "100%" }}
            >
              <path
                d="M0,240 C 150,200 300,200 450,240 C 600,280 750,280 900,240 C 1050,200 1200,200 1350,240 C 1500,280 1650,280 1800,240 L1600,300 L0,300 Z
                   M800,240 C 950,200 1100,200 1250,240 C 1400,280 1550,280 1700,240 C 1850,200 2000,200 2150,240 C 2300,280 2450,280 2600,240 L2600,300 L800,300 Z"
                fill="rgba(238,246,244,0.05)"
              />
            </svg>
          </div>
          <div className="lp-breakwater-row" aria-hidden="true">
            <svg width="100%" height="46" viewBox="0 0 1120 46" preserveAspectRatio="none" style={{ display: "block" }}>
              <defs>
                <g id="tetra-unit">
                  <circle cx="0" cy="0" r="4.5" fill="var(--surface-2)" stroke="var(--line)" strokeWidth="1" />
                  <line x1="0" y1="0" x2="-9" y2="10" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" />
                  <line x1="0" y1="0" x2="9" y2="10" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" />
                  <line x1="0" y1="0" x2="0" y2="-11" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" />
                </g>
              </defs>
              {TETRA_UNITS.map((u, i) => (
                <use key={i} href="#tetra-unit" x={u.x} y={u.y} />
              ))}
            </svg>
          </div>
          <div className="baseline" />
        </div>
      </div>

      <div className="lp-bulletin">
        <div className="lp-wrap lp-bulletin-grid">
          <div className="lp-bulletin-cell">
            <div className="lbl">Current Stripe API version</div>
            <div className="val">2026-08-26.dahlia</div>
          </div>
          <div className="lp-bulletin-cell">
            <div className="lbl">Release rhythm</div>
            <div className="val">Monthly, no breaks · 2 named/yr</div>
          </div>
          <div className="lp-bulletin-cell">
            <div className="lbl">Vendors under watch</div>
            <div className="val">Stripe, Twilio, OpenAI, Shopify, Slack</div>
          </div>
        </div>
      </div>

      <div className="lp-storm-section lp-wrap" id="tracking">
        <p className="lp-kicker">Named system tracking</p>
        <h2 className="lp-h2 font-display">
          Two confirmed systems on the board. More between them, unnamed to you — not to Breakwater.
        </h2>
        <p className="sub">
          Every dot below is a real, dated Stripe API release. The gap in between is real too —
          Stripe doesn&apos;t publish a master list, so most teams only ever hear about the one that
          just hit them.
        </p>

        <div className="lp-track">
          <div className="lp-track-line" />
          <div className="lp-track-points">
            <div className="lp-track-point">
              <div className="node" />
              <div className="name font-display">acacia</div>
              <div className="date">2024-09-30 · first named release</div>
              <div className="mag">
                <span style={{ height: 6 }} />
                <span style={{ height: 11 }} />
                <span style={{ height: 8 }} />
                <span style={{ height: 14 }} />
              </div>
              <div className="mag-lbl">breaking changes</div>
            </div>
            <div className="lp-track-gap">
              <div className="node" />
              <div className="name">3–4 more systems</div>
            </div>
            <div className="lp-track-point active">
              <div className="node" />
              <div className="name font-display">dahlia</div>
              <div className="date">2026-08-26 · active now</div>
              <div className="mag">
                <span style={{ height: 16 }} />
                <span style={{ height: 9 }} />
                <span style={{ height: 19 }} />
                <span style={{ height: 12 }} />
              </div>
              <div className="mag-lbl">breaking changes</div>
            </div>
          </div>
        </div>
      </div>

      <div className="lp-trust-strip" id="security">
        <div className="lp-wrap">
          <div className="lp-trust-head">
            <p className="lp-kicker" style={{ marginBottom: 8 }}>
              Built for teams who ship on top of vendors
            </p>
            <h2 className="font-display" style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>
              Nothing about how this runs should surprise your security review.
            </h2>
          </div>
          <div className="lp-trust-grid">
            <div className="lp-trust-item">
              <div className="ic">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3 4 7v5c0 5.2 3.4 8.6 8 9.9 4.6-1.3 8-4.7 8-9.9V7l-8-4Z"
                    stroke="var(--accent)"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <path d="M9 12.2l2 2 4-4.4" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="tt">Encrypted at rest</div>
                <div className="td">AES-256-GCM on every stored key. Nothing sits in the database in plain text.</div>
              </div>
            </div>
            <div className="lp-trust-item">
              <div className="ic">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="10" width="16" height="10" rx="2" stroke="var(--accent)" strokeWidth="1.6" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="var(--accent)" strokeWidth="1.6" />
                </svg>
              </div>
              <div>
                <div className="tt">Your own AI key</div>
                <div className="td">Scans run on the Anthropic key you provide. Nothing is pooled or shared across accounts.</div>
              </div>
            </div>
            <div className="lp-trust-item">
              <div className="ic">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
                  <path d="M14 4h6v6M20 4l-9 9" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="tt">Writes only when you ask</div>
                <div className="td">Every scan only reads. Breakwater only ever opens a pull request when you click &quot;Open fix PR&quot; on a specific finding — never automatically, and you review it like any other PR.</div>
              </div>
            </div>
            <div className="lp-trust-item">
              <div className="ic">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M12 4v4M12 16v4M4 12h4M16 12h4" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="3.2" stroke="var(--accent)" strokeWidth="1.6" />
                </svg>
              </div>
              <div>
                <div className="tt">Disconnect anytime</div>
                <div className="td">Removing a repository deletes its scan history with it. Nothing lingers.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="lp-steps-section" id="how">
        <div className="lp-wrap">
          <p className="lp-kicker">How a watch is set</p>
          <h2 className="lp-h2 font-display">Three steps. Then it runs without you.</h2>
          <div className="lp-steps-grid">
            <div className="lp-step-card">
              <div className="step-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M8 12h8M12 8v8" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="9" stroke="var(--accent)" strokeWidth="1.6" />
                </svg>
              </div>
              <div className="step-n">01 / MOOR</div>
              <h3>Connect a repo</h3>
              <p>
                Sign in with GitHub and pick which repository — and which vendor it depends on —
                Breakwater should watch.
              </p>
            </div>
            <div className="lp-step-card">
              <div className="step-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="var(--accent)" strokeWidth="1.6" />
                  <path d="M12 7v5l3.2 2" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="step-n">02 / WATCH</div>
              <h3>It stands the night shift</h3>
              <p>
                Every day, Breakwater checks the vendor&apos;s real API version history against your
                actual code, quietly, in the background.
              </p>
            </div>
            <div className="lp-step-card">
              <div className="step-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3 3 8v5c0 5 4 8 9 8s9-3 9-8V8l-9-5Z" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M12 9v4.5" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="12" cy="16.5" r="0.9" fill="var(--accent)" />
                </svg>
              </div>
              <div className="step-n">03 / WARN</div>
              <h3>Only when it matters</h3>
              <p>
                One email when something concrete changes — the file, the line, why it matters, and
                the fix. Nothing when there&apos;s nothing to say.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="lp-statement-section">
        <div className="lp-wrap">
          <div className="lp-statement-mark">&ldquo;</div>
          <h2 className="font-display">
            Most teams don&apos;t find out a vendor&apos;s API changed.{" "}
            <b>They find out a request started failing —</b> and work backward from there.
          </h2>
          <div className="who">THAT GAP IS THE WHOLE PRODUCT</div>
        </div>
      </div>

      <div className="lp-compare-section lp-wrap">
        <p className="lp-kicker">What actually changes</p>
        <h2 className="lp-h2 font-display">
          The changelog reaches your inbox either way. Only one version reaches your code.
        </h2>
        <div className="lp-compare-grid">
          <div className="lp-compare-col without">
            <div className="ch">Changelog alone</div>
            <div className="lp-compare-row">
              <span className="ico">✕</span>
              <span>You get a broadcast email that doesn&apos;t know which repos, files, or lines you actually own.</span>
            </div>
            <div className="lp-compare-row">
              <span className="ico">✕</span>
              <span>Someone has to read it, remember it, and manually check every service against it.</span>
            </div>
            <div className="lp-compare-row">
              <span className="ico">✕</span>
              <span>Unnamed monthly releases between the big ones usually go unread entirely.</span>
            </div>
            <div className="lp-compare-row">
              <span className="ico">✕</span>
              <span>Risk is discovered in production, after a request starts failing.</span>
            </div>
          </div>
          <div className="lp-compare-col with lp-bracketed">
            <div className="ch">✓ With Breakwater</div>
            <div className="lp-compare-row">
              <span className="ico">✓</span>
              <span>The same changelog is cross-checked against your actual repository, automatically, every day.</span>
            </div>
            <div className="lp-compare-row">
              <span className="ico">✓</span>
              <span>You get one email only when a specific file and line are genuinely at risk.</span>
            </div>
            <div className="lp-compare-row">
              <span className="ico">✓</span>
              <span>Every named and unnamed release is tracked — nothing quietly slips through.</span>
            </div>
            <div className="lp-compare-row">
              <span className="ico">✓</span>
              <span>Risk is caught before deploy, with the fix already written out for you.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="lp-gap-section lp-wrap">
        <p className="lp-kicker">The actual gap</p>
        <h2 className="lp-h2 font-display">
          Vendor changelogs are a broadcast.
          <br />
          Your codebase is not.
        </h2>
        <div className="lp-gap-grid">
          <div>
            <p>
              Stripe already tells the world when something changes — a changelog entry, an email, a
              named release. What it doesn&apos;t do is open <em>your</em> repository and check
              whether it&apos;s affected.
            </p>
            <p>
              That translation — from a general announcement to &quot;this line, in this file, needs
              to change&quot; — is work every team quietly skips until it costs them. Breakwater does
              that translation automatically, every day, for exactly the code you actually shipped.
            </p>
          </div>
          <div className="lp-transmission lp-bracketed">
            <div className="scanbox">
              <div className="lp-scanbeam" />
              <pre>
                {`src/lib/stripe/client.ts

  const stripe = new Stripe(key, {
    `}
                <span className="hl">apiVersion: null,</span>
                {`
  });

  // scanning against 2026-08-26.dahlia…`}
              </pre>
            </div>
            <div className="th">
              <span className="tag">Signal received</span>
              <span className="lp-pill high">high risk</span>
            </div>
            <div className="stats">
              <div className="stat-row">
                <span>Source</span>
                <span>Stripe changelog, 2026-08-26</span>
              </div>
              <div className="stat-row">
                <span>Cross-checked against</span>
                <span>acme-inc/billing-service</span>
              </div>
              <div className="stat-row">
                <span>Files matched</span>
                <span>3 of 3 scanned</span>
              </div>
              <div className="stat-row">
                <span>Verdict</span>
                <span>version unpinned, one fix required</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="lp-footer">
        <div className="lp-wrap fwrap">
          <div className="fl">
            <Logo className="text-sm" />
            <span className="coords">37.7749°N · 122.4194°W</span>
          </div>
          <span className="brand">EARLY ACCESS · STRIPE · TWILIO · OPENAI · SHOPIFY · SLACK</span>
          <span className="brand">SCANS RUN ON YOUR OWN CLAUDE USAGE · YOUR CODE GOES NOWHERE ELSE</span>
          <div className="flex gap-4 text-xs text-ink-dim">
            <Link href="/terms" className="hover:text-ink transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-ink transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function GithubMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
