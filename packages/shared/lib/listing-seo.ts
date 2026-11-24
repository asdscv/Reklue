// Official deck pages as word-list pages: title, description, hreflang cluster and word rows.
//
// Shared by the crawler HTML (Worker) and the web page so both show the same content — a page
// that shows crawlers more than people would be cloaking. An official deck page is written in
// the deck's own language (its meanings are in that language), not in the visitor's UI language.

import { DECK_NATIVE_LANGUAGES, teachesJapanese } from './official-deck-family'
import {
  LANGUAGE_NATIVE_NAME, VOCAB_INDEX_PATH, VOCAB_LANGUAGE_INDEX,
  vocabHubForDeck, vocabHubPath, vocabLanguageIndexPath,
} from './vocab-hubs'

export interface ListingSeoInput {
  id: string
  title: string
  category: string
  card_count: number
  tags: string[]
  owner_is_official: boolean
  native_language?: string | null
  siblings?: { id: string; native_language: string }[] | null
  sample_fields: { field_values: Record<string, string> }[]
}

export interface WordRow {
  term: string
  meaning: string
  example: string
  exampleNote: string
}

type IndexLang = (typeof DECK_NATIVE_LANGUAGES)[number]
type Lang = IndexLang | 'en'

const EXAMS = ['toeic', 'ielts', 'toefl'] as const
type Exam = (typeof EXAMS)[number]

const EXAM_NAME: Record<Lang, Record<Exam, string>> = {
  en: { toeic: 'TOEIC', ielts: 'IELTS', toefl: 'TOEFL' },
  ko: { toeic: '토익', ielts: '아이엘츠', toefl: '토플' },
  ja: { toeic: 'TOEIC', ielts: 'IELTS', toefl: 'TOEFL' },
  zh: { toeic: '托业', ielts: '雅思', toefl: '托福' },
  vi: { toeic: 'TOEIC', ielts: 'IELTS', toefl: 'TOEFL' },
  th: { toeic: 'TOEIC', ielts: 'IELTS', toefl: 'TOEFL' },
  id: { toeic: 'TOEIC', ielts: 'IELTS', toefl: 'TOEFL' },
  es: { toeic: 'TOEIC', ielts: 'IELTS', toefl: 'TOEFL' },
}

const LEVEL_UNIT: Partial<Record<Lang, Partial<Record<Exam, string>>>> = {
  ko: { toeic: '점', toefl: '점' },
  ja: { toeic: '点', toefl: '点' },
  zh: { toeic: '分', toefl: '分', ielts: '分' },
}

interface Copy {
  examTitle: (exam: string, level: string, count: string) => string
  title: (deckTitle: string, count: string) => string
  description: (heading: string, shown: string) => string
  intro: (count: string, shown: string) => string
  columns: [string, string, string]
  cta: (rest: string) => string
  /** Conversation decks (Korean only today): expressions, not words. */
  phraseTitle?: (theme: string, count: string) => string
  phraseColumns?: [string, string, string]
}

const COPY: Record<Lang, Copy> = {
  en: {
    examTitle: (e, l, c) => `${e} ${l} vocabulary — ${c} words with meanings and examples`,
    title: (t, c) => `${t}: ${c} words with readings and examples`,
    description: (h, s) => `${h}. Preview ${s} words from the deck with meanings and examples, then study with spaced repetition for free.`,
    intro: (c, s) => `Preview ${s} of the ${c} words with readings, meanings and examples. Study the full deck for free with spaced repetition.`,
    columns: ['Word', 'Meaning', 'Example'],
    cta: (r) => `Study the remaining ${r} words with spaced repetition`,
  },
  ko: {
    examTitle: (e, l, c) => `${e} ${l} 단어 ${c}개 — 뜻·예문`,
    title: (t, c) => `${t}: 단어 ${c}개·뜻·예문`,
    phraseTitle: (th, c) => `${th} 영어 회화 표현 ${c}개 — 뜻·상황별 예시`,
    phraseColumns: ['영어 표현', '뜻', '다른 표현 · 상황'],
    description: (h, s) => `${h}. 덱 전체에서 고른 ${s}개 단어를 뜻과 예문으로 미리 보고, 무료로 간격 반복 학습을 시작하세요.`,
    intro: (c, s) => `전체 ${c}개 중 ${s}개를 덱 전체에서 고르게 뽑아 보여 드립니다. 나머지는 간격 반복으로, 잊어버리기 직전에 다시 보며 외울 수 있습니다.`,
    columns: ['단어', '뜻', '예문'],
    cta: (r) => `나머지 ${r}개는 간격 반복으로 학습하기`,
  },
  ja: {
    examTitle: (e, l, c) => `${e} ${l} 英単語${c}語 — 意味・例文`,
    title: (t, c) => `${t}：${c}語・意味・例文`,
    description: (h, s) => `${h}。デッキ全体から選んだ${s}語を意味と例文で確認し、無料で間隔反復学習を始めましょう。`,
    intro: (c, s) => `全${c}語のうち、デッキ全体から均等に選んだ${s}語を掲載しています。残りは間隔反復で、忘れる直前に復習しながら覚えられます。`,
    columns: ['単語', '意味', '例文'],
    cta: (r) => `残り${r}語を間隔反復で学習する`,
  },
  zh: {
    examTitle: (e, l, c) => `${e}${l}词汇${c}个 — 释义与例句`,
    title: (t, c) => `${t}：${c}个词汇·释义·例句`,
    description: (h, s) => `${h}。先浏览从整套牌组中挑选的${s}个单词及其释义和例句，然后免费开始间隔重复学习。`,
    intro: (c, s) => `从全部${c}个中均匀挑选了${s}个展示。其余的可以用间隔重复，在快要忘记之前复习并记住。`,
    columns: ['单词', '释义', '例句'],
    cta: (r) => `用间隔重复学习剩下的${r}个`,
  },
  vi: {
    examTitle: (e, l, c) => `Từ vựng ${e} ${l} — ${c} từ kèm nghĩa và ví dụ`,
    title: (t, c) => `${t}: ${c} từ, nghĩa và ví dụ`,
    description: (h, s) => `${h}. Xem trước ${s} từ được chọn từ toàn bộ bộ thẻ, kèm nghĩa và ví dụ, rồi bắt đầu học lặp lại ngắt quãng miễn phí.`,
    intro: (c, s) => `Trong tổng số ${c} từ, đây là ${s} từ được chọn đều từ toàn bộ bộ thẻ. Phần còn lại bạn có thể ghi nhớ bằng lặp lại ngắt quãng, ôn lại ngay trước khi quên.`,
    columns: ['Từ', 'Nghĩa', 'Ví dụ'],
    cta: (r) => `Học ${r} từ còn lại bằng lặp lại ngắt quãng`,
  },
  th: {
    examTitle: (e, l, c) => `คำศัพท์ ${e} ${l} — ${c} คำ พร้อมความหมายและตัวอย่าง`,
    title: (t, c) => `${t}: ${c} คำ พร้อมความหมายและตัวอย่าง`,
    description: (h, s) => `${h} ดูตัวอย่าง ${s} คำที่คัดมาจากทั้งชุด พร้อมความหมายและประโยคตัวอย่าง แล้วเริ่มเรียนแบบทบทวนเว้นระยะได้ฟรี`,
    intro: (c, s) => `จากทั้งหมด ${c} คำ นี่คือ ${s} คำที่คัดมาอย่างทั่วถึงจากทั้งชุด ส่วนที่เหลือจำได้ด้วยการทบทวนแบบเว้นระยะ ก่อนที่คุณจะลืม`,
    columns: ['คำศัพท์', 'ความหมาย', 'ตัวอย่าง'],
    cta: (r) => `เรียนอีก ${r} คำที่เหลือด้วยการทบทวนแบบเว้นระยะ`,
  },
  id: {
    examTitle: (e, l, c) => `Kosakata ${e} ${l} — ${c} kata dengan arti dan contoh`,
    title: (t, c) => `${t}: ${c} kata, arti dan contoh`,
    description: (h, s) => `${h}. Lihat ${s} kata pilihan dari seluruh dek beserta arti dan contohnya, lalu mulai belajar dengan pengulangan berjarak secara gratis.`,
    intro: (c, s) => `Dari total ${c} kata, berikut ${s} kata yang dipilih merata dari seluruh dek. Sisanya bisa kamu hafalkan dengan pengulangan berjarak, tepat sebelum kamu lupa.`,
    columns: ['Kata', 'Arti', 'Contoh'],
    cta: (r) => `Pelajari ${r} kata lainnya dengan pengulangan berjarak`,
  },
  es: {
    examTitle: (e, l, c) => `Vocabulario ${e} ${l} — ${c} palabras con significado y ejemplos`,
    title: (t, c) => `${t}: ${c} palabras, significados y ejemplos`,
    description: (h, s) => `${h}. Consulta ${s} palabras elegidas de todo el mazo con su significado y ejemplos, y empieza gratis a estudiar con repetición espaciada.`,
    intro: (c, s) => `De un total de ${c} palabras, aquí tienes ${s} elegidas de forma uniforme de todo el mazo. El resto puedes memorizarlo con repetición espaciada, justo antes de olvidarlo.`,
    columns: ['Palabra', 'Significado', 'Ejemplo'],
    cta: (r) => `Estudia las ${r} palabras restantes con repetición espaciada`,
  },
}

function isIndexLang(value: string | null | undefined): value is IndexLang {
  return !!value && (DECK_NATIVE_LANGUAGES as readonly string[]).includes(value)
}

/** The language an official deck page is written in, or null for pages that keep the old layout. */
export function wordListPageLanguage(listing: Pick<ListingSeoInput, 'owner_is_official' | 'native_language' | 'tags'>): Lang | null {
  if (!listing.owner_is_official) return null
  if (listing.native_language === 'en' && teachesJapanese(listing.tags)) return 'en'
  return isIndexLang(listing.native_language) ? listing.native_language : null
}

// 'always': Spanish would otherwise print 1500 — every count on the site carries a separator.
// (The string form is ES2023 Intl; the web build's lib typings still declare useGrouping boolean.)
const GROUP_ALWAYS = { useGrouping: 'always' } as unknown as Intl.NumberFormatOptions

function fmt(n: number, lang: Lang): string {
  return new Intl.NumberFormat(lang, GROUP_ALWAYS).format(n)
}

function levelOf(tags: string[]): string | null {
  const t = tags.find((x) => x.startsWith('level:'))
  return t ? t.slice('level:'.length) : null
}

// «(영어 → 한국어)» / «（英語 → 日本語）» — kept so a deck and its reverse never share a title.
const DIRECTION = /\s*[(（]([^()（）]*→[^()（）]*)[)）]\s*$/

function directionSuffix(title: string): string {
  const m = title.match(DIRECTION)
  return m ? ` (${m[1].trim()})` : ''
}

/** The page heading: the search phrase people actually type, e.g. «토익 800점 단어 1,500개 — 뜻·예문». */
export function wordListHeading(listing: ListingSeoInput, lang: Lang): string {
  const count = fmt(listing.card_count, lang)
  const level = levelOf(listing.tags)
  const exam = (EXAMS as readonly string[]).includes(listing.category) ? (listing.category as Exam) : null
  if (exam && level) {
    const unit = LEVEL_UNIT[lang]?.[exam] ?? ''
    return COPY[lang].examTitle(EXAM_NAME[lang][exam], `${level}${unit}`, count) + directionSuffix(listing.title)
  }
  if (listing.category === 'conversation' && level && COPY[lang].phraseTitle) {
    return COPY[lang].phraseTitle!(level, count) + directionSuffix(listing.title)
  }
  const base = listing.title.replace(DIRECTION, '')
  return COPY[lang].title(base, count) + directionSuffix(listing.title)
}

export function wordListDescription(listing: ListingSeoInput, lang: Lang): string {
  return COPY[lang].description(wordListHeading(listing, lang), fmt(listing.sample_fields.length, lang))
}

export function wordListIntro(listing: ListingSeoInput, lang: Lang): string {
  return COPY[lang].intro(fmt(listing.card_count, lang), fmt(listing.sample_fields.length, lang))
}

export function wordListColumns(lang: Lang, category?: string): [string, string, string] {
  return (category === 'conversation' && COPY[lang].phraseColumns) || COPY[lang].columns
}

export function wordListCta(listing: ListingSeoInput, lang: Lang): string {
  if (teachesJapanese(listing.tags)) return FULL_DECK_CTA[lang](fmt(listing.card_count, lang))
  return COPY[lang].cta(fmt(Math.max(0, listing.card_count - listing.sample_fields.length), lang))
}

const FULL_DECK_CTA: Record<Lang, (count: string) => string> = {
  en: (c) => `Study all ${c} cards for free`,
  ko: (c) => `${c}장 모두 무료로 학습하기`,
  ja: (c) => `全${c}枚を無料で学習する`,
  zh: (c) => `免费学习全部 ${c} 张卡片`,
  es: (c) => `Estudia las ${c} tarjetas gratis`,
  vi: (c) => `Học miễn phí cả ${c} thẻ`,
  th: (c) => `เรียนฟรีทั้ง ${c} การ์ด`,
  id: (c) => `Pelajari semua ${c} kartu secara gratis`,
}

function siblingLinks(listing: ListingSeoInput) {
  const japanese = teachesJapanese(listing.tags)
  return (listing.siblings ?? []).flatMap(({ id, native_language: lang }) => {
    if (lang === listing.native_language) return []
    if (lang === 'en' && japanese) return [{ id, lang, label: 'English' }]
    return isIndexLang(lang) ? [{ id, lang, label: LANGUAGE_NATIVE_NAME[lang] }] : []
  })
}

export function wordListLanguageLinks(listing: ListingSeoInput) {
  return teachesJapanese(listing.tags) ? siblingLinks(listing) : []
}

/**
 * hreflang: this deck plus the same exam level in every other native language, and — for
 * «English → X» exam decks — the English hub as both `en` and `x-default`.
 */
export function wordListHreflang(listing: ListingSeoInput, siteUrl: string): { lang: string; href: string }[] {
  const lang = wordListPageLanguage(listing)
  const self = lang ? [{ lang, href: `${siteUrl}/d/${listing.id}` }] : []
  const others = siblingLinks(listing).map((s) => ({ lang: s.lang, href: `${siteUrl}/d/${s.id}` }))
  const hub = vocabHubForDeck(listing.category, listing.tags)
  const english = hub
    ? [{ lang: 'en', href: `${siteUrl}${vocabHubPath(hub)}` }, { lang: 'x-default', href: `${siteUrl}${vocabHubPath(hub)}` }]
    : []
  return [...self, ...others, ...english]
}

/** The link from a deck page back to every official word list in its language. */
export function wordListIndexLink(lang: Lang): { path: string; label: string } {
  if (lang === 'en') return { path: VOCAB_INDEX_PATH, label: 'All vocabulary lists' }
  return { path: vocabLanguageIndexPath(lang), label: VOCAB_LANGUAGE_INDEX[lang].backToIndex }
}

export function wordListTermLanguage(listing: Pick<ListingSeoInput, 'tags'>): 'en' | 'ja' {
  return teachesJapanese(listing.tags) ? 'ja' : 'en'
}

// Some imported decks wrap whole example sentences in quotes ("Air quality tends to…").
function unquote(text: string): string {
  const m = text.match(/^["“「](.*)["”」]$/s)
  return m ? m[1].trim() : text
}

/**
 * Put the language being learned in the term column. Japanese vocabulary
 * includes kana when the written term differs from its reading.
 */
export function wordRows(listing: Pick<ListingSeoInput, 'tags' | 'sample_fields'>): WordRow[] {
  const japanese = teachesJapanese(listing.tags)
  const englishOnBack = !japanese && listing.tags.includes('target:en') && !listing.tags.includes('source:en')
  return listing.sample_fields.map(({ field_values: f }) => {
    const v = (k: string) => (typeof f?.[k] === 'string' ? unquote(f[k].trim()) : '')
    if (v('kind') === 'phrase' || (!v('example_front') && (v('situation') || v('alt')))) {
      return {
        term: englishOnBack ? v('back') : v('front'),
        meaning: englishOnBack ? v('front') : v('back'),
        example: v('alt'),
        exampleNote: v('situation'),
      }
    }
    const front = v('front')
    const reading = japanese ? v('reading') : ''
    const term = front && reading && reading !== front ? `${front}（${reading}）` : front
    return englishOnBack
      ? { term: v('back'), meaning: v('front'), example: v('example_back'), exampleNote: v('example_front') }
      : { term, meaning: v('back'), example: v('example_front'), exampleNote: v('example_back') }
  }).filter((r) => r.term && r.meaning)
}
