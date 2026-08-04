/**
 * What a trending search is *about*, inferred rather than reported.
 *
 * Everything else on the Search Pulse screen traces back to something Google
 * stated or to arithmetic over rows this Pi wrote. This file is the one
 * exception, and it is deliberate: 73% of trend titles are three words or fewer
 * and most of the rest are bare personal names — `casey mize`, `alex hoppe`,
 * `rafael jodar` — which no local rule can place. The headlines are what make
 * them answerable, and a model is what reads them.
 *
 * Two rules follow from that and are load-bearing:
 *
 *  - **The category is ours, not Google's.** It never joins the figures on a
 *    row as though it were another reported value; the badge design says so
 *    visually and the API contract says so in its comments.
 *  - **Nothing the model writes reaches the screen as prose.** It returns one
 *    value from a closed set, or nothing. Headlines still go to the panel
 *    quoted verbatim with their outlet named, exactly as before.
 *
 * Failure here must never cost the screen its list. This module signals
 * failure by throwing a typed error and by simply omitting trends it could not
 * settle; the caller logs and carries on. A trend left out stays uncategorised
 * and is retried on the next fetch, which is why there is no queue and no
 * retry schedule — "uncategorised" is already the retry list.
 */

import type { TrendingSearch } from './types.js';

/**
 * The closed set. Eleven, plus an honest way out.
 *
 * Not fewer, because the measured distribution collapses: sport is already the
 * largest bucket before the athlete names in the unmatched half are resolved,
 * and a badge that is the same on half the list has stopped discriminating.
 *
 * `ai` and `conflict` were added 2026-08-04 at the user's request, and they are
 * the only two of eleven candidates that earned it. Measured over 539 stored
 * trends *including their headlines*: conflict 2.4%, ai 2.2%, and then a long
 * tail — animals 1.9%, royalty 1.3%, lottery 1.3%, space 1.3%, education 1.1%,
 * gaming 1.1%, food 0.9%, aviation 0.9%, religion 0.2%. Those were folded into
 * the existing categories rather than given their own, because a badge seen
 * twice a week is a glyph nobody learns and a boundary paid for on every call.
 *
 * `ai` also does something the others do not: it *dissolves* an observed
 * boundary rather than creating one. The live check had `apac` categorised
 * `business` by one configuration and `tech` by another, precisely because AI
 * stories are genuinely both.
 *
 * Splitting `ai` further — into AI-tech and AI-finance, as first suggested —
 * was rejected: at 2.2% between them each half is around 1%, and the split
 * rebuilds the exact tech/business boundary inside AI that the single category
 * exists to remove.
 *
 * Eleven is near the ceiling. The limit is legible silhouettes at 8x8 and a
 * small model holding the boundaries steady, and both are now doing real work.
 *
 * `weather` covers routine lookups (`atlanta weather`) and events (`oregon
 * fires`, `flash flood warning`) alike. Splitting them was considered and
 * rejected: it would make the model rule on "is an air quality warning weather
 * or a disaster?" on every single call, which is exactly where a cheap model
 * drifts.
 *
 * The order here is the order the model sees. It is not meaningful.
 */
export const TREND_CATEGORIES = [
  'sport',
  'politics',
  'conflict',
  'business',
  'entertainment',
  'tech',
  'ai',
  'health',
  'weather',
  'crime',
  'obituary',
  'uncategorised',
] as const;

export type TrendCategory = (typeof TREND_CATEGORIES)[number];

/**
 * `uncategorised` is a real answer, not a failure code.
 *
 * It is stored like any other value and never retried, which is what keeps a
 * badge from flickering. The cost is that a genuinely ambiguous trend stays
 * blank for good; that is the intended trade and not a bug to fix later.
 */
export const UNCATEGORISED: TrendCategory = 'uncategorised';

/** Short glosses, sent to the model. Boundaries, not marketing copy. */
const CATEGORY_GUIDE: Readonly<Record<TrendCategory, string>> = {
  sport: 'athletes, teams, fixtures, results, transfers, leagues',
  politics: 'government, elections, policy, legislation, diplomacy',
  conflict: 'war, armed forces, missile and air strikes, hostilities, militaries',
  business: 'markets, tickers, companies, money, jobs, prices, lotteries',
  entertainment: 'film, TV, music, celebrity, royalty, video games as culture',
  tech: 'devices, software, science, space, outages, data breaches',
  /*
   * The tight definition is the whole point of this one, and it is the
   * difference between a useful badge and one that swallows `business`.
   *
   * Roughly half of the market moves on AI demand now, so "mentions AI" would
   * put this badge on every chip and cloud stock on the feed. The user's call,
   * 2026-08-04: it applies when the *story* is about artificial intelligence,
   * not when a share price happened to move because of it.
   */
  ai: 'artificial intelligence itself: models, capabilities, AI companies, AI policy. NOT a company whose share price moved on AI demand — that is business',
  health: 'disease, outbreaks, medicine, food and product recalls',
  weather: 'forecasts and lookups, storms, fires, floods, quakes, air quality',
  crime: 'crimes, trials, investigations, missing persons',
  obituary: 'someone has died — whoever they were and however it happened',
  uncategorised: 'the headlines do not settle it — prefer this over guessing',
};

/**
 * How overlap is resolved, in order. First match wins.
 *
 * This is the part that stops a taxonomy drifting, and it is worth more than
 * another category. A live batch produced three trends belonging to two
 * categories each — an Asian AI-investment story (business or tech), a
 * money-laundering review of a company's bank accounts (business, crime or
 * politics), and a dead jockey (sport or obituary). None of those has a
 * *correct* answer, so the only thing that can be wrong is answering
 * differently on Tuesday than on Monday.
 *
 * Adding a category for each overlap would make this worse, not better: every
 * new bucket brings its own two new borders. A stated precedence costs no
 * badge, no glyph and no row space, and it is the mechanism real taxonomies
 * use.
 *
 * `obituary` sits at the top because a death is the event; what the person did
 * for a living is the context, not the news.
 */
const PRECEDENCE: readonly TrendCategory[] = [
  'obituary',
  'crime',
  'conflict',
  'weather',
  'health',
  'ai',
  'politics',
  'sport',
  'entertainment',
  'tech',
  'business',
];

/** Raised when the upstream call failed outright. Partial answers do not raise. */
export class CategoriserUnavailableError extends Error {
  override readonly name = 'CategoriserUnavailableError';
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * How many headlines are sent per trend.
 *
 * The feed carries three. All three go, because which one a trend is "really"
 * about is precisely the judgement being delegated — a broad query like
 * `artificial intelligence news` comes back with three unrelated stories, and
 * sending only the first would assert the trend was about the first when it is
 * about all three. That is the same reason the trend card shows all three.
 */
const HEADLINES_PER_TREND = 3;

/**
 * Longest headline sent, in characters.
 *
 * Headlines measured at 226 bytes for all three joined, so this clips almost
 * nothing. It exists so one pathological item cannot inflate a request.
 */
const MAX_HEADLINE_CHARS = 200;

export interface CategoriserOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs: number;
  /**
   * How hard the model is allowed to think before answering.
   *
   * This is the single biggest lever on what this feature costs, and it was
   * discovered the hard way: the first real call spent 1,101 input tokens and
   * **2,222 output tokens** on ten trends. The GPT-5 family are reasoning
   * models and reasoning is billed as output, so 94% of the bill was thinking
   * about a nine-way label whose evidence was already in the prompt.
   *
   * Omitted entirely when undefined, so a non-reasoning model is unaffected.
   */
  readonly reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
}

/**
 * The result of one batch: only the trends actually settled.
 *
 * A trend missing from the map was not answered, or was answered in a way that
 * did not survive validation. Both mean the same thing downstream — leave it
 * uncategorised and ask again next fetch — so they are not distinguished here.
 * They are distinguished in the log, which is where the difference matters.
 */
export interface CategoryBatch {
  readonly categories: ReadonlyMap<string, TrendCategory>;
  /** Rejected answers, for the log. Empty on a clean batch. */
  readonly rejected: readonly string[];
  /**
   * What the call actually cost, as OpenAI counted it.
   *
   * Carried because this feature was specified on projected token arithmetic,
   * and a projection nobody ever checks against a real invoice is a guess with
   * a table around it. Absent if the response omitted it.
   */
  readonly usage?: { readonly inputTokens: number; readonly outputTokens: number };
}

export class TrendCategoriser {
  readonly #apiKey: string;
  readonly #model: string;
  readonly #timeoutMs: number;
  readonly #reasoningEffort: CategoriserOptions['reasoningEffort'];

  constructor(options: CategoriserOptions) {
    this.#apiKey = options.apiKey;
    this.#model = options.model;
    this.#timeoutMs = options.timeoutMs;
    this.#reasoningEffort = options.reasoningEffort;
  }

  /**
   * Categorises a batch of trends in a single call.
   *
   * One call rather than one per trend: the trends are independent, the whole
   * batch is under a thousand tokens, and ten calls a fetch from a Raspberry Pi
   * to answer ten independent questions is waste for its own sake. The saving
   * is not really money — measured at about four dollars a year — it is call
   * volume and latency.
   */
  async categorise(trends: readonly TrendingSearch[]): Promise<CategoryBatch> {
    if (trends.length === 0) return { categories: new Map(), rejected: [] };

    const body = {
      model: this.#model,
      messages: [
        { role: 'system', content: instructions() },
        { role: 'user', content: promptFor(trends) },
      ],
      ...(this.#reasoningEffort === undefined
        ? {}
        : { reasoning_effort: this.#reasoningEffort }),
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'trend_categories',
          strict: true,
          schema: SCHEMA,
        },
      },
    };

    let payload: unknown;
    try {
      const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.#apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.#timeoutMs),
      });

      if (!response.ok) {
        /*
         * 429 is not special-cased. Every upstream failure has the same
         * consequence — this batch is abandoned and its trends are still
         * uncategorised — so telling them apart only matters for the log,
         * which the status code already does.
         */
        const detail = (await response.text()).slice(0, 300);
        throw new CategoriserUnavailableError(
          `OpenAI responded ${response.status} ${response.statusText}: ${detail}`,
        );
      }
      payload = await response.json();
    } catch (error) {
      if (error instanceof CategoriserUnavailableError) throw error;
      throw new CategoriserUnavailableError('Could not reach OpenAI', { cause: error });
    }

    return parseBatch(payload, trends);
  }
}

/**
 * The JSON schema the answer is forced into.
 *
 * With `strict: true` and a string enum the model *cannot* return a value
 * outside the set — the closed set stops being a hope and becomes a property of
 * the API. Everything is still validated again below, because a schema
 * guarantee is only as good as the response actually matching the schema, and
 * this file is the boundary with something we do not control.
 *
 * `title` is echoed back for one reason: alignment. If answer 7 were silently
 * applied to trend 8 the screen would render perfectly and be wrong about every
 * row, which is the worst failure available here. Matching the echo is what
 * makes that detectable instead of invisible.
 */
const SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer', description: 'The number the trend was given.' },
          title: { type: 'string', description: 'The trend title, copied exactly.' },
          category: { type: 'string', enum: [...TREND_CATEGORIES] },
        },
        required: ['index', 'title', 'category'],
        additionalProperties: false,
      },
    },
  },
  required: ['results'],
  additionalProperties: false,
} as const;

/*
 * `instructions` and `promptFor` are exported so the exact text sent upstream
 * can be printed and read without making a call. What we ask for is as much a
 * part of this feature as what comes back, and a prompt nobody can look at is a
 * prompt nobody can review.
 */
export function instructions(): string {
  const list = TREND_CATEGORIES.map((id) => `- ${id}: ${CATEGORY_GUIDE[id]}`).join('\n');

  return [
    'You label Google trending searches from the United States by subject.',
    '',
    'For each numbered trend, choose exactly one category:',
    list,
    '',
    'Rules:',
    '- Judge what the search is about, using the headlines. A title alone is',
    '  often just a name; the headlines are what identify the person.',
    '- Choose the subject of the event, not the feeling about it.',
    '- When a trend fits more than one category, take the first one that',
    '  applies from this order:',
    `  ${PRECEDENCE.join(' > ')}`,
    '  So a footballer who died is obituary, a footballer charged with an',
    '  offence is crime, and a footballer transferred is sport.',
    '- Answer "uncategorised" whenever the headlines genuinely do not settle it,',
    '  including when the search term is too vague to have one subject. That is',
    '  a correct answer and is preferred over a plausible guess.',
    '- Copy each trend title back exactly as given, and keep its number.',
    '- Return one result per trend, in the order given.',
  ].join('\n');
}

/**
 * The batch as the model sees it.
 *
 * Numbered rather than bulleted so the echoed `index` has something to refer
 * to, and headlines indented under their trend so three sentences of news prose
 * cannot be mistaken for three more trends.
 */
export function promptFor(trends: readonly TrendingSearch[]): string {
  return trends
    .map((trend, index) => {
      const headlines = trend.news
        .slice(0, HEADLINES_PER_TREND)
        .map((item) => `     - ${item.title.slice(0, MAX_HEADLINE_CHARS)}`)
        .join('\n');

      // A trend with no headlines still gets asked about — it is 0.7% of them,
      // and the title alone is occasionally enough. It is likelier to come back
      // uncategorised, which is the right outcome rather than a lost row.
      return headlines === ''
        ? `${index + 1}. ${trend.title}\n     (no headlines available)`
        : `${index + 1}. ${trend.title}\n${headlines}`;
    })
    .join('\n\n');
}

/**
 * The response, checked rather than trusted.
 *
 * Hand-rolled, matching how the RSS feed and the Open-Meteo payload are already
 * validated in this codebase. Every entry has to clear four separate bars, and
 * anything that does not is dropped rather than repaired — a repaired answer is
 * a guess wearing the model's authority.
 */
function parseBatch(payload: unknown, trends: readonly TrendingSearch[]): CategoryBatch {
  const content = messageContent(payload);
  if (content === null) {
    throw new CategoriserUnavailableError('OpenAI returned no message content');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new CategoriserUnavailableError('OpenAI returned unparseable JSON', {
      cause: error,
    });
  }

  const results = (parsed as { results?: unknown })?.results;
  if (!Array.isArray(results)) {
    throw new CategoriserUnavailableError('OpenAI returned no results array');
  }

  const categories = new Map<string, TrendCategory>();
  const rejected: string[] = [];

  for (const entry of results) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;

    // 1. The index has to name a trend we actually asked about.
    const index = record['index'];
    if (typeof index !== 'number' || !Number.isInteger(index)) {
      rejected.push(`non-integer index: ${JSON.stringify(index)}`);
      continue;
    }
    const trend = trends[index - 1];
    if (trend === undefined) {
      rejected.push(`index ${index} is outside the batch of ${trends.length}`);
      continue;
    }

    // 2. The echoed title has to be the title we sent, or the answer is
    //    aligned to the wrong trend and everything after it may be too.
    const title = record['title'];
    if (typeof title !== 'string' || title.trim() !== trend.title.trim()) {
      rejected.push(
        `index ${index} echoed ${JSON.stringify(title)}, expected ${JSON.stringify(trend.title)}`,
      );
      continue;
    }

    // 3. The category has to be in the closed set. The schema should already
    //    guarantee this; we are the boundary, so we check anyway.
    const category = record['category'];
    if (!isCategory(category)) {
      rejected.push(`index ${index} returned unknown category ${JSON.stringify(category)}`);
      continue;
    }

    // 4. First answer for a trend wins, so a duplicated index cannot overwrite
    //    a good answer with a worse one.
    if (!categories.has(trend.id)) categories.set(trend.id, category);
  }

  return { categories, rejected, ...usageOf(payload) };
}

/** OpenAI's own token counts, if the response carried them. */
function usageOf(payload: unknown): Pick<CategoryBatch, 'usage'> {
  const usage = (payload as { usage?: unknown })?.usage as
    | { prompt_tokens?: unknown; completion_tokens?: unknown }
    | undefined;

  const input = usage?.prompt_tokens;
  const output = usage?.completion_tokens;
  if (typeof input !== 'number' || typeof output !== 'number') return {};

  return { usage: { inputTokens: input, outputTokens: output } };
}

/** The assistant message text, or null if the response is not shaped like one. */
function messageContent(payload: unknown): string | null {
  const choices = (payload as { choices?: unknown })?.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const message = (choices[0] as { message?: unknown })?.message;
  const content = (message as { content?: unknown })?.content;
  return typeof content === 'string' && content !== '' ? content : null;
}

function isCategory(value: unknown): value is TrendCategory {
  return (
    typeof value === 'string' && (TREND_CATEGORIES as readonly string[]).includes(value)
  );
}
