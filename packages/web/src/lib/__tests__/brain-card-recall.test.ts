import { describe, expect, it } from 'vitest'
import { brainGame, createRng, DEFAULT_CONTEXT, POKER_RANKS, POKER_SUITS } from '@reklue/shared/lib/brain-games'
import { cardRecall } from '@reklue/shared/lib/brain-games/games/card-recall'

describe('Playing Card Recall', () => {
  it('deals a unique hold’em board and two hole cards, and hides every answer during recall', () => {
    const { def } = brainGame('cardRecall')
    const high = def.maxLevel!(DEFAULT_CONTEXT)
    const normal = def.create(9, createRng(8), DEFAULT_CONTEXT)
    const expert = def.create(high, createRng(8), DEFAULT_CONTEXT)
    expect(def.pendingMs(expert)).toBeLessThan(def.pendingMs(normal)!)
    for (let seed = 1; seed <= 50; seed++) {
      const s = cardRecall.create(14, createRng(seed))
      expect(cardRecall.tap(s, 0)).toBe(s)
      const shown = cardRecall.view(s)
      expect(shown.privateCount).toBe(2)
      expect(shown.slots).toHaveLength(7)
      expect(new Set(shown.slots.map((card) => card.rank! + card.suit)).size).toBe(7)
      expect(shown.slots.every((c) => POKER_RANKS.includes(c.rank!) && c.suit! in POKER_SUITS)).toBe(true)
      const hidden = cardRecall.view(cardRecall.advance(s))
      expect(hidden.slots.some((c) => c.rank || c.suit || c.correct !== undefined)).toBe(false)
      expect(hidden.input?.submit.disabled).toBe(true)
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
    expect(cardRecall.outcome(s)).toEqual({ correct: false, accuracy: 5 / 7 })
    expect(cardRecall.view(s).slots.map((c) => c.correct)).toEqual([false, false, true, true, true, true, true])
    expect(cardRecall.view(s).slots.map(({ rank, suit }) => ({ rank, suit }))).toEqual(expected.map(({ rank, suit }) => ({ rank, suit })))
  })
})
