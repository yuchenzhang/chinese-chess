import { initBoardPen } from 'zh-chess'
import type { GameSession, MoveRecord, CapturedPieceInfo } from '../types/gameSession'
import { parsePenToBoard } from './penParser'

const PEN_DISPLAY: Record<string, string> = {
  R: '車', N: '馬', B: '相', A: '仕', K: '帅', C: '炮', P: '兵',
  r: '车', n: '马', b: '象', a: '士', k: '将', c: '砲', p: '卒',
}

/**
 * Render a PEN string as a visual text board (9×10 grid).
 */
function renderBoardText(pen: string): string {
  const board = parsePenToBoard(pen)
  const lines: string[] = []

  lines.push('  ９ ８ ７ ６ ５ ４ ３ ２ １')
  lines.push('  ┌─┬─┬─┬─┬─┬─┬─┬─┐')

  for (let y = 0; y < 10; y++) {
    const row = board[y] ?? []
    const cells = row.map(ch => ch ? (PEN_DISPLAY[ch] ?? ch) : '．')
    const rowNum = String(y).padStart(2, ' ')
    lines.push(`${rowNum}│${cells.join('│')}│`)

    if (y === 4) {
      lines.push('  ├─楚─河─────漢─界─┤')
    } else if (y < 9) {
      lines.push('  ├─┼─┼─┼─┼─┼─┼─┼─┤')
    }
  }

  lines.push('  └─┴─┴─┴─┴─┴─┴─┴─┘')
  return lines.join('\n')
}

/**
 * Get cumulative captured pieces up to a given move index (0-based inclusive).
 */
function getCapturedUpTo(moveHistory: MoveRecord[], upToIndex: number): { red: CapturedPieceInfo[]; black: CapturedPieceInfo[] } {
  const red: CapturedPieceInfo[] = []
  const black: CapturedPieceInfo[] = []
  for (let i = 0; i <= upToIndex && i < moveHistory.length; i++) {
    const m = moveHistory[i]
    if (m.captured) {
      if (m.captured.side === 'RED') red.push(m.captured)
      else black.push(m.captured)
    }
  }
  return { red, black }
}

function formatCapturedList(pieces: CapturedPieceInfo[]): string {
  if (pieces.length === 0) return '无'
  const counts = new Map<string, number>()
  for (const p of pieces) {
    counts.set(p.displayName, (counts.get(p.displayName) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([name, count]) => count > 1 ? `${name}×${count}` : name)
    .join('、')
}

function formatEvent(move: MoveRecord): string {
  const events: string[] = []
  if (move.captured) {
    events.push(`吃${move.captured.displayName}`)
  }
  if (move.inCheck) {
    events.push('将军')
  }
  if (move.isNotable && move.notableReason) {
    events.push(`妙手（${move.notableReason}）`)
  }
  return events.length > 0 ? events.join('、') : '—'
}

/**
 * Export a game session as a structured Markdown document designed for LLM coach annotation.
 * The format includes placeholders where an AI coach can fill in commentary for each move.
 */
export function exportGameRecord(session: GameSession): string {
  const { moveHistory, title, vsAi, playerSide, winner, status } = session
  const date = new Date(session.createdAt).toLocaleDateString('zh-CN')

  let md = ''

  // Header
  md += `# 棋局记录 — ${title}\n\n`
  md += `## 对局信息\n\n`
  md += `| 项目 | 内容 |\n`
  md += `|------|------|\n`
  md += `| 日期 | ${date} |\n`
  md += `| 模式 | ${vsAi ? '人机对弈' : '人人对弈'} |\n`
  if (vsAi) {
    md += `| 玩家 | ${playerSide === 'RED' ? '红方' : '黑方'} |\n`
    md += `| AI | ${playerSide === 'RED' ? '黑方' : '红方'} |\n`
  }
  md += `| 总步数 | ${moveHistory.length} |\n`
  md += `| 结果 | ${winner ? `${winner === 'RED' ? '红方' : '黑方'}胜` : (status === 'finished' ? '和棋' : '进行中')} |\n`
  md += `\n`

  // Instructions for LLM coach
  md += `## 教练批注说明\n\n`
  md += `请以中国象棋教练的身份，针对每一步棋给出评语。评语应包括：\n`
  md += `- 这步棋的意图和质量评价（好棋/一般/失误）\n`
  md += `- 如果是失误，建议的更优走法\n`
  md += `- 战术/战略层面的解读\n\n`
  md += `请在每步棋下方的「教练评语」处填写。\n\n`
  md += `---\n\n`

  // Initial position
  md += `## 初始局面\n\n`
  md += '```\n'
  md += renderBoardText(initBoardPen)
  md += '\n```\n\n'
  md += `---\n\n`

  // Each move
  for (let i = 0; i < moveHistory.length; i++) {
    const move = moveHistory[i]
    const moveNum = i + 1
    const sideLabel = move.side === 'RED' ? '红方' : '黑方'
    const captured = getCapturedUpTo(moveHistory, i)

    md += `## 第 ${moveNum} 手 · ${sideLabel}\n\n`
    md += `**着法**: ${move.notation}\n\n`
    md += `**事件**: ${formatEvent(move)}\n\n`
    md += `**红方已损失**: ${formatCapturedList(captured.red)}\n\n`
    md += `**黑方已损失**: ${formatCapturedList(captured.black)}\n\n`

    // Board after this move
    md += `<details>\n<summary>局面图（点击展开）</summary>\n\n`
    md += '```\n'
    md += renderBoardText(move.penCode)
    md += '\n```\n\n'
    md += `PEN: \`${move.penCode}\`\n\n`
    md += `</details>\n\n`

    // Coach commentary placeholder
    md += `> **教练评语**: \n\n`
    md += `---\n\n`
  }

  // Summary
  md += `## 总结\n\n`
  md += `> **总体评价**: \n\n`
  md += `> **关键转折点**: \n\n`
  md += `> **改进建议**: \n\n`

  return md
}
