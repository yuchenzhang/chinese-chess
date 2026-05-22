import { useState, useEffect, useRef } from 'react'
import { Evaluator } from '../utils/engine/evaluator'

interface EngineExplanationPageProps {
  onBack: () => void
}

type PieceType = 'P' | 'R' | 'N' | 'C'
const PIECE_NAMES: Record<PieceType, string> = {
  R: '车 (Rook)',
  N: '马 (Knight)',
  C: '炮 (Cannon)',
  P: '兵/卒 (Pawn)',
}

// Steps for the Minimax + Alpha-Beta Pruning Simulation
interface TreeSimStep {
  text: string
  activeNode: string | null
  evaluatedNodes: string[]
  prunedNodes: string[]
  alpha: string
  beta: string
  nodeValues: Record<string, number | string>
}

const TREE_STEPS: TreeSimStep[] = [
  {
    text: '博弈树搜索启动！红方（极大方）寻找最大得分着法，黑方（极小方）寻找对红方最不利（得分最低）的着法。初始值：α = -∞，β = +∞。',
    activeNode: 'root',
    evaluatedNodes: [],
    prunedNodes: [],
    alpha: '-∞',
    beta: '+∞',
    nodeValues: { root: '?', A: '?', B: '?', A1: 10, A2: 30, B1: -5, B2: 80, B3: 50 },
  },
  {
    text: '第一步：深度优先搜索左子树 A。将 α = -∞，β = +∞ 传递给节点 A。',
    activeNode: 'A',
    evaluatedNodes: ['root'],
    prunedNodes: [],
    alpha: '-∞',
    beta: '+∞',
    nodeValues: { root: '?', A: '?', B: '?', A1: 10, A2: 30, B1: -5, B2: 80, B3: 50 },
  },
  {
    text: '第二步：访问叶子节点 A1。静态评估分数为 +10。',
    activeNode: 'A1',
    evaluatedNodes: ['root', 'A'],
    prunedNodes: [],
    alpha: '-∞',
    beta: '+∞',
    nodeValues: { root: '?', A: '?', B: '?', A1: 10, A2: 30, B1: -5, B2: 80, B3: 50 },
  },
  {
    text: '第三步：A 为极小方节点（黑方选择）。黑方目前在此分支最多允许红方得到 10 分。更新 A 节点值 = 10，同时更新 A 节点的 β 上限 = 10。',
    activeNode: 'A',
    evaluatedNodes: ['root', 'A1'],
    prunedNodes: [],
    alpha: '-∞',
    beta: '10',
    nodeValues: { root: '?', A: 10, B: '?', A1: 10, A2: 30, B1: -5, B2: 80, B3: 50 },
  },
  {
    text: '第四步：访问叶子节点 A2。静态评估分数为 +30。极小方（黑方）在 A 分支更倾向于保留更小的值（10），因此 A 的评估值保持 10。',
    activeNode: 'A2',
    evaluatedNodes: ['root', 'A1', 'A'],
    prunedNodes: [],
    alpha: '-∞',
    beta: '10',
    nodeValues: { root: '?', A: 10, B: '?', A1: 10, A2: 30, B1: -5, B2: 80, B3: 50 },
  },
  {
    text: '第五步：A 子树搜索完成。回溯到根节点（红方，极大方）。红方在左侧分支可以确保拿到 10 分。更新根节点临时值 = 10，更新根节点的下限 α = 10。',
    activeNode: 'root',
    evaluatedNodes: ['A1', 'A2', 'A'],
    prunedNodes: [],
    alpha: '10',
    beta: '+∞',
    nodeValues: { root: 10, A: 10, B: '?', A1: 10, A2: 30, B1: -5, B2: 80, B3: 50 },
  },
  {
    text: '第六步：向右子树 B 递归搜索。将当前的下限 α = 10 和上限 β = +∞ 传递给节点 B。',
    activeNode: 'B',
    evaluatedNodes: ['A1', 'A2', 'A', 'root'],
    prunedNodes: [],
    alpha: '10',
    beta: '+∞',
    nodeValues: { root: 10, A: 10, B: '?', A1: 10, A2: 30, B1: -5, B2: 80, B3: 50 },
  },
  {
    text: '第七步：访问叶子节点 B1。静态评估分数为 -5。',
    activeNode: 'B1',
    evaluatedNodes: ['A1', 'A2', 'A', 'root', 'B'],
    prunedNodes: [],
    alpha: '10',
    beta: '+∞',
    nodeValues: { root: 10, A: 10, B: '?', A1: 10, A2: 30, B1: -5, B2: 80, B3: 50 },
  },
  {
    text: '第八步：B 为极小方节点。更新 B 节点临时值为 -5。更新 B 节点的上限 β = -5。',
    activeNode: 'B',
    evaluatedNodes: ['A1', 'A2', 'A', 'root', 'B1'],
    prunedNodes: [],
    alpha: '10',
    beta: '-5',
    nodeValues: { root: 10, A: 10, B: -5, A1: 10, A2: 30, B1: -5, B2: 80, B3: 50 },
  },
  {
    text: '⚠️ 触发 Alpha-Beta 剪枝条件！此时 B 的 β 值 (-5) 已经小于或等于当前的全局下限 α (10)。这意味着什么？',
    activeNode: 'B',
    evaluatedNodes: ['A1', 'A2', 'A', 'root', 'B1'],
    prunedNodes: [],
    alpha: '10',
    beta: '-5',
    nodeValues: { root: 10, A: 10, B: -5, A1: 10, A2: 30, B1: -5, B2: 80, B3: 50 },
  },
  {
    text: '解释：红方在左边分支已稳拿 10 分，而在右边 B 分支，由于对手的选择权，红方最多只能拿到 -5 分。因此红方绝对不会走向 B 路径。B 分支的其余节点（B2, B3）被立即剪掉！',
    activeNode: 'B',
    evaluatedNodes: ['A1', 'A2', 'A', 'root', 'B1'],
    prunedNodes: ['B2', 'B3'],
    alpha: '10',
    beta: '-5',
    nodeValues: { root: 10, A: 10, B: -5, A1: 10, A2: 30, B1: -5, B2: 'pruned', B3: 'pruned' },
  },
  {
    text: '第九步：搜索完全结束！根节点（红方）采纳左侧最佳着法。最终得分：10 分。由于 Alpha-Beta 剪枝，我们仅计算了 4 个叶子中的 2 个，效率翻倍！',
    activeNode: 'root',
    evaluatedNodes: ['A1', 'A2', 'A', 'B1', 'B'],
    prunedNodes: ['B2', 'B3'],
    alpha: '10',
    beta: '+∞',
    nodeValues: { root: 10, A: 10, B: -5, A1: 10, A2: 30, B1: -5, B2: 'pruned', B3: 'pruned' },
  },
]

export function EngineExplanationPage({ onBack }: EngineExplanationPageProps) {
  // Navigation
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // State for Clipboard Copying
  const [copied, setCopied] = useState(false)
  
  const PROMPT_TEXT = `# 任务：构建中国象棋高阶并行决策引擎后端

你是一个高水平的算法与后端工程专家。请为我使用 [Python FastAPI] (或 Go / Node.js) 构建一个高性能的中国象棋规则推演与搜索算法后端服务。

## 1. 业务意图与系统定位
目前我们有一个纯前端的中国象棋（React + TypeScript + Vite）对弈应用，它自带了 2~4 层的浏览器本地 JS 计算引擎。
当用户选择高难度等级（搜索深度达到 5 层、6 层甚至 7 层）时，浏览器端单线程算力不足，极易引发界面卡顿。因此，我们需要将运算外包给本高性能后端服务器。

你需要构建一个能处理深度 alpha-beta 搜索、并发剪枝，并能流畅接入我们前端界面的 HTTP API 服务。

## 2. API 接口规格定义 (API Specifications)

### 接口 1: 健康检查与引擎就绪状态
* **请求路径**: \`GET /api/health\`
* **接口用意**: 前端一键测试连接、评估引擎健康状况以及协商引擎的最大搜索深度。
* **返回数据结构 (JSON)**:
\`\`\`json
{
  "status": "ok",
  "engine": "high-performance-xiangqi-backend",
  "max_depth_supported": 7,
  "features": ["alpha-beta", "multiprocessing", "transposition-table"]
}
\`\`\`

### 接口 2: 局面最佳走法搜索 (核心决策接口)
* **请求路径**: \`POST /api/move/best\`
* **接口用意**: 接收前端当前棋局的 FEN/PEN 局面字符串和所需的搜索深度参数，调用底层的极大极小算法与剪枝算法，推演出对当前局面最有利的一步走法。
* **请求体数据结构 (JSON)**:
\`\`\`json
{
  "fen": "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w",
  "depth": 6
}
\`\`\`
* **字段说明**:
  - \`fen\`: 中国象棋局面 PEN/FEN 表示法（例如首字母小写表示黑方子力，大写表示红方子力，以 \`/\` 分隔 10 行棋盘；\`w\` 或 \`b\` 代表当前执子方）。
  - \`depth\`: 整型数字（如 5、6、7），指示算法搜索的最大树层级。
* **返回数据结构 (JSON)**:
\`\`\`json
{
  "best_move": "h2e2",
  "evaluation": 150,
  "depth": 6,
  "think_time": 1.45,
  "nodes_searched": 142050
}
\`\`\`
* **字段说明**:
  - \`best_move\`: 引擎计算出的最佳着法，必须使用 UCI 标准坐标格式（例如 \`h2e2\` 表示从炮二平五，首字母表示列 a-i，数字表示行 0-9 从黑方底线向红方底线计算）。
  - \`evaluation\`: 对当前局面的分数评估（以红方视角为基准的分数分值，正数表示红方优势，负数表示黑方优势）。
  - \`depth\`: 实际完成的搜索树深度。
  - \`think_time\`: 决策所消耗的秒数。
  - \`nodes_searched\`: 搜索过程中遍历评估的局面节点总数。

### 接口 3: 纯局势评估 (进度条使用)
* **请求路径**: \`POST /api/evaluate\`
* **接口用意**: 仅对当前局面进行打分，无需返回走法，专供前端实时更新局势进度条使用。
* **请求体数据结构 (JSON)**:
\`\`\`json
{
  "fen": "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w"
}
\`\`\`
* **返回数据结构 (JSON)**:
\`\`\`json
{
  "evaluation": 150
}
\`\`\`
* **字段说明**:
  - \`evaluation\`: 对当前局面的分数评估（以红方视角为基准，正数表示红优，负数表示黑优）。

## 3. 算法实现与性能建议
- **核心搜索**: 请使用带有 **Alpha-Beta 剪枝 (Alpha-Beta Pruning)** 的极大极小搜索树算法。
- **性能硬化**:
  - 中国象棋节点生成呈指数爆炸。在深层搜索（6层以上）时，请使用**置换表 (Transposition Table)** 或 Zobrist 哈希存储已搜索局面，避免重复计算。
  - 建议启用多进程（Multiprocessing）并行评估不同的主分支分支，发挥多核处理器的极限性能。
  - 引入**静态搜索 (Quiescence Search)**，仅在深度耗尽时评估吃子链，规避“水平线效应”。`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(PROMPT_TEXT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // State for Decision Tree Simulator
  const [treeStep, setTreeStep] = useState(0)
  const [isTreePlaying, setIsTreePlaying] = useState(false)
  const treePlayTimerRef = useRef<any | null>(null)

  useEffect(() => {
    if (isTreePlaying) {
      treePlayTimerRef.current = setInterval(() => {
        setTreeStep((prev) => {
          if (prev >= TREE_STEPS.length - 1) {
            setIsTreePlaying(false)
            return prev
          }
          return prev + 1
        })
      }, 3500)
    } else {
      if (treePlayTimerRef.current) {
        clearInterval(treePlayTimerRef.current)
      }
    }
    return () => {
      if (treePlayTimerRef.current) {
        clearInterval(treePlayTimerRef.current)
      }
    }
  }, [isTreePlaying])

  const stepForward = () => {
    setIsTreePlaying(false)
    if (treeStep < TREE_STEPS.length - 1) {
      setTreeStep(treeStep + 1)
    }
  }

  const stepBackward = () => {
    setIsTreePlaying(false)
    if (treeStep > 0) {
      setTreeStep(treeStep - 1)
    }
  }

  const restartTreeSim = () => {
    setIsTreePlaying(false)
    setTreeStep(0)
  }

  // State for Positional Heatmap
  const [selectedPiece, setSelectedPiece] = useState<PieceType>('P')
  const [isRedPerspective, setIsRedPerspective] = useState(true)
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number; val: number } | null>(null)

  // Retrieve position matrix dynamically from evaluator.ts
  const getMatrix = (piece: PieceType) => {
    switch (piece) {
      case 'P':
        return Evaluator.PAWN_POSITION
      case 'R':
        return Evaluator.ROOK_POSITION
      case 'N':
        return Evaluator.KNIGHT_POSITION
      case 'C':
        return Evaluator.CANNON_POSITION
    }
  }

  const currentMatrix = getMatrix(selectedPiece)

  // State for Quiescence Search Demo
  const [qSearchStep, setQSearchStep] = useState(0)

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            棋
          </span>
          <div>
            <h1>智能引擎决策机制</h1>
            <p className="tagline">解密中国象棋 AI 是如何思考和决策的</p>
          </div>
        </div>
        <button type="button" className="btn btn-sm" onClick={onBack}>
          返回对弈
        </button>
      </header>

      <main className="layout-single">
        
        {/* Intro Card */}
        <section className="card" style={{ background: 'linear-gradient(135deg, var(--surface) 0%, rgba(37,32,25,0.7) 100%)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '3rem', color: 'var(--accent)', background: 'var(--accent-soft)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
              🧠
            </div>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <h2 style={{ margin: '0 0 8px', fontSize: '1.5rem', color: 'var(--accent)' }}>象棋 AI 思考原理概述</h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.98rem' }}>
                象棋引擎并不是凭空“直觉”下子，而是通过经典的<strong>博弈树搜索 (Game Tree Search)</strong> 算法。
                在限定时间内（5.0秒），引擎会在后台构建出数十万个未来的棋局变化，给每个变化打分，并挑选最有利于己方的行棋路线。
                下面，我们将通过三大互动模块，为您直观解析这套兼顾严密逻辑与计算极限的科学算法。
              </p>
            </div>
          </div>
        </section>

        {/* Section 1: Minimax & Alpha-Beta Pruning */}
        <section className="card" style={{ border: '1px solid var(--border)' }}>
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>模块一</span>
            <h2 style={{ margin: '4px 0 0', fontSize: '1.6rem' }}>极大极小搜索 & Alpha-Beta 剪枝模拟</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              利用深度优先的机制遍历未来所有可能的下子局面，并通过剪枝技术舍弃无关的分支，使运算速度提升数倍。
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'stretch' }}>
            {/* Simulation Tree Graph (Centered) */}
            <div style={{ width: '100%', maxWidth: '640px', margin: '0 auto', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid var(--border)', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              
              {/* Alpha Beta Header Badge */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', zIndex: 10 }}>
                <span style={{ fontSize: '0.9rem', padding: '4px 12px', borderRadius: '20px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171', fontWeight: 'bold' }}>
                  α (全局下限): {TREE_STEPS[treeStep].alpha}
                </span>
                <span style={{ fontSize: '0.9rem', padding: '4px 12px', borderRadius: '20px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid #3b82f6', color: '#60a5fa', fontWeight: 'bold' }}>
                  β (全局上限): {TREE_STEPS[treeStep].beta}
                </span>
              </div>

              {/* Node Layout Area */}
              <div style={{ width: '100%', maxWidth: '500px', height: '260px', position: 'relative' }}>
                
                {/* SVG Connections */}
                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
                  {/* Root to A */}
                  <line x1="50%" y1="25" x2="25%" y2="105" stroke={TREE_STEPS[treeStep].evaluatedNodes.includes('A') || TREE_STEPS[treeStep].activeNode === 'A' ? 'var(--accent)' : 'var(--border)'} strokeWidth="2.5" />
                  {/* Root to B */}
                  <line x1="50%" y1="25" x2="75%" y2="105" stroke={TREE_STEPS[treeStep].evaluatedNodes.includes('B') || TREE_STEPS[treeStep].activeNode === 'B' ? 'var(--accent)' : 'var(--border)'} strokeWidth="2.5" />
                  
                  {/* A to A1 */}
                  <line x1="25%" y1="105" x2="12.5%" y2="185" stroke={TREE_STEPS[treeStep].evaluatedNodes.includes('A1') || TREE_STEPS[treeStep].activeNode === 'A1' ? 'var(--accent)' : 'var(--border)'} strokeWidth="2" />
                  {/* A to A2 */}
                  <line x1="25%" y1="105" x2="37.5%" y2="185" stroke={TREE_STEPS[treeStep].evaluatedNodes.includes('A2') || TREE_STEPS[treeStep].activeNode === 'A2' ? 'var(--accent)' : 'var(--border)'} strokeWidth="2" />
                  
                  {/* B to B1 */}
                  <line x1="75%" y1="105" x2="62.5%" y2="185" stroke={TREE_STEPS[treeStep].evaluatedNodes.includes('B1') || TREE_STEPS[treeStep].activeNode === 'B1' ? 'var(--accent)' : 'var(--border)'} strokeWidth="2" />
                  {/* B to B2 */}
                  <line x1="75%" y1="105" x2="75%" y2="185" stroke={TREE_STEPS[treeStep].prunedNodes.includes('B2') ? '#ef4444' : (TREE_STEPS[treeStep].evaluatedNodes.includes('B2') || TREE_STEPS[treeStep].activeNode === 'B2' ? 'var(--accent)' : 'var(--border)')} strokeWidth="2" strokeDasharray={TREE_STEPS[treeStep].prunedNodes.includes('B2') ? '4' : 'none'} />
                  {/* B to B3 */}
                  <line x1="75%" y1="105" x2="87.5%" y2="185" stroke={TREE_STEPS[treeStep].prunedNodes.includes('B3') ? '#ef4444' : (TREE_STEPS[treeStep].evaluatedNodes.includes('B3') || TREE_STEPS[treeStep].activeNode === 'B3' ? 'var(--accent)' : 'var(--border)')} strokeWidth="2" strokeDasharray={TREE_STEPS[treeStep].prunedNodes.includes('B3') ? '4' : 'none'} />
                </svg>

                {/* Root Layer (Red Side - MAX) */}
                <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 5 }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%', border: '2.5px solid #b91c1c', background: TREE_STEPS[treeStep].activeNode === 'root' ? '#b91c1c' : '#fff8e8',
                    color: TREE_STEPS[treeStep].activeNode === 'root' ? '#fff' : '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem',
                    boxShadow: TREE_STEPS[treeStep].activeNode === 'root' ? '0 0 16px #b91c1c' : 'none', transition: 'all 0.3s ease'
                  }}>
                    帅
                  </div>
                  <span style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--text-muted)', fontWeight: 'bold' }}>MAX: {TREE_STEPS[treeStep].nodeValues.root}</span>
                </div>

                {/* Layer 1 (Black Side - MIN) */}
                {/* Node A */}
                <div style={{ position: 'absolute', top: '90px', left: '25%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 5 }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%', border: '2.5px solid #1c1917', background: TREE_STEPS[treeStep].activeNode === 'A' ? '#1c1917' : '#f5ecd8',
                    color: TREE_STEPS[treeStep].activeNode === 'A' ? '#fff' : '#1c1917', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem',
                    boxShadow: TREE_STEPS[treeStep].activeNode === 'A' ? '0 0 16px #1c1917' : 'none', transition: 'all 0.3s ease'
                  }}>
                    将A
                  </div>
                  <span style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--text-muted)' }}>MIN: {TREE_STEPS[treeStep].nodeValues.A}</span>
                </div>

                {/* Node B */}
                <div style={{ position: 'absolute', top: '90px', left: '75%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 5 }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%', border: '2.5px solid #1c1917', background: TREE_STEPS[treeStep].activeNode === 'B' ? '#1c1917' : '#f5ecd8',
                    color: TREE_STEPS[treeStep].activeNode === 'B' ? '#fff' : '#1c1917', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem',
                    boxShadow: TREE_STEPS[treeStep].activeNode === 'B' ? '0 0 16px #1c1917' : 'none', transition: 'all 0.3s ease'
                  }}>
                    将B
                  </div>
                  <span style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--text-muted)' }}>MIN: {TREE_STEPS[treeStep].nodeValues.B}</span>
                </div>

                {/* Layer 2 (Leaf Nodes - Static Evaluation) */}
                {/* A1 */}
                <div style={{ position: 'absolute', top: '170px', left: '12.5%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 5 }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--border)', background: TREE_STEPS[treeStep].activeNode === 'A1' ? 'var(--accent)' : 'var(--surface)',
                    color: TREE_STEPS[treeStep].activeNode === 'A1' ? '#000' : 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold',
                    transition: 'all 0.3s ease'
                  }}>
                    {TREE_STEPS[treeStep].nodeValues.A1}
                  </div>
                  <span style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--text-muted)' }}>着法1</span>
                </div>

                {/* A2 */}
                <div style={{ position: 'absolute', top: '170px', left: '37.5%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 5 }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--border)', background: TREE_STEPS[treeStep].activeNode === 'A2' ? 'var(--accent)' : 'var(--surface)',
                    color: TREE_STEPS[treeStep].activeNode === 'A2' ? '#000' : 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold',
                    transition: 'all 0.3s ease'
                  }}>
                    {TREE_STEPS[treeStep].nodeValues.A2}
                  </div>
                  <span style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--text-muted)' }}>着法2</span>
                </div>

                {/* B1 */}
                <div style={{ position: 'absolute', top: '170px', left: '62.5%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 5 }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--border)', background: TREE_STEPS[treeStep].activeNode === 'B1' ? 'var(--accent)' : 'var(--surface)',
                    color: TREE_STEPS[treeStep].activeNode === 'B1' ? '#000' : 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold',
                    transition: 'all 0.3s ease'
                  }}>
                    {TREE_STEPS[treeStep].nodeValues.B1}
                  </div>
                  <span style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--text-muted)' }}>着法3</span>
                </div>

                {/* B2 (Pruned) */}
                <div style={{ position: 'absolute', top: '170px', left: '75%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 5, opacity: TREE_STEPS[treeStep].prunedNodes.includes('B2') ? 0.3 : 1 }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', border: TREE_STEPS[treeStep].prunedNodes.includes('B2') ? '2px dashed #ef4444' : '2px solid var(--border)', background: 'var(--surface)',
                    color: TREE_STEPS[treeStep].prunedNodes.includes('B2') ? '#ef4444' : 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold',
                    transition: 'all 0.3s ease'
                  }}>
                    {TREE_STEPS[treeStep].nodeValues.B2 === 'pruned' ? '✕' : TREE_STEPS[treeStep].nodeValues.B2}
                  </div>
                  <span style={{ fontSize: '0.75rem', marginTop: '4px', color: TREE_STEPS[treeStep].prunedNodes.includes('B2') ? '#ef4444' : 'var(--text-muted)', textDecoration: TREE_STEPS[treeStep].prunedNodes.includes('B2') ? 'line-through' : 'none' }}>着法4</span>
                </div>

                {/* B3 (Pruned) */}
                <div style={{ position: 'absolute', top: '170px', left: '87.5%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 5, opacity: TREE_STEPS[treeStep].prunedNodes.includes('B3') ? 0.3 : 1 }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', border: TREE_STEPS[treeStep].prunedNodes.includes('B3') ? '2px dashed #ef4444' : '2px solid var(--border)', background: 'var(--surface)',
                    color: TREE_STEPS[treeStep].prunedNodes.includes('B3') ? '#ef4444' : 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold',
                    transition: 'all 0.3s ease'
                  }}>
                    {TREE_STEPS[treeStep].nodeValues.B3 === 'pruned' ? '✕' : TREE_STEPS[treeStep].nodeValues.B3}
                  </div>
                  <span style={{ fontSize: '0.75rem', marginTop: '4px', color: TREE_STEPS[treeStep].prunedNodes.includes('B3') ? '#ef4444' : 'var(--text-muted)', textDecoration: TREE_STEPS[treeStep].prunedNodes.includes('B3') ? 'line-through' : 'none' }}>着法5</span>
                </div>

              </div>

              {/* Step counter */}
              <div style={{ position: 'absolute', right: '12px', bottom: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                步骤：{treeStep + 1} / {TREE_STEPS.length}
              </div>
            </div>

            {/* Controls and Narrative (Stacked below) */}
            <div style={{ width: '100%', maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 10px', fontSize: '1.2rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🎬</span> 动画解析与说明
                </h3>
                
                {/* Highlight text area */}
                <div style={{
                  background: 'var(--accent-soft)', borderLeft: '3px solid var(--accent)', padding: '16px', borderRadius: '0 8px 8px 0', minHeight: '60px',
                  display: 'flex', alignItems: 'center', fontSize: '0.98rem', lineHeight: '1.6', color: 'var(--text)'
                }}>
                  {TREE_STEPS[treeStep].text}
                </div>
              </div>

              {/* Control Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                <button type="button" className="btn" style={{ flex: 1, minWidth: '80px', maxWidth: '120px' }} onClick={stepBackward} disabled={treeStep === 0}>
                  上一步
                </button>
                <button type="button" className={`btn ${isTreePlaying ? 'primary' : ''}`} style={{ flex: 1.5, minWidth: '120px', maxWidth: '160px' }} onClick={() => setIsTreePlaying(!isTreePlaying)}>
                  {isTreePlaying ? '⏸️ 暂停演示' : '▶️ 播放动画'}
                </button>
                <button type="button" className="btn" style={{ flex: 1, minWidth: '80px', maxWidth: '120px' }} onClick={stepForward} disabled={treeStep === TREE_STEPS.length - 1}>
                  下一步
                </button>
                <button type="button" className="btn" style={{ padding: '8px 12px' }} onClick={restartTreeSim} title="重新开始">
                  🔄
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Positional Evaluation Heatmap */}
        <section className="card" style={{ border: '1px solid var(--border)' }}>
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>模块二</span>
            <h2 style={{ margin: '4px 0 0', fontSize: '1.6rem' }}>棋子位置权重可视化 (Evaluation Heatmap)</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              引擎如何给局面打分？除了评估残存棋子本身的“基础物质价值”外，还会根据“位置矩阵”对占领关键要道的棋子进行额外加分。
            </p>
          </div>

          {/* Configuration toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(Object.keys(PIECE_NAMES) as PieceType[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`btn ${selectedPiece === p ? 'primary' : ''}`}
                  style={{ padding: '6px 16px', borderRadius: '16px', fontSize: '0.9rem' }}
                  onClick={() => setSelectedPiece(p)}
                >
                  {PIECE_NAMES[p].split(' ')[0]}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', padding: '6px 16px', borderRadius: '16px' }}
              onClick={() => setIsRedPerspective(!isRedPerspective)}
            >
              🔄 视角切换: {isRedPerspective ? '红方视角' : '黑方视角'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'stretch' }}>
            {/* Heatmap Grid (Centered) */}
            <div style={{ width: '100%', maxWidth: '420px', margin: '0 auto', display: 'flex', justifyContent: 'center', background: '#e8c890', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', position: 'relative' }}>
              
              {/* Heatmap Board */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '2px', width: '100%', maxWidth: '380px', aspectRatio: '9/10',
                background: '#44403c', padding: '2px', borderRadius: '4px', position: 'relative', overflow: 'hidden'
              }}>
                
                {/* Render Grid cells */}
                {Array.from({ length: 10 }).map((_, rIdx) => {
                  // If black perspective, row indices are inverted internally for displaying matrix
                  // (matrix is stored from red perspective, where row 0 is far black rank, row 9 is red base rank)
                  const displayRow = isRedPerspective ? rIdx : 9 - rIdx
                  
                  return Array.from({ length: 9 }).map((_, cIdx) => {
                    // For evaluator matrix: row 0 in red pawn/rook matrix refers to red's own backline?
                    // Let's check:
                    // static PAWN_POSITION matrix starts with rows of 0,0,0,0,0, then [10, 10, 20...], then [50, 50, 60...].
                    // So row index 0 is RED's own base line (cannot move backward, pawns start here).
                    // In evaluator.ts: row 0 to 4 are own half. Row 5 to 9 are opponent's half (pawn gets 10-50 bonus).
                    // When isRed is true, we lookup getPositionValue(row, col).
                    // When isRed is false (black piece), row = 9 - row, then look up.
                    // Let's display the matrix values clearly!
                    const val = currentMatrix[displayRow]?.[cIdx] ?? 0
                    
                    // Color intensity calculation
                    const maxVal = selectedPiece === 'P' ? 80 : (selectedPiece === 'R' ? 25 : 25)
                    const intensity = val > 0 ? Math.min(val / maxVal, 1.0) : 0
                    const cellBg = val > 0 
                      ? `rgba(245, 158, 11, ${0.15 + intensity * 0.7})` 
                      : 'rgba(255, 255, 255, 0.65)'
                    
                    return (
                      <div
                        key={`${displayRow}-${cIdx}`}
                        style={{
                          background: cellBg, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.8rem', fontWeight: 'bold', color: val > 0 ? '#541c00' : '#44403c', cursor: 'pointer',
                          transition: 'all 0.2s ease', border: hoveredCell?.row === displayRow && hoveredCell?.col === cIdx ? '2px solid #b91c1c' : 'none',
                        }}
                        onMouseEnter={() => setHoveredCell({ row: displayRow, col: cIdx, val })}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        {val || ''}
                      </div>
                    )
                  })
                })}

                {/* River overlay across column indices in the middle (between row index 4 and 5) */}
                <div style={{
                  position: 'absolute', top: '50%', left: 0, right: 0, height: '4px', background: '#b91c1c', opacity: 0.35, pointerEvents: 'none'
                }} />
              </div>
            </div>

            {/* Explanation details (Stacked below) */}
            <div style={{ width: '100%', maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📊</span> 权重解析：{PIECE_NAMES[selectedPiece]}
                </h3>

                {/* Live Tooltip / Card Info */}
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px', borderRadius: '8px',
                  minHeight: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'center', marginBottom: '20px'
                }}>
                  {hoveredCell ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>当前格坐标：</span>
                        <strong style={{ color: 'var(--accent)' }}>第 {hoveredCell.row + 1} 行，第 {hoveredCell.col + 1} 列</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>引擎位置额外奖励值：</span>
                        <strong style={{ fontSize: '1.2rem', color: hoveredCell.val > 0 ? 'var(--accent)' : 'var(--text)' }}>
                          +{hoveredCell.val} 分
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      💡 鼠标悬停在棋盘单元格上，查看具体格子的分值与权重规则
                    </div>
                  )}
                </div>

                <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  {selectedPiece === 'P' && (
                    <p>
                      <strong>兵/卒规则：</strong> 在己方河界内（前5行）没有任何位置加分（分值为 0）。
                      一旦越过河界，分值开始阶梯上升（从 +10 到 +50），而一旦逼近对方大营九宫格（底线中路），分值最高可达 <strong>+80</strong>。
                      这引导着兵卒勇往直前！
                    </p>
                  )}
                  {selectedPiece === 'R' && (
                    <p>
                      <strong>车规则：</strong> 作为最强战力，车在整个棋盘上都非常活跃（均有 +10 保底）。
                      在中路核心直道和肋道（第 4、5、6 列，索引为 3, 4, 5）更具威慑力，可获得 <strong>+15 至 +25</strong> 的高额权重，促使引擎霸占核心肋道和直道。
                    </p>
                  )}
                  {selectedPiece === 'N' && (
                    <p>
                      <strong>马规则：</strong> 马是跳跃性棋子，中场控制力强。在中路河界交汇处（中心格）其控制范围最大，获得 <strong>+25</strong> 的最高加分。
                      但在死角（底线侧翼、角落）由于容易被蹩马脚，分值为 0。这迫使引擎让马往中心跳，避免边缘化。
                    </p>
                  )}
                  {selectedPiece === 'C' && (
                    <p>
                      <strong>炮规则：</strong> 炮的位置权重设计与马类似。在中场核心区域及可以进行远程压制的直道，获得 <strong>+20 至 +25</strong> 的加分。
                      底线或过于靠后的位置则加分较低（仅 +5），从而促使炮积极架在中前场发挥炮架子和牵制作用。
                    </p>
                  )}
                </div>
              </div>

              {/* Formula Panel */}
              <div style={{ marginTop: '24px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>综合评估公式：</span>
                <code style={{ fontSize: '0.95rem', color: 'var(--accent)', fontWeight: 'bold' }}>
                  单局总得分 = ∑(己方棋子基础值 + 位置加分) - ∑(敌方棋子基础值 + 位置加分)
                </code>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Quiescence Search & Horizon Effect */}
        <section className="card" style={{ border: '1px solid var(--border)' }}>
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>模块三</span>
            <h2 style={{ margin: '4px 0 0', fontSize: '1.6rem' }}>水平线效应 & 静态搜索 (Quiescence Search)</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              如果引擎搜索仅限制在固定深度，就会因为“目光短浅”而产生致命误判（水平线效应）。静态搜索通过延续局部吃子链路解决了这一问题。
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'stretch' }}>
            {/* Interactive puzzle board (Centered) */}
            <div style={{ width: '100%', maxWidth: '420px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)', padding: '24px', borderRadius: '12px' }}>
              
              <div style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 'bold', marginBottom: '12px' }}>
                演示场景：红车吃黑卒，黑马在后
              </div>

              {/* Grid 3x3 cutout */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 80px)', gridTemplateRows: 'repeat(3, 80px)', gap: '4px', background: '#d8b880', padding: '8px', borderRadius: '8px', border: '2px solid #44403c', position: 'relative' }}>
                
                {/* Grid lines inside */}
                <div style={{ position: 'absolute', top: '88px', left: '8px', right: '8px', height: '2px', background: '#7c2d12', opacity: 0.3 }} />
                <div style={{ position: 'absolute', top: '172px', left: '8px', right: '8px', height: '2px', background: '#7c2d12', opacity: 0.3 }} />
                <div style={{ position: 'absolute', left: '88px', top: '8px', bottom: '8px', width: '2px', background: '#7c2d12', opacity: 0.3 }} />
                <div style={{ position: 'absolute', left: '172px', top: '8px', bottom: '8px', width: '2px', background: '#7c2d12', opacity: 0.3 }} />

                {/* Cells contents */}
                {/* (0,0) Black Pawn */}
                <div style={{ gridArea: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {qSearchStep === 0 ? (
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#f5ecd8', border: '2px solid #1c1917', color: '#1c1917', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>卒</div>
                  ) : null}
                </div>
                
                {/* (0,2) Black Knight */}
                <div style={{ gridArea: '1 / 3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {qSearchStep === 2 ? (
                    // Knight jumped to (0,0)
                    null
                  ) : (
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#f5ecd8', border: '2px solid #1c1917', color: '#1c1917', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>马</div>
                  )}
                </div>

                {/* (0,0) position after step 1 */}
                <div style={{ gridArea: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                  {qSearchStep === 1 ? (
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#fff8e8', border: '2px solid #b91c1c', color: '#b91c1c', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', boxShadow: '0 0 12px rgba(185,28,28,0.5)' }}>车</div>
                  ) : null}
                  {qSearchStep === 2 ? (
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#f5ecd8', border: '2px solid #1c1917', color: '#1c1917', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', boxShadow: '0 0 12px rgba(28,25,23,0.5)' }}>马</div>
                  ) : null}
                </div>

                {/* (2,0) Red Rook */}
                <div style={{ gridArea: '3 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {qSearchStep === 0 ? (
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#fff8e8', border: '2px solid #b91c1c', color: '#b91c1c', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>车</div>
                  ) : null}
                </div>
              </div>

              {/* Mini stats */}
              <div style={{ marginTop: '20px', display: 'flex', gap: '20px' }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>普通算法估分 (深度1)</span>
                  <strong style={{ fontSize: '1.3rem', color: '#22c55e' }}>+100分 (大优)</strong>
                </div>
                <div style={{ width: '1px', background: 'var(--border)' }} />
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>静态搜索估分 (深度1+)</span>
                  <strong style={{ fontSize: '1.3rem', color: '#ef4444' }}>-800分 (崩溃)</strong>
                </div>
              </div>

            </div>

            {/* Explanation text (Stacked below) */}
            <div style={{ width: '100%', maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
              <div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <button type="button" className={`btn btn-sm ${qSearchStep === 0 ? 'primary' : ''}`} onClick={() => setQSearchStep(0)}>1. 初始局面</button>
                  <button type="button" className={`btn btn-sm ${qSearchStep === 1 ? 'primary' : ''}`} onClick={() => setQSearchStep(1)}>2. 车吃卒 (深度1结束)</button>
                  <button type="button" className={`btn btn-sm ${qSearchStep === 2 ? 'primary' : ''}`} onClick={() => setQSearchStep(2)}>3. 马吃车 (静态搜索延伸)</button>
                </div>

                <div style={{ background: 'var(--surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.98rem', lineHeight: '1.6' }}>
                  {qSearchStep === 0 && (
                    <p style={{ margin: 0 }}>
                      <strong>初始局面：</strong> 红车距离黑卒仅有两步直道，黑卒后面有一只黑马暗中把守（保护着卒）。
                      红车面临两个选择：<strong>吃卒</strong>，或者<strong>静止不动</strong>。
                    </p>
                  )}
                  {qSearchStep === 1 && (
                    <p style={{ margin: 0 }}>
                      <strong>常规极大极小算法 (假设设定的最大搜索深度为 1)：</strong>
                      红方计算“车向前吃掉黑卒”。吃掉卒获得了 <strong>+100</strong> 的评估加分。
                      由于限定深度为 1，搜索在此处戛然而止！引擎根本看不到接下来黑马的反击。它自满地认为这是一个好棋（得 100 分），于是做出了错误的决定。这就是著名的<strong>水平线效应 (Horizon Effect)</strong>。
                    </p>
                  )}
                  {qSearchStep === 2 && (
                    <p style={{ margin: 0 }}>
                      <strong>静态搜索 (Quiescence Search) 的修正：</strong>
                      当普通搜索在深度 1 终止后，引擎发现当前局面并不“安静”（发生了红车捕获黑卒的事件）。
                      为了规避短视错误，静态搜索自动触发，<strong>只搜索接下来的吃子动作</strong>，一直深入到没有子可吃为止：
                      黑马跃出吃掉红车！红方分数瞬间暴跌：`+100 (吃卒) - 900 (丢车) = -800 分`。
                      引擎立即意识到这是个陷阱，放弃了该走法。它救了红车一命！
                    </p>
                  )}
                </div>
              </div>

              {/* Feature Tip */}
              <div style={{ marginTop: '20px', padding: '12px 16px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid var(--accent)', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text)' }}>
                💡 <strong>引擎机制：</strong> 本棋局引擎在达到限制深度（如困难 4 层）时，都会自动开启<strong>最多 4 层</strong>的静态搜索。这使它在剧烈的兑子交换中表现得极其老辣，防范任何短视的战术陷阱。
              </div>

            </div>
          </div>
        </section>

        {/* Section 4: Difficulty and Search Depths Cards */}
        <section className="card" style={{ border: '1px solid var(--border)' }}>
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>模块四</span>
            <h2 style={{ margin: '4px 0 0', fontSize: '1.6rem' }}>AI 难度与搜索深度分层</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              难度越高的 AI，其后台深度搜索遍历的变化呈指数级爆炸增长，思考也越全面。
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            
            {/* Level 2: Easy */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--accent)' }}>入门级 (Depth = 2)</h3>
                  <span style={{ fontSize: '0.8rem', padding: '2px 8px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', borderRadius: '4px', border: '1px solid #22c55e' }}>
                    深度：2层
                  </span>
                </div>
                <ul style={{ margin: '0 0 20px', paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.8' }}>
                  <li>仅向前思考 1 个完整的行棋来回（红一步、黑一步）。</li>
                  <li><strong>运算开销：</strong> 极小，通常 1-20 毫秒内完成。</li>
                  <li><strong>遍历节点：</strong> 约 500 ~ 1,500 个局面。</li>
                  <li><strong>弱点：</strong> 极容易掉入两步以上的简单捉子或双杀陷阱。</li>
                </ul>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px 12px', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                适合象棋零基础新手或儿童进行趣味博弈与教学。
              </div>
            </div>

            {/* Level 3: Medium */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--accent)' }}>普通级 (Depth = 3)</h3>
                  <span style={{ fontSize: '0.8rem', padding: '2px 8px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', borderRadius: '4px', border: '1px solid #f59e0b' }}>
                    深度：3层
                  </span>
                </div>
                <ul style={{ margin: '0 0 20px', paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.8' }}>
                  <li>向前思考 1.5 回合（算到己方做出的第二步反应）。</li>
                  <li><strong>运算开销：</strong> 平均 50 ~ 250 毫秒。</li>
                  <li><strong>遍历节点：</strong> 约 5,000 ~ 15,000 个局面。</li>
                  <li><strong>战术水平：</strong> 可以进行简单的防守、中场纠缠，能发现明显的杀招。</li>
                </ul>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px 12px', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                适合业余初学者，可以锻炼常规局部的排兵布阵与防守。
              </div>
            </div>

            {/* Level 4: Hard */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 20px rgba(245,158,11,0.08)' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--accent)' }}>困难级 (Depth = 4)</h3>
                  <span style={{ fontSize: '0.8rem', padding: '2px 8px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: '4px', border: '1px solid #ef4444' }}>
                    深度：4层
                  </span>
                </div>
                <ul style={{ margin: '0 0 20px', paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.8' }}>
                  <li>向前思考 2 个完整回合（四步交锋计算）。</li>
                  <li><strong>运算开销：</strong> 300 毫秒至 3 秒（受限于5秒时限）。</li>
                  <li><strong>遍历节点：</strong> 约 50,000 ~ 200,000+ 个局面。</li>
                  <li><strong>算法杀手锏：</strong> 引入<strong>迭代加深（Iterative Deepening）</strong>和<strong>软硬双重时间超时退出</strong>，在保住算力的同时确保响应体验。</li>
                </ul>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px 12px', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                棋力接近业余中等水平，布局老练，战术交换非常精准。
              </div>
            </div>

          </div>
        </section>

        {/* Section 5: High-Performance Backend Integration & Coding Agent Spec */}
        <section className="card" style={{ border: '1px solid var(--border)', background: 'linear-gradient(135deg, var(--surface) 0%, rgba(37,32,25,0.7) 100%)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>模块五</span>
            <h2 style={{ margin: '4px 0 0', fontSize: '1.6rem' }}>高难度搜索与后端集群接入规范</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              如果本地 4 层深度无法满足您的对弈需求，您可以复制以下开发指令集（Prompt）并在您的 AI 辅助编程编辑器（如 Cursor/Claude/Gemini）中运行，一键自动构建高性能并行计算后端。
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>⚙️ 象棋引擎后端服务提示词规格书 (Markdown)</span>
              <button 
                type="button" 
                className={`btn ${copied ? 'success' : 'primary'}`} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '8px 16px', 
                  borderRadius: '20px', 
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  background: copied ? '#22c55e' : 'var(--accent)',
                  color: copied ? '#fff' : '#000',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  boxShadow: copied ? '0 0 12px rgba(34, 197, 94, 0.4)' : '0 4px 12px rgba(245, 158, 11, 0.2)'
                }}
                onClick={handleCopyPrompt}
              >
                {copied ? '✓ 已复制到剪贴板！' : '📋 一键复制提示词规格书'}
              </button>
            </div>

            <div style={{ 
              background: '#12100e', 
              border: '1px solid var(--border)', 
              borderRadius: '8px', 
              padding: '20px', 
              maxHeight: '400px', 
              overflowY: 'auto',
              fontFamily: 'Courier New, Courier, monospace',
              fontSize: '0.88rem',
              lineHeight: '1.6',
              color: '#d4c5b9',
              whiteSpace: 'pre-wrap',
              textAlign: 'left'
            }}>
              {PROMPT_TEXT}
            </div>
            
            <div style={{ 
              background: 'rgba(59, 130, 246, 0.08)', 
              border: '1px solid #3b82f6', 
              borderRadius: '8px', 
              padding: '16px', 
              fontSize: '0.9rem', 
              color: 'var(--text)', 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: '12px',
              lineHeight: '1.6'
            }}>
              <span style={{ fontSize: '1.2rem', marginTop: '-2px' }}>ℹ️</span>
              <div>
                <strong>如何使用？</strong> 复制上方提示词，发给您的 AI 编程助手（如 Cursor / Claude 3.5 Sonnet / Gemini 1.5 Pro）。
                后端服务构建完毕并部署运行后，在对弈界面的 <strong>远程引擎</strong> 中填入您的后端 API 服务 URL，并点击<strong>“一键测试”</strong>按钮，即可成功将搜索层级扩展至 <strong>7层国手级</strong>！
              </div>
            </div>
          </div>
        </section>

      </main>

      <footer className="app-footer" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', opacity: 0.8, marginTop: '40px' }}>
        <div>&copy; 2026 中国象棋对弈与训练系统 · 引擎核心算法揭密</div>
      </footer>
    </div>
  )
}
