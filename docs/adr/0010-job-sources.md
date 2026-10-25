# Job Sources: one package, structured countries

All Job Sources live in one `job-sources` package: one file per source behind a shared interface (search, detail, still-open check), registered in one list. Each Job Source declares the countries it covers, and Job Seekers pick countries and regions from a structured list instead of typing free text. Job Sources never call `fetch` directly: they receive a fetcher from their context, so the network transport (direct, HTTP proxy, scraping service) is chosen per source by config without changing the source. Code ported from other MIT-licensed projects keeps its notices in `THIRD_PARTY_NOTICES.md`.

## Considered Options

- **One package per Job Source**: maximum isolation, but 50-100 packages to configure and keep updated.
- **Runtime plugins folder**: users add sources without a release, but untrusted code runs inside the app.
