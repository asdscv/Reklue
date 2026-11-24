import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { PublicListingPreview } from '../../types/database'
import {
  wordListHeading, wordListIntro, wordListColumns, wordListCta, wordRows, wordListIndexLink,
  wordListLanguageLinks, wordListTermLanguage,
} from '@reklue/shared/lib/listing-seo'
import { OfficialBadge } from '../common/OfficialBadge'
import { useTrackEvent } from '../../hooks/useTrackEvent'

type PageLang = Parameters<typeof wordListHeading>[1]

interface OfficialWordListProps {
  listing: PublicListingPreview
  lang: PageLang
  signedIn: boolean
}

/** Official deck as a word list in the deck's own language — the same rows the crawler HTML shows. */
export function OfficialWordList({ listing, lang, signedIn }: OfficialWordListProps) {
  const trackEvent = useTrackEvent()
  const rows = wordRows(listing)
  const termLang = wordListTermLanguage(listing)
  const languageLinks = wordListLanguageLinks(listing)
  const [termCol, meaningCol, exampleCol] = wordListColumns(lang, listing.category)
  const target = `/marketplace/${listing.id}`
  const studyHref = signedIn ? target : `/auth/login?redirect=${encodeURIComponent(target)}`
  const index = wordListIndexLink(lang)
  const cta = wordListCta(listing, lang)
  const trackStudy = () => trackEvent({ category: 'marketplace', action: 'word_list_study_click', label: listing.id })

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 sm:py-16" lang={lang}>
      <nav className="text-sm mb-4">
        <Link to={index.path} className="text-brand hover:underline" data-testid="word-list-index-link">{index.label}</Link>
      </nav>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3" data-testid="listing-title">
          {wordListHeading(listing, lang)}
        </h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <span>{listing.title}</span>
          {listing.owner_is_official && <OfficialBadge badgeType="official" lang={lang} />}
        </div>
        <p className="text-muted-foreground leading-relaxed">{wordListIntro(listing, lang)}</p>
        {termLang === 'ja' && (
          <Link to={studyHref} onClick={trackStudy} className="inline-flex min-h-11 items-center mt-4 px-4 py-2 rounded-xl bg-brand text-brand-foreground font-semibold hover:bg-brand-hover">
            {cta}
          </Link>
        )}
        {languageLinks.length > 0 && (
          <ul className="flex flex-wrap gap-2 mt-4">
            {languageLinks.map(({ id, lang: locale, label }) => (
              <li key={id}>
                <Link
                  to={`/d/${id}`}
                  hrefLang={locale}
                  lang={locale}
                  className="inline-flex min-h-11 items-center px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:border-brand hover:underline"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border mb-8">
        <table className="w-full text-sm" data-testid="word-list">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-4 py-2.5 font-semibold text-foreground">{termCol}</th>
              <th className="px-4 py-2.5 font-semibold text-foreground">{meaningCol}</th>
              <th className="px-4 py-2.5 font-semibold text-foreground hidden sm:table-cell">{exampleCol}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={`${r.term}-${i}`} className="align-top">
                <td className="px-4 py-2.5 font-semibold text-foreground" lang={termLang}>{r.term}</td>
                <td className="px-4 py-2.5 text-foreground">
                  {r.meaning}
                  {r.example && (
                    <span className="block sm:hidden mt-1 text-xs text-muted-foreground" lang={termLang}>{r.example}</span>
                  )}
                  {termLang === 'ja' && r.exampleNote && (
                    <span className="block sm:hidden mt-0.5 text-xs text-muted-foreground">{r.exampleNote}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">
                  {r.example && <span className="block" lang={termLang}>{r.example}</span>}
                  {r.exampleNote && <span className="block text-xs mt-0.5">{r.exampleNote}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl bg-foreground text-white p-6 sm:p-8 text-center" data-testid="cta-section">
        <Link
          to={studyHref}
          onClick={trackStudy}
          className="inline-flex items-center gap-2 px-6 py-3 bg-brand text-brand-foreground font-semibold rounded-xl hover:bg-brand-hover transition no-underline"
          data-testid="cta-login"
        >
          {cta}
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </main>
  )
}
