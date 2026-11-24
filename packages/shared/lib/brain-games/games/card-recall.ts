import type { Rng } from '../rng'
import { POKER_RANKS, POKER_SUITS, type BrainGameDef, type CardRecallView, type PokerCard, type PokerRank, type PokerSuit, type PromptView } from '../types'

const suits = Object.keys(POKER_SUITS) as PokerSuit[]
const deck = suits.flatMap((suit) => POKER_RANKS.map((rank) => ({ rank, suit })))

// Card count, viewing time, recall time. Adding cards also gives the player time to see them
// and enter their ranks and suits. Showdown boards add one revealed opponent's hand at a time.
const LEVELS = [
  [2, 7_000, 38_000], [2, 6_500, 38_000], [3, 8_000, 46_000], [3, 7_500, 46_000],
  [4, 9_500, 54_000], [5, 11_000, 62_000], [5, 10_500, 62_000], [5, 10_000, 62_000],
  [7, 14_000, 78_000], [7, 13_000, 78_000], [9, 18_000, 92_000], [9, 17_000, 92_000],
  [11, 22_000, 106_000], [13, 26_000, 120_000],
] as const

const COMMUNITY_CARDS = 5
const HAND_CARDS = 2
const DECK_ROW_SIZE = 5
const SHOWDOWN_MAX = LEVELS[LEVELS.length - 1][0]
const MAX_CARDS = 30
const RANK_START = MAX_CARDS
const SUIT_START = RANK_START + POKER_RANKS.length
const CONFIRM = SUIT_START + suits.length
const START_RECALL = CONFIRM + 1
const RESET_RANK = CONFIRM + 2

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
const canSubmit = (s: State, answered: number) => s.rank === null && (s.cards.length > SHOWDOWN_MAX ? answered > 0 : answered === s.cards.length)

export function growCardRecall(s: State, depth: number, rng: Rng): State {
  const extra = Math.floor((MAX_CARDS - s.cards.length) * depth + 1e-9)
  if (extra === 0) return s
  const extraCards = rng.sample(deck.filter((card) => !s.cards.includes(card)), extra)
  return {
    ...s,
    cards: [...s.cards, ...extraCards],
    answers: [...s.answers, ...extraCards.map(() => null)],
    previewMs: s.previewMs + extra * 3_000,
    limitMs: s.limitMs + extra * 5_000,
  }
}

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
    if (s.phase === 'preview' && index === START_RECALL) return { ...s, phase: 'recall' }
    if (s.phase !== 'recall' || !Number.isInteger(index)) return s
    if (index === CONFIRM) return canSubmit(s, s.answers.filter(Boolean).length) ? { ...s, phase: 'done' } : s
    if (index === RESET_RANK) return s.rank === null ? s : { ...s, rank: null }
    if (index >= 0 && index < s.cards.length) {
      return index === s.active ? s : { ...s, active: index, rank: null }
    }
    const active = s.active
    if (active === null) return s
    const rank = POKER_RANKS[index - RANK_START]
    if (rank) return { ...s, rank }
    const suit = suits[index - SUIT_START]
    if (!suit || !s.rank) return s
    const answer = { rank: s.rank, suit }
    const answers = s.answers.map((previous, i) => i === active ? answer : previous)
    const later = answers.findIndex((value, i) => i > active && value === null)
    const next = later === -1 ? answers.indexOf(null) : later
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
    const total = s.cards.length
    const deckOrder = total > SHOWDOWN_MAX
    const answered = s.answers.filter(Boolean).length
    const prompt: PromptView = preview ? { key: 'play.cardRecallMemorize', params: { total } }
      : recalling ? s.active === null
        ? { key: 'play.cardRecallCheck' }
        : { key: deckOrder ? s.rank ? 'play.cardRecallPickSuit' : 'play.cardRecallPickRank' : 'play.cardRecallEnter', params: { position: s.active + 1, total } }
        : { key: 'play.cardRecallResult', params: { correct: score(s), total } }
    const handCount = deckOrder ? 0 : Math.max(0, Math.floor((total - COMMUNITY_CARDS) / HAND_CARDS))
    return {
      kind: 'cardRecall',
      prompt,
      hands: Array.from({ length: handCount }, (_, hand) => {
        const start = COMMUNITY_CARDS + hand * HAND_CARDS
        const title = hand === 0 ? { key: 'play.cardRecallPrivate' } : { key: 'play.cardRecallOpponent', params: { number: hand } }
        return { start, end: start + HAND_CARDS, title }
      }),
      rows: deckOrder ? Array.from({ length: Math.ceil(total / DECK_ROW_SIZE) }, (_, row) => {
        const start = row * DECK_ROW_SIZE
        const end = Math.min(start + DECK_ROW_SIZE, total)
        const empty = s.answers.slice(start, end).indexOf(null)
        return { start, end, target: empty === -1 ? start : start + empty }
      }) : undefined,
      preview: preview ? { ms: s.previewMs, index: START_RECALL } : undefined,
      slots: s.cards.map((card, index) => {
        const active = recalling && index === s.active
        const draft = active ? s.rank : null
        const shown = recalling ? s.answers[index] : card
        return { index, rank: draft ?? shown?.rank, suit: draft ? undefined : shown?.suit, active, correct: s.phase === 'done' ? matches(s.answers[index], card) : undefined }
      }),
      input: recalling ? {
        active: s.active,
        ranks: POKER_RANKS.map((value, i) => ({ value, index: RANK_START + i, disabled: s.active === null, selected: value === s.rank })),
        suits: suits.map((value, i) => ({ value, index: SUIT_START + i, disabled: !s.rank })),
        resetRank: s.rank ? RESET_RANK : undefined,
        submit: { index: CONFIRM, disabled: !canSubmit(s, answered), answered },
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
