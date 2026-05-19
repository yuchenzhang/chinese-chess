import { writeFileSync } from 'node:fs'
import type { Reporter, File, Suite, Test } from 'vitest/reporter'

interface TestResult {
  file: string
  suite: string
  name: string
  status: 'pass' | 'fail' | 'skip'
  duration: number
  error?: string
  description: string
  logs: string[]
}

const TEST_DESCRIPTIONS: Record<string, string> = {
  'loads all providers from config': '验证 llmProviders.json 能正确加载所有 3 个提供商配置',
  'finds provider by id': '验证 getProviderById() 能正确查找 bailian/dashscope/deepseek',
  'each provider has baseUrl and apiKey resolved from env': '验证 .env 中的环境变量被正确解析到配置（不是 $VAR 占位符）',
  'pings bailian': '测试百炼 Coding Plan 连通性，发送 "ping" 消息验证 API 可达',
  'pings dashscope': '测试千问 DashScope 连通性，发送 "ping" 消息验证 API 可达',
  'pings deepseek': '测试 DeepSeek 连通性，发送 "ping" 消息验证 API 可达',
  'pings all providers at once': '批量测试所有提供商的连通性（3 个并行请求）',
  'handles invalid provider gracefully': '验证传入不存在的 providerId 时正确抛出异常',
  'returns ok': '测试 GET /api/health 端点返回健康状态',
  'lists all providers': '测试 GET /api/ai/providers 返回所有可用提供商及其配置状态',
  'pings dashscope via API': '测试 POST /api/ai/ping 通过后端 API 发起连通性检查',
  'returns 400 for missing fields': '测试 POST /api/ai/move 缺少参数时返回 400',
  'returns 400 for unknown provider': '测试 POST /api/ai/move 传入不存在的 provider 时返回 400',
  'returns move from dashscope': '测试 POST /api/ai/move 能成功从 DashScope 获取 AI 着法（炮二平五）',
  'parses positions and finds correct number of legal moves': '验证 PEN 解析器能正确计算各局面的合法着法数量',
  'generates correct Chinese notation': '验证合法着法能正确转换为中文记谱格式（如 炮二平五）',
  'matches LLM moves with normalization (Chinese/Arabic numerals)': '验证着法匹配器能处理全角/半角数字、繁简字变体、阿拉伯数字',
  'LLM returns a legal move: 初始局面 — 红方先行 (with legal moves hint)': '端到端测试：给 LLM 合法着法列表，验证其从初始局面返回的着法在列表中',
  'LLM returns a legal move: 中局 — 黑方走子 (with legal moves hint)': '端到端测试：给 LLM 合法着法列表，验证其从中局返回的着法在列表中',
  'LLM returns a legal move: 残局 — 红方单车对黑将 (with legal moves hint)': '端到端测试：给 LLM 合法着法列表，验证其从残局返回的着法在列表中',
  'LLM returns legal move from initial position (no hints)': '盲测：不给 LLM 合法着法列表，仅通过 PEN 理解返回合法着法',
}

export default function createHtmlReporter(options: { output?: string } = {}): Reporter {
  const outputPath = options.output ?? './test-report.html'
  const results: TestResult[] = []
  let startTime = Date.now()

  function collect(file: File, tasks: (Suite | Test)[]) {
    for (const task of tasks) {
      if (task.type === 'test') {
        const t = task as Test
        results.push({
          file: file.name,
          suite: task.suite?.name ?? '',
          name: task.name,
          status: t.result?.state === 'pass' ? 'pass' : t.result?.state === 'fail' ? 'fail' : 'skip',
          duration: Math.round(t.result?.duration ?? 0),
          error: t.result?.errors?.[0]?.message,
          description: TEST_DESCRIPTIONS[task.name] ?? '',
          logs: (t.logs?.flat() ?? []).map(l => typeof l === 'string' ? l : JSON.stringify(l, null, 2)),
        })
      } else if (task.type === 'suite') {
        collect(file, (task as Suite).tasks)
      }
    }
  }

  return {
    onInit(ctx) { startTime = Date.now(); results.length = 0 },
    onFinished(files, errors) {
      if (!files) return
      for (const f of files) collect(f, f.tasks)

      const total = results.length
      const passed = results.filter(r => r.status === 'pass').length
      const failed = results.filter(r => r.status === 'fail').length
      const skipped = results.filter(r => r.status === 'skip').length
      const runDuration = Date.now() - startTime

      // Suite summary
      const suiteMap: Record<string, { total: number; passed: number; failed: number }> = {}
      for (const r of results) {
        const key = r.suite || r.file
        if (!suiteMap[key]) suiteMap[key] = { total: 0, passed: 0, failed: 0 }
        suiteMap[key].total++
        if (r.status === 'pass') suiteMap[key].passed++
        if (r.status === 'fail') suiteMap[key].failed++
      }

      const summaryItems = Object.entries(suiteMap).map(([name, s]) => `
        <div class="summary-item">
          <span class="summary-name">${name}</span>
          <span class="summary-detail">
            <span class="badge pass">${s.passed} 通过</span>
            ${s.failed > 0 ? `<span class="badge fail">${s.failed} 失败</span>` : ''}
            <span class="badge total">${s.total} 总计</span>
          </span>
        </div>`).join('')

      const rows = results.map(r => {
        const statusIcon = r.status === 'pass'
          ? '<span class="status-pass">✓ 通过</span>'
          : r.status === 'fail'
          ? '<span class="status-fail">✗ 失败</span>'
          : '<span class="status-skip">○ 跳过</span>'
        const hasLogs = r.logs.some(l => l && l !== '[object Object]')
        return `
        <tr class="result-row ${r.status}">
          <td class="cell-suite">${r.suite}</td>
          <td class="cell-name">${r.name}</td>
          <td class="cell-desc">${r.description || '-'}</td>
          <td class="cell-status">${statusIcon}</td>
          <td class="cell-duration">${r.duration > 0 ? r.duration + 'ms' : '-'}</td>
        </tr>${r.error ? `<tr class="error-row"><td colspan="5"><pre class="error-detail">${esc(r.error)}</pre></td></tr>` : ''}${hasLogs ? `<tr class="log-row"><td colspan="5"><pre class="log-detail">${esc(r.logs.filter(l => l && l !== '[object Object]').join('\n'))}</pre></td></tr>` : ''}`
      }).join('')

      const cls = failed === 0 ? 'pass' : 'fail'

      const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>中国象棋后端 — 测试报告</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0f172a;color:#e2e8f0;padding:2rem}
h1{font-size:1.8rem;margin-bottom:.5rem}
.subtitle{color:#94a3b8;font-size:.9rem;margin-bottom:2rem}
.overall{padding:1.5rem;border-radius:12px;margin-bottom:2rem;display:flex;align-items:center;gap:2rem}
.overall.pass{background:#065f46;border:1px solid #10b981}
.overall.fail{background:#7f1d1d;border:1px solid #ef4444}
.overall .icon{font-size:3rem}
.overall .text h2{font-size:1.4rem;margin-bottom:.3rem}
.overall .text p{color:#d1d5db;font-size:.9rem}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem;margin-bottom:2rem}
.stat-card{background:#1e293b;border-radius:10px;padding:1.2rem;text-align:center}
.stat-card .value{font-size:2rem;font-weight:700}
.stat-card .label{font-size:.8rem;color:#94a3b8;margin-top:.3rem}
.stat-card.total .value{color:#60a5fa}.stat-card.passed .value{color:#34d399}
.stat-card.failed .value{color:#f87171}.stat-card.time .value{color:#fbbf24;font-size:1.4rem}
.section{margin-bottom:2rem}
.section h3{font-size:.85rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.8rem}
.summary-grid{display:grid;gap:.5rem}
.summary-item{background:#1e293b;border-radius:8px;padding:.8rem 1rem;display:flex;justify-content:space-between;align-items:center}
.summary-name{font-weight:500}
.badge{display:inline-block;padding:.15rem .5rem;border-radius:4px;font-size:.75rem;margin-left:.5rem}
.badge.pass{background:#065f46;color:#6ee7b7}.badge.fail{background:#7f1d1d;color:#fca5a5}.badge.total{background:#334155;color:#cbd5e1}
table{width:100%;border-collapse:collapse;background:#1e293b;border-radius:10px;overflow:hidden}
th{background:#0f172a;padding:.8rem 1rem;text-align:left;font-size:.8rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em}
td{padding:.7rem 1rem;border-top:1px solid #334155;font-size:.9rem}
.cell-suite{color:#94a3b8;font-size:.8rem}.cell-name{font-weight:500}
.cell-desc{color:#64748b;font-size:.85rem;max-width:400px}
.cell-duration{color:#fbbf24;font-family:monospace;white-space:nowrap}
.result-row.pass td{border-left:3px solid #10b981}
.result-row.fail td{border-left:3px solid #ef4444;background:rgba(239,68,68,.05)}
.result-row.skip td{border-left:3px solid #f59e0b;opacity:.6}
.status-pass{color:#34d399;font-weight:600}.status-fail{color:#f87171;font-weight:600}.status-skip{color:#fbbf24}
.error-row td{padding:0!important}.log-row td{padding:0!important}
.error-detail{background:#1c1917;color:#fca5a5;padding:.8rem 1rem;margin:0;font-size:.85rem;white-space:pre-wrap;word-break:break-word;border-left:3px solid #ef4444}
.log-detail{background:#0c1929;color:#7dd3fc;padding:.8rem 1rem;margin:0;font-size:.8rem;white-space:pre-wrap;word-break:break-word;border-left:3px solid #3b82f6}
.errors-section{background:#7f1d1d;border-radius:10px;padding:1rem;margin-bottom:2rem}
.errors-section h3{color:#fca5a5}
.errors-section pre{background:#450a0a;padding:.8rem;border-radius:6px;margin-top:.5rem;font-size:.85rem;overflow-x:auto;color:#fecaca}
</style></head><body>
<h1>🀄 中国象棋后端 — 测试报告</h1>
<p class="subtitle">运行时间: ${new Date().toISOString()} · 总耗时: ${runDuration}ms</p>
<div class="overall ${cls}">
  <div class="icon">${failed === 0 ? '✅' : '❌'}</div>
  <div class="text"><h2>${failed === 0 ? '全部测试通过' : failed + ' 个测试失败'}</h2>
  <p>${total} 个测试 · ${passed} 通过 · ${failed} 失败 · ${skipped} 跳过</p></div>
</div>
<div class="stats">
  <div class="stat-card total"><div class="value">${total}</div><div class="label">总测试数</div></div>
  <div class="stat-card passed"><div class="value">${passed}</div><div class="label">通过</div></div>
  <div class="stat-card failed"><div class="value">${failed}</div><div class="label">失败</div></div>
  <div class="stat-card time"><div class="value">${runDuration}ms</div><div class="label">运行耗时</div></div>
</div>
<div class="section"><h3>模块汇总</h3><div class="summary-grid">${summaryItems}</div></div>
<div class="section"><h3>测试详情</h3>
<table><thead><tr><th style="width:180px">模块</th><th style="width:220px">测试名称</th><th>测试目的</th><th style="width:90px">状态</th><th style="width:80px">耗时</th></tr></thead>
<tbody>${rows}</tbody></table></div>
${(errors?.length ?? 0) > 0 ? `<div class="section"><div class="errors-section"><h3>⚠️ 测试执行错误</h3>${(errors ?? []).map((e: any) => `<pre>${esc(String(e))}</pre>`).join('')}</div></div>` : ''}
</body></html>`

      writeFileSync(outputPath, html, 'utf-8')
      console.log(`\n📊 测试报告已生成: ${outputPath}`)
    },
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
