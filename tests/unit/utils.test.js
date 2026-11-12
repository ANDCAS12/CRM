import { describe, expect, it } from 'vitest';
import { addDays, dayDiff, quarterLabel, toISODate } from '../../src/utils/dates.js';
import { ago, domainOf, esc, kmoney, money, normalizeDomain, stripHtml, truncate } from '../../src/utils/format.js';
import { parseCSV, toCSV } from '../../src/utils/csv.js';
import { isBlank, sameValue } from '../../src/utils/object.js';

describe('dates', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('computes day differences', () => {
    expect(dayDiff('2026-11-01', '2026-11-11')).toBe(10);
    expect(dayDiff('2026-11-11T23:00:00Z', '2026-11-11')).toBeLessThanOrEqual(1);
  });
  it.each([
    ['2026-03-05', '2026-03-05'],
    ['3/5/2026', '2026-03-05'],
    ['12/15/26', '2026-12-15'],
    [46000, '2025-12-09'],
    ['', ''],
    ['not a date', ''],
  ])('toISODate(%s) -> %s', (input, out) => expect(toISODate(input)).toBe(out));
  it('labels quarters', () => expect(quarterLabel('2026-11-11')).toBe('2026 Q4'));
});

describe('format', () => {
  it('escapes HTML to prevent XSS', () => expect(esc('<img onerror="x">')).toBe('&lt;img onerror=&quot;x&quot;&gt;'));
  it('formats money', () => {
    expect(money(420000)).toBe('$420,000');
    expect(money('')).toBe('—');
    expect(kmoney(1_450_000)).toBe('$1.4M');
    expect(kmoney(420_000)).toBe('$420K');
    expect(kmoney(12)).toBe('$12');
  });
  it('strips HTML and decodes entities in the right order', () => {
    expect(stripHtml('<p>A &amp; B</p><p>C</p>')).toBe('A & B C');
    expect(stripHtml('&amp;lt;')).toBe('&lt;');
  });
  it('normalises domains and emails', () => {
    expect(normalizeDomain('https://www.Acme.com/about')).toBe('acme.com');
    expect(domainOf('Dana@NorthwindFoods.com')).toBe('northwindfoods.com');
  });
  it('relative time', () => {
    const now = new Date('2026-11-11T12:00:00Z');
    expect(ago('2026-11-11T11:59:30Z', now)).toBe('just now');
    expect(ago('2026-11-10T12:00:00Z', now)).toBe('yesterday');
    expect(ago('2026-11-01T12:00:00Z', now)).toBe('10 days ago');
  });
  it('truncates', () => expect(truncate('abcdef', 4)).toBe('abc…'));
});

describe('csv', () => {
  it('parses quotes, escaped quotes, CRLF and BOM', () => {
    const rows = parseCSV('\uFEFFa,b\r\n"x, y","say ""hi"""\r\n1,2');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['1', '2'],
    ]);
  });
  it('round-trips through toCSV', () => {
    const data = [{ Name: 'A, Inc', Note: 'line\nbreak' }];
    const [header, row] = parseCSV(toCSV(data));
    expect(header).toEqual(['Name', 'Note']);
    expect(row).toEqual(['A, Inc', 'line\nbreak']);
  });
  it('returns empty string for no rows', () => expect(toCSV([])).toBe(''));
});

describe('object', () => {
  it('detects blanks and equal values', () => {
    expect(isBlank([])).toBe(true);
    expect(isBlank(0)).toBe(false);
    expect(sameValue(['a'], ['a'])).toBe(true);
    expect(sameValue(undefined, '')).toBe(true);
  });
});
