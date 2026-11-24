import { POKER_RANKS, POKER_SUITS, type BrainGameDef, type CardRecallView, type PokerCard, type PokerRank, type PokerSuit } from '../types'

const suits = Object.keys(POKER_SUITS) as PokerSuit[]
const deck = suits.flatMap((suit) => POKER_RANKS.map((rank) => ({ rank, suit })))

// Card count, time to see the cards, time for recall. Seven cards are the five community cards
// and two hole cards. The extreme range shortens the windows without changing the deck.
const LEVELS = [
  [2, 7_000, 38_000], [2, 5_000, 35_000], [3, 6_500, 42_000], [3, 4_500, 38_000],
  [4, 6_000, 43_000], [5, 7_000, 49_000], [5, 5_000, 45_000], [5, 3_500, 42_000],
  [7, 9_000, 58_000], [7, 7_000, 54_000], [7, 5_000, 50_000], [7, 3_800, 46_000],
  [7, 3_000, 43_000], [7, 2_400, 40_000],
] as const

const RANK_START = 7
const SUIT_START = RANK_START + POKER_RANKS.length
const CONFIRM = SUIT_START + suits.length

interface State {
  cards: PokerCard[]
  answers: (PokerCard | null)[]
  phase: 'preview' | 'recall' | 'done'
  active: number | null
  rank: PokerRank | null
  previewMs: number
  limitMs: number
}

const matches = (answer: PokerCard | null, card: PokerCard) => answer?.rank === card.rank && answer.suit === card.suit
const score = (s: State) => s.cards.filter((card, i) => matches(s.answers[i], card)).length
const ready = (s: State) => s.rank === null && s.answers.every((answer) => answer !== null)

export const cardRecall = {
  id: 'cardRecall',
  create(level, rng): State {
    const band = Number.isFinite(level) ? Math.max(1, Math.min(LEVELS.length, Math.floor(level))) : 1
    const [count, previewMs, limitMs] = LEVELS[band - 1]
    return { cards: rng.sample(deck, count), answers: Array.from({ length: count }, () => null), phase: 'preview', active: 0, rank: null, previewMs, limitMs }
  },
  pendingMs: (s) => s.phase === 'preview' ? s.previewMs : null,
  advance: (s) => s.phase === 'preview' ? { ...s, phase: 'recall' } : s,
  acceptsInput: (s) => s.phase === 'recall',
  tap(s, index) {
    if (s.phase !== 'recall' || !Number.isInteger(index)) return s
    if (index === CONFIRM) return ready(s) ? { ...s, phase: 'done' } : s
    if (index >= 0 && index < s.cards.length) {
      return index === s.active ? s : { ...s, active: index, rank: null }
    }
    if (s.active === null) return s
    const rank = POKER_RANKS[index - RANK_START]
    if (rank) return { ...s, rank }
    const suit = suits[index - SUIT_START]
    if (!suit || !s.rank) return s
    const answer = { rank: s.rank, suit }
    const answers = s.answers.map((previous, i) => i === s.active ? answer : previous)
    const next = answers.findIndex((value) => value === null)
    return { ...s, answers, active: next === -1 ? null : next, rank: null }
  },
  timeout: (s) => s.phase === 'done' ? s : { ...s, phase: 'done' },
  outcome(s) {
    if (s.phase !== 'done') return null
    const right = score(s)
    return { correct: right === s.cards.length, accuracy: right / s.cards.length }
  },
  timeLimitMs: (s) => s.limitMs,
  view(s): CardRecallView {
    const recalling = s.phase === 'recall'
    const preview = s.phase === 'preview'
    const prompt = preview ? { key: 'play.cardRecallMemorize' }
      : recalling ? { key: ready(s) ? 'play.cardRecallCheck' : 'play.cardRecallEnter' }
        : { key: 'play.cardRecallResult', params: { correct: score(s), total: s.cards.length } }
    return {
      kind: 'cardRecall',
      prompt,
      privateCount: s.cards.length === 7 ? 2 : 0,
      previewMs: preview ? s.previewMs : undefined,
      slots: s.cards.map((card, index) => {
        const active = recalling && index === s.active
        const draft = active ? s.rank : null
        const shown = recalling ? s.answers[index] : card
        return { index, rank: draft ?? shown?.rank, suit: draft ? undefined : shown?.suit, active, correct: s.phase === 'done' ? matches(s.answers[index], card) : undefined }
      }),
      input: recalling ? {
        ranks: POKER_RANKS.map((value, i) => ({ value, index: RANK_START + i, disabled: s.active === null, selected: value === s.rank })),
        suits: suits.map((value, i) => ({ value, index: SUIT_START + i, disabled: !s.rank })),
        submit: { index: CONFIRM, disabled: !ready(s) },
      } : undefined,
    }
  },
  signature: (s) => s.cards.map((card) => card.rank + card.suit).join('/'),
  solution(s) {
    if (s.phase !== 'recall') return null
    if (s.rank === null && s.cards.every((card, i) => matches(s.answers[i], card))) return [CONFIRM]
    const at = s.active ?? s.cards.findIndex((card, i) => !matches(s.answers[i], card))
    const card = s.cards[at]
    return [
      ...(at !== s.active ? [at] : []),
      ...(s.rank !== card.rank ? [RANK_START + POKER_RANKS.indexOf(card.rank)] : []),
      SUIT_START + suits.indexOf(card.suit),
    ]
  },
  mechanics: () => [],
  maxLevel: () => LEVELS.length,
} satisfies BrainGameDef<State>
