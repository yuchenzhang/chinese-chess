import { useState, useEffect, useCallback } from 'react'

interface TourStep {
  target: string
  title: string
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  action?: () => void
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="brand"]',
    title: '欢迎来到中国象棋 AI 教练',
    content: '这是一个集成了人机对弈和 AI 深度分析的象棋学习平台。让我们快速了解一下如何使用 AI 提升棋艺。',
    position: 'bottom'
  },
  {
    target: '[data-tour="board"]',
    title: '第一步：进行对弈',
    content: '首先，您可以像平时一样与 AI 或朋友下棋。所有的走子过程都会被系统记录下来。',
    position: 'right'
  },
  {
    target: '[data-tour="enter-replay-btn"]',
    title: '第二步：进入复盘模式',
    content: '对局结束后，点击这个“回放棋局”按钮。这会打开复盘面板，解锁强大的 AI 复盘功能。',
    position: 'left'
  },
  {
    target: '[data-tour="export-import-actions"]',
    title: '第三步：导出与 AI 对话',
    content: '点击“复制大模型提示词”，然后将其粘贴给 ChatGPT 或 Gemini。AI 会根据棋局返回 JSON 格式的点评和针对性习题数据。',
    position: 'left',
    action: () => {
      // 尝试打开回放面板
      const tryOpen = () => {
        const panel = document.querySelector('[data-tour="export-import-actions"]');
        if (panel) return; // 已打开

        console.log('[象棋·演示] 尝试通过模拟点击打开回放面板...');
        const btn = document.querySelector('[data-tour="enter-replay-btn"]') as HTMLButtonElement;
        
        if (btn && !btn.disabled) {
          btn.click();
        } else {
          // 如果按钮还没准备好，等待并重试
          console.log('[象棋·演示] 按钮尚未准备好，等待中...');
          setTimeout(tryOpen, 200);
        }
      };
      tryOpen();
    }
  },
  {
    target: '[data-tour="import-analysis-btn"]',
    title: '第四步：导入 AI 分析',
    content: '将 AI 返回的 JSON 代码粘贴到这里的导入框中。这样，AI 的点评就会出现在复盘历史中，甚至还能为你创建专项训练。',
    position: 'left'
  },
  {
    target: '[data-tour="session-list"]',
    title: '第五步：开始专项训练',
    content: '导入成功后，习题会出现在这里。点击即可进入由 AI 教练手把手教您如何破解关键局面的特训模式。',
    position: 'left'
  },
  {
    target: '[data-tour="ai-settings"]',
    title: '最后：配置 AI 引擎',
    content: '确保在这里配置好您的决策引擎地址。一切就绪后，您就可以在训练中与强大的 AI 进行实时切磋了！',
    position: 'top'
  }
]

export function GuideTour() {
  const [activeStep, setActiveStep] = useState<number | null>(null)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})

  const updateTooltipPosition = useCallback((index: number) => {
    const step = TOUR_STEPS[index]
    
    // 执行步骤关联的动作
    if (step.action) {
      step.action();
    }

    // 使用轮询重试机制，确保 DOM 元素出现（特别是由于 action 触发的元素）
    let attempts = 0
    const maxAttempts = 20 // 最多等待 2 秒
    
    const tryPosition = () => {
      const element = document.querySelector(step.target) as HTMLElement
      
      // 如果元素还没出现且我们还有重试机会，则继续等待
      if (!element && attempts < maxAttempts) {
        attempts++
        setTimeout(tryPosition, 100)
        return
      }

      if (!element) {
        console.warn(`[象棋·演示] 未能找到目标元素: ${step.target}`)
        return
      }

      const rect = element.getBoundingClientRect()
      const padding = 16
      let top = 0
      let left = 0
      let transform = ''

      switch (step.position || 'bottom') {
        case 'bottom':
          top = rect.bottom + window.scrollY + padding
          left = rect.left + rect.width / 2
          transform = 'translateX(-50%)'
          break
        case 'top':
          top = rect.top + window.scrollY - padding
          left = rect.left + rect.width / 2
          transform = 'translate(-50%, -100%)'
          break
        case 'left':
          top = rect.top + rect.height / 2 + window.scrollY
          left = rect.left - padding
          transform = 'translate(-100%, -50%)'
          break
        case 'right':
          top = rect.top + rect.height / 2 + window.scrollY
          left = rect.right + padding
          transform = 'translate(0, -50%)'
          break
      }

      // Viewport boundary checks
      const tooltipWidth = 320
      const margin = 20
      
      if (step.position === 'top' || step.position === 'bottom') {
        const predictedLeft = left - tooltipWidth / 2
        if (predictedLeft < margin) {
          left = margin + tooltipWidth / 2
        } else if (predictedLeft + tooltipWidth > window.innerWidth - margin) {
          left = window.innerWidth - margin - tooltipWidth / 2
        }
      } else if (step.position === 'left') {
        if (left - tooltipWidth < margin) {
          if (left < tooltipWidth + margin) left = tooltipWidth + margin
        }
      } else if (step.position === 'right') {
        if (left + tooltipWidth > window.innerWidth - margin) {
          left = window.innerWidth - margin - tooltipWidth
        }
      }

      setTooltipStyle({
        position: 'absolute',
        top,
        left,
        transform,
        zIndex: 2000,
      })

      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      element.classList.add('tour-highlight')
    }

    tryPosition()
  }, [])


  useEffect(() => {
    const handleStart = () => {
      setActiveStep(0)
    }
    window.addEventListener('start-tour', handleStart)
    return () => window.removeEventListener('start-tour', handleStart)
  }, [])

  useEffect(() => {
    if (activeStep !== null) {
      // Clear previous highlights
      document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'))
      updateTooltipPosition(activeStep)
    }
  }, [activeStep, updateTooltipPosition])

  if (activeStep === null) return null

  const currentStep = TOUR_STEPS[activeStep]

  const handleNext = () => {
    if (activeStep < TOUR_STEPS.length - 1) {
      setActiveStep(activeStep + 1)
    } else {
      handleClose()
    }
  }

  const handlePrev = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1)
    }
  }

  const handleClose = () => {
    document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'))
    setActiveStep(null)
  }

  return (
    <>
      <div className="tour-overlay" onClick={handleClose} />
      <div className="tour-tooltip" style={tooltipStyle}>
        <div className="tour-tooltip-arrow" data-position={currentStep.position || 'bottom'} />
        <h4 className="tour-tooltip-title">{currentStep.title}</h4>
        <p className="tour-tooltip-content">{currentStep.content}</p>
        <div className="tour-tooltip-footer">
          <span className="tour-tooltip-progress">{activeStep + 1} / {TOUR_STEPS.length}</span>
          <div className="tour-tooltip-actions">
            {activeStep > 0 && <button className="btn btn-sm" onClick={handlePrev}>上一步</button>}
            <button className="btn btn-sm primary" onClick={handleNext}>
              {activeStep === TOUR_STEPS.length - 1 ? '完成' : '下一步'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
