# Icons

This directory contains the extension icons in various sizes.
These files are generated programmatically using `tools/generate-icons.js`.

## Sizes
*   16x16: Favicon / Extension pages
*   32x32: Windows / Mac High DPI
*   48x48: Extension Management Page
*   128x128: Chrome Web Store / Installation

## Generation
To regenerate icons (e.g., if you change colors):

```bash
npm install
node tools/generate-icons.js
```
