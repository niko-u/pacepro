import { chromium } from 'playwright';

async function takeScreenshots() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  // Landing page - full page
  await page.goto('https://pacepro.vercel.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  // Hero section
  await page.screenshot({ path: 'screenshots/landing-hero.png' });
  console.log('✓ Hero section');
  
  // Wearables section
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/landing-wearables.png' });
  console.log('✓ Wearables section');
  
  // More than plans section
  await page.evaluate(() => window.scrollTo(0, 1400));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/landing-howit-works.png' });
  console.log('✓ How it works section');
  
  // Second screenshot/dashboard preview
  await page.evaluate(() => window.scrollTo(0, 2200));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/landing-dashboard-preview.png' });
  console.log('✓ Dashboard preview section');
  
  // Features section
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/landing-features.png' });
  console.log('✓ Features section');
  
  // Pricing
  await page.evaluate(() => window.scrollTo(0, 4500));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/landing-pricing.png' });
  console.log('✓ Pricing section');
  
  await browser.close();
  console.log('\n📸 All screenshots saved to screenshots/');
}

takeScreenshots().catch(console.error);
