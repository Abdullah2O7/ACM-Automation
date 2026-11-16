import { expect, test } from '@playwright/test';
import { parseLongDate } from '../../src/utils/core/dates';
import { htmlToText, isTruncationOf } from '../../src/utils/core/text';

test('parseLongDate reads the portal publish date format', () => {
  expect(parseLongDate('07 October 2026').getTime()).toBe(new Date(2026, 9, 7).getTime());
  expect(parseLongDate(' 1 january 2027 ').getTime()).toBe(new Date(2027, 0, 1).getTime());
});

test('parseLongDate refuses other formats and unknown months', () => {
  expect(() => parseLongDate('07/10/2026')).toThrow('UNREADABLE_DATE');
  expect(() => parseLongDate('07 Octobre 2026')).toThrow('UNREADABLE_DATE');
});

test('htmlToText drops tags, decodes entities and collapses whitespace', () => {
  expect(htmlToText('<div class="x">\n<p>Hawar&#x27;s &amp; club&nbsp;day</p>\n<p>Second</p></div>')).toBe("Hawar's & club day Second");
  expect(htmlToText('&unknown; stays')).toBe('&unknown; stays');
});

test('htmlToText decodes the typographic entities of rich text', () => {
  expect(htmlToText('<p>players&rsquo; skills &ndash; &ldquo;strong&rdquo;</p>')).toBe('players\u2019 skills \u2013 \u201Cstrong\u201D');
});

test('isTruncationOf accepts the whole text or its start, with or without an ellipsis', () => {
  const full = 'Hawar Sports Club has launched a new community initiative for youth.';
  expect(isTruncationOf(full, full)).toBe(true);
  expect(isTruncationOf('Hawar Sports Club has launched a new...', full)).toBe(true);
  expect(isTruncationOf('Hawar Sports Club has launched a new…', full)).toBe(true);
  expect(isTruncationOf('A different text', full)).toBe(false);
  expect(isTruncationOf('', full)).toBe(false);
});
