import { chromium } from 'playwright';

async function verify() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('https://pacepro.vercel.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  
  // Full page
  await page.screenshot({ path: 'screenshots/v2-landing-full.png', fullPage: true });
  console.log('✓ Full page');
  
  // Hero
  await page.screenshot({ path: 'screenshots/v2-hero.png' });
  console.log('✓ Hero');
  
  // Scroll to features
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/v2-feature1.png' });
  console.log('✓ Feature 1');
  
  // Scroll to feature 2
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/v2-feature2.png' });
  console.log('✓ Feature 2');
  
  // Scroll to pricing
  await page.evaluate(() => window.scrollTo(0, 3200));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/v2-pricing.png' });
  console.log('✓ Pricing');
  
  await browser.close();
  console.log('\n📸 Done');
}

verify().catch(console.error);
