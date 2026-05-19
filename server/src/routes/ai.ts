import { Router } from 'express'
import { callLlmForMove } from '../llm/client.js'
import { listProviders, getProviderById } from '../config/llmProviderLoader.js'
import { getLegalMoveNotations, findLegalMove, getLegalMovesFromPen, toMoveStr, renderBoardAsText } from '../utils/penValidator.js'

const router = Router()

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface AiMoveRequest {
  providerId: string
  modelId: string
  messages: ChatMessage[]
  /** For server-side move validation. */
  positionPen?: string
  /** Which side the AI is playing — used for validation. */
  moveSide?: 'RED' | 'BLACK'
}

// POST /api/ai/move — 请求 AI 着法
router.post('/ai/move', async (req, res) => {
  try {
    const { providerId, modelId, messages, positionPen, moveSide } = req.body as AiMoveRequest

    // DEBUG: dump incoming request details
    console.log('[API DEBUG] incoming request:', {
      positionPen,
      moveSide,
      messageCount: messages?.length,
      userContentLen: messages?.find(m => m.role === 'user')?.content?.length ?? 0,
      // Show first 100 chars of history section from user message
      historyPreview: (() => {
        const userMsg = messages?.find(m => m.role === 'user')
        if (!userMsg) return 'none'
        const idx = userMsg.content.indexOf('走子记录')
        if (idx < 0) return 'no history'
        return userMsg.content.substring(idx, Math.min(idx + 100, userMsg.content.length))
      })(),
    })

    if (!providerId || !modelId || !messages || !Array.isArray(messages)) {
      res.status(400).json({
        error: 'Missing required fields: providerId, modelId, messages',
      })
      return
    }

    const provider = getProviderById(providerId)
    if (!provider) {
      res.status(400).json({ error: `Unknown provider: ${providerId}` })
      return
    }

    const validModel = provider.models.find((m) => m.id === modelId)
    if (!validModel) {
      res.status(400).json({
        error: `Unknown model "${modelId}" for provider "${provider.name}"`,
      })
      return
    }

    // Use the AI's side (passed explicitly) for validation, not the PEN turn letter
    const sideToMove = moveSide ?? null

    // Enhance user prompt with visual board + legal moves list
    const userMessage = messages.find(m => m.role === 'user')
    const legalMoves = (positionPen && sideToMove) ? getLegalMovesFromPen(positionPen, sideToMove) : []
    const sideLabel = sideToMove === 'RED' ? '红方' : '黑方'

    let enhancedMessages = messages
    if (userMessage) {
      const enhancements: string[] = []

      // Visual board
      if (positionPen) {
        const boardVisual = renderBoardAsText(positionPen)
        enhancements.push(
          `\n\n## 当前棋盘（· 表示空位，你是${sideLabel}）\n\`\`\`\n${boardVisual}\n\`\`\``
        )
      }

      // Legal moves
      if (legalMoves.length > 0) {
        const notations = legalMoves.map(m => m.notation)
        enhancements.push(
          `\n\n## 所有合法着法（必须从中选择一个）\n${notations.join('、')}\n（共${notations.length}种可选着法）`
        )
      }

      if (enhancements.length > 0) {
        const enhancedContent = userMessage.content + enhancements.join('')
        enhancedMessages = messages.map(m =>
          m === userMessage ? { ...m, content: enhancedContent } : m
        )
        console.log(`[API] 增强提示: 棋盘视觉 + ${legalMoves.length} 个合法着法 (side: ${sideToMove})`)
      }
    }

    const result = await callLlmForMove(providerId, modelId, enhancedMessages)

    // Return the enhanced prompt content so frontend can display what was actually sent to LLM
    const enhancedUserContent = enhancedMessages.find(m => m.role === 'user')?.content ?? ''

    // Validate: if positionPen provided, check LLM move is legal
    if (positionPen && sideToMove) {
      const notations = getLegalMoveNotations(positionPen, sideToMove)
      const match = findLegalMove(
        getLegalMovesFromPen(positionPen, sideToMove),
        result.move,
      )
      if (!match) {
        console.warn(`[API] LLM 返回非法着法: "${result.move}"，不在 ${notations.length} 个合法着法中`)
        // Return 200 with error so frontend can retry (not 500 which aborts the retry loop)
        res.json({ error: `着法 "${result.move}" 不合法`, fullPrompt: enhancedUserContent })
        return
      }
      console.log(`[API] 着法验证通过: "${result.move}" → ${match.notation}`)
      // Return move in zh-chess moveStrAsync-compatible format (砲/車/馬 not 炮/车/马)
      res.json({ move: toMoveStr(match.notation), rawContent: result.rawContent, fullPrompt: enhancedUserContent })
    } else {
      res.json({ move: result.move, rawContent: result.rawContent, fullPrompt: enhancedUserContent })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] Error:', message)
    // Return enhanced prompt so frontend can display it even on error
    const fallbackPrompt = req.body.messages?.find((m: { role: string }) => m.role === 'user')?.content ?? ''
    res.status(200).json({ error: message, fullPrompt: fallbackPrompt })
  }
})

// GET /api/ai/providers — 列出所有可用的模型提供商
router.get('/ai/providers', (_req, res) => {
  const providers = listProviders().map((p) => ({
    id: p.id,
    name: p.name,
    models: p.models,
    configured: !!p.baseUrl && !!p.apiKey,
  }))
  res.json(providers)
})

// GET /api/health — 健康检查
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// POST /api/ai/ping — 测试指定提供商的连通性
router.post('/ai/ping', async (req, res) => {
  try {
    const { providerId, modelId } = req.body
    const provider = getProviderById(providerId)
    if (!provider) {
      res.status(400).json({ error: `Unknown provider: ${providerId}` })
      return
    }
    if (!provider.baseUrl) {
      res.status(500).json({ error: `Provider "${provider.name}" has no baseUrl configured` })
      return
    }
    if (!provider.apiKey) {
      res.status(500).json({ error: `Provider "${provider.name}" has no apiKey configured` })
      return
    }

    const testModel = modelId ?? provider.models[0]?.id
    if (!testModel) {
      res.status(500).json({ error: `Provider "${provider.name}" has no models` })
      return
    }

    const baseUrl = provider.baseUrl.replace(/\/+$/, '')
    const url = `${baseUrl}${provider.apiPath}`
    const body = {
      model: testModel,
      messages: [{ role: 'user' as const, content: 'ping' }],
      stream: false,
      max_tokens: 16,
      temperature: 0,
    }

    console.log(`[PING] → POST ${url} (provider: ${provider.name}, model: ${testModel})`)
    const started = Date.now()

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    const elapsed = Date.now() - started

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      res.status(response.status).json({
        provider: provider.name,
        model: testModel,
        status: 'fail',
        httpStatus: response.status,
        error: errText.slice(0, 500),
        elapsedMs: elapsed,
      })
      return
    }

    const contentType = response.headers.get('content-type') ?? ''
    const raw = await response.text()

    let content = ''
    if (contentType.includes('text/event-stream') || raw.includes('data:')) {
      for (const line of raw.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:') || trimmed === 'data: [DONE]') continue
        try {
          const chunk = JSON.parse(trimmed.slice(5).trim())
          const part =
            chunk.choices?.[0]?.delta?.content ??
            chunk.choices?.[0]?.message?.content ??
            ''
          content += part
        } catch { /* ignore */ }
      }
    } else {
      const data = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> }
      content = data.choices?.[0]?.message?.content ?? ''
    }

    console.log(`[PING] ← ${provider.name}: ok (${elapsed}ms) "${content.slice(0, 50)}"`)

    res.json({
      provider: provider.name,
      model: testModel,
      status: 'ok',
      response: content.slice(0, 200),
      elapsedMs: elapsed,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[PING] Error:', message)
    res.status(500).json({ status: 'fail', error: message })
  }
})

export default router
