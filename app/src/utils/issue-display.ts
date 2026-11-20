import type { FetchIssue } from '../types/topology';
import { classifyIssue, deniedAction, type IssueCause } from './fetch-issues';

/**
 * Display helpers for the incomplete-data banner and report: group many near
 * identical failures by cause, describe each group in one line, and mask account
 * and identity details so a screenshot is safe to share.
 */

/** Above this many issues the banner shows a cause summary and hides the per-call list behind a button. */
export const COMPACT_AT = 5;

const REGION_IN_LABEL = /^([a-z]{2}(?:-[a-z]+)+-\d+)\//;

/** Region from a label like "sa-east-1/VpcRouteTables"; undefined for global labels. */
export function issueRegion(label: string): string | undefined {
  return REGION_IN_LABEL.exec(label)?.[1];
}

export interface IssueGroup {
  cause: IssueCause;
  count: number;
  /** Regions affected, most calls first. */
  regions: { region: string; count: number }[];
  /** Distinct denied API actions, in first-seen order. */
  actions: string[];
}

const ORDER: IssueCause[] = ['org-policy', 'missing-permission', 'role-restriction', 'other'];

/** Failed issues grouped by cause. Truncated issues are not failures and are not grouped. */
export function groupIssues(issues: FetchIssue[]): IssueGroup[] {
  const failed = issues.filter((i) => i.kind === 'failed');
  const groups: IssueGroup[] = [];
  for (const cause of ORDER) {
    const members = failed.filter((i) => classifyIssue(i) === cause);
    if (members.length === 0) continue;
    const perRegion = new Map<string, number>();
    const actions = new Set<string>();
    for (const i of members) {
      const region = issueRegion(i.label);
      if (region) perRegion.set(region, (perRegion.get(region) ?? 0) + 1);
      const action = deniedAction(i.message);
      if (action) actions.add(action);
    }
    groups.push({
      cause,
      count: members.length,
      regions: [...perRegion]
        .map(([region, count]) => ({ region, count }))
        .sort((a, b) => b.count - a.count || a.region.localeCompare(b.region)),
      actions: [...actions],
    });
  }
  return groups;
}

const plural = (n: number, word: string) => n + ' ' + word + (n === 1 ? '' : 's');

function regionText(g: IssueGroup): string {
  if (g.regions.length === 0) return '';
  if (g.regions.length === 1) return ' in ' + g.regions[0].region;
  const shown = g.regions.slice(0, 4).map((r) => r.region + ' (' + r.count + ')');
  const more = g.regions.length > 4 ? ', +' + (g.regions.length - 4) + ' more' : '';
  return ' across ' + g.regions.length + ' regions: ' + shown.join(', ') + more;
}

function actionText(g: IssueGroup): string {
  if (g.actions.length === 0) return '';
  const shown = g.actions.slice(0, 4).join(', ');
  return shown + (g.actions.length > 4 ? ', +' + (g.actions.length - 4) + ' more' : '');
}

/** One line per cause: what happened, how many calls, where. */
export function describeGroup(g: IssueGroup): string {
  const calls = plural(g.count, 'call');
  switch (g.cause) {
    case 'org-policy':
      return 'Blocked by an organization policy: ' + calls + regionText(g);
    case 'missing-permission':
      return g.actions.length > 0
        ? 'Missing read permission: ' + actionText(g) + ' (' + calls + regionText(g) + ')'
        : 'Permission errors: ' + calls + regionText(g);
    case 'role-restriction':
      return (
        'Denied by your role, session or permissions boundary' +
        (g.actions.length > 0 ? ': ' + actionText(g) : '') +
        ' (' + calls + regionText(g) + ')'
      );
    default:
      return 'Other errors: ' + calls + regionText(g);
  }
}

// ---------------------------------------------------------------------------
// Masking
// ---------------------------------------------------------------------------

const ARN_RE = /arn:aws[a-z-]*:[a-z0-9-]*:[a-z0-9-]*:\d{0,12}:[^\s,;)]+/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const ORG_ID_RE = /\b(?:o|ou|r|p)-[a-z0-9]{8,32}(?:-[a-z0-9]{8,32})?\b/g;
const ACCOUNT_RE = /\b\d{12}\b|\b\d{4}-\d{4}-\d{4}\b/g;
const ACCESS_KEY_RE = /\b(?:AKIA|ASIA)[A-Z0-9]{12,20}\b/g;

function arnLabel(arn: string): string {
  if (arn.includes(':assumed-role/')) return 'your signed-in role';
  if (arn.includes(':user/')) return 'your user';
  if (arn.includes(':organizations:')) return 'an organization policy';
  if (arn.includes(':role/')) return 'a role';
  return '[ARN]';
}

/**
 * Replace account, identity and organization details in an AWS error message.
 *
 * AWS authorization errors print the caller's full ARN (account ID, role name,
 * session name, often a person's email) and the ID of the policy that denied the
 * call. None of that helps fix the problem, and all of it ends up in screenshots.
 * The denied action, the region and the resource labels are left alone, since
 * those are what the reader needs.
 */
export function maskIdentifiers(text: string): string {
  return text
    .replace(ARN_RE, (m) => {
      const trail = /[.:]+$/.exec(m)?.[0] ?? '';
      const core = trail ? m.slice(0, -trail.length) : m;
      return arnLabel(core) + trail;
    })
    .replace(ORG_ID_RE, '[org-id]')
    .replace(ACCOUNT_RE, '[account]')
    .replace(EMAIL_RE, '[email]')
    .replace(ACCESS_KEY_RE, '[access key]');
}
