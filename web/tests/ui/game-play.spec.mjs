import { chromium } from 'playwright';

/**
 * 象棋坐标转 Canvas 像素坐标
 * 逻辑参考 ZhChess.ts 中的 setGameWindow 和 getGridPosition
 * w=720, h=720, p=40
 */
function boardToPixel(x, y, playerSide = 'RED') {
  const gridWidth = 72; // (720 - 648 + 72) / 2 ... 经过推导 gridWidth 为 72
  const gridHeight = 64; // 640 / 10 = 64
  const startX = 72;
  const startY = 72;
  
  let targetX = x;
  let targetY = y;
  
  if (playerSide === 'BLACK') {
    targetX = Math.abs(x - 8);
    targetY = Math.abs(y - 9);
  }
  
  return {
    px: targetX * gridWidth + startX,
    py: targetY * gridHeight + startY
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 960 }
  });
  
  // 注入初始状态到 localStorage，避免由于环境导致的配置缺失
  await context.addInitScript(() => {
    const settings = {
      providerId: 'deepseek',
      modelId: 'deepseek-chat',
      updatedAt: Date.now()
    };
    const connections = {
      backendUrl: 'http://127.0.0.1:3001',
      updatedAt: Date.now()
    };
    // 模拟 API Key 已配置的状态
    const keys = {
      deepseek: 'sk-dummy-key',
      updatedAt: Date.now()
    };
    
    localStorage.setItem('chinese-chess:llm-settings:v1', JSON.stringify(settings));
    localStorage.setItem('chinese-chess:llm-connection:v1', JSON.stringify(connections));
    localStorage.setItem('chinese-chess:llm-keys:v1', JSON.stringify(keys));
  });

  const page = await context.newPage();
  
  // 监听浏览器控制台日志
  page.on('console', msg => {
    console.log(`[Browser] ${msg.type()}: ${msg.text()}`);
  });
  
  const screenshot = async (name) => {
    await page.screenshot({ path: `tests/ui/screenshots/gameplay-${name}.png` });
    console.log(`Saved screenshot: tests/ui/screenshots/gameplay-${name}.png`);
  };

  try {
    console.log('1. 加载页面...');
    await page.goto('http://localhost:5173');
    await page.waitForSelector('canvas');
    await screenshot('01-loaded');

    console.log('2. 配置并开始对局 (人机模式, 执红)...');
    const vsAiCheckbox = await page.$('input[type="checkbox"]');
    if (!(await vsAiCheckbox.isChecked())) {
      await vsAiCheckbox.click();
    }
    
    // 定位“对局”卡片中的阵营选择下拉框
    const setupSection = page.locator('section.card:has-text("对局")');
    await setupSection.locator('select').selectOption('RED');
    
    await setupSection.locator('button:has-text("开始对局")').click();
    await page.waitForTimeout(500); // 等待引擎初始化
    await screenshot('02-game-started');

    console.log('3. 执行第一步: 炮二平五 ([1,7] -> [4,7])...');
    const from = boardToPixel(1, 7, 'RED');
    const to = boardToPixel(4, 7, 'RED');
    
    // 点击选择炮
    await page.mouse.click(from.px, from.py);
    await page.waitForTimeout(300);
    // 点击目标位置落子
    await page.mouse.click(to.px, to.py);
    
    console.log('等待用户走子完成...');
    await page.waitForSelector('.move-list li:has-text("1.")');
    await screenshot('03-after-human-move');

    console.log('4. 等待 AI 思考并落子...');
    // 等待 AI 思考遮罩消失，且出现第二步记录
    await page.waitForSelector('.board-blocker', { state: 'hidden', timeout: 30000 });
    await page.waitForSelector('.move-list li:has-text("2.")', { timeout: 10000 });
    
    const moveHistory = await page.textContent('.move-list');
    console.log('当前走子记录:\n', moveHistory);
    await screenshot('04-after-ai-move');

    console.log('5. 执行第二步 (马八进七: [7,9] -> [6,7])...');
    const from2 = boardToPixel(7, 9, 'RED');
    const to2 = boardToPixel(6, 7, 'RED');
    
    await page.mouse.click(from2.px, from2.py);
    await page.waitForTimeout(300);
    await page.mouse.click(to2.px, to2.py);
    
    await page.waitForSelector('.move-list li:has-text("3.")');
    console.log('用户第二步完成。');
    await screenshot('05-second-human-move');

    console.log('测试闭环验证通过！');

  } catch (err) {
    console.error('测试过程中发生错误:', err);
    await screenshot('error-state');
  } finally {
    await browser.close();
  }
})();
