import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173');
    
    // 等待页面渲染
    await page.waitForSelector('h1');
    
    // 获取标题
    const title = await page.textContent('h1');
    console.log(`Page title found: ${title}`);
    
    // 截图保存以便确认
    const screenshotPath = 'tests/ui/screenshots/initial-load.png';
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved as ${screenshotPath}`);
    
    // 检查棋盘 Canvas 是否存在
    const canvas = await page.$('canvas');
    if (canvas) {
      console.log('Chess board canvas detected.');
    } else {
      console.log('Chess board canvas NOT found!');
    }
    
  } catch (err) {
    console.error('Automation failed:', err);
  } finally {
    await browser.close();
  }
})();
