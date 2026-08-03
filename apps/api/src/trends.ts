/**
 * Google Trending Now, fetched and normalised.
 *
 * The provider interface is the point of this file: the screen and the cache
 * only know they can ask for a region's trending searches, so the day the
 * official API replaces the RSS export, one class changes and nothing else.
 */

import type { TrendingSearch, TrendNewsItem } from './types.js';

const TRENDING_RSS_URL = 'https://trends.google.com/trending/rss';

/** Raised when the feed is unreachable or answers with something unusable. */
export class TrendsUnavailableError extends Error {
  override readonly name = 'TrendsUnavailableError';
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

export interface TrendProvider {
  /** Highest-ranked first. Rejects rather than returning an empty list. */
  getTrendingNow(region: string): Promise<readonly TrendingSearch[]>;
}

export class GoogleTrendingRssProvider implements TrendProvider {
  readonly #timeoutMs: number;

  constructor(options: { timeoutMs: number }) {
    this.#timeoutMs = options.timeoutMs;
  }

  async getTrendingNow(region: string): Promise<readonly TrendingSearch[]> {
    const url = new URL(TRENDING_RSS_URL);
    url.searchParams.set('geo', region);

    let xml: string;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.#timeoutMs),
        headers: { accept: 'application/rss+xml, application/xml, text/xml' },
      });
      if (!response.ok) {
        throw new TrendsUnavailableError(
          `Google Trends responded ${response.status} ${response.statusText}`,
        );
      }
      xml = await response.text();
    } catch (error) {
      if (error instanceof TrendsUnavailableError) throw error;
      throw new TrendsUnavailableError('Could not reach Google Trends', { cause: error });
    }

    return parseTrendingRss(xml);
  }
}

// --- Parsing --------------------------------------------------------------

/*
 * Hand-rolled rather than pulling an XML library in for one feed, matching how
 * the Open-Meteo payload is validated. The feed is a fixed, flat shape we do
 * not control, so the parser only ever *looks for* the handful of elements it
 * understands and ignores everything else. An unexpected new field is
 * therefore inert rather than fatal.
 *
 * The tag names below cannot collide with the ones nested inside an item:
 * `<ht:news_item_title>` does not contain the substring `<title`, and
 * `<ht:news_item>` does not contain `<item`.
 *
 * The same care applies to the picture and news tags. `\b` after `ht:picture`
 * is what keeps it off `<ht:picture_source>` — an underscore is a word
 * character, so there is no boundary there to match. `<ht:news_item>` is
 * written with its closing angle bracket for the same reason, so it cannot
 * swallow `<ht:news_item_title>`; and its closing tag `</ht:news_item>` is
 * likewise distinct from `</ht:news_item_picture>`, which is what lets the
 * non-greedy body stop in the right place.
 */

const ITEM_RE = /<item\b[^>]*>([\s\S]*?)<\/item>/g;
const TITLE_RE = /<title\b[^>]*>([\s\S]*?)<\/title>/;
const TRAFFIC_RE = /<ht:approx_traffic\b[^>]*>([\s\S]*?)<\/ht:approx_traffic>/;
const PUBDATE_RE = /<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/;
const PICTURE_RE = /<ht:picture\b[^>]*>([\s\S]*?)<\/ht:picture>/;
const PICTURE_SOURCE_RE =
  /<ht:picture_source\b[^>]*>([\s\S]*?)<\/ht:picture_source>/;

const NEWS_ITEM_RE = /<ht:news_item>([\s\S]*?)<\/ht:news_item>/g;
const NEWS_TITLE_RE = /<ht:news_item_title\b[^>]*>([\s\S]*?)<\/ht:news_item_title>/;
const NEWS_SOURCE_RE =
  /<ht:news_item_source\b[^>]*>([\s\S]*?)<\/ht:news_item_source>/;
const NEWS_URL_RE = /<ht:news_item_url\b[^>]*>([\s\S]*?)<\/ht:news_item_url>/;

export function parseTrendingRss(xml: string): readonly TrendingSearch[] {
  const trends: TrendingSearch[] = [];
  const seen = new Set<string>();

  for (const match of xml.matchAll(ITEM_RE)) {
    const item = match[1];
    if (item === undefined) continue;

    const title = text(item, TITLE_RE);
    // A trend with no search term is not a trend. Nothing else is required.
    if (title === undefined || title === '') continue;

    const id = trendKey(title);
    // Two spellings that normalise alike are one trend; the feed lists the
    // stronger one first, so the first occurrence is the one worth keeping.
    if (seen.has(id)) continue;
    seen.add(id);

    trends.push({
      id,
      title,
      ...optional('approximateVolume', text(item, TRAFFIC_RE)),
      ...optional('publishedAt', isoDate(text(item, PUBDATE_RE))),
      /*
       * Empty, always. The feed gives each item a set of `<ht:news_item>`
       * headlines, which are articles about the trend and not other searches
       * people made. Passing those off as related queries would put words on
       * the screen that nobody searched for, so the field stays empty until a
       * source that genuinely carries related searches is wired up.
       */
      relatedQueries: [],
      /*
       * Likewise absent. Every item's `<link>` in this feed is the URL of the
       * feed itself rather than a page about that trend, so there is nothing
       * per-trend to point at.
       */

      /*
       * What the feed *does* carry about the subject matter: a thumbnail and
       * a handful of headlines. Verified against the live export — present on
       * 10/10 items, three headlines each, every one with a source and a URL.
       * `<description>` and `<ht:news_item_snippet>` are empty on every item
       * and every article, so there is no prose here to show and none is made.
       */
      ...optional('imageUrl', httpUrl(text(item, PICTURE_RE))),
      ...optional('imageSource', text(item, PICTURE_SOURCE_RE)),
      news: newsItems(item),
    });
  }

  if (trends.length === 0) {
    throw new TrendsUnavailableError('Google Trends returned no usable items');
  }
  return trends;
}

/**
 * The identity of a trend across fetches: lowercased, trimmed, inner runs of
 * whitespace collapsed.
 *
 * Deliberately conservative. It exists to recognise the *same* search written
 * with different spacing, not to decide that two differently worded searches
 * mean the same thing — that judgement is exactly what this feature does not
 * make.
 */
export function trendKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Every `<ht:news_item>` in one item, in the order the feed lists them.
 *
 * A headline with no text is not an article, so it is dropped rather than
 * rendered as an empty quote; source and URL are each carried only when
 * stated. Nothing here trims the list to a single "best" headline — the feed
 * routinely attaches three unrelated stories to a broad query, and choosing
 * one would assert the trend is about that one.
 */
function newsItems(item: string): TrendNewsItem[] {
  const news: TrendNewsItem[] = [];

  for (const match of item.matchAll(NEWS_ITEM_RE)) {
    const entry = match[1];
    if (entry === undefined) continue;

    const title = text(entry, NEWS_TITLE_RE);
    if (title === undefined) continue;

    news.push({
      title,
      ...optional('source', text(entry, NEWS_SOURCE_RE)),
      ...optional('url', httpUrl(text(entry, NEWS_URL_RE))),
    });
  }
  return news;
}

/**
 * A URL only if it is one, and only over http(s).
 *
 * The image URL ends up in an `src` attribute, so a feed that ever carried
 * something else — a `javascript:` or `data:` value — must not reach the
 * browser. An unparseable URL is treated like any other field the feed did not
 * supply: left out.
 */
function httpUrl(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Inner text of the first matching element, decoded and trimmed. */
function text(xml: string, pattern: RegExp): string | undefined {
  const raw = pattern.exec(xml)?.[1];
  if (raw === undefined) return undefined;
  const value = decodeEntities(raw).trim();
  return value === '' ? undefined : value;
}

/** RFC 822, as RSS uses, to ISO 8601. Undefined if it will not parse. */
function isoDate(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

/**
 * Builds `{ key: value }` or `{}`, because `exactOptionalPropertyTypes` draws a
 * distinction between a field set to undefined and a field that is not there.
 */
function optional<K extends string>(
  key: K,
  value: string | undefined,
): Record<K, string> | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, string>);
}

function decodeEntities(text: string): string {
  return (
    text
      // CDATA first: it wraps the entities rather than the other way round.
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
        codePoint(Number.parseInt(hex, 16)),
      )
      .replace(/&#(\d+);/g, (_, digits: string) =>
        codePoint(Number.parseInt(digits, 10)),
      )
      // Last, so that an escaped entity like "&amp;lt;" survives as "&lt;".
      .replace(/&amp;/g, '&')
  );
}

function codePoint(value: number): string {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff
    ? String.fromCodePoint(value)
    : '';
}
