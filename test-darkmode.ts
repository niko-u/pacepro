import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  
  // Login
  await page.goto('https://pacepro.vercel.app/login');
  await page.fill('input[type="email"]', 'test-dashboard@pacepro.ai');
  await page.fill('input[type="password"]', 'pacepro123');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(3000);
  
  // Screenshot dashboard
  await page.screenshot({ path: 'screenshots/test-dark.png' });
  console.log('Screenshot saved');
  
  await browser.close();
}

main().catch(console.error);
