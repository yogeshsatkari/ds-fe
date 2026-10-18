import { useEffect } from 'react'

export const ATTENTION_REGEX =
  /\[[^\]\r\n]*(?:verif[a-z]*|fill[a-z]*|illegib[a-z]*|pending|confirm[a-z]*|review[a-z]*|specif[a-z]*|missing|not\s+documented|unknown|\b(?:tbd|tbc)\b|\?)[^\]\r\n]*\]/gi

/**
 * Scans container text nodes and returns candidate placeholder matches.
 */
function scanContainerForCandidates(container) {
  const candidates = []

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const blocks = new Map()
  let node

  while ((node = walker.nextNode())) {
    const val = node.nodeValue
    if (!val) continue

    const blockEl =
      node.parentElement?.closest(
        'p, .layout-line, .docx-line, tr, td, th, li, h1, h2, h3, h4, h5, h6',
      ) || node.parentElement
    if (!blockEl) continue

    let blockData = blocks.get(blockEl)
    if (!blockData) {
      blockData = { blockEl, fullText: '', nodes: [] }
      blocks.set(blockEl, blockData)
    }

    const startOffset = blockData.fullText.length
    blockData.fullText += val
    blockData.nodes.push({
      node,
      startOffset,
      endOffset: startOffset + val.length,
    })
  }

  for (const { blockEl, fullText, nodes } of blocks.values()) {
    const regex = new RegExp(ATTENTION_REGEX.source, 'gi')
    let m
    while ((m = regex.exec(fullText)) !== null) {
      const matchStart = m.index
      const matchEnd = matchStart + m[0].length

      if (m.index === regex.lastIndex) {
        regex.lastIndex++
      }

      let startNode = null
      let startOffsetInNode = 0
      let endNode = null
      let endOffsetInNode = 0

      for (const item of nodes) {
        if (!startNode && matchStart >= item.startOffset && matchStart < item.endOffset) {
          startNode = item.node
          startOffsetInNode = matchStart - item.startOffset
        }
        if (matchEnd > item.startOffset && matchEnd <= item.endOffset) {
          endNode = item.node
          endOffsetInNode = matchEnd - item.startOffset
          break
        }
      }

      if (startNode && endNode) {
        candidates.push({
          blockEl,
          startNode,
          startOffset: startOffsetInNode,
          endNode,
          endOffset: endOffsetInNode,
          text: m[0],
        })
      }
    }
  }

  return candidates
}

/**
 * Highlights placeholder keywords directly inside the DOCX document canvas.
 * Uses persistent Highlight with in-place Range updating to guarantee ZERO
 * blinking or flashing on other placeholders when typing or editing.
 */
export function useDocumentPlaceholderHighlight(surfaceRef, isReady = true) {
  useEffect(() => {
    if (!isReady) return

    const container = surfaceRef.current
    if (!container) return

    const supportsHighlight =
      typeof CSS !== 'undefined' && Boolean(CSS.highlights)
    if (!supportsHighlight) return

    // Inject highlight styles if not present
    const styleId = 'docx-placeholder-highlight-style'
    let styleEl = document.getElementById(styleId)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = `
      ::highlight(docx-placeholder-highlight) {
        background-color: #fde047;
        text-decoration: none;
      }
    `

    // Persistent Highlight object registered once in CSS.highlights
    let activeHighlight = CSS.highlights.get('docx-placeholder-highlight')
    if (!activeHighlight) {
      activeHighlight = new Highlight()
      CSS.highlights.set('docx-placeholder-highlight', activeHighlight)
    }

    // Pool of Range objects registered in activeHighlight
    let trackedRanges = [] // Array of { range, text }

    const updateHighlights = () => {
      try {
        const candidates = scanContainerForCandidates(container)

        // Fast-path guard: if candidate positions and nodes are identical,
        // do ABSOLUTELY NOTHING. Zero DOM/range calls = zero flicker on clicks or focus.
        const allIdentical =
          candidates.length === trackedRanges.length &&
          trackedRanges.every((t, i) => {
            const c = candidates[i]
            return (
              t.range.startContainer === c.startNode &&
              t.range.startOffset === c.startOffset &&
              t.range.endContainer === c.endNode &&
              t.range.endOffset === c.endOffset &&
              c.startNode.isConnected &&
              c.endNode.isConnected
            )
          })

        if (allIdentical) {
          return
        }

        const nextTracked = []
        const available = [...trackedRanges]

        // Pass 1: Keep ranges that already point to the exact same live DOM positions
        for (const c of candidates) {
          const exactIdx = available.findIndex(
            (t) =>
              t.range.startContainer === c.startNode &&
              t.range.startOffset === c.startOffset &&
              t.range.endContainer === c.endNode &&
              t.range.endOffset === c.endOffset &&
              c.startNode.isConnected &&
              c.endNode.isConnected,
          )

          if (exactIdx !== -1) {
            const [item] = available.splice(exactIdx, 1)
            nextTracked.push(item)
            c.resolved = true
          }
        }

        // Pass 2: Reuse existing ranges for candidates with matching text (repoints in-place)
        for (const c of candidates) {
          if (c.resolved) continue

          const textIdx = available.findIndex((t) => t.text === c.text)
          if (textIdx !== -1) {
            const [item] = available.splice(textIdx, 1)
            try {
              item.range.setStart(c.startNode, c.startOffset)
              item.range.setEnd(c.endNode, c.endOffset)
              nextTracked.push(item)
              c.resolved = true
            } catch {
              // fallback
            }
          }
        }

        // Pass 3: Reuse any remaining available ranges from pool (prevents delete + re-add)
        for (const c of candidates) {
          if (c.resolved) continue

          if (available.length > 0) {
            const item = available.shift()
            try {
              item.range.setStart(c.startNode, c.startOffset)
              item.range.setEnd(c.endNode, c.endOffset)
              item.text = c.text
              nextTracked.push(item)
              c.resolved = true
            } catch {
              // fallback
            }
          }
        }

        // Pass 4: Create new ranges only if candidates exceed the existing pool
        for (const c of candidates) {
          if (c.resolved) continue

          try {
            const r = document.createRange()
            r.setStart(c.startNode, c.startOffset)
            r.setEnd(c.endNode, c.endOffset)
            activeHighlight.add(r)
            nextTracked.push({ range: r, text: c.text })
          } catch {
            // ignore
          }
        }

        // Pass 5: Delete only truly excess ranges that are no longer needed
        for (const item of available) {
          try {
            activeHighlight.delete(item.range)
          } catch {
            // ignore
          }
        }

        trackedRanges = nextTracked
      } catch {
        // Fallback gracefully
      }
    }

    let rafId = null
    const scheduleUpdate = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(updateHighlights)
    }

    // Run scans at staggered intervals as pages mount and layout resolves
    const timer1 = setTimeout(scheduleUpdate, 300)
    const timer2 = setTimeout(scheduleUpdate, 800)
    const timer3 = setTimeout(scheduleUpdate, 1800)

    // Observe changes with RAF so highlights update in the same frame as editor mutations
    const observer = new MutationObserver(scheduleUpdate)

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    // Also update on scroll so virtualized pages get highlighted smoothly
    const scrollContainer =
      container.querySelector('.docx-editor__scroll-container') ||
      container.querySelector('.ep-one-surface__viewport') ||
      container

    scrollContainer?.addEventListener('scroll', scheduleUpdate, { passive: true })

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      if (rafId) cancelAnimationFrame(rafId)
      observer.disconnect()
      scrollContainer?.removeEventListener('scroll', scheduleUpdate)
      try {
        activeHighlight?.clear()
        CSS.highlights.delete('docx-placeholder-highlight')
      } catch {
        // Ignore cleanup errors
      }
    }
  }, [surfaceRef, isReady])
}
