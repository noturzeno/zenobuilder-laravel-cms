# Zenobuilder DOM contract

Zenobuilder is a **vanilla JS** library that enhances a pre-rendered HTML builder UI. Your host application (Laravel Blade, static HTML, etc.) must provide the markup and server endpoints; this package provides client-side behavior.

## Builder (`zenobuilder.js` + `zenobuilder.css`)

Loads on `DOMContentLoaded` and expects a builder page with the following structure.

### Required root elements

| ID | Purpose |
|----|---------|
| `blocks-list` | `<ul>` (or container) holding block `<li>` items |
| `orders-input` | Hidden input storing block order JSON |
| `reorder-form` | Form wrapping order submit (optional if you only use AJAX) |
| `add-block-modal` | Modal overlay for choosing block types |
| `close-add-block` | Closes add-block modal |
| `modal-add-block-form` | Hidden form with block type/content/width fields |
| `modal-block-type` | Hidden input: block type slug |
| `modal-block-content` | Hidden input: JSON block content |
| `modal-block-width` | Hidden input: width key (`full`, `half`, etc.) |

### Block list items

Each block is an `<li>` with:

- `data-block-id` (persisted) or `data-temp-id` (unsaved)
- `data-block-type` on the row or edit toggle
- `.block-preview` — collapsed preview area
- `.block-edit-form` — edit panel (often `hidden` until opened)
- `.hidden-width-input` — synced width for PATCH requests
- `.header-width` — width `<select>` in the block header

Content is stored in hidden inputs such as:

- `.divider-content-input`, `.spacer-content-input`, `.button-content-input`
- `.richtext-content-input`, `.image-content-input`, `.heading-content-input`
- `.gallery-content-input`, `.code-content-input`, `.map-content-input`
- `.testimonial-content-input`, `.hero-content-input`, `.column-content-input`

### Add block flow

- Buttons with class `open-add-block` open the modal
- Buttons with class `add-block-type` and `data-type` / `data-content` select a block type

### Optional host globals

The library integrates with these when present (no error if missing):

| Global | Purpose |
|--------|---------|
| `window.AutoSaveManager` | Object with `markUnsaved()` — called when blocks change |
| `window.deletedBlockIds` | `Set` of block IDs pending deletion on save |

### Optional elements

| ID / selector | Purpose |
|---------------|---------|
| `save-order-btn` | Triggers order save |
| `edit-nested-block-modal` | Nested column block editor |
| `block-note-modal` | Per-block notes |
| `block-visibility-rules-modal` | Scheduled visibility rules |
| `unlock-all-blocks-btn` | Bulk unlock |

### Layout / column blocks

- `.column-blocks-list` with `data-column-index`
- Block types: `two_column`, `three_column`

### Local storage keys

- `zenobuilder_block_templates` — saved block presets
- `zenobuilder_block_clipboard` — copy/paste between pages
- `blockLocks_<pageId>` — per-page lock state (page ID parsed from URL path `/pages/(\d+)/` by default)

## Preview (`zenopreview.js` + `zenopreview.css`)

After the preview HTML is rendered, call:

```js
initializePreview(
  { customCss: '...' },
  { bodyBgColor: '#f6f5f4', cardBgColor: '#ffffff' }
);
```

Requires:

- `#custom-page-css` or `#custom-template-css` — `<style>` element with custom CSS rules
- `#page-container` — optional card background target

## Tailwind

The builder UI assumes **Tailwind CSS** utility classes (via CDN or your build). Font Awesome icons are used in full integrations but are not required for core drag-and-drop.

## Reference implementation

See the X Bird CMS builder blades:

- `resources/views/admin/cms/pages/builder.blade.php`
- `resources/views/admin/cms/templates/builder.blade.php`
