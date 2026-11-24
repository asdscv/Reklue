import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import i18n from 'i18next'
import { emptyProgress } from '@reklue/shared/lib/brain-games'
import { useBrainStore } from '@reklue/shared/stores/brain-store'
import brain from '../../../../public/locales/en/brain.json'
import { BrainHomePage } from '../../../pages/brain/BrainHomePage'
import { BrainTrainingPage } from '../../../pages/brain/BrainTrainingPage'

vi.mock('../useBrainHydrated', () => ({ useBrainHydrated: () => true }))

function visibleGames() {
  const list = screen.getByRole('list', { name: brain.training.lineup })
  return within(list).getAllByRole('listitem').map((item) =>
    Object.values(brain.games).find(({ name }) => within(item).queryByText(name))?.name,
  )
}

afterEach(() => {
  cleanup()
  useBrainStore.getState().resetForSignOut()
  vi.restoreAllMocks()
})

describe('shuffling Today’s Training', () => {
  it.each([5, 20] as const)('plays the displayed %i-minute line-up after reshuffling from either screen', (sessionMinutes) => {
    i18n.addResourceBundle('en', 'brain', brain)
    const progress = emptyProgress()
    progress.settings.sessionMinutes = sessionMinutes
    useBrainStore.setState({ progress })
    // The planner must offer a different game even when the same random seed is drawn twice.
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-11-24T10:00:00').getTime())
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(
      <MemoryRouter initialEntries={['/brain']}>
        <Routes>
          <Route path="/brain" element={<BrainHomePage />} />
          <Route path="/brain/training" element={<BrainTrainingPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const original = visibleGames()
    fireEvent.click(screen.getByRole('button', { name: brain.training.shuffle }))
    const homeShuffle = visibleGames()
    expect(homeShuffle.some((game) => !original.includes(game))).toBe(true)
    fireEvent.click(screen.getByRole('link', { name: brain.training.start }))
    expect(visibleGames()).toEqual(homeShuffle)

    fireEvent.click(screen.getByRole('button', { name: brain.training.shuffle }))
    const chosen = visibleGames()
    expect(chosen.some((game) => !homeShuffle.includes(game))).toBe(true)
    expect(screen.getByText(`${chosen.length} games · about ${sessionMinutes} min`)).toBeInTheDocument()
    expect(useBrainStore.getState().progress).toBe(progress)

    fireEvent.click(screen.getByRole('button', { name: brain.training.start }))
    const intro = within(screen.getByTestId('brain-intro'))
    expect(intro.getByRole('heading', { name: chosen[0], level: 1 })).toBeInTheDocument()
    const steps = intro.getByRole('list', { name: brain.training.title })
    expect(within(steps).getAllByRole('listitem').map((step) => step.getAttribute('aria-label'))).toEqual(chosen)
    expect(screen.queryByRole('button', { name: brain.training.shuffle })).toBeNull()
  })
})
