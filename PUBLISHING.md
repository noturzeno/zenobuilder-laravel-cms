# Publishing Zenobuilder to GitHub (and npm)

This folder is a **standalone package** intended to live in its own Git repository.

## 1. Create the GitHub repository

1. On GitHub, create a new repository named `zenobuilder` (empty, no README).
2. Update `package.json` `repository`, `bugs`, and `homepage` URLs with your org/username.
3. Update `CHANGELOG.md` release links.

## 2. Push this package as its own repo

From your machine:

```bash
cd zenobuilder

# Initialize git (only once)
git init
git add .
git commit -m "chore: initial zenobuilder v1.0.0 release"

git remote add origin git@github.com:noturzeno/zenobuilder-laravel-cms.git
git branch -M main
git push -u origin main
```

## 3. Tag a release

```bash
git tag -a v1.0.0 -m "v1.0.0 — initial release"
git push origin v1.0.0
```

On GitHub: **Releases → Draft new release** → choose tag `v1.0.0`, describe changes from `CHANGELOG.md`.

## 4. CDN (jsDelivr, no npm required)

After the repo is public:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/noturzeno/zenobuilder-laravel-cms@1.0.0/dist/zenobuilder.css">
<script src="https://cdn.jsdelivr.net/gh/noturzeno/zenobuilder-laravel-cms@1.0.0/dist/zenobuilder.js"></script>
```

Pin the version (`@1.0.0` for git tag `v1.0.0`). Do not use `@main` in production.

## 5. Publish to npm (optional)

```bash
cd zenobuilder
npm login
npm publish --access public
```

If the name `zenobuilder` is taken, use a scoped name in `package.json`:

```json
"name": "@your-org/zenobuilder"
```

Then publish with `npm publish --access public`.

## 6. Sync built assets into a host app (optional)

```bash
npm run prepare
node scripts/sync-to-app.js /path/to/your-app/public/assets/zenobuilder
```

## 7. CI releases (optional)

`.github/workflows/release.yml` runs on tag push and verifies `dist/` exists. Extend it to run `npm publish` if you use npm.
