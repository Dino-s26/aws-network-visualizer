import { describe, it, expect } from 'vitest';
import {
  COLLAPSED_PREFIX_LINES,
  EXPANDED_MAX_HEIGHT,
  collapseLabelLines,
  estimateLabelHalfHeight,
  isPrefixLine,
} from '../label-lines';

// Documentation ranges only (RFC 5737 / 3849).
const prefixes = (n: number) => Array.from({ length: n }, (_, i) => `198.51.${i}.0/24`);
const label = (n: number) => ['Allowed Prefixes (advertised)', 'gateway-name', ...prefixes(n), 'State: associated'];

describe('isPrefixLine', () => {
  it('accepts IPv4 and IPv6 prefixes, with stray whitespace', () => {
    expect(isPrefixLine('198.51.100.0/24')).toBe(true);
    expect(isPrefixLine('  198.51.100.0/24  ')).toBe(true);
    expect(isPrefixLine('2001:db8::/32')).toBe(true);
  });

  it('rejects titles, ids and status lines', () => {
    for (const line of ['Allowed Prefixes (advertised)', 'State: associated', 'tgw-0123456789abcdef0', 'VIF: available', '198.51.100.0', '']) {
      expect(isPrefixLine(line), line).toBe(false);
    }
  });
});

describe('collapseLabelLines', () => {
  it('leaves a short list alone', () => {
    const v = collapseLabelLines(label(5), false);
    expect(v.collapsible).toBe(false);
    expect(v.lines).toHaveLength(label(5).length);
    expect(v.hidden).toBe(0);
  });

  it('does not collapse when it would hide only one line', () => {
    const v = collapseLabelLines(label(COLLAPSED_PREFIX_LINES + 1), false);
    expect(v.collapsible).toBe(false);
    expect(v.hidden).toBe(0);
  });

  it('collapses once two or more lines would be hidden', () => {
    const v = collapseLabelLines(label(COLLAPSED_PREFIX_LINES + 2), false);
    expect(v.collapsible).toBe(true);
    expect(v.hidden).toBe(2);
  });

  it('shows the first few prefixes and hides the rest of a long list', () => {
    const v = collapseLabelLines(label(28), false);
    expect(v.total).toBe(28);
    expect(v.hidden).toBe(28 - COLLAPSED_PREFIX_LINES);
    expect(v.lines.filter((l) => isPrefixLine(l.text))).toHaveLength(COLLAPSED_PREFIX_LINES);
    // the first prefixes are the ones kept
    expect(v.lines.filter((l) => isPrefixLine(l.text)).map((l) => l.text)).toEqual(prefixes(COLLAPSED_PREFIX_LINES));
  });

  it('always keeps the title, the id and the trailing status line, with original indexes', () => {
    const v = collapseLabelLines(label(28), false);
    expect(v.lines[0]).toEqual({ text: 'Allowed Prefixes (advertised)', index: 0 });
    expect(v.lines[1]).toEqual({ text: 'gateway-name', index: 1 });
    expect(v.lines[v.lines.length - 1]).toEqual({ text: 'State: associated', index: 2 + 28 });
  });

  it('returns every line, unchanged, when expanded', () => {
    const v = collapseLabelLines(label(28), true);
    expect(v.lines.map((l) => l.text)).toEqual(label(28));
    expect(v.hidden).toBe(0);
    expect(v.collapsible).toBe(true);
  });

  it('never hides a line that is not a prefix', () => {
    const lines = ['Title', ...prefixes(10), 'note: keep me', ...prefixes(3)];
    const v = collapseLabelLines(lines, false);
    expect(v.lines.map((l) => l.text)).toContain('note: keep me');
    expect(v.total).toBe(13);
  });

  it('copes with an empty label', () => {
    expect(collapseLabelLines([], false)).toEqual({ lines: [], hidden: 0, total: 0, collapsible: false });
  });
});

describe('estimateLabelHalfHeight', () => {
  it('never goes below the old single-line figure', () => {
    expect(estimateLabelHalfHeight(1, false)).toBe(14);
    expect(estimateLabelHalfHeight(0, false)).toBe(14);
  });

  it('grows with the number of visible lines', () => {
    expect(estimateLabelHalfHeight(8, false)).toBe((8 * 11 + 8) / 2);
    expect(estimateLabelHalfHeight(30, false)).toBeGreaterThan(estimateLabelHalfHeight(8, false));
  });

  it('caps an expanded list at the scroll height, because it scrolls instead of growing', () => {
    expect(estimateLabelHalfHeight(30, true)).toBe(EXPANDED_MAX_HEIGHT / 2);
    expect(estimateLabelHalfHeight(30, false)).toBeGreaterThan(EXPANDED_MAX_HEIGHT / 2);
  });

  it('a collapsed long list is now far smaller than the full list', () => {
    const collapsed = collapseLabelLines(label(28), false).lines.length;
    const full = collapseLabelLines(label(28), true).lines.length;
    expect(estimateLabelHalfHeight(collapsed, false)).toBeLessThan(estimateLabelHalfHeight(full, false) / 2);
  });
});
