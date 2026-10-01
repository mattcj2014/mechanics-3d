# Mechanics 3D v5 — publish and manage models from the app

## Install this update once

Extract the app ZIP and upload its contents to the ROOT of your existing GitHub Pages repository, replacing the older app files. Keep `catalog.json` and all existing `projects/` folders. This update ZIP deliberately omits your model library so installing it will not overwrite finished problems.

Wait for deployment, refresh the editor, and look for **Manage Models / Connect GitHub**. You only install this app update manually once. After that, finished problems can be published, edited, hidden, restored, and deleted directly in the app.

## Connect your repository

1. Click **Manage Models / Connect GitHub**.
2. Enter your GitHub owner/username and repository name. Enter the branch used by Settings → Pages (normally `main`). Leave it blank to use the repository's default branch.
3. Create a fine-grained personal access token at https://github.com/settings/personal-access-tokens/new . Choose the repository owner, **Only select repositories**, and this repository. Under Repository permissions set **Contents: Read and write**. Choose an expiration and generate the token.
4. Paste the token into the editor and click **Connect**. Then close the model manager.

The token is cleared from the input after connecting and held only in memory. It is not saved in local storage, JSON, GLBs, ZIPs, QR codes, or the repository. Re-enter it when opening a new session. **Disconnect** clears it. Only non-secret repository details and the public site address are remembered.

Your account and token must be permitted to commit directly to the selected branch. Protected branches may require a different publishing workflow. For an organization-owned repository, token approval may be required.

## Create a new problem

1. **Load GLB** and place Label, Length, or Vector annotations. Adjust dimension units if needed.
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

QR generator and ZIP libraries are bundled. Three.js 0.186.1 loads from jsDelivr. Modern Chrome/Edge is recommended for the editor. The student viewer supports touch and mouse controls.

Automated checks cover QR/link construction, in-app connect/publish/edit/hide/restore/delete, byte-preserving model uploads, concurrent catalog updates, stale edit rejection, protected branch failures, secret clearing, and shared/unrelated-file preservation using a simulated GitHub API and DOM. A live authenticated GitHub deployment and full browser rendering were not tested in this environment.

GitHub references:
https://docs.github.com/en/rest/git/blobs
https://docs.github.com/en/rest/git/trees
https://docs.github.com/en/rest/git/commits
https://docs.github.com/en/rest/git/refs
https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

Bundled qrcode-generator 1.4.4 (MIT) and JSZip 3.10.1 (MIT). License files are in vendor/. Three.js is MIT licensed.
