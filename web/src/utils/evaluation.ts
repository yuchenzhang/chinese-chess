import { parsePenToBoard } from './penParser'

/**
 * Static Evaluation for Chinese Chess
 * Evaluates the board position from Red's perspective.
 * Positive score means Red is better, negative means Black is better.
 */

const PIECE_VALUES: Record<string, number> = {
  R: 900,  // 车
  N: 400,  // 马
  C: 450,  // 炮
  A: 200,  // 仕
  B: 200,  // 相
  P: 100,  // 兵
  K: 10000 // 帅
}

// Piece-Square Tables (PST) from Red's perspective.
// 10 rows (y=0 is Black's back rank, y=9 is Red's back rank), 9 cols (x=0 to x=8).
// Values indicate the positional bonus for placing a piece at that square.

const PST_P = [
  [  9,  11,  13,  14,  14,  14,  13,  11,   9], // y=0 (Promotion)
  [ 19,  24,  34,  42,  44,  42,  34,  24,  19], // y=1
  [ 19,  24,  32,  37,  37,  37,  32,  24,  19], // y=2
  [ 19,  23,  27,  29,  30,  29,  27,  23,  19], // y=3
  [ 14,  18,  20,  27,  29,  27,  20,  18,  14], // y=4 (River)
  [  7,   0,  13,   0,  16,   0,  13,   0,   7], // y=5 (Own River)
  [  7,   0,   7,   0,  15,   0,   7,   0,   7], // y=6 (Pawn start rank)
  [  0,   0,   0,   0,   0,   0,   0,   0,   0], // y=7
  [  0,   0,   0,   0,   0,   0,   0,   0,   0], // y=8
  [  0,   0,   0,   0,   0,   0,   0,   0,   0]  // y=9
]

const PST_N = [
  [  4,   8,  16,  12,   4,  12,  16,   8,   4],
  [  4,  10,  28,  16,   8,  16,  28,  10,   4],
  [ 12,  14,  16,  20,  18,  20,  16,  14,  12],
  [  8,  24,  18,  24,  20,  24,  18,  24,   8],
  [  6,  16,  14,  18,  16,  18,  14,  16,   6],
  [  4,  12,  16,  14,  12,  14,  16,  12,   4],
  [  2,   6,   8,   6,  10,   6,   8,   6,   2],
  [  4,   2,   8,   8,   4,   8,   8,   2,   4],
  [  0,   2,   4,   4,  -2,   4,   4,   2,   0],
  [  0,  -4,   0,   0,   0,   0,   0,  -4,   0]
]

const PST_C = [
  [  6,   4,   0, -10, -12, -10,   0,   4,   6],
  [  2,   2,   0,  -4, -14,  -4,   0,   2,   2],
  [  2,   2,   0, -10,  -8, -10,   0,   2,   2],
  [  0,   0,  -2,   4,  10,   4,  -2,   0,   0],
  [  0,   0,   0,   2,   8,   2,   0,   0,   0],
  [ -2,   0,   4,   2,   6,   2,   4,   0,  -2],
  [  0,   0,   0,   2,   4,   2,   0,   0,   0],
  [  4,   0,   8,   6,  10,   6,   8,   0,   4], // Cannon start rank
  [  0,   2,   4,   6,   6,   6,   4,   2,   0],
  [  0,   0,   2,   6,   6,   6,   2,   0,   0]
]

const PST_R = [
  [ 14,  14,  12,  18,  16,  18,  12,  14,  14],
  [ 16,  20,  18,  24,  26,  24,  18,  20,  16],
  [ 12,  12,  12,  18,  18,  18,  12,  12,  12],
  [ 12,  18,  16,  22,  22,  22,  16,  18,  12],
  [ 12,  14,  12,  18,  18,  18,  12,  14,  12],
  [ 12,  16,  14,  20,  20,  20,  14,  16,  12],
  [  6,  12,   8,  14,  14,  14,   8,  12,   6],
  [  8,   8,   8,  16,   0,  16,   8,   8,   8],
  [  8,   8,   8,  14,   8,  14,   8,   8,   8],
  [ -2,  10,   6,  14,  12,  14,   6,  10,  -2]  // Rook start rank
]

// Advisors and Elephants have restricted movements, we can assign a simple table or fixed value.
const PST_A = [
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0]
]

// Assign a slight bonus for being in the center of the palace for A and B.
PST_A[8][4] = 10;
PST_A[7][3] = 5; PST_A[7][5] = 5;
PST_A[9][3] = 5; PST_A[9][5] = 5;

const PST_B = [
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0]
]
PST_B[7][4] = 10; // Center elephant

const PST_K = [
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0, 0, 10, 0, 0,0,0], // Top of palace
  [0,0,0, 0,  5, 0, 0,0,0],
  [0,0,0, -5, 0, -5, 0,0,0]
]

function getPST(type: string): number[][] {
  switch(type.toUpperCase()) {
    case 'P': return PST_P;
    case 'N': return PST_N;
    case 'C': return PST_C;
    case 'R': return PST_R;
    case 'A': return PST_A;
    case 'B': return PST_B;
    case 'K': return PST_K;
    default: return PST_P;
  }
}

/**
 * Evaluate a PEN string position.
 * Returns a number: > 0 means RED is better, < 0 means BLACK is better.
 */
export function evaluatePosition(pen: string): number {
  const board = parsePenToBoard(pen);
  let redScore = 0;
  let blackScore = 0;

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const p = board[y][x];
      if (!p) continue;

      const upperP = p.toUpperCase();
      const isRed = p === upperP;
      
      const baseVal = PIECE_VALUES[upperP] || 0;
      const pst = getPST(upperP);
      
      // For Red, y=0 is opponent back rank, y=9 is own back rank.
      // For Black, y=0 is own back rank, y=9 is opponent back rank.
      const pstY = isRed ? y : 9 - y;
      // Board is symmetrical horizontally, but let's just use x normally
      const posVal = pst[pstY][x];

      if (isRed) {
        redScore += baseVal + posVal;
      } else {
        blackScore += baseVal + posVal;
      }
    }
  }

  // Calculate game phases or simple threat scanning could be added here,
  // but Material + PST provides a very robust baseline static evaluation.

  return redScore - blackScore;
}

/**
 * Converts the raw score (-Inf to +Inf) to a percentage (0 to 100) for UI display.
 * 50% means perfectly equal.
 * > 50% means Red is winning.
 * < 50% means Black is winning.
 */
export function scoreToPercentage(score: number): number {
  // A typical piece advantage is ~200-400 points.
  // We use a sigmoid-like function to smoothly map the score.
  // If score is +1000, percentage should be ~90%.
  
  // y = 100 / (1 + e^(-k * x))
  const k = 0.0025; 
  const winProb = 1 / (1 + Math.exp(-k * score));
  return Math.max(0, Math.min(100, winProb * 100));
}
