# Mechanics 3D — editor, student gallery, and QR generator

## Update your existing GitHub Pages site

Extract this app ZIP and upload its contents to the root of your existing repository. Replace the existing app files; retain your existing projects folders. If you already have a catalog.json, merge its entries with the included demo entry rather than replacing your catalog.

- `index.html` — creator's labeller with publishing tools.
- `students.html` — student gallery, with search and no editor controls.
- `viewer.html?project=projects/PROBLEM_ID/problem.annotations.json` — direct student viewer.

Your existing viewer links using other annotation filenames still work.

## Create a finished problem

1. Open your published site homepage (`index.html`). Load your GLB.
2. Place labels, two-point lengths, and force vectors. Edit the text and measurement settings.
3. Click **Preview Viewer** to open a separate student viewer tab. This preview is stored on your current browser only. It is not a public sharing link.
4. In **Publish & QR code**, enter the problem title and a unique problem ID, such as `beam01`.
5. Check the **Published site address**. It must be your website homepage, such as `https://YOUR-NAME.github.io/mechanics-3d/`, including the repository folder. It is automatically filled and remembered in this browser.
6. Click **Generate QR & Link**. Download the PNG for a problem sheet or SVG for sharp printing.
7. Click **Download Publishing Pack** and extract that ZIP. It contains:
   - `projects/beam01/model.glb`
   - `projects/beam01/problem.annotations.json`
   - `projects/beam01/qr.png` and `qr.svg`
   - `catalog.json` — existing published gallery entries plus this problem
   - `PUBLISH.txt` — exact student URL and upload instructions
8. On GitHub, open the root of the repository. Choose **Add file → Upload files**. Upload the extracted `projects` folder and `catalog.json`. Replace catalog.json and commit. Do not upload the ZIP itself.
9. Wait for the Pages deployment. Use **Open published viewer** to confirm the model loads, then scan the downloaded QR with your phone.

The QR can be generated before upload, but it only works for students after you publish the files. Once published, they can scan and view without an account or editor. You can close your editor tab and computer.

## Several problems and later edits

Use a different problem ID for each new problem. Using the same ID replaces that problem and keeps its printed QR link working. Export JSON is still available for backups. To edit a saved problem, load its model and import its annotation JSON, then use the original problem ID when publishing again.

Each publishing pack merges the CURRENT online catalog. Upload one pack and let it deploy before exporting the next. If multiple authors prepare packs concurrently, merge the catalog entries rather than replacing another author's changes. For existing models, add their title, id, and project JSON path to catalog.json if you want them listed in the student gallery. Direct QR links do not require a gallery entry.

## What GitHub Pages handles

This is a static website. Files chosen in the editor stay in the browser until you download and upload the publishing pack. GitHub Pages cannot accept permanent visitor uploads by itself. Fully automatic publishing from one button would require a storage backend or a GitHub authentication integration; this version does not request account credentials.

Anyone can use the online labeller. Only repository writers can publish to your site. No local server is required once the app is on Pages. QR generation and ZIP packaging run in the browser using bundled libraries. Rendering loads Three.js 0.186.1 from jsDelivr and requires internet.

## First-time Pages setup

Create a public repository, upload the app contents, then choose Settings → Pages → Deploy from a branch → main → /(root) → Save. Check the beam demo through students.html.

GitHub Docs: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Third-party code

Bundled qrcode-generator 1.4.4 (MIT): https://github.com/kazuhikoarase/qrcode-generator
Bundled JSZip (MIT): https://github.com/Stuk/jszip
Three.js (MIT, loaded by CDN): https://github.com/mrdoob/three.js
License headers are retained in the bundled JavaScript.
