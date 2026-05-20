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

/**
 * Export a game session as a JSON-based prompt for an LLM coach.
 */
export function exportGameRecordForLlmPrompt(session: GameSession): string {
  const { moveHistory, vsAi, playerSide, winner, status } = session
  const date = new Date(session.createdAt).toISOString().split('T')[0]

  const movesData = moveHistory.map((move, i) => {
    const captured = getCapturedUpTo(moveHistory, i)
    return {
      ply: i + 1,
      side: move.side === 'RED' ? 'red' : 'black',
      actor: vsAi ? (move.side === playerSide ? 'human' : 'ai') : 'human',
      move: move.notation,
      event: formatEvent(move).replace('—', ''),
      red_lost: captured.red.map(p => p.displayName),
      black_lost: captured.black.map(p => p.displayName),
      pen_after: move.penCode
    }
  })

  let result = status === 'finished' ? 'draw' : 'ongoing'
  if (winner) {
    result = winner === 'RED' ? 'red_win' : 'black_win'
  }

  const resultNote = winner 
    ? `系统记录为${winner === 'RED' ? '红' : '黑'}方胜。如果最后一步只是将军但未确认将死，请在总结中谨慎表达为${winner === 'RED' ? '红' : '黑'}方形成决定性攻势。`
    : '游戏状态未产生明显胜负。'

  const gameData = {
    game_id: session.id,
    date: date,
    mode: vsAi ? 'human_vs_ai' : 'human_vs_human',
    human_side: playerSide === 'RED' ? 'red' : 'black',
    ai_side: playerSide === 'RED' ? 'black' : 'red',
    total_plies: moveHistory.length,
    result: result,
    result_note: resultNote,
    moves: movesData
  }

  return `你是一名中国象棋教练。请阅读下面这局${vsAi ? '人机对弈' : '人人对弈'}记录。

你的任务不是点评每一步，而是从整局棋中找出最值得讲解的关键步骤，并返回结构化 JSON。

请重点寻找以下类型的步骤：
1. 疑问手：表面看可以走，但导致子力不协调、节奏变慢、攻守失衡；
2. 失误：导致一方明显丢兵、丢大子、失去主动权，或被迫转入防守；
3. 严重失误：导致车、马、炮等大子损失，或直接引发连续将军、败势；
4. 好棋：抓住对方弱点，吃子、将军、牵制、夺取主动权；
5. 妙手：表面不明显，但通过战术手段吃回大子、化解危机或反击成功；
6. 胜负手：直接导致最终胜负方向明确的关键步骤。

请不要平均点评每一步。正常出子、普通应手、没有明显影响局势的步骤可以跳过。

你需要优先点评：
- 人类玩家${playerSide === 'RED' ? '红' : '黑'}方的关键问题；
- ${vsAi ? `AI ${playerSide === 'RED' ? '黑' : '红'}方抓住${playerSide === 'RED' ? '红' : '黑'}方问题的关键步骤；` : `另一方抓住问题的关键步骤；`}
- 子力损失发生变化的步骤；
- 被将军、连续将军、最终攻势相关的步骤；
- 一方从主动转为被动的步骤；
- 虽然吃到子，但整体局面仍然变差的步骤。

点评要求：
- 面向初中级象棋学习者；
- 每条评语控制在 80 到 150 字；
- 每条评语要说明这步的意图、质量和影响；
- 如果是${playerSide === 'RED' ? '红' : '黑'}方问题，请指出${playerSide === 'RED' ? '红' : '黑'}方为什么吃亏；
- 如果是好棋，请指出抓住了什么机会；
- 如果无法确认最佳着法，可以只说“更稳妥的方向是……”；
- 不要强行编造具体最佳着法；
- 只返回 JSON；
- 不要返回 Markdown；
- 不要在 JSON 外添加任何解释。

下面是对局数据：

${JSON.stringify(gameData, null, 2)}

请根据以上棋局，返回以下 JSON 格式：

{
  "game_id": "${session.id}",
  "review_type": "key_moments",
  "annotations": [
    {
      "ply": 7,
      "side": "red",
      "move": "马三进四",
      "importance": "high",
      "quality": "疑问手",
      "tags": ["开局", "马位过深", "子力不协调"],
      "comment": "这步红马继续向前，表面上显得主动，但开局阶段其他大子尚未展开，马过早深入容易成为黑方攻击目标。更稳妥的方向是先出车或补强中路。"
    }
  ],
  "summary": {
    "overall": "请用 120 到 200 字总结整局棋。",
    "main_problems": ["问题1", "问题2", "问题3"],
    "training_focus": ["训练方向1", "训练方向2", "训练方向3"]
  },
  "coaching_scenarios": [
    {
      "id": "scenario_1",
      "title": "残局攻防训练",
      "description": "针对第 25 手的失误，重新尝试更佳的防御方案。",
      "difficulty": "medium",
      "initial_pen": "...",
      "instruction": "在此局面下，黑方正面临沉底炮的威胁。请思考如何通过运车和补士来化解危机，并尝试反击。",
      "target_ply": 25
    }
  ]
}

字段要求：
- annotations 数量控制在 5 到 8 条；
- ply 必须对应原棋局中的步数；
- move 必须使用原棋局中的着法文字；
- importance 只能使用 low、medium、high、critical；
- quality 只能使用 好棋、妙手、正常、疑问手、失误、严重失误；
- tags 使用中文短标签；
- comment 必须是完整中文句子；
- summary.overall 是整局总结；
- summary.main_problems 写${playerSide === 'RED' ? '红' : '黑'}方本局主要问题；
- summary.training_focus 写${playerSide === 'RED' ? '红' : '黑'}方后续训练方向；
- coaching_scenarios 提取 2 到 3 个具有训练价值的瞬间（如残局、复杂对攻或重大失误处）：
  - initial_pen 必须是合法的 PEN 字符串，通常是 target_ply 前后的局面；
  - instruction 是给学生的指导语，说明训练目标和思路；
  - difficulty 只能使用 easy、medium、hard；
- 只返回 JSON，不要返回 Markdown，不要添加额外解释。`
}

