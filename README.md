# TrueTel Cloud Phone — Proposal Builder

Mobile-first internal tool: a rep answers TrueTel's own discovery script,
picks quantities, a pricing tier, and an optional discount, then **previews
the actual AI-drafted, on-brand proposal in the portal** before anything goes
near the client. Approve it and it sends (Gmail); ask for changes and it goes
straight back to editing — nothing is emailed without a human tapping
"Approve & send." Multi-site deals go through the exact same pipeline, not a
manual hand-off — see "The actual n8n workflow" below.

Live design reference: `managed-it.truetel.com.au` (tokens ported into
`app/globals.css` — white/lime/near-black, Plus Jakarta Sans).

## Run locally

```bash
npm install
cp .env.local.example .env.local   # then paste your n8n webhook URL
npm run dev
```

## What's real vs. placeholder in the pricing model

`lib/pricing.ts` is fully documented inline, but the short version:

- **Confirmed from TrueTel's own Notion** (discovery script, "1300 Number
  Charges" guide, per-site worksheet, the RJP Body Repair Centre deal):
  NBN 100/40, per-line landline, 1300 standalone/bundled pricing, porting
  fees, regional install surcharge.
- **Unconfirmed placeholders, flagged in code comments**: the NBN 50/20 rate,
  cordless/cordless-base per-unit rates, modem rental rate, and the base
  setup fee. Get a rep or Jack to confirm these before trusting a quote that
  uses them.
- **`PRICING_TIERS` (Basic / Standard / Premium) is a new mechanism**, not
  historical TrueTel practice — real deal records show flat per-unit pricing
  regardless of company size. The multipliers (1.0 / 1.2 / 1.5) are wired up
  and working end-to-end but are placeholders; TrueTel's leadership should
  set the real numbers in `PRICING_TIERS` in `lib/pricing.ts`.

## The n8n contract

The app calls the SAME `NEXT_PUBLIC_N8N_WEBHOOK_URL` twice, distinguished by
`mode` (defined in `lib/n8n.ts` as `ProposalPayload`):

- `mode: "generate"` — sent when the rep taps "Preview proposal." n8n drafts
  the narrative, merges the template, and **responds synchronously with the
  rendered result** (`mergedHtml`, `emailText`, `narrative`) so the portal can
  show it before anything reaches the client.
- `mode: "send"` — sent when the rep taps "Approve & send," carrying the
  exact `mergedHtml`/`emailText` they just previewed. n8n relays it verbatim
  via Gmail — no re-drafting, no second AI call, guaranteed WYSIWYG.

This means the Webhook node must use **responseMode: "Using Respond to
Webhook Node"** (already set in the workflow file), not "Immediately" — the
portal is now waiting on the actual generated content, not just an ack.

Also includes `currentSetup` — whether the client is switching from an
existing provider (and what's wrong with it) or installing fresh — and
`quantities.siteCount`, which turns per-site line items (NBN, landline, 1300)
into a multiplier for multi-site deals:

```json
{
  "mode": "generate",
  "meta": { "submittedAt": "2026-09-11T08:32:10.000Z", "source": "truetel-proposal-portal", "repName": "Alex Rep", "repEmail": "alex@truetel.com.au" },
  "client": { "companyName": "Acme Pty Ltd", "contactName": "Jordan Smith", "contactEmail": "jordan@acme.com.au", "contactPhone": "0412 345 678" },
  "dealShape": "standard",
  "outputFormat": "brandedPdf",
  "companyTier": "standard",
  "discovery": { "businessStatus": "new", "hasLandline": false, "needsHandsets": true, "headcount": 6, "hasExistingSystem": false },
  "currentSetup": {
    "hasProvider": true,
    "providerName": "Telstra",
    "monthlyCost": 620,
    "painPoints": ["Frequent outages", "Expensive month-to-month"]
  },
  "quantities": {
    "nbnSpeed": "100/40", "lines": 4, "cordless": 0, "cordlessBase": 0, "mobileApps": 0, "modems": 1,
    "number1300": false, "number1300Bundled": false, "siteCount": 1,
    "hardware": {
      "primary": { "itemId": "yealink_t54", "qty": 6 },
      "secondary1": { "itemId": null, "qty": 0 },
      "secondary2": { "itemId": null, "qty": 0 },
      "accessory1": { "itemId": null, "qty": 0 },
      "accessory2": { "itemId": null, "qty": 0 }
    }
  },
  "pricing": {
    "lineItems": [
      { "description": "NBN 100/40", "qty": 1, "unitPriceExGst": 120, "lineTotalExGst": 120 },
      { "description": "Cloud landline", "qty": 4, "unitPriceExGst": 35, "lineTotalExGst": 140 },
      { "description": "Yealink T54W - Executive", "qty": 6, "unitPriceExGst": 35, "lineTotalExGst": 210 }
    ],
    "tierMultiplier": 1.2, "subtotalBeforeTierExGst": 470, "subtotalExGst": 564,
    "discount": { "type": "percent", "value": 10 }, "discountAmountExGst": 56.4,
    "subtotalAfterDiscountExGst": 507.6, "gst": 50.76, "totalIncGst": 558.36, "contractTermMonths": 24
  },
  "notes": ""
}
```

A `mode: "send"` call carries the exact same object plus `mergedHtml` and
`emailText` populated with whatever the `generate` call returned (edited by
nobody in between — that's the WYSIWYG guarantee).

## The actual n8n workflow

`n8n/cloud-phone-proposal.workflow.json` — in n8n: **⋯ → Import from File**,
or paste it straight onto the canvas. 20 nodes, two paths off one `If` node
keyed on `mode`:

**Generate path** (`mode: "generate"`) — runs for every deal, standard or
multi-site, there is no separate manual branch anymore:
1. **Build Comparison + Scenario** — decides whether this is a **switch**
   (`currentSetup.hasProvider`) or a **new install**, builds the current-vs-
   recommended row lists TrueTel's real proposals already use (the Colleges
   deal's "Current Operating Model vs Recommended TrueTel Model" table), and
   — for multi-site deals — folds in the site count instead of routing away
   to a human. If switching, it also computes the real monthly saving.
2. **Build AI Prompt → OpenAI - Draft Narrative & Hero Stats → Parse AI
   Response** — the actual AI agent step, via OpenAI's Chat Completions API
   authenticated through **Predefined Credential Type → OpenAi API** (click
   the node, attach your OpenAI credential — no key pasted anywhere). It
   drafts an executive summary, up to 6 key-outcome bullets, and **three hero
   stats chosen for the scenario**: switching favours a direct spend
   comparison or a continuity guarantee (mirrors the real Colleges proposal's
   "100% existing numbers retained"); new installs favour speed-to-live and
   support quality; multi-site favours a site-count/consolidation stat. The
   model only ever rephrases real figures it was given — never invents a
   number. Bad/missing JSON falls back to deterministic bullets so a flaky
   model call never blocks the pipeline.
3. **Merge Template** — the branded HTML proposal follows the same 9-section
   structure as TrueTel's real CloudPhone template, nothing dropped: Executive
   Overview → Current Environment & Proposed Solution → About TrueTel →
   Cloud Phone System Solutions → Hardware Ecosystem (only when handsets are
   in scope) → Technical Scope of Services → Investment Summary → full 17-
   clause Terms & Conditions → Formal Acceptance/signature block. The fixed
   sections (About TrueTel, Cloud Phone System Solutions, Technical Scope,
   Terms & Conditions, Acceptance) are TrueTel's real copy verbatim, not
   AI-invented — only the Executive Overview, the comparison, and the hero
   stats are drafted per deal. Also saved standalone at
   `templates/cloud-phone-proposal.html` for reference/redesign.
   **Build Plain Email Text** builds the plain-text version too — both
   formats are always generated so the rep can toggle views in the preview
   without a second AI call.
4. **Respond - Generated** sends `{ mergedHtml, emailText, narrative,
   isMultiSite, siteCount }` straight back to the portal.

### Hero-stat reliability

Each hero stat is validated independently in "Parse AI Response": a `value`
must be a bare number/currency/percentage/duration (≤8 characters, at most
one space) — if the model returns a phrase where a number belongs (the "Lower
Monthly Cost" bug seen in testing), *that one stat* falls back to a
deterministic value, without discarding the other two the model got right.

### The itemised-vs-summary toggle

`showLineItems` (set on the portal's pricing step) controls whether the
Investment Summary section renders the full per-line table or a single
bottom-line total — some procurement teams want the detail, others just want
the number. Applies to both the branded template and the plain-text email.

**Send path** (`mode: "send"`) — no AI, no template merge, just relays what
was already approved:
1. **Prepare Send → Branded Format?** branches on `outputFormat`. Plain-text
   quote emails (`Gmail - Send Quote Email`) skip PDF generation entirely.
2. **Generate PDF (CustomJS) → Check PDF Result → PDF Generated OK?** — the
   branded path renders the approved `mergedHtml` into a real `.pdf` via
   [CustomJS](https://www.customjs.space) (`POST e.customjs.io/html2pdf`,
   600 free conversions/month, no infrastructure to run). `continueOnFail`
   is deliberately ON: if the call fails or the free quota runs out, "Check
   PDF Result" sets `pdfOk: false` and the workflow falls back gracefully
   instead of breaking the send.
3. **Gmail - Send Branded Proposal (PDF)** — short HTML body + the generated
   PDF as a real attachment, ready for the client to print and sign. Only
   reached when `pdfOk` is true.
4. **Gmail - Send Branded Proposal (Fallback, HTML)** — the full `mergedHtml`
   as the email body instead, exactly like before PDF support existed. Only
   reached when `pdfOk` is false.
5. **Multi-Site — FYI Notify?** — if it was a multi-site deal, an FYI copy
   goes to the rep/BDM (`Gmail - Notify BDM (FYI, Sent)`) *after* the client
   already has their proposal — visibility, not a hand-off. Standard deals
   skip straight past this.
6. **Respond - Sent** acks the portal.

**Three things to fill in after importing:**
- Attach your **Gmail OAuth2 credential** to the four Gmail nodes.
- Attach your **OpenAi credential** to the "OpenAI - Draft Narrative & Hero
  Stats" node (its Authentication field is already set to the right type).
- Create a **Header Auth** credential (n8n → Credentials → New → Header
  Auth) named e.g. "CustomJS API Key" with header name `x-api-key` and your
  CustomJS API key as the value, then attach it to "Generate PDF (CustomJS)"
  (Authentication is already set to "Generic Credential Type → Header
  Auth"). **Never paste the key directly into the node or the workflow
  file** — it would get committed to this public repo. Get a free key at
  [customjs.space](https://www.customjs.space) (no card required, 600
  conversions/month, then $9/mo for 3,000+).

No Notion writes happen anywhere in this workflow.

### Why CustomJS over self-hosting

Gotenberg (self-hosted, Docker) and CloudConvert (25/day free) were the
earlier options considered here. CustomJS's 600/month free tier needs zero
infrastructure and comfortably covers a sales team's proposal volume, so
it's what's actually wired in. If volume ever exceeds the free tier, either
raise the CustomJS plan or swap "Generate PDF (CustomJS)" for a
self-hosted Gotenberg call — same node shape (POST HTML, response format
"File"), so the rest of the graph doesn't change.

## The glass effect — what shipped vs. what's vendored

You asked to prioritize `Miftahul-Islam-Efaz/LIQUID-GLASS` — it's cloned as
reference in `vendor/liquid-glass-source/`, but it's a full standalone WebGL2
*editor app* (state model, undo/redo, UI panel, a Web Worker for its distance
field), not a drop-in component. Wiring its `createRenderer()` engine in
correctly needs canvas sizing, WebGL2 context-loss handling, and worker
message contracts done right — real work that can't be visually verified
without a browser in the loop, and this is a tool reps rely on live in front
of clients.

So: every interactive surface (`.glass-surface` in `app/globals.css`) uses
`backdrop-filter: blur() saturate()` plus a subtle animated sheen and gradient
border — the same aesthetic family, guaranteed to run smoothly on any rep's
phone, with a graceful `@supports` fallback for older WebKit. The true WebGL
renderer is there in `vendor/` if the team wants to invest in wiring one hero
moment to it later (it should stay off the interaction-heavy screens
regardless — it's genuinely GPU-costly per the repo's own README).

## Deploy

Wired to Vercel + this GitHub repo. Push to `main` and it redeploys.
