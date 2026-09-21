# Questions for [friend] — Breakwater feedback

A quick heads-up before the list: I'm not looking for "does this look cool" — I'm trying to
figure out if this solves a real problem for people who actually build on top of these vendors.
Be honest, even if the honest answer is "I wouldn't use this."

## Before you ask anything

Have them actually sign in and connect a real repo of theirs — ideally one that uses Stripe,
Twilio, OpenAI, Shopify, or Slack, since those are the only vendors it knows about right now.
Everything below is more useful after they've seen a real scan result on their own code, not just
the landing page.

## Their current behavior (ask this first, before they've seen the product)

1. How do you currently find out when a vendor's API changes in a way that could break your code?
2. Has a vendor update ever actually broken something in production for you? How did you find out
   — a changelog, a failed request in your logs, a user complaint?
3. Do you pin SDK/API versions and just... never revisit them? Be honest.
4. Do you read vendor changelogs regularly, or only after something breaks?

## Reaction to the actual scan result

5. Did the scan say anything true and specific about your code, or did it feel generic?
6. Was there anything in the findings you already knew, that still felt worth being reminded of?
7. Did anything in the results feel wrong, made-up, or like a false alarm?
8. If this had been running silently on this repo for the last six months, would it have caught
   anything you'd have actually wanted to know about?

## Trust and adoption blockers

9. It asks for GitHub `repo` scope (read + write, since it can open a PR with a fix if you ask it
   to) — does that give you pause? Would you connect a real work repo to this, not just a
   side project?
10. It asks for your own Anthropic API key rather than using a shared one — does that feel better
    or worse to you than a tool that just charges you directly?
11. What would make you *not* trust an automated finding enough to act on it?

## Willingness to pay (ask this separately from "is it a good idea")

12. Would you pay for this? Roughly how much, monthly, for the problem it solves — not for the
    product as a demo?
13. What would have to be true for you to actually recommend this to a coworker, unprompted?

## Since you're a developer — technical gut-check

14. Does the core mechanism make sense to you: it searches your repo for code that touches a
    vendor's SDK, then asks Claude to cross-reference that against how the vendor actually
    versions/deprecates things? Where do you think that approach breaks down?
15. Any obvious gaps, edge cases, or architecture concerns jump out at you from using it?
