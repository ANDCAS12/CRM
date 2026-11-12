import { describe, expect, it } from 'vitest';
import { OPERATORS, runQuery } from '../../src/core/query.js';

const rows = [
  { id: 'a', name: 'Ana', function: 'Data', employees: 50, createdAt: '2026-11-10T10:00:00Z', email: '' },
  { id: 'b', name: 'Ben', function: 'Finance', employees: 500, createdAt: '2026-01-01T10:00:00Z', email: 'b@x.com' },
  { id: 'c', name: 'Cy', function: 'data', employees: 5, createdAt: '2026-11-01T10:00:00Z', email: 'c@x.com' },
];
const now = new Date('2026-11-11T12:00:00');
const ids = (q, acc, sf) => runQuery(rows, q, acc, sf, now).map((r) => r.id);

describe('runQuery', () => {
  it('searches across fields case-insensitively', () => expect(ids({ search: 'X.COM' }, {}, ['email'])).toEqual(['b', 'c']));
  it('ANDs filters', () =>
    expect(
      ids({
        filters: [
          { field: 'function', op: 'is', value: 'DATA' },
          { field: 'employees', op: 'gte', value: 10 },
        ],
      }),
    ).toEqual(['a']));
  it.each([
    ['isNot', 'function', 'Data', ['b']],
    ['contains', 'name', 'n', ['a', 'b']],
    ['known', 'email', undefined, ['b', 'c']],
    ['unknown', 'email', undefined, ['a']],
    ['lte', 'employees', 50, ['a', 'c']],
    ['lastDays', 'createdAt', 7, ['a']],
  ])('operator %s', (op, field, value, expected) => expect(ids({ filters: [{ field, op, value }] })).toEqual(expected));
  it('sorts numbers and text in both directions', () => {
    expect(ids({ sort: { field: 'employees', dir: -1 } })).toEqual(['b', 'a', 'c']);
    expect(ids({ sort: { field: 'name', dir: 1 } })).toEqual(['a', 'b', 'c']);
  });
  it('uses computed accessors', () =>
    expect(ids({ filters: [{ field: 'upper', op: 'is', value: 'BEN' }] }, { upper: (r) => r.name.toUpperCase() })).toEqual(['b']));
  it('pins to an id set (view imported records)', () => expect(ids({ ids: ['c'] })).toEqual(['c']));
  it('ignores unknown operators', () => expect(ids({ filters: [{ field: 'name', op: 'nope', value: 'x' }] })).toHaveLength(3));
  it('every operator has a label', () => Object.values(OPERATORS).forEach((o) => expect(o.label).toBeTruthy()));
});
