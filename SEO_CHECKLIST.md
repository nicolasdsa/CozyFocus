# SEO Checklist

- [x] Add baseline metadata in `index.html` (`description`, `robots`, canonical, Open Graph, Twitter).
- [x] Provide static route entry pages for `/files`, `/calendar`, and `/settings` with crawlable HTML metadata.
- [x] Add structured data (`SoftwareApplication`) in `index.html`.
- [x] Add `noscript` fallback content with crawlable route links.
- [x] Implement route-level metadata updates (`title`, `description`, canonical, OG/Twitter URL).
- [x] Make primary navigation crawlable with semantic links (`<a href>`).
- [x] Add `aria-current="page"` handling on active route.
- [x] Add crawler support files: `public/robots.txt`, `public/sitemap.xml`, `public/llms.txt`.
- [x] Add share preview image: `public/og-cover.svg`.
- [x] Keep app language in English and translate remaining Portuguese UI strings.
- [x] Add unit tests for SEO metadata and crawlable navigation (`tests/seo.metadata.test.ts`).

## Deployment Note

- `robots.txt`, `sitemap.xml`, and `llms.txt` currently use `https://cozyfocus.com` as canonical host.
- If production runs on a different domain, update those URLs before release.
