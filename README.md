# Our wedding — GitHub Pages album

A complete static wedding gallery with 260 photos, chronological half-hour albums,
a full-screen slideshow, and selfie photo search. All scripts, fonts, face models,
and photographs are bundled. No server, API key, build step, or external CDN is needed.

## Deploy to GitHub Pages

1. Unzip `wedding-album-github-pages.zip`.
2. Put the **contents of the wedding-album folder** at the root of your GitHub repository.
   `index.html`, `.nojekyll`, `album.json`, `face-index.json`, `photos/`, `thumbnails/`,
   `models/`, `vendor/`, and `fonts/` must stay together.
3. Commit and push the files with Git or GitHub Desktop. The package contains more
   than 500 files; uploading through the GitHub website is less convenient.
4. In your repository, open **Settings → Pages**.
5. Set **Source** to **Deploy from a branch**, choose **main**, choose **/(root)**,
   and save. Use your actual branch name if it differs.
6. GitHub will show the published URL after deployment. Share that link with guests.

The gallery uses relative URLs and works at both a user domain and a project URL
such as `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`. HTTPS enables the camera.
Do not upload the ZIP itself as the website; upload the extracted contents.

## Preview locally

Run this inside the extracted wedding-album folder:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://localhost:8000/`. Opening `index.html` directly as a file does not work
because browser modules and JSON requests require an HTTP origin.

## How selfie search works

Guests enable the consent checkbox and take or upload a selfie with exactly one
visible face. The self-hosted face-api.js model generates a descriptor locally,
then compares it to the precomputed `face-index.json`. The original selfie and its
descriptor remain in memory on the guest's device. They are never uploaded or
written to browser storage. Clear the search to remove the selfie preview.

The album's face index is a public static file containing face descriptors and
bounding boxes from the published wedding photos. This is necessary for this
serverless matching design. There are no face names or identity labels.

Matches are suggestions, not verified identities. Masks, profiles, small faces,
blur, low light, and differences between selfies and wedding photos can cause
misses or incorrect suggestions. The slider broadens or narrows the match range.
The gallery and slideshow work without using face search.

## Photos

The photos are compressed camera-rendered JPEG previews extracted from the ARW
files, not full-resolution RAW developments. The longest side is 1616 pixels;
thumbnail longest sides are up to 480 pixels. The original ARW files remain intact
on the owner's computer and are not included in this package.

Camera times span 25 November 2023, 18:23–20:06. Capture times are displayed as
recorded, without assuming a timezone. JPEG EXIF metadata, including GPS, is omitted.

## Customize

- Edit the title and text in `index.html`.
- Change the cover photograph by editing the `.cover img` source in `index.html`.
- Change colors and spacing through the variables at the top of `styles.css`.
- Keep `album.json` photo IDs aligned with `face-index.json`; replacing photos
  requires generating a new face index.

## Dependencies and licenses

- face-api.js 0.22.2: MIT, `vendor/face-api-LICENSE`.
- Model weights: the face-api.js 0.22.2 distribution. Model provenance is documented
  by the original project at https://github.com/justadudewhohacks/face-api.js.
- Lora: SIL Open Font License, `fonts/OFL.txt`.
- `dependency-sources.json`: pinned download URLs and SHA-256 checksums.

No analytics or external runtime services are included.

## ภาษาไทยและการใช้งานที่อ่านง่าย

หน้าเว็บใช้ภาษาไทยและวันที่แบบ พ.ศ. ตัวอักษรหลัก 20px ปุ่มหลักสูงอย่างน้อย 56px และเมนูช่วงเวลาขึ้นบรรทัดใหม่ได้ มีคำกำกับปุ่มก่อนหน้า ถัดไป ปิดรูป และบันทึกรูป การค้นหาใบหน้ามีคำแนะนำ 3 ขั้นตอนและปุ่มดูผลค้นหาโดยตรง รูปใบหน้าของผู้ใช้ยังประมวลผลในเครื่องเท่านั้น
