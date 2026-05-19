import type { PieceSide, Point } from 'zh-chess'

const CN_NUMS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
function cnNum(n: number): string {
  return CN_NUMS[n] ?? String(n)
}

/**
 * 将走法转换为中文记谱（如 "炮二平五"）
 * 逻辑参考 server/src/utils/penValidator.ts
 */
export function moveToNotation(
  piece: { name: string; x: number; y: number },
  to: Point,
  side: PieceSide
): string {
  const { name: pieceName, x: fromX, y: fromY } = piece

  // BOTH sides use 9 - x to match zh-chess engine expectation
  const fromFile = 9 - fromX

  const dy = to.y - fromY
  const isHorizontal = dy === 0

  // 红方前进：y 减小；黑方前进：y 增大
  const isForward = side === 'RED' ? dy < 0 : dy > 0

  let direction: string
  let dest: string

  if (isHorizontal) {
    direction = '平'
    const toFile = 9 - to.x
    dest = cnNum(toFile)
  } else {
    direction = isForward ? '进' : '退'
    // 直线棋子（车炮兵卒帅将）：用步数
    // 斜线棋子（马相士）：用目标列
    const isLinear = ['车', '炮', '兵', '卒', '帅', '将', '砲', '車', '馬', '象', '仕', '將', '帥'].includes(pieceName)
    if (isLinear) {
      dest = cnNum(Math.abs(dy))
    } else {
      const toFile = 9 - to.x
      dest = cnNum(toFile)
    }
  }

  // 统一简化字名称用于展示
  const displayName = pieceName
    .replace('砲', '炮')
    .replace('車', '车')
    .replace('馬', '马')
    .replace('象', '相')
    .replace('仕', '士')
    .replace('將', '将')
    .replace('帥', '帅')

  return `${displayName}${cnNum(fromFile)}${direction}${dest}`
}
