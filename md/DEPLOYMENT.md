# Deployment

[← Back to the README](../README.md)

Citation Needed is a static site hosted on Cloudflare Workers at **https://citation.party**. It needs no Worker script, database, API keys or runtime environment variables. [`wrangler.jsonc`](../wrangler.jsonc) defines the asset directory and custom domain.

## Automatic deployments

Connect `MaeglynD/citation` through **Cloudflare → Workers & Pages → citation → Settings → Builds** with:

| Setting | Value |
| :--- | :--- |
| Repository | `MaeglynD/citation` |
| Production branch | `main` |
| Root directory | `/` |
| Build command | `npm test && npm run build` |
| Deploy command | `npx wrangler deploy` |
| Build variable | `NODE_VERSION=22` |

Once connected, each push to `main` runs the checks, builds `dist/` and publishes it. A failed check or build stops deployment. Cloudflare manages the Git connection and deployment credentials; no Cloudflare token needs to be added to this repository or its GitHub Actions secrets.

The separate [GitHub CI workflow](../.github/workflows/ci.yml) runs tests and a production build on pull requests and pushes to `main`. It does not publish the site.

## Manual deployment

```sh
npm ci
npx wrangler login
npm run deploy
```

Wrangler opens an authorization page in your normal browser. `npm run deploy` checks the data, builds the site and uploads only `dist/`.

Cloudflare provisions DNS and HTTPS for the custom domain declared in Wrangler. If you fork the project, change the Worker name and domain in `wrangler.jsonc` before deploying to your own account. Update the canonical URL and social metadata in `index.html` too.

## Configuration and local files

- Node.js 22 is recorded in `.nvmrc`; Wrangler is pinned in `package-lock.json`.
- `.wrangler/`, `.dev.vars*`, `.env*`, build output and local test artifacts are ignored.
- `prompts-and-responses/` remains local and is excluded from Git.
- The earlier private Sites configuration in local `.openai/` is ignored and is not part of the Cloudflare deployment.
- Player history is stored in each browser, so deploying a new build on the same domain preserves it. Moving to a different domain starts with that domain's own storage.
