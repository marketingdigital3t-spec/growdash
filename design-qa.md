# Design QA — funil RD

## Source visual truth

- Baseline screenshot supplied by the user: `/var/folders/h9/bngn7l491hl8tzl1w97rfpn80000gn/T/TemporaryItems/NSIRD_screencaptureui_FOfEBK/Captura de Tela 2026-10-16 às 20.59.15.png`
- Source pixels: 1724 × 974.
- The supplied image is the pre-fix visual baseline, not a requirement to preserve the metallic treatment.

## Rendered implementation

- URL: `https://growdash.com.br/analise-de-funis?visual=updated`
- Browser: authenticated Codex in-app browser, desktop viewport, dark theme and light theme checked.
- The implementation was captured in the browser after the Cloudflare deployment `https://3c01d35b.growdash.pages.dev` became active.
- The selected period in the authenticated session currently has no RD negotiations, so the data state differs from the baseline screenshot. The comparison therefore focuses on the funnel component geometry, hierarchy, contrast and responsive shell rather than numeric parity.

## Comparison evidence

- Full view: the funnel now sits inside the existing analysis card without the old metallic black gradient or pointed `clip-path` edges.
- Focused region: each stage is a rounded, descending surface with the count, percentage, stage name and secondary metrics inside the stage. The first stage remained visible in both dark and light captures; the dark screenshot uses white text on the red surface and the light screenshot preserves the same stage colors without inverted text.
- No custom image asset is used by this component; it is a semantic data visualization driven by the existing RD values and design tokens.

## Findings and fixes

- [P1] Metallic gradient and pointed edges made the funnel look like a decorative object instead of an analytics component. Fixed by replacing the fixed black gradient and polygon clip path with rounded token-based stage surfaces.
- [P1] Values and metadata were too small and visually compressed. Fixed with a larger count hierarchy, an explicit percentage pill, readable stage label and wrapped secondary metrics.
- [P2] Stage colors were only visible in the small dot while the body stayed gray. Fixed by applying the existing red → yellow → green stage scale to the stage surface, border and connector.
- [P2] Light/dark contrast depended on hard-coded white text. Fixed by using the existing stage text-color helper and content-surface tokens in both themes.

## Validation

- TypeScript: passed.
- ESLint: passed with no errors.
- Vitest: 94 files / 473 tests passed.
- Vite build: passed; only the existing large-chunk warning remains.
- `git diff --check`: passed.
- Production HTTP: `200`.
- Production and preview asset hashes matched after deployment.
- Dark and light authenticated visual states were inspected in the browser.

## Final result

passed
