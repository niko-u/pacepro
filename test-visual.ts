import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  
  // Login first
  await page.goto('https://pacepro.vercel.app/login');
  await page.fill('input[type="email"]', 'test-dashboard@pacepro.ai');
  await page.fill('input[type="password"]', 'pacepro123');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(3000);
  
  // Should be on dashboard now - screenshot dark mode
  await page.screenshot({ path: 'screenshots/dashboard-dark.png' });
  console.log('✓ Dashboard dark mode');
  
  // Toggle to light mode (click sun/moon icon)
  const themeBtn = page.locator('button').filter({ has: page.locator('svg') }).last();
  await themeBtn.click().catch(() => console.log('No theme toggle found'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/dashboard-light.png' });
  console.log('✓ Dashboard light mode');
  
  // Test chat page
  await page.goto('https://pacepro.vercel.app/chat');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/chat-light.png' });
  console.log('✓ Chat light mode');
  
  // Test calendar
  await page.goto('https://pacepro.vercel.app/calendar');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/calendar-light.png' });
  
  // Test month view toggle
  await page.click('button:has-text("Month")').catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/calendar-month.png' });
  console.log('✓ Calendar month view');
  
  await browser.close();
  console.log('\nAll screenshots saved to screenshots/');
}

main().catch(console.error);
