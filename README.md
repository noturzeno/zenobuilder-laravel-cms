# Zenobuilder

Visual drag-and-drop CMS page builder for the browser. Vanilla JavaScript — no framework required.

Extracted from the [X Bird](https://github.com/YOUR_ORG/vo_xbirds) CMS (`vo_xbirds`) admin page builder.

## Features

- Drag-and-drop block reordering
- Undo/redo history
- Block types: heading, rich text, image, button, video, code, columns, divider, spacer, hero, gallery, map, testimonials, and more
- Block lock, duplicate, notes, visibility rules
- Copy/paste blocks between pages (clipboard in `localStorage`)
- Block templates / presets
- Preview helpers (`zenopreview.js`) for custom CSS and background colors

## Install

### npm

```bash
npm install zenobuilder
```

```html
<link rel="stylesheet" href="node_modules/zenobuilder/dist/zenobuilder.css">
<script src="node_modules/zenobuilder/dist/zenobuilder.js"></script>
```

### jsDelivr (GitHub)

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/YOUR_ORG/zenobuilder@1.0.0/dist/zenobuilder.css">
<script src="https://cdn.jsdelivr.net/gh/YOUR_ORG/zenobuilder@1.0.0/dist/zenobuilder.js"></script>
```

### Copy into a Laravel app

```bash
cd packages/zenobuilder   # or your clone of this repo
npm run prepare
npm run sync:app
```

Assets land in `public/assets/zenobuilder/` (default target for X Bird).

## Quick start

1. Include **Tailwind CSS** (CDN or build).
2. Render the builder HTML with the required DOM IDs — see [docs/DOM-CONTRACT.md](docs/DOM-CONTRACT.md).
3. Load `zenobuilder.css` then `zenobuilder.js`.
4. Implement save/reorder endpoints in your backend (the library updates hidden inputs and order JSON; your app submits forms or AJAX).

### Preview

```html
<link rel="stylesheet" href="dist/zenopreview.css">
<script src="dist/zenopreview.js"></script>
<script>
  initializePreview(
    { customCss: '.hero { color: red; }' },
    { bodyBgColor: '#f6f5f4', cardBgColor: '#ffffff' }
  );
</script>
```

## Standalone demo

Open [examples/minimal-builder.html](examples/minimal-builder.html) in a browser (via a local static server recommended):

```bash
npx serve examples
# open http://localhost:3000/minimal-builder.html
```

## Package layout

```text
zenobuilder/
├── dist/           # Published files (mirrors src in v1)
├── src/            # Source of truth
├── docs/           # DOM contract
├── examples/       # Minimal integration demo
├── scripts/        # prepare-dist, sync-to-app
└── PUBLISHING.md   # GitHub + npm release guide
```

## Host application integration

Zenobuilder does **not** include:

- Server routes or controllers
- Database models
- Full Blade/HTML templates

Your app provides markup matching the [DOM contract](docs/DOM-CONTRACT.md) and optional hooks:

```js
window.AutoSaveManager = { markUnsaved() { /* ... */ } };
window.deletedBlockIds = new Set();
```

Reference: X Bird `resources/views/admin/cms/pages/builder.blade.php`.

## Development

```bash
# Edit files in src/, then refresh dist/
npm run prepare

# Push built assets into vo_xbirds public folder
npm run sync:app
```

## Publishing

See [PUBLISHING.md](PUBLISHING.md) for creating the GitHub repo, tags, npm, and CDN.

## License

MIT — see [LICENSE](LICENSE).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
