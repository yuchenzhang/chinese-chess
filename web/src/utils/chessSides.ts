import type { PieceSide } from 'zh-chess'

export function oppositeSide(side: PieceSide): PieceSide {
  return side === 'RED' ? 'BLACK' : 'RED'
}

export function getAiSide(playerSide: PieceSide): PieceSide {
  return oppositeSide(playerSide)
}
