const puppeteer = require('puppeteer');
const { Jimp, JimpMime } = require('jimp');
const path = require('path');
const fs = require('fs');
const os = require('os');

const IMAGES_DIR = path.join(__dirname, 'public/images');
const THUMB_DIR = path.join(os.tmpdir(), 'portfolio-thumbs');

// All images used in the PDF
const IMAGES = [
  'property-ca.jpg', 'condos-ca.jpg', 'mrloft-ca.jpg',
  'web-agents-property-ca.jpg', 'web-hq-property-ca.jpg', 'web-strata-ca.jpg',
  'sm-listing-harbourfront.jpg', 'sm-agent-recruitment.jpg', 'sm-precon-cove.jpg',
  'sm-editorial-story.jpg', 'sm-features-launch.jpg', 'sm-mortgage-renewals.jpg',
  'sm-market-report.jpg', 'sm-holiday.jpg', 'sm-buyer-search.jpg',
  'email-re-engagement.jpg', 'email-listings-newsletter.jpg', 'email-market-report.jpg',
  'email-agent-bulletin.jpg', 'email-precon-vp.jpg', 'email-listing-alert.jpg',
  'email-agent-personalised.jpg', 'email-recruitment-newsletter.jpg',
  'print-listing-brochure.jpg', 'print-agent-brand-package.jpg', 'print-market-report.jpg',
  'print-direct-mail.jpg', 'print-seller-guide.jpg', 'print-recruitment-brochure.jpg',
  'landing-app-launch.jpg', 'landing-join-brokerage.jpg', 'landing-investor-rental.jpg',
];

async function createThumbs() {
  if (!fs.existsSync(THUMB_DIR)) fs.mkdirSync(THUMB_DIR, { recursive: true });
  for (const img of IMAGES) {
    const src = path.join(IMAGES_DIR, img);
    const dst = path.join(THUMB_DIR, img);
    if (fs.existsSync(src)) {
      try {
        const buf = fs.readFileSync(src);
        const image = await Jimp.fromBuffer(buf);
        // Resize to max 900px wide, keep aspect ratio
        if (image.width > 900) {
          image.resize({ w: 900 });
        }
        // Write as JPEG quality 72
        const outBuf = await image.getBuffer(JimpMime.jpeg, { quality: 72 });
        fs.writeFileSync(dst, outBuf);
        console.log(`  ✓ ${img}`);
      } catch (e) {
        console.warn(`  ✗ Failed: ${img} — ${e.message}`);
      }
    } else {
      console.warn(`  ✗ Missing: ${img}`);
    }
  }
  console.log('Thumbnails ready.\n');
}

(async () => {
  console.log('Creating image thumbnails...');
  await createThumbs();

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--allow-file-access-from-files',
      '--disable-web-security',
    ],
  });
  const page = await browser.newPage();

  // Read HTML and embed images as base64 data URIs
  let html = fs.readFileSync(path.join(__dirname, 'portfolio-print.html'), 'utf8');
  html = html.replace(/src="\.\/public\/images\/([^"]+)"/g, (match, filename) => {
    const thumbPath = path.join(THUMB_DIR, filename);
    const srcPath = path.join(IMAGES_DIR, filename);
    const usePath = fs.existsSync(thumbPath) ? thumbPath : (fs.existsSync(srcPath) ? srcPath : null);
    if (usePath) {
      const data = fs.readFileSync(usePath).toString('base64');
      return `src="data:image/jpeg;base64,${data}"`;
    }
    return match;
  });

  console.log('Rendering HTML...');
  await page.setContent(html, { waitUntil: 'load', timeout: 180000 });

  const outPath = path.join(__dirname, 'Ulyana_Viktyuk_Portfolio.pdf');
  console.log('Generating PDF...');
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });

  await browser.close();

  const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
  console.log(`\n✅ PDF generated: Ulyana_Viktyuk_Portfolio.pdf (${sizeMB} MB)`);
})();
