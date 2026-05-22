import type { TacticalSnapshot } from '../types/gameSession'

const SNAPSHOT_KEY = 'chinese-chess:tactical-snapshots'

export function loadSnapshots(): TacticalSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    console.error('[象棋·错题本] 加载瞬间失败', e)
    return []
  }
}

export function saveSnapshots(snapshots: TacticalSnapshot[]) {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots))
  } catch (e) {
    console.error('[象棋·错题本] 保存瞬间失败', e)
  }
}

export function addSnapshot(snapshot: TacticalSnapshot): TacticalSnapshot[] {
  const current = loadSnapshots()
  
  // 避免对同一个局面的重复或过于密集的捕获 (例如在同一局中、短时间内触发的相同触发类型)
  const isDuplicate = current.some(
    (s) => s.gameId === snapshot.gameId && Math.abs(s.triggerMoveIndex - snapshot.triggerMoveIndex) < 4
  )
  if (isDuplicate) {
    console.log('[象棋·错题本] 检测到相邻步骤已被捕获，忽略当前触发')
    return current
  }

  const next = [snapshot, ...current]
  
  // FIFO 容量限制 30 个
  if (next.length > 30) {
    next.splice(30)
  }
  
  saveSnapshots(next)
  console.log('[象棋·错题本] 成功捕获并保存新的瞬间！', snapshot.triggerReason)
  return next
}

export function clearSnapshots(): TacticalSnapshot[] {
  try {
    localStorage.removeItem(SNAPSHOT_KEY)
  } catch (e) {
    console.error('[象棋·错题本] 清空失败', e)
  }
  return []
}

export function deleteSnapshot(id: string): TacticalSnapshot[] {
  const current = loadSnapshots()
  const next = current.filter((s) => s.id !== id)
  saveSnapshots(next)
  console.log('[象棋·错题本] 成功删除瞬间！ID:', id)
  return next
}

export interface ImportCoachingItem {
  id: string
  hint: string
}

export interface ImportCoachingPayload {
  snapshots?: ImportCoachingItem[]
}

/**
 * 导入大模型点评数据，更新本地存储中的 coachingHint
 */
export function updateSnapshotCoaching(payload: ImportCoachingPayload): TacticalSnapshot[] {
  const current = loadSnapshots()
  if (!payload || !Array.isArray(payload.snapshots)) {
    throw new Error('无效的导入格式：应包含 snapshots 数组')
  }

  let updatedCount = 0
  const next = current.map((s) => {
    const matched = payload.snapshots?.find((item) => item.id === s.id)
    if (matched) {
      updatedCount++
      return { ...s, coachingHint: matched.hint }
    }
    return s
  })

  if (updatedCount > 0) {
    saveSnapshots(next)
    console.log(`[象棋·错题本] 成功匹配并载入了 ${updatedCount} 条 AI 教练提示`)
  } else {
    console.warn('[象棋·错题本] 未匹配到任何本地战术瞬间 ID，请确认导入的点评数据是否过期')
  }

  return next
}
