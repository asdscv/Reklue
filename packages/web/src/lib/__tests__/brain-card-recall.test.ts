import { describe, expect, it } from 'vitest'
import { brainGame, buildDemo, createRng, DEFAULT_CONTEXT, POKER_RANKS, POKER_SUITS, type CardRecallView } from '@reklue/shared/lib/brain-games'
import { cardRecall } from '@reklue/shared/lib/brain-games/games/card-recall'

describe('Playing Card Recall', () => {
  it('adds cards with time to see and enter them, up to 30 cards at level 34', () => {
    const { def } = brainGame('cardRecall')
    const high = def.maxLevel!(DEFAULT_CONTEXT)
    const counts = new Set<number>()
    let previous = { count: 0, preview: 0, limit: 0 }
    for (let level = 1; level <= high; level += 0.25) {
      const state = def.create(level, createRng(8), DEFAULT_CONTEXT)
      const view = def.view(state)
      if (view.kind !== 'cardRecall') throw new Error('expected cards')
      const current = { count: view.slots.length, preview: def.pendingMs(state)!, limit: def.timeLimitMs(state) ?? 0 }
      expect(current.count).toBeGreaterThanOrEqual(previous.count)
      if (current.count > previous.count) expect(current.preview).toBeGreaterThan(previous.preview)
      if (current.count > 13) expect(current.limit).toBeGreaterThanOrEqual(previous.limit)
      counts.add(current.count)
      previous = current
    }
    expect([...counts]).toEqual([2, 3, 4, 5, 7, 9, 11, ...Array.from({ length: 18 }, (_, i) => 13 + i)])
    expect(high).toBe(34)
    expect(previous).toEqual({ count: 30, preview: 77_000, limit: 205_000 })
  })

  it('deals distinct community and player cards and hides every answer during recall', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = cardRecall.create(14, createRng(seed))
      expect(cardRecall.tap(s, 0)).toBe(s)
      const shown = cardRecall.view(s)
      expect(shown.hands).toEqual([
        { start: 5, end: 7, title: { key: 'play.cardRecallPrivate' } },
        { start: 7, end: 9, title: { key: 'play.cardRecallOpponent', params: { number: 1 } } },
        { start: 9, end: 11, title: { key: 'play.cardRecallOpponent', params: { number: 2 } } },
        { start: 11, end: 13, title: { key: 'play.cardRecallOpponent', params: { number: 3 } } },
      ])
      expect(shown.slots).toHaveLength(13)
      expect(new Set(shown.slots.map((card) => card.rank! + card.suit)).size).toBe(13)
      expect(shown.slots.every((c) => POKER_RANKS.includes(c.rank!) && c.suit! in POKER_SUITS)).toBe(true)
      const hidden = cardRecall.view(cardRecall.advance(s))
      expect(hidden.slots.some((c) => c.rank || c.suit || c.correct !== undefined)).toBe(false)
      expect(hidden.input?.submit.disabled).toBe(true)
      expect(hidden.prompt.params).toEqual({ position: 1 })
      const indices = [...hidden.slots, ...hidden.input!.ranks, ...hidden.input!.suits, hidden.input!.submit].map((control) => control.index)
      expect(new Set(indices).size).toBe(indices.length)
    }
  })

  it('requires the correct rank and suit in each position and reveals the original cards at the end', () => {
    let s = cardRecall.create(14, createRng(31))
    const expected = cardRecall.view(s).slots
    s = cardRecall.advance(s)
    const enter = (rank: typeof POKER_RANKS[number], suit: keyof typeof POKER_SUITS) => {
      const input = cardRecall.view(s).input!
      s = cardRecall.tap(s, input.ranks.find((key) => key.value === rank)!.index)
      s = cardRecall.tap(s, input.suits.find((key) => key.value === suit)!.index)
    }
    enter(expected[1].rank!, expected[1].suit!)
    enter(expected[0].rank!, expected[0].suit!)
    for (const card of expected.slice(2)) enter(card.rank!, card.suit!)
    expect(cardRecall.outcome(s)).toBeNull()
    s = cardRecall.tap(s, cardRecall.view(s).input!.submit.index)
    expect(cardRecall.outcome(s)).toEqual({ correct: false, accuracy: 11 / 13 })
    expect(cardRecall.view(s).slots.map((c) => c.correct)).toEqual(expected.map((_, i) => i >= 2))
    expect(cardRecall.view(s).slots.map(({ rank, suit }) => ({ rank, suit }))).toEqual(expected.map(({ rank, suit }) => ({ rank, suit })))
    expect(cardRecall.view(s).slots[0].guess).toEqual({ rank: expected[1].rank, suit: expected[1].suit })
  })

  it('starts recall early or on the timer, hiding 30 unique cards and keeping inputs distinct', () => {
    const { def } = brainGame('cardRecall')
    for (let seed = 1; seed <= 50; seed++) {
      const state = def.create(34, createRng(seed), DEFAULT_CONTEXT)
      const visible = def.view(state) as CardRecallView
      const hiddenState = def.tap(state, visible.preview!.index)
      expect(def.acceptsInput(state)).toBe(false)
      expect(def.acceptsInput(hiddenState)).toBe(true)
      expect(def.pendingMs(hiddenState)).toBeNull()
      expect(hiddenState).toEqual(def.advance(state))
      expect(def.advance(hiddenState)).toBe(hiddenState)
      const hidden = def.view(hiddenState) as CardRecallView
      expect(visible.hands).toEqual([])
      expect(visible.rows).toEqual(Array.from({ length: 6 }, (_, i) => ({ start: i * 5, end: (i + 1) * 5, target: i * 5 })))
      expect(new Set(visible.slots.map((slot) => slot.rank! + slot.suit)).size).toBe(30)
      expect(hidden.slots.every((slot) => slot.rank === undefined && slot.suit === undefined)).toBe(true)
      const input = hidden.input!
      expect(input.submit.disabled).toBe(true)
      const indices = [...hidden.slots, ...input.ranks, ...input.suits, input.submit, visible.preview!].map((control) => control.index)
      expect(new Set(indices).size).toBe(indices.length)
    }
  })

  it('keeps the active group, sends the player to the next blank, and grades a partial entry', () => {
    const { def } = brainGame('cardRecall')
    let state = def.create(34, createRng(8), DEFAULT_CONTEXT)
    const expected = (def.view(state) as CardRecallView).slots
    const view = () => def.view(state) as CardRecallView
    const tap = (index: number) => { state = def.tap(state, index) }
    state = def.advance(state)
    tap(view().rows![5].target)
    expect(view().input!.active).toBe(25)
    tap(view().input!.ranks[0].index)
    expect(view().prompt.key).toBe('play.cardRecallPickSuit')
    expect(view().input!.submit.disabled).toBe(true)
    tap(view().input!.resetRank!)
    expect(view().prompt.key).toBe('play.cardRecallEnter')
    for (const step of def.solution(state)!) tap(step)
    expect(view().input!.active).toBe(26)
    expect(view().rows![5].target).toBe(26)
    expect(view().input!.submit).toMatchObject({ answered: 1, disabled: false })
    tap(view().input!.submit.index)
    expect(def.outcome(state)).toEqual({ correct: false, accuracy: 1 / 30 })
    const result = view().slots
    expect(result.filter((slot) => slot.correct).map((slot) => slot.index)).toEqual([25])
    expect(result[25]).toMatchObject({ rank: expected[25].rank, suit: expected[25].suit })
    expect(view().prompt.params).toEqual({ correct: 1, total: 30 })
  })

  it('teaches the real cover, rank and suit actions in the two-card demo', () => {
    const frames = buildDemo('cardRecall')
    const start = frames[0].view as CardRecallView
    expect(frames[0].tap).toBe(start.preview!.index)
    expect(start.slots).toHaveLength(2)
    expect(frames[1].view.prompt).toMatchObject({ key: 'play.cardRecallEnter', params: { position: 1 } })
    expect(frames[3].view.prompt).toMatchObject({ key: 'play.cardRecallPickSuit', params: { position: 1, rank: start.slots[0].rank } })
    expect(frames.at(-1)?.view.prompt).toMatchObject({ key: 'play.cardRecallResult', params: { correct: 2, total: 2 } })
  })

  it('leaves skipped slots empty and lets a beginner check one answer', () => {
    let state = cardRecall.create(1, createRng(2))
    const expected = cardRecall.view(state).slots
    state = cardRecall.advance(state)
    state = cardRecall.tap(state, cardRecall.view(state).input!.skip!)
    expect(cardRecall.view(state).input!.active).toBe(1)
    for (const step of cardRecall.solution(state)!) state = cardRecall.tap(state, step)
    const entered = cardRecall.view(state)
    expect(entered.input).toMatchObject({ active: 0, submit: { answered: 1, disabled: false } })
    expect(entered.slots[0].rank).toBeUndefined()
    state = cardRecall.tap(state, entered.input!.submit.index)
    expect(cardRecall.view(state).slots[0]).toMatchObject({ rank: expected[0].rank, suit: expected[0].suit, guess: null })
    expect(cardRecall.outcome(state)).toEqual({ correct: false, accuracy: 0.5 })
  })
})
