/**
 * Long connection labels.
 *
 * Some edge labels list every advertised prefix on its own line, so a gateway with
 * thirty prefixes produced a label several hundred pixels tall that covered nodes,
 * zones and other labels. These helpers collapse such a list to its first few
 * prefixes, with a "+N more" toggle, and give the label-placement code a realistic
 * height instead of the single line it used to assume.
 */

/** Prefix lines shown while a long list is collapsed. */
export const COLLAPSED_PREFIX_LINES = 5;

const IPV4_CIDR = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/;
const IPV6_CIDR = /^[0-9a-fA-F:]+\/\d{1,3}$/;

/** A line that is nothing but a prefix, such as 10.0.0.0/8. Headers and status lines are not. */
export function isPrefixLine(line: string): boolean {
  const t = line.trim();
  return IPV4_CIDR.test(t) || (t.includes(':') && IPV6_CIDR.test(t));
}

export interface LabelLine {
  text: string;
  /** Position in the original label, so header and id styling still keys off it. */
  index: number;
}

export interface LabelView {
  lines: LabelLine[];
  /** Prefix lines hidden by the collapse (0 when nothing is hidden). */
  hidden: number;
  /** Prefix lines in the whole label. */
  total: number;
  /** True when the list is long enough to offer a toggle. */
  collapsible: boolean;
}

/**
 * Lines to show for a label. Only prefix lines are ever hidden; the title, the id
 * and any status line stay, in place. A list is collapsed only when at least two
 * lines would be hidden, because "+1 more" saves nothing.
 */
export function collapseLabelLines(
  lines: string[],
  expanded: boolean,
  max: number = COLLAPSED_PREFIX_LINES,
): LabelView {
  const total = lines.filter(isPrefixLine).length;
  const collapsible = total >= max + 2;
  if (!collapsible || expanded) {
    return { lines: lines.map((text, index) => ({ text, index })), hidden: 0, total, collapsible };
  }
  const shown: LabelLine[] = [];
  let seen = 0;
  lines.forEach((text, index) => {
    if (isPrefixLine(text)) {
      seen += 1;
      if (seen > max) return;
    }
    shown.push({ text, index });
  });
  return { lines: shown, hidden: total - max, total, collapsible };
}

const LINE_HEIGHT = 11; // 9px text with tight leading
const BOX_PADDING = 8;
/** An expanded list scrolls inside a box this tall (CustomEdge applies the same cap). */
export const EXPANDED_MAX_HEIGHT = 260;

/** Half the rendered height of a label, for placing it clear of nodes. Never below one line. */
export function estimateLabelHalfHeight(visibleLines: number, expanded: boolean): number {
  const full = visibleLines * LINE_HEIGHT + BOX_PADDING;
  const height = expanded ? Math.min(full, EXPANDED_MAX_HEIGHT) : full;
  return Math.max(14, height / 2);
}
