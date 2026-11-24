import { describe, expect, it } from 'vitest'
import { createRng, DEFAULT_CONTEXT, type MakeNumberView, type MakeToken } from '@reklue/shared/lib/brain-games'
import { eachTree, evaluate, MAKE_NUMBER_MAX_LEVEL, makeNumber, makeNumberFractionPuzzles, type MakeNumberState } from '@reklue/shared/lib/brain-games/games/make-number'

const viewOf = (s: MakeNumberState) => makeNumber.view(s) as MakeNumberView
const equation = (s: MakeNumberState) => viewOf(s).equation.map((part) => part.text).join(' ')
const toggleSquare = (s: MakeNumberState, index: number) => makeNumber.tap(makeNumber.tap(s, viewOf(s).square!.index), index)

describe('Make the Number: editing and recovery', () => {
  it('an unfinished or wrong expression can be undone, cleared and solved at every level', () => {
    for (let level = 1; level <= MAKE_NUMBER_MAX_LEVEL; level++) {
      for (let seed = 1; seed <= 8; seed++) {
        let s = makeNumber.create(level, createRng(level * 7919 + seed), DEFAULT_CONTEXT)
        const first = makeNumber.view(s) as MakeNumberView
        const tile = first.tiles.find((t) => !t.disabled)
        if (tile) s = makeNumber.tap(s, tile.index)
        let view = makeNumber.view(s) as MakeNumberView
        const op = view.ops.find((o) => !o.disabled && o.op !== ')')
        if (op) s = makeNumber.tap(s, op.index)
        view = makeNumber.view(s) as MakeNumberView
        // Incomplete input cannot be judged, and editing spends no tries.
        if (view.submit.disabled) expect(makeNumber.tap(s, view.submit.index)).toBe(s)
        expect(s.triesLeft).toBe(first.tries.total)
        if (!view.undo.disabled) s = makeNumber.tap(s, view.undo.index)
        for (let guard = 0; guard < 100 && !makeNumber.outcome(s); guard++) {
          const next = makeNumber.solution(s)
          expect(next?.length, `L${level}`).toBeGreaterThan(0)
          s = makeNumber.tap(s, next![0])
        }
        expect(makeNumber.outcome(s), `L${level} seed ${seed}`).toMatchObject({ correct: true, mistakes: 0 })
        expect(makeNumber.tap(s, 0)).toBe(s)
      }
    }
  })

  it('no tile can be reused or placed out of order, including equal-valued tiles', () => {
    for (let seed = 1; seed <= 40; seed++) {
      let s = makeNumber.create(10, createRng(seed), DEFAULT_CONTEXT)
      s = makeNumber.tap(s, 0)
      expect(makeNumber.tap(s, 1)).toBe(s)
      const v = makeNumber.view(s) as MakeNumberView
      s = makeNumber.tap(s, v.ops.find((o) => o.op === '+')!.index)
      expect(makeNumber.tap(s, 0)).toBe(s)
      s = makeNumber.tap(s, 1)
      expect(s.input.order === 'any' && s.input.tokens.filter((t) => t.kind === 'num')).toHaveLength(2)
    }
  })

  it('fills fixed slots out of order, changes earlier signs, and undoes just the last edit', () => {
    let s = makeNumber.create(4, createRng(8), DEFAULT_CONTEXT)
    const [a, b, c] = s.tiles
    const initial = viewOf(s)
    const [first, second] = initial.equation.filter((part) => part.control === 'sign')
    const choose = (sign: string) => { s = makeNumber.tap(s, initial.ops.find((o) => o.op === sign)!.index) }
    s = makeNumber.tap(s, second.index)
    choose('×')
    expect(equation(s)).toBe(`${a} □ ${b} × ${c} = ${s.target}`)
    expect(viewOf(s).submit.disabled).toBe(true)
    choose('+')
    expect(equation(s)).toBe(`${a} + ${b} × ${c} = ${s.target}`)
    s = makeNumber.tap(s, first.index)
    choose('−')
    expect(equation(s)).toBe(`${a} − ${b} × ${c} = ${s.target}`)
    expect(viewOf(s).tries.left).toBe(initial.tries.total)
    s = makeNumber.tap(s, initial.undo.index)
    expect(equation(s)).toBe(`${a} + ${b} × ${c} = ${s.target}`)
    s = makeNumber.tap(s, initial.clear.index)
    expect(equation(s)).toBe(`${a} □ ${b} □ ${c} = ${s.target}`)
  })

  it('keeps a sign selected when the preceding number is squared in a free-order bracket group', () => {
    let s = makeNumber.create(13, createRng(8), DEFAULT_CONTEXT)
    const [a, b, c] = s.tiles
    const initial = viewOf(s)
    const sign = (op: string) => initial.ops.find((o) => o.op === op)!.index
    for (const step of [sign('('), 0, sign('+'), 1, sign(')'), sign('×'), 2]) s = makeNumber.tap(s, step)
    expect(equation(s)).toBe(`( ${a} + ${b} ) × ${c} = ${s.target}`)
    expect(viewOf(s).submit.disabled).toBe(false)
    const first = viewOf(s).equation.find((part) => part.control === 'sign')!
    const firstNumber = viewOf(s).equation.find((part) => part.control === 'square')!
    s = makeNumber.tap(s, first.index)
    s = toggleSquare(s, firstNumber.index)
    expect(equation(s)).toBe(`( ${a}² + ${b} ) × ${c} = ${s.target}`)
    expect(viewOf(s).equation.find((part) => part.control === 'sign')?.selected).toBe(true)
    s = makeNumber.tap(s, sign('−'))
    expect(equation(s)).toBe(`( ${a}² − ${b} ) × ${c} = ${s.target}`)
    expect(viewOf(s).submit.disabled).toBe(false)
    s = makeNumber.tap(s, initial.undo.index)
    expect(equation(s)).toBe(`( ${a}² + ${b} ) × ${c} = ${s.target}`)
    s = toggleSquare(s, firstNumber.index)
    expect(equation(s)).toBe(`( ${a} + ${b} ) × ${c} = ${s.target}`)
  })

  it('an answer built through the public buttons retains exact rational values until submission', () => {
    let fractions = 0
    for (let seed = 1; seed <= 80; seed++) {
      let s = makeNumber.create(21, createRng(seed), DEFAULT_CONTEXT)
      for (const tap of makeNumber.solution(s)!.slice(0, -1)) s = makeNumber.tap(s, tap)
      expect(s.input.order === 'any' && evaluate(s.input.tokens)).toEqual({ n: s.target, d: 1 })
      if (s.kind === 'fraction') fractions++
      s = makeNumber.tap(s, (makeNumber.view(s) as MakeNumberView).submit.index)
      expect(makeNumber.outcome(s)?.correct).toBe(true)
    }
    expect(fractions).toBe(80)
  })
})

describe('Make the Number: square operator', () => {
  it('squares a number once, before multiplication and division; it never consumes a second tile', () => {
    const n = (value: number, tile: number) => ({ kind: 'num' as const, value, tile })
    const o = (op: '²' | '+' | '×' | '(' | ')') => ({ kind: 'op' as const, op })
    expect(evaluate([n(2, 0), o('+'), n(3, 1), o('²'), o('×'), n(2, 2)])).toEqual({ n: 20, d: 1 })
    expect(evaluate([n(3, 0), o('²'), o('²')])).toBeNull()
    expect(evaluate([o('('), n(3, 0), o(')'), o('²')])).toBeNull()
    for (let seed = 1; seed <= 30; seed++) {
      let s = makeNumber.create(7, createRng(seed), DEFAULT_CONTEXT)
      expect(s.tiles).toHaveLength(2)
      expect(s.witness.some((t) => t.kind === 'op' && t.op === '²')).toBe(true)
      const square = viewOf(s).equation.find((part) => part.control === 'square')!
      expect(square.selected).toBe(false)
      expect(makeNumber.tap(s, square.index)).toBe(s)
      expect(viewOf(makeNumber.tap(s, viewOf(s).square!.index)).prompt.key).toBe('play.makeSquareHint')
      s = toggleSquare(s, square.index)
      expect(equation(s)).toBe(`${s.tiles[0]}² □ ${s.tiles[1]} = ${s.target}`)
      expect(viewOf(s).equation.find((part) => part.control === 'square')?.selected).toBe(true)
      expect(equation(toggleSquare(s, square.index))).toBe(`${s.tiles[0]} □ ${s.tiles[1]} = ${s.target}`)
      s = makeNumber.tap(s, (makeNumber.view(s) as MakeNumberView).undo.index)
      expect(equation(s)).toBe(`${s.tiles[0]} □ ${s.tiles[1]} = ${s.target}`)
      for (const tap of makeNumber.solution(s)!) s = makeNumber.tap(s, tap)
      expect(makeNumber.outcome(s)?.correct).toBe(true)
    }
  })

  it('changing the sign in a single blank preserves a square on either number', () => {
    let s = makeNumber.create(7, createRng(5), DEFAULT_CONTEXT)
    const [left, right] = s.tiles
    const { ops: choices, equation: parts } = viewOf(s)
    const [squareLeft, squareRight] = parts.filter((part) => part.control === 'square')
    s = toggleSquare(s, squareLeft.index)
    s = makeNumber.tap(s, choices.find((x) => x.op === '+')!.index)
    s = toggleSquare(s, squareRight.index)
    s = makeNumber.tap(s, choices.find((x) => x.op === '×')!.index)
    expect(equation(s)).toBe(`${left}² × ${right}² = ${s.target}`)
    expect(viewOf(s).tries.left).toBe(3)
  })

  it('never offers or requires an unseen blocked square rule', () => {
    for (let level = 7; level <= 21; level++) {
      const s = makeNumber.create(level, createRng(level), { ...DEFAULT_CONTEXT, blockRules: ['makeNumber.square'] })
      expect(viewOf(s).square).toBeUndefined()
      expect(viewOf(s).equation.some((part) => part.control === 'square')).toBe(false)
      expect(s.witness.some((t) => t.kind === 'op' && t.op === '²')).toBe(false)
    }
  })
})


describe('Make the Number: mathematical difficulty', () => {
  it('square introduction targets cannot be solved with the old four operators alone', () => {
    const ops = ['+', '−', '×', '÷'] as const
    for (let level = 7; level <= 9; level++) for (let seed = 1; seed <= 15; seed++) {
      const s = makeNumber.create(level, createRng(seed), DEFAULT_CONTEXT)
      for (let choice = 0; choice < 4 ** (s.tiles.length - 1); choice++) {
        let code = choice
        const expr: MakeToken[] = []
        s.tiles.forEach((value, tile) => {
          if (tile > 0) { expr.push({ kind: 'op', op: ops[code % 4] }); code = Math.floor(code / 4) }
          expr.push({ kind: 'num', value, tile })
        })
        expect(evaluate(expr)).not.toEqual({ n: s.target, d: 1 })
      }
    }
  })

  it('every advanced puzzle still requires an intermediate fraction even when squares are available', () => {
    const puzzles = makeNumberFractionPuzzles(true)
    expect(puzzles.length).toBeGreaterThan(200)
    for (const p of puzzles) {
      let ways = 0, whole = false
      eachTree(p.tiles, { times: true, divide: true, square: true }, (t) => {
        if (t.d === 1 && t.n === p.target) { ways++; if (t.int) whole = true }
      })
      expect(ways).toBeGreaterThan(0)
      expect(whole, `${p.tiles} = ${p.target}`).toBe(false)
    }
  })
})

it('reusing solver results preserves seeded puzzles, tile identities and witnesses', () => {
  for (const level of [11, 12, 14, 15, 16, 21]) {
    const first = makeNumber.create(level, createRng(1234567 + level), DEFAULT_CONTEXT)
    for (let n = 0; n < 5; n++) makeNumber.create(level, createRng(7654321 + n), DEFAULT_CONTEXT)
    const again = makeNumber.create(level, createRng(1234567 + level), DEFAULT_CONTEXT)
    expect(again).toEqual(first)
    let played = again
    for (const tap of makeNumber.solution(played)!) played = makeNumber.tap(played, tap)
    expect(makeNumber.outcome(played)?.correct).toBe(true)
    expect(first.witness).toEqual(again.witness)
  }
})
