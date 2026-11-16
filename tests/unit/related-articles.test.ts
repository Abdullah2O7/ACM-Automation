import { expect, test } from '@playwright/test';
import { articleKey, eligibleRelated, expectedRelated, sharesCategory, summaryStart } from '../../src/domain/related-articles';

const article = (title: string, publishDate: string, categories: string[]) => ({ title, publishDate, categories });

// Newest first, the way the portal lists them
const published = [
  article('Tennis', '07 October 2026', ['Announcements', 'Youth']),
  article('Football A', '01 October 2026', ['Youth', 'sports']),
  article('Football B', '01 October 2026', ['Youth', 'Membership']),
  article('Community day', '30 September 2026', ['Dining', 'Announcements']),
  article('Stadium', '10 September 2026', ['sports']),
  article('Lonely', '08 September 2026', ['Health']),
];

test('articles that repeat a title are still told apart', () => {
  expect(articleKey(article(' Hawar  Club ', '01 October 2026', ['b', 'a']))).toBe('Hawar Club|01 October 2026|a,b');
  expect(articleKey(published[1])).not.toBe(articleKey(article('Football A', '01 October 2026', ['Youth'])));
});

test('sharesCategory needs one category in common', () => {
  expect(sharesCategory(published[0], published[1])).toBe(true);
  expect(sharesCategory(published[0], published[4])).toBe(false);
});

test('eligibleRelated keeps the category, drops the article itself and keeps the newest-first order', () => {
  expect(eligibleRelated(published[0], published).map((a) => a.title)).toEqual(['Football A', 'Football B', 'Community day']);
  expect(eligibleRelated(published[4], published).map((a) => a.title)).toEqual(['Football A']);
});

test('expectedRelated shows at most three', () => {
  expect(expectedRelated(published[1], published).map((a) => a.title)).toEqual(['Tennis', 'Football B', 'Stadium']);
  expect(expectedRelated(published[0], published, 2).map((a) => a.title)).toEqual(['Football A', 'Football B']);
});

test('an article alone in its categories has no related articles', () => {
  expect(eligibleRelated(published[5], published)).toEqual([]);
});

test('summaryStart is the first 200 characters, or all of a shorter text', () => {
  expect(summaryStart('x'.repeat(250))).toBe('x'.repeat(200));
  expect(summaryStart('  short   text ')).toBe('short text');
  expect(summaryStart('abcdef', 3)).toBe('abc');
});
