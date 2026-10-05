# Mechanics 3D v7 — annotation appearance and origin axes

## Install this update once

First test using TEST_HERE (see START_HERE.md). When ready, upload the CONTENTS of UPLOAD_TO_GITHUB to the ROOT of your existing GitHub Pages repository, replacing the older app files. Do not upload the containing folder or the ZIP itself. Keep `catalog.json` and all existing `projects/` folders. The UPLOAD_TO_GITHUB folder deliberately omits your model library so installing it will not overwrite finished problems.

Wait for deployment, refresh the editor, and look for **Manage Models / Connect GitHub**. You only install this app update manually once. After that, finished problems can be published, edited, hidden, restored, and deleted directly in the app.

## Load a SolidWorks STEP AP214 model

1. In SolidWorks, use File → Save As → STEP, then Options → AP214 and enable Export appearances to include body and face colors. A STEP can preserve only the colors actually exported.
2. In the editor, click **Load Model** and select the `.step` or `.stp` file.
3. Wait for browser conversion. A background worker reads and tessellates the CAD geometry, preserves imported body and face colors, and creates a self-contained GLB. Conversion stays in your browser.
4. Add annotations, preview, and publish using the existing workflow. The published file is the converted GLB, so students need no CAD software or STEP converter.
5. **Download GLB** saves the converted colored model if you want a copy.

STEP units are normalized to meters. The dimension multiplier is reset to 1 and the unit to m on STEP import. To show millimeters, set multiplier 1000 and unit mm. STEP import detail defaults to Standard; choose Coarse for faster processing or Fine for smoother curves BEFORE loading. Geometry is tessellated, so dimension picking is based on the displayed surface mesh.

STEP AP214 carries solid body/face colors. CAD appearance textures and finish parameters are not preserved by this importer. Files without exported color data receive a neutral default. Existing GLBs continue to work. Original STEP CAD data is not stored in the published GLB.

The update includes the converter script and 7.3 MiB WASM file under vendor/occt/. Upload that entire folder. Modern Chrome/Edge is recommended. STEP files over 50 MiB should be simplified before browser import.

## Label appearance and origin tools

Select an annotation by clicking its label or its list entry. In Edit selected, change Text size (8–72 pixels), font (sans serif/serif/monospace), Bold, Italic, text color, background color, border color, and label style (Box, Pill, Text only). Changes appear immediately and are saved with the annotation. Labels stay the same screen size when zooming. Text color also changes a force vector; border color changes a dimension line.

Choose Origin X/Y/Z and click a model surface. The marker places an origin label and three arrows. X is red, Y green, and Z blue. In Origin axes, adjust axis length in model units, Flip X/Y/Z independently, and rotate about X/Y/Z in degrees (Euler XYZ order). Reset axis directions restores the original positive model axes. Move to another model point lets you reposition a label or origin with one click. Cancel Placement cancels that move.

An origin is a visual coordinate marker: its clicked point is labeled O (0, 0, 0). Model point displays the original model coordinates of that point. The marker does not transform the model, change length measurements, or calculate coordinates for other points. Axis labels retain their standard colors; the origin label uses your chosen text color. Independent flips can produce a left-handed triad.

Preview Viewer uses the same annotation renderer as the editor. Styles and origins survive Export JSON, Import JSON, direct publication, and publishing packs. Load the model before importing its JSON. Existing annotation JSON is still supported; the student viewer must also be updated for the new origin markers to appear.

## Replacing a model with the same name

Load the replacement file, use the original problem ID, and publish. You do not need to delete it first. The viewer and printed QR keep the same project address. Changed model bytes get a new GLB filename, so cached geometry cannot be mistaken for the replacement. Direct updates remove the prior model file; optional ZIP uploads may leave an unused prior model file. Full deletion removes the current referenced file and allows the same ID to be reused even if unrelated notes remain.

The viewer fetches fresh annotations, and Check live status verifies that the published model is available and matches its content hash. GitHub Pages still needs to deploy each commit. An already-open student tab must be reloaded to see changes.

## Connect your repository

1. Click **Manage Models / Connect GitHub**.
2. Enter your GitHub owner/username and repository name. Enter the branch used by Settings → Pages (normally `main`). Leave it blank to use the repository's default branch.
3. Create a fine-grained personal access token at https://github.com/settings/personal-access-tokens/new . Choose the repository owner, **Only select repositories**, and this repository. Under Repository permissions set **Contents: Read and write**. Choose an expiration and generate the token.
4. Paste the token into the editor and click **Connect**. Then close the model manager.

The token is cleared from the input after connecting and held only in memory. It is not saved in local storage, JSON, GLBs, ZIPs, QR codes, or the repository. Re-enter it when opening a new session. **Disconnect** clears it. Only non-secret repository details and the public site address are remembered.

Your account and token must be permitted to commit directly to the selected branch. Protected branches may require a different publishing workflow. For an organization-owned repository, token approval may be required.

## Create a new problem

1. **Load Model** and place Label, Length, Vector, or Origin annotations. Adjust dimension units if needed.
2. **Preview Viewer** opens a separate student viewer tab; this private preview is only available in your current browser.
3. Enter a title and unique problem ID under **Publish & QR code**. Confirm the **Published site address**, including the repository folder.
4. Click **Publish to GitHub**. The app uploads the GLB, annotations, PNG/SVG QR images, and student catalog in one commit.
5. Wait for GitHub Pages to deploy. Click **Check live status**, then **Open published viewer** or scan the QR to verify the model.
6. Download the QR PNG for your worksheet, or SVG for printing. No extraction or manual problem-file upload is needed.

The app supports direct publishing of GLBs up to 50 MiB. If necessary, optimize larger models or use the optional publishing ZIP workflow.

## Edit a saved problem

1. Open **Manage Models** and connect if needed.
2. Search the library and click **Edit** beside a problem. This loads its saved GLB and annotations directly from the repository.
3. Make changes and click **Update Published Problem**.
4. Keep the same problem ID to preserve the existing viewer URL and printed QR codes.

If someone edited the same problem after you opened it, the update is rejected. Refresh and reopen the latest version before making your changes. Other problems and repository files are preserved. Import JSON and Export JSON remain available for backups.

To replace the geometry, load the new GLB, import the prior annotations if appropriate, and enter the original problem ID. Publishing will ask before replacing that existing problem and keep its original viewer link. Annotation coordinates must match the replacement geometry.

## Hide, restore, or delete a problem

Click **Remove** in Manage Models:

- Leave **Also delete its GLB, annotations, and QR files** unchecked to hide it from the student gallery. Its direct QR link keeps working, and it remains visible in the author library with a **Restore** button.
- Check that option to remove the gallery entry and its model, annotation, and QR files. Printed QR links will stop working after deployment.

Removing files does not erase repository history. Deleted files can be restored through GitHub history. Shared problem folders are protected from destructive removal; unrelated files alongside the model are preserved.

## Student access

- `students.html`: searchable gallery of visible finished problems.
- QR link: opens its student-only `viewer.html` directly.
- Students do not need an editor tab, GitHub account, or token. The creator's computer can be off.

Old viewer links still work. Editing an existing problem preserves its annotation JSON path. Publishing also makes hidden edited problems visible again.

## Optional offline publishing pack

**Generate QR & Link**, **Export JSON**, and **Download Publishing Pack** remain available. Direct GitHub publishing reads the latest repository catalog and merges it automatically. The ZIP workflow instead reads the currently deployed catalog; upload one pack before exporting the next.

## Dependencies and verification

QR generator, ZIP libraries, and occt-import-js 0.0.23 are bundled. Three.js 0.186.1 loads from jsDelivr. Modern Chrome/Edge is recommended for the editor. The student viewer supports touch and mouse controls.

Automated checks cover QR/link construction, in-app connect/publish/edit/hide/restore/delete, byte-preserving model uploads, concurrent catalog updates, stale edit rejection, protected branch failures, secret clearing, and shared/unrelated-file preservation using a simulated GitHub API and DOM. A live authenticated GitHub deployment and full browser rendering were not tested in this environment.

GitHub references:
https://docs.github.com/en/rest/git/blobs
https://docs.github.com/en/rest/git/trees
https://docs.github.com/en/rest/git/commits
https://docs.github.com/en/rest/git/refs
https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

Bundled qrcode-generator 1.4.4 (MIT), JSZip 3.10.1 (MIT), and occt-import-js/OpenCascade (LGPL-2.1; supplied license notices apply). License files are in vendor/. Three.js is MIT licensed.

STEP verification used the actual bundled WASM importer on body/face-colored STEP fixtures and an assembly. Tests confirm RGB material factors survive GLB export/import, and models defined in mm, inches, and meters normalize correctly to meters. Worker conversion was exercised with a Node worker adapter. The supplied SolidWorks STEP was also checked: its seven bodies all contained the same pale-blue color, which survived conversion. Distinct colors absent from an export cannot be recovered by the viewer.

V7 checks exercised the real GLB loader, DOM annotation controls and CSS2D renderer with WebGL rendering stubbed: formatting, origin flips/rotation/length/repositioning, JSON roundtrip, IndexedDB preview, legacy annotations, and label cleanup. A repository simulator verified content-addressed replacement, deletion/recreation with the same name, unrelated note retention, and fresh URL/cache policy. Full visual browser rendering, the Windows launcher, and a live GitHub deployment were not executed here; use the local test checklist before uploading.
