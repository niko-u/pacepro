import { chromium } from 'playwright';

async function testAllPages() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ 
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark'
  });
  const page = await context.newPage();
  
  // Test dashboard dark mode
  await page.goto('https://pacepro.vercel.app/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/test-dashboard-dark.png' });
  console.log('✓ Dashboard dark');
  
  // Test calendar dark mode
  await page.goto('https://pacepro.vercel.app/calendar', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/test-calendar-dark.png' });
  console.log('✓ Calendar dark');
  
  // Test chat dark mode
  await page.goto('https://pacepro.vercel.app/chat', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/test-chat-dark.png' });
  console.log('✓ Chat dark');
  
  // Test analytics dark mode
  await page.goto('https://pacepro.vercel.app/analytics', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/test-analytics-dark.png' });
  console.log('✓ Analytics dark');
  
  // Test settings dark mode
  await page.goto('https://pacepro.vercel.app/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/test-settings-dark.png' });
  console.log('✓ Settings dark');
  
  // Landing page
  await page.goto('https://pacepro.vercel.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/test-landing.png', fullPage: true });
  console.log('✓ Landing page');
  
  await browser.close();
  console.log('\n📸 All test screenshots saved');
}

testAllPages().catch(console.error);
