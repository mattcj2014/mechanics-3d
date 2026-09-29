# Mechanics 3D Labeller — GitHub Pages edition

This is a static website. Anyone can open the editor, choose a `.glb` from their computer, add billboard labels, two-point lengths, and vectors, preview the result, and download an annotation JSON. Visitors do not need to install Python or run a local server. The selected GLB remains in that visitor's browser until they choose to publish it elsewhere.

The public `viewer.html` reads a GLB and its annotation JSON from the published site. The included cantilever beam demo is a small sample that works immediately after publishing.

## Publish using only GitHub's website

1. Sign in to GitHub and create a **public** repository named `mechanics-3d`. You can use another repository name if you prefer; that changes the URL below.
2. Extract the ZIP. In the repository, choose **Add file → Upload files**. Drag the **contents** of the extracted `mechanics_3d_pages` folder into the upload area. Make sure `index.html` and `viewer.html` are at the repository root, with `projects/demo/demo.glb` and `projects/demo/demo.annotations.json` beneath them. Commit the upload.
3. Go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**; select `main` and `/(root)`, then **Save**. GitHub will show the published address there after deployment.
4. Open `https://YOUR-USERNAME.github.io/mechanics-3d/` for the public labeller. Click **View Demo** to test the student viewer, or use `https://YOUR-USERNAME.github.io/mechanics-3d/viewer.html`.

GitHub Docs: [configure Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) · [upload files in a browser](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)

## Annotate your own GLB online

1. On the published editor, click **Load GLB** and select your model. This loads it in your browser; it does not upload the file to the site.
2. Choose **Label**, **Length**, or **Vector**. Click the model once for a label, or click two points for a length/vector. Drag to orbit. Select annotations on the left to edit their text.
3. Click **Preview Viewer** to see the model without editor panels. Click **Back to Editor** to continue.
4. Click **Export JSON**. The downloaded file will have a name like `plane.annotations.json`. Keep your `plane.glb` with it. If you need to edit later, load the same GLB and use **Import JSON**.

## Put a finished problem on the public site

Using the GitHub website, upload **both** `plane.glb` and `plane.annotations.json` to the same folder, for example `projects/plane01/`. You can drag a folder into **Add file → Upload files**, or create `projects/plane01/README.md` first and then upload the two files inside that folder. Commit the change.

The public link for that problem is:

`https://YOUR-USERNAME.github.io/mechanics-3d/viewer.html?project=projects/plane01/plane.annotations.json`

Copy that full link into a QR code generator. Each problem gets its own folder and JSON link; `viewer.html` is shared. The JSON's `model` property must exactly match the GLB's filename, including capitalization.

GitHub Pages is static hosting. **Anyone can use the labeller**, but only people with write access to your repository can publish models for everyone to view. A service with user accounts and file storage would be needed if you want arbitrary visitors to upload and publish directly from the website.

## Files

- `index.html`, `editor.js`, `styles.css`: browser-based labeller.
- `viewer.html`, `viewer.js`, `viewer.css`: public 3D viewer.
- `projects/demo/`: example beam GLB and annotations.
- `.nojekyll`: keeps the static files as supplied.

This version loads Three.js from jsDelivr, so visitors need internet access. GitHub's browser upload has a 25 MiB per-file limit; larger GLBs need another upload workflow or optimization. Avoid sensitive content in models or annotations because the published site is public.
