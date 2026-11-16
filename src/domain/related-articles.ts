/**
 * The business rules of "Related News" on an article page (PTL-08), as pure functions: no browser, no portal.
 * The tests ask them what the page SHOULD show and compare it with what it shows.
 */

/** Related articles shown at the bottom of an article page - at most. */
const RELATED_LIMIT = 3;
/** Characters of the summary a related article card shows. */
export const SUMMARY_LENGTH = 200;

/** What the rules need to know of an article. */
export type ArticleLike = {
  title: string;
  /** As the portal shows it, e.g. `07 October 2026`. */
  publishDate: string;
  categories: readonly string[];
};

const clean = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** Tells articles apart: titles alone repeat (two articles can share one). */
export const articleKey = (article: ArticleLike): string =>
  [clean(article.title), clean(article.publishDate), article.categories.map(clean).sort().join(',')].join('|');

/** The article has at least one category in common with the other. */
export const sharesCategory = (article: ArticleLike, other: ArticleLike): boolean => {
  const mine = new Set(article.categories.map(clean));
  return other.categories.some((category) => mine.has(clean(category)));
};

/**
 * Every article that may be related to `current`: published, in at least one of its categories, and not the article
 * itself. `published` is in the order the portal lists it - newest publish date first - and that order is kept.
 */
export const eligibleRelated = <T extends ArticleLike>(current: ArticleLike, published: readonly T[]): T[] =>
  published.filter((article) => articleKey(article) !== articleKey(current) && sharesCategory(current, article));

/** The related articles the page should show: the most recent eligible ones, up to the limit. */
export const expectedRelated = <T extends ArticleLike>(current: ArticleLike, published: readonly T[], limit = RELATED_LIMIT): T[] =>
  eligibleRelated(current, published).slice(0, limit);

/** The summary a card should show: the first `length` characters of the text, or all of it when it is shorter. */
export const summaryStart = (text: string, length = SUMMARY_LENGTH): string => clean(text).slice(0, length).trim();
