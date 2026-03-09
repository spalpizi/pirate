# Future Data Split (Simple Plan)

This project is currently data-driven for products via `products.json`.
To keep maintenance simple, future content can be separated in this folder:

- `products.json`: product catalog, availability, variants, SEO and sorting.
- `home-content.json` (future): hero text, featured section copy, editorial blocks.
- `events.json` (future): home events currently in `script.js`.

No backend/framework is required for this structure.
All files can be loaded client-side with vanilla JS.
