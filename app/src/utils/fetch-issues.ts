import type { FetchIssue } from '../types/topology';

/**
 * Shared wording for the incomplete-data warnings.
 *
 * The on-screen banner and the exported HTML report must say the same thing —
 * they are the same claim to two audiences, and the report's readers usually
 * cannot see the app. Keeping the text here means a copy change lands in both
 * instead of drifting apart.
 *
 * Deliberately does NOT tell the user to retry, refresh, or re-run. The dominant
 * cause is a missing IAM permission, and re-running changes nothing — it just
 * produces the same incomplete review a second time and teaches the user the
 * warning is noise. Every message below either names something concrete to
 * check, or says plainly that no action is available.
 */

/** One-line count for a header, keeping the two kinds distinct. */
export function summariseIssues(issues: FetchIssue[]): string {
  const failed = issues.filter((i) => i.kind === 'failed').length;
  const truncated = issues.filter((i) => i.kind === 'truncated').length;
  return [
    failed > 0 ? `${failed} resource${failed === 1 ? '' : 's'} failed to load` : '',
    truncated > 0 ? `${truncated} loaded incompletely` : '',
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * Pull the denied API action out of an AWS authorization error.
 *
 * AccessDenied reads "User: arn:aws:iam::…:user/x is not authorized to perform:
 * ec2:DescribeRouteTables because no identity-based policy allows…". The action
 * is the single most useful thing on screen — it turns "something failed" into
 * one line to add to a policy — so it is worth extracting rather than leaving
 * the user to read an ARN-laden sentence.
 *
 * Returns undefined when the message is not an authorization error, which is how
 * the caller decides between permissions guidance and "no action available".
 */
export function deniedAction(message: string): string | undefined {
  return /(?:perform|call)\s*:?\s+([a-z0-9-]+:[A-Za-z0-9]+)/.exec(message)?.[1];
}

/** Distinct denied actions across every failed issue, in first-seen order. */
export function deniedActions(issues: FetchIssue[]): string[] {
  const seen = new Set<string>();
  for (const i of issues) {
    if (i.kind !== 'failed') continue;
    const action = deniedAction(i.message);
    if (action) seen.add(action);
  }
  return [...seen];
}

/**
 * Why a call was denied. The cause decides what the user can actually do, and one
 * generic "check your IAM policy" line is wrong for two of the four:
 *
 *  - org-policy: a service control policy (or resource control policy) denies the
 *    call. These sit above every IAM policy in the account, so granting the action
 *    in IAM changes nothing. Typically the region is simply not allowed.
 *  - missing-permission: nothing grants the action. Adding it to the policy fixes it.
 *  - role-restriction: the role, session policy or permissions boundary explicitly
 *    denies it or does not allow it. Whoever manages that role has to change it.
 *  - other: not an authorization error (timeouts, throttling, bad input).
 */
export type IssueCause = 'org-policy' | 'missing-permission' | 'role-restriction' | 'other';

const ORG_POLICY =
  /explicit deny in (?:a|an) (?:service|resource) control policy|no (?:service|resource) control policy allows/i;
const ROLE_RESTRICTION =
  /explicit deny in (?:an? )?(?:identity-based|session|resource-based) policy|explicit deny in (?:an? )?permissions boundary|no (?:session policy|permissions boundary) allows/i;
const ANY_DENIAL = /AccessDenied|UnauthorizedOperation|not authorized/i;

export function classifyIssue(issue: Pick<FetchIssue, 'kind' | 'message'>): IssueCause {
  if (issue.kind !== 'failed') return 'other';
  const m = issue.message;
  if (ORG_POLICY.test(m)) return 'org-policy';
  if (ROLE_RESTRICTION.test(m)) return 'role-restriction';
  if (deniedAction(m) || ANY_DENIAL.test(m)) return 'missing-permission';
  return 'other';
}

/**
 * What the user should check, as plain sentences.
 *
 * Split by cause because the actions genuinely differ, and a single generic
 * "common causes" footer made them all look equally likely. An action blocked by
 * an organization policy is never offered as something to grant in IAM.
 */
export function guidanceFor(issues: FetchIssue[]): string[] {
  const out: string[] = [];
  const failed = issues.filter((i) => i.kind === 'failed');
  const truncated = issues.filter((i) => i.kind === 'truncated');
  const of = (cause: IssueCause) => failed.filter((i) => classifyIssue(i) === cause);
  const missing = of('missing-permission');
  const orgBlocked = of('org-policy');
  const restricted = of('role-restriction');
  const others = of('other');
  // Only actions an IAM change can fix.
  const actions = deniedActions(missing);

  if (actions.length > 0) {
    out.push(
      `Check your IAM policy grants ${actions.join(', ')}. The reference policy is docs/iam-policy.json.`,
    );
    // A real trap in this codebase, and invisible from the error text: the
    // example policy uses a Describe* wildcard, which does not cover List* or
    // Get*. Someone comparing their policy to the reference will conclude it is
    // already correct.
    if (actions.some((a) => /:(List|Get)/.test(a))) {
      out.push(
        'Note: List* and Get* actions are not covered by a Describe* wildcard and need their own entry.',
      );
    }
  } else if (missing.length > 0) {
    out.push(
      'These look like permission errors: check the IAM policy for the action named in each message. The reference policy is docs/iam-policy.json.',
    );
  }

  if (orgBlocked.length > 0) {
    out.push(
      'Blocked by an organization policy (a service control policy). An IAM change cannot override it. This usually means the region is not allowed for your organization: skip it, or ask your cloud team to review the policy.',
    );
  }

  if (restricted.length > 0) {
    out.push(
      'Your role, session or permissions boundary explicitly denies these actions. Ask whoever manages the role, or sign in with a role that allows them.',
    );
  }

  if (others.length > 0) {
    // Not an authorization error, so pointing at IAM would send the user down
    // the wrong path.
    out.push(
      missing.length + orgBlocked.length + restricted.length === 0
        ? 'These are not permission errors — see the message on each row for the cause reported by AWS.'
        : 'Other failures are not permission errors — see the message on each row for the cause reported by AWS.',
    );
  }

  if (truncated.length > 0) {
    out.push(
      'Truncated results stopped at a page limit: what is shown is accurate, but older or additional entries are omitted.',
    );
  }

  return out;
}
