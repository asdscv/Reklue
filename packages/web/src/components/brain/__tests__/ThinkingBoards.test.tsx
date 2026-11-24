import { useEffect, useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { brainGame, createRng, DEFAULT_CONTEXT, GAME_THEMES, type BrainGameId, type MazeView } from '@reklue/shared/lib/brain-games'
import { makeNumber } from '@reklue/shared/lib/brain-games/games/make-number'
import { mazeDragCells } from '@reklue/shared/lib/brain-games/maze-drag'
import { BrainBoard } from '../BrainBoard'

for (const [id, level] of [['setMatch', 1], ['codeBreak', 1], ['makeNumber', 1], ['makeNumber', 7], ['makeNumber', 14], ['mazeRun', 1], ['cardRecall', 14]] as const) {
  it(`${id} L${level}: the real board's buttons finish a generated puzzle`, () => {
    const def = brainGame(id).def
    let state = def.create(level, createRng(6), DEFAULT_CONTEXT)
    if (def.pendingMs(state) !== null) state = def.advance(state)
    function Player() {
      const [s, setS] = useState(state)
      useEffect(() => { state = s }, [s])
      return <BrainBoard view={def.view(s)} onTap={(i) => setS((old: unknown) => def.tap(old, i))} width={358} theme={GAME_THEMES[id]} />
    }
    const { container } = render(<Player />)
    for (let guard = 0; guard < 200 && !def.outcome(state); guard++) {
      const at = def.solution(state)![0]
      const target = container.querySelector<HTMLButtonElement>(`[data-tap="${at}"]`)
      expect(target).not.toBeNull()
      expect(target).not.toBeDisabled()
      fireEvent.click(target!, id === 'mazeRun' ? { detail: 0 } : {})
    }
    expect(def.outcome(state)).toMatchObject({ correct: true })
  })
}

it('fills one blank in place and lets the player change signs before confirming', () => {
  function Player() {
    const [state, setState] = useState(() => makeNumber.create(5, createRng(8), DEFAULT_CONTEXT))
    return <BrainBoard view={makeNumber.view(state)} onTap={(index) => setState((old) => makeNumber.tap(old, index))} width={358} theme={GAME_THEMES.makeNumber} />
  }
  render(<Player />)
  const equation = screen.getByTestId('brain-make-number').querySelector('[aria-live="polite"]')
  const confirm = screen.getByRole('button', { name: 'play.submit' })
  const plus = screen.getByRole('button', { name: '+' })
  const divide = screen.getByRole('button', { name: '÷' })

  expect(equation).toHaveTextContent('8 □ 4 = 2')
  expect(confirm).toBeDisabled()
  fireEvent.click(plus)
  expect(equation).toHaveTextContent('8 + 4 = 2')
  expect(plus).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('status')).toBeNull()
  expect(confirm).toBeEnabled()

  fireEvent.click(divide)
  expect(equation).toHaveTextContent('8 ÷ 4 = 2')
  expect(divide).toHaveAttribute('aria-pressed', 'true')
  expect(plus).toHaveAttribute('aria-pressed', 'false')
  const undo = screen.getByRole('button', { name: 'play.undo' })
  fireEvent.click(undo)
  expect(equation).toHaveTextContent('8 + 4 = 2')
  expect(confirm).toBeEnabled()
  fireEvent.click(undo)
  expect(equation).toHaveTextContent('8 □ 4 = 2')
  expect(confirm).toBeDisabled()
})

it('selects an earlier on-screen slot and changes just that operator', () => {
  function Player() {
    const [state, setState] = useState(() => makeNumber.create(4, createRng(8), DEFAULT_CONTEXT))
    return <BrainBoard view={makeNumber.view(state)} onTap={(index) => setState((old) => makeNumber.tap(old, index))} width={320} theme={GAME_THEMES.makeNumber} />
  }
  render(<Player />)
  const [first, second] = within(screen.getByTestId('brain-make-equation')).getAllByRole('button')
  expect(first).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: '+' }))
  expect(second).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: '×' }))
  fireEvent.click(first)
  expect(first).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: '−' }))
  expect(first).toHaveTextContent('−')
  expect(second).toHaveTextContent('×')
  expect(screen.queryByRole('status')).toBeNull()
})

it('asks which number to square after the Square button is pressed', () => {
  function Player() {
    const [state, setState] = useState(() => makeNumber.create(7, createRng(588), DEFAULT_CONTEXT))
    return <BrainBoard view={makeNumber.view(state)} onTap={(index) => setState((old) => makeNumber.tap(old, index))} width={320} theme={GAME_THEMES.makeNumber} />
  }
  render(<Player />)
  const equation = screen.getByTestId('brain-make-equation')
  const expression = equation.querySelector('[aria-live="polite"]')
  const [six, eight] = within(equation).getAllByRole('button', { name: 'play.makeSquare' })
  const confirm = screen.getByRole('button', { name: 'play.submit' })
  const square = screen.getByRole('button', { name: 'play.makeSquareButton' })

  expect(expression).toHaveTextContent('6 □ 8 = 70')
  expect(six).toBeDisabled()
  expect(eight).toBeDisabled()
  fireEvent.click(square)
  expect(square).toHaveAttribute('aria-pressed', 'true')
  expect(eight).toBeEnabled()
  fireEvent.click(eight)
  expect(expression).toHaveTextContent('6 □ 8² = 70')
  expect(eight).toHaveAttribute('aria-pressed', 'true')
  expect(eight).toBeDisabled()
  expect(confirm).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: '+' }))
  expect(expression).toHaveTextContent('6 + 8² = 70')
  expect(screen.queryByRole('status')).toBeNull()
  fireEvent.click(square)
  fireEvent.click(eight)
  expect(expression).toHaveTextContent('6 + 8 = 70')
  fireEvent.click(screen.getByRole('button', { name: 'play.undo' }))
  expect(expression).toHaveTextContent('6 + 8² = 70')
  fireEvent.click(confirm)
  expect(confirm).toBeDisabled()
  expect(eight).toBeDisabled()
})

describe('maze drag', () => {
  it('crosses every cell on fast straight and diagonal strokes; never skips to a non-neighbour', () => {
    expect(mazeDragCells({ x: 0.5, y: 0.5 }, { x: 4.5, y: 0.5 }, 5, 5)).toEqual([1, 2, 3, 4])
    for (const to of [{ x: 4.5, y: 4.5 }, { x: -100, y: 4.5 }, { x: 100, y: -100 }]) {
      let previous = 12
      for (const i of mazeDragCells({ x: 2.5, y: 2.5 }, to, 5, 5)) {
        expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThan(25)
        expect(Math.abs(i % 5 - previous % 5) + Math.abs(Math.floor(i / 5) - Math.floor(previous / 5))).toBe(1)
        previous = i
      }
    }
  })

  it('pointer dragging follows the real maze, backtracks, and cancels cleanly', () => {
    class Pointer extends MouseEvent {
      pointerId: number
      constructor(type: string, props: PointerEventInit = {}) { super(type, props); this.pointerId = props.pointerId ?? 1 }
    }
    vi.stubGlobal('PointerEvent', Pointer)
    try {
      const id: BrainGameId = 'mazeRun', def = brainGame(id).def
      let state = def.create(1.01, createRng(6), DEFAULT_CONTEXT)
      function Player() {
        const [s, setS] = useState(state)
        useEffect(() => { state = s }, [s])
        return <BrainBoard view={def.view(s)} onTap={(i) => setS((old: unknown) => def.tap(old, i))} width={320} maxHeight={400} theme={GAME_THEMES[id]} />
      }
      render(<Player />)
      const board = screen.getByRole('group')
      const view = def.view(state) as MazeView
      const cell = Number.parseInt(board.style.width) / view.cols
      vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: cell * view.cols, height: cell * view.rows, right: cell * view.cols, bottom: cell * view.rows, x: 0, y: 0, toJSON: () => ({}) })
      const at = (i: number) => ({ clientX: (i % view.cols + 0.5) * cell, clientY: (Math.floor(i / view.cols) + 0.5) * cell, pointerId: 1, button: 0 })
      const steps = def.solution(state)!
      fireEvent.pointerDown(board, at(view.start))
      fireEvent.pointerMove(board, at(steps[0]))
      fireEvent.pointerMove(board, at(view.start))
      expect((def.view(state) as MazeView).path).toEqual([view.start])
      fireEvent.pointerCancel(board)
      fireEvent.pointerMove(board, at(steps[0]))
      expect((def.view(state) as MazeView).path).toEqual([view.start])
      fireEvent.pointerDown(board, at(view.start))
      for (const step of steps) fireEvent.pointerMove(board, at(step))
      fireEvent.pointerUp(board)
      expect(def.outcome(state)).toMatchObject({ correct: true })
    } finally { vi.unstubAllGlobals() }
  })
})
