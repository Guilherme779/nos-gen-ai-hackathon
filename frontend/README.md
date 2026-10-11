# Untrace — CodingBros

Untrace by CodingBros is a React frontend for JunctionX Lisbon 2026. Source attribution: supplied `NOS-XFiles-Website-Final.zip`, specifically `submission/webapp/static/index.html`, `styles.css`, `app.js`, and `result-utils.mjs`. The final palette overrides, ring symbol and source copy are preserved, except that the product branding is Untrace. The active visual direction is black-led monochrome with the site's blue (#4d5dcb) as the only accent; the source lime is not used. No Python code, engine, database, authentication, Cloud integration, API keys, or backend handlers are included. TanStack Start's template hosting shell is retained; application behavior is browser-side only.

## Run locally

```sh
bun install
bun run dev
bun run test
bun run build
```

Equivalent npm scripts work. TypeScript is checked by the editor's automated validation. The app is an editable preview, not a production deployment.

## Backend handoff

Copy `.env.example` to `.env.local` and set **public** `VITE_API_BASE_URL` to the independently hosted API origin, e.g. `https://engine.example.org` (never a key, no `/api` suffix). Vite substitutes this at build time; restart local development after changing environment configuration. When unset, **no same-origin API requests are made**; PDF selection and the comparator work, analysis stays disabled. No fallback/demo analysis exists.

`src/lib/api.ts` is the isolated typed browser client:

- `GET {base}/api/health`, no-store, 6-second timeout. Required fields: `engine_ready:boolean`, `engine_status:string`, `busy:boolean`, `max_file_bytes:positive integer`, `max_pages:positive integer|null`, `timeout_seconds:positive number`.
- `POST {base}/api/anonymize`: **raw File body**, `Content-Type: application/pdf`, `X-File-Name: encodeURIComponent(filename)`, no multipart. Request timeout is engine `timeout_seconds + 20`; outstanding requests abort on unmount. The engine may continue after a client timeout; status is refreshed before retry. Non-2xx responses may return `{error:{message:string}}`.
- Success: `{status:'completed',original_text:string,anonymized_text:string,page_count:number|null,processing_ms:number|null,spans?:Span[]|null,summary:{masked_spans:number|null,substitutions:number|null,categories:string[]|null,categories_complete:boolean},download:{filename:string,encoding:'utf-8',byte_length:number,sha256:string,base64:string}}`.
- Each span contains `original_start,original_end,result_start,result_end` (exclusive end, ordered nonoverlapping Unicode **codepoint** offsets), optional `category` and `word_count`. React renders safe text and `<mark>` nodes; no HTML injection or inferred sensitive fields.
- Null metadata displays **Not provided**, never invented counts. Missing spans render unchanged text without inferred highlights. The client validates UTF-8, byte length, exact text equality, SHA-256 and span boundaries before showing a successful result or download. HTTPS/Web Crypto is required for verification; downloaded bytes are exactly supplied bytes. The output is never normalized or rewritten.
- The engine—not this frontend—must replace each anonymized word and each number with its own `*`, never merging adjacent tokens into one group, remove empty lines, and preserve other formatting and context per the challenge. Masking is not a guarantee of legal anonymity.
- Local validation checks extension, MIME type, empty file, max **10 MiB** (or a lower engine limit), and `%PDF-` header. A header is not full PDF parsing; the backend must enforce valid PDFs, page count and its own limits.

Separate hosting requires deliberate **teammate-owned Python server integration**, not just CORS. The supplied ZIP server's `TrustedHostMiddleware` restricts hosts to localhost, and POST requests independently check their Origin. Teammates must:

- Host the backend at a working HTTPS origin and configure its allowed hosts for the actual backend hostname (including any intended local development hosts).
- Configure explicit allowed frontend origins for the POST-origin check as well as CORS, covering the actual preview/published origin they intend to support. The ZIP also rejects `Sec-Fetch-Site: cross-site`; teammates must deliberately accommodate authorized cross-site frontend requests in that policy rather than assuming CORS alone permits POST. Do not disable host/origin validation or broadly allow every origin.
- Handle OPTIONS preflight and allow GET/POST plus `Content-Type` and `X-File-Name`. The custom filename header and PDF MIME require preflight. Verify both health and raw-PDF POST from the hosted frontend; successful preflight alone does not establish that POST passes the server's origin check.

No server changes are made in this frontend project. No credentials are sent or needed by this contract. Never put private provider keys in `VITE_*`; they belong to teammates' server configuration. Hosted HTTPS, allowed-host/origin configuration, OPTIONS/CORS responses and genuine engine integration remain unverified until a working API origin is supplied.

## Comparison and accessibility

The declaration comparator is a **static fictitious illustration**, independent of selected PDFs and real TXT output. It uses matching DOM layers, a single `*` asterisk per word and per number (one per token, never merged) in the same blue used for the original values on the censored side, immediate clipping and a blue divider. The divider drifts slowly by itself (~10s per sweep between 8% and 92% so it never touches the card edges, pausing 5 seconds after pointer or keyboard interaction; static when reduced motion is preferred) while still supporting direct control. Its native labeled range supports arrows, Home (0) and End (100); mouse/touch pointer capture directly follows the divider. Declaration typography is fixed at each source breakpoint, not interpolated while dragging. It is not a bitmap. All navigation anchors, file picking/drop, line wrapping, views, retry, byte-exact download and a keyboard-trapped clear confirmation are provided. The result panel keeps a permanent download bar at its foot: in every state (empty, processing, failed, completed) the `Download .txt` action is visible, disabled and greyed while no verified result exists, and takes the site blue only once engine bytes have been validated; the caption states that nothing is available yet instead of hiding the control.

## Motion

`framer-motion` is an installed runtime dependency. Root `MotionConfig reducedMotion="user"`, `useReducedMotion`, and CSS `prefers-reduced-motion` honor user preferences. Only transform/opacity animate: one-time hero letter reveal completes in under 0.8 seconds, then returns to the exact source plain-text markup to preserve shaping and line breaks; native buttons use a bounded 0.22-second spring at hover 1.02/tap 0.98. Informational step reveals total 0.6 seconds; comparison/project reveals are 0.3–0.35 seconds. Empty/processing/error transitions use `AnimatePresence` at 0.18 seconds with 8px translation. Successful review is rendered outside that wrapper, with no animated ancestor, entry, exit, scroll reveal or layout/character animation. SSR-safe body portals keep the confirmation and toast outside clipped bands; a static outer wrapper centers the toast independently of its vertical motion. The processing spinner rotates every 0.8 seconds and is static for reduced motion; elapsed seconds are real time, not invented progress. The hero sunburst rotates continuously as a pure CSS transform (18 seconds per full turn, linear, infinite) on a separate inner element, so the one-time entrance animation is untouched; it is also static for reduced motion. Header blur is static and switches with scroll. No animated colors, borders, sizes, layout, clipping, blur, parallax or initial loader. CSS retains static source colors under centralized OKLCH tokens. Hero art and lockups are the actual supplied CSS illustrations rather than external stock imagery.

## Intro video

`src/components/IntroVideo.tsx` plays a muted, decorative 8-second intro once per tab session over the always-mounted site (the site renders underneath from the first render and is never remounted). 0–6s: video only. 6–8s: a feathered transparent hole grows from the centre to every viewport corner while the video plane fades out; progress is `clamp((video.currentTime − 6) / 2, 0, 1)`, sampled from the video's own clock, so it freezes if the media freezes. At 8s (or `ended`) the video pauses and the overlay is removed. "Saltar" (label "Saltar introdução") is focused, visible throughout and fades the overlay out in 0.2s. This intro is an explicit, scoped exception to the site's opacity/transform-only and ≤0.8s motion rules.

- Asset: local `src/assets/untrace-intro-8s.mp4` (first 8s of "Cinemas NOS – Policy Trailer" by Luís R. Teixeira, audio removed). Credited in the footer: "Intro: Luís R. Teixeira · NOS Cinemas". Rights remain with the author.
- Storage: one `sessionStorage` flag, `untrace-intro-vista`, set when playback is first attempted. If storage is unavailable, the intro is skipped.
- Reduced motion: no intro and no playback; switching to reduce mid-intro ends it immediately.
- Failures (media error, rejected/pending `play()`, startup timeout 6s, stall 4s, hard cap 20s, hidden tab) bypass the intro immediately, restoring scroll, `inert` and focus.
- Disable: `<IntroVideo enabled={false}>` in `src/routes/__root.tsx`. Development reset (optional): `sessionStorage.removeItem("untrace-intro-vista")`.

## Tests

Utility tests cover PDF checks, Unicode offsets, malformed annotations, incomplete results, UTF-8/download integrity, raw POST headers, API errors, timeouts and unset API configuration. Routing smoke coverage confirms `/` exists. Browser checks exercise desktop/mobile navigation, comparison endpoints and midpoint, drag/pointer behavior, file selection/replacement/removal, invalid and oversized files, reduced motion and honest missing-backend state. Genuine success is only available from the teammate API; test fixtures never enter the normal app flow.

### Verified delivery checks

- Automated preview build and strict TypeScript validation: **build OK** after resolving strict optional-property and test-selector typing errors.
- Vitest: **30 tests passed**, 4 files. Explicit isolated review fixtures additionally cover processing, failure, deferred-health retry gating, static successful review ancestors, body portals, focus trapping/Escape/backdrop/return focus, view switching, wrapping, download action, the permanent download bar being present but unavailable before a verified result and unavailable again after clearing, and clear confirmation. These are not tests of the teammates' engine.
- Chromium desktop **1280×1800**, mobile **375×812**, plus widths **1440, 1024, 800 and 560**: no horizontal overflow. Screenshots visually inspected for source identity, mobile navigation, comparison text and aligned layers.
- Keyboard range Home/End and arrows: **0/50/100** passed. Mouse drag to 75% and real browser touch-event drag to 80% passed. Both declaration layers have identical measured line positions/dimensions.
- Valid PDF select, replacement, removal, drop selection and multiple-file drop rejection passed. Empty, incorrect extension, incorrect header and >10 MiB errors passed.
- Missing configuration: analysis remained disabled even after selecting a PDF; **zero API requests**, no runtime page errors. Internal anchor navigation and reduced-motion rendering passed.
- Review-fix Chromium checks: headline glyph positions and line breaks exactly match the ZIP at **1280, 1100, 800, 560 and 375px**, including the two-line 1280px headline. After the reveal, no letter spans remain. Pending/clear toasts are centered and fully visible at 375px. Successful fixture text has no transformed, faded or animated ancestor; processing is absent. The body-portaled confirmation covers the viewport above the fixed header; focus trap, Escape, backdrop dismissal and return focus passed. No runtime errors; zero API calls with configuration unset. Browser success uses intercepted isolated fixtures, not the teammate API.
- No real backend connection, provider request, real anonymization result, CORS response, security/accuracy assertion or production deployment was tested or supplied.
