import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  // Test dashboard in dark mode (default)
  await page.goto('https://pacepro.vercel.app/dashboard');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/dashboard-dark.png', fullPage: false });
  
  // Toggle to light mode
  await page.click('button:has-text("☀")').catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/dashboard-light.png', fullPage: false });
  
  await browser.close();
  console.log('Screenshots saved to screenshots/');
}

main().catch(console.error);
