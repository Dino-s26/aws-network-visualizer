import { describe, it, expect } from 'vitest';
import type { FetchIssue } from '../../types/topology';
import { classifyIssue, guidanceFor } from '../fetch-issues';
import { COMPACT_AT, describeGroup, groupIssues, issueRegion, maskIdentifiers } from '../issue-display';

// All identifiers are made up: account 111122223333, org 999988887777, example.com.
const CALLER = 'arn:aws:sts::111122223333:assumed-role/AWSReservedSSO_Demo_0123456789abcdef/jane.doe@example.com';
const scp = (action: string) =>
  `User: ${CALLER} is not authorized to perform: ${action} with an explicit deny in a service control policy: arn:aws:organizations::999988887777:policy/o-demo123456/service_control_policy/p-demo1234`;
const NO_POLICY =
  'User: arn:aws:iam::111122223333:user/auditor is not authorized to perform: ec2:DescribeRouteTables because no identity-based policy allows the ec2:DescribeRouteTables action';
const EXPLICIT_IDENTITY =
  'User: arn:aws:iam::111122223333:user/auditor is not authorized to perform: ec2:DescribeSubnets on resource: * with an explicit deny in an identity-based policy';
const BOUNDARY =
  'User: arn:aws:iam::111122223333:user/auditor is not authorized to perform: ec2:DescribeSubnets because no permissions boundary allows the ec2:DescribeSubnets action';
const failed = (label: string, message: string): FetchIssue => ({ label, kind: 'failed', message });

describe('classifyIssue', () => {
  it('recognises an organization policy block, explicit or implicit', () => {
    expect(classifyIssue(failed('sa-east-1/VPCs', scp('ec2:DescribeVpcs')))).toBe('org-policy');
    expect(
      classifyIssue(failed('x', 'not authorized to perform: ec2:DescribeVpcs because no service control policy allows the ec2:DescribeVpcs action')),
    ).toBe('org-policy');
  });

  it('recognises a missing permission', () => {
    expect(classifyIssue(failed('x', NO_POLICY))).toBe('missing-permission');
    expect(classifyIssue(failed('x', 'not authorized to perform: ec2:DescribeVpcs'))).toBe('missing-permission');
    expect(classifyIssue(failed('x', 'AccessDeniedException: nope'))).toBe('missing-permission');
  });

  it('recognises a restriction on the role itself', () => {
    expect(classifyIssue(failed('x', EXPLICIT_IDENTITY))).toBe('role-restriction');
    expect(classifyIssue(failed('x', BOUNDARY))).toBe('role-restriction');
  });

  it('treats everything else, and truncation, as other', () => {
    expect(classifyIssue(failed('x', 'socket hang up'))).toBe('other');
    expect(classifyIssue({ kind: 'truncated', message: NO_POLICY })).toBe('other');
  });
});

describe('guidanceFor, by cause', () => {
  it('does not send an organization-policy block to IAM', () => {
    const g = guidanceFor([failed('sa-east-1/VPCs', scp('ec2:DescribeVpcs'))]);
    expect(g.join(' ')).toContain('An IAM change cannot override it');
    expect(g.join(' ')).not.toContain('Check your IAM policy grants');
  });

  it('offers only the actions an IAM change can fix when causes are mixed', () => {
    const g = guidanceFor([failed('sa-east-1/VPCs', scp('ec2:DescribeVpcs')), failed('us-east-1/RouteTables', NO_POLICY)]);
    const iam = g.find((l) => l.startsWith('Check your IAM policy grants'))!;
    expect(iam).toContain('ec2:DescribeRouteTables');
    expect(iam).not.toContain('ec2:DescribeVpcs');
    expect(g.join(' ')).toContain('organization policy');
  });

  it('points a role restriction at whoever manages the role', () => {
    const g = guidanceFor([failed('x', EXPLICIT_IDENTITY)]).join(' ');
    expect(g).toContain('permissions boundary');
    expect(g).not.toContain('Check your IAM policy grants');
  });

  it('keeps the original wording for non-permission failures', () => {
    expect(guidanceFor([failed('a/VPCs', 'socket hang up')])).toEqual([
      'These are not permission errors — see the message on each row for the cause reported by AWS.',
    ]);
  });

  it('distinguishes other failures when permission errors are also present', () => {
    const g = guidanceFor([failed('a/VPCs', NO_POLICY), failed('b/VPCs', 'socket hang up')]).join(' ');
    expect(g).toContain('Other failures are not permission errors');
    expect(g).not.toContain('These are not permission errors');
  });

  it('still helps when AWS names no action', () => {
    expect(guidanceFor([failed('a/VPCs', 'AccessDeniedException: nope')]).join(' ')).toContain(
      'These look like permission errors',
    );
  });

  it('never tells the user to retry, refresh or re-run, whatever the cause', () => {
    const all = guidanceFor([
      failed('a', scp('ec2:DescribeVpcs')),
      failed('b', NO_POLICY),
      failed('c', EXPLICIT_IDENTITY),
      failed('d', 'socket hang up'),
      { label: 'e', kind: 'truncated', message: 'stopped after 25 pages' },
    ]).join(' ');
    expect(all).not.toMatch(/retry|refresh|re-run/i);
  });
});

describe('issueRegion', () => {
  it('reads the region from a regional label and ignores global ones', () => {
    expect(issueRegion('sa-east-1/TGWAttachments')).toBe('sa-east-1');
    expect(issueRegion('us-gov-west-1/VPCs')).toBe('us-gov-west-1');
    expect(issueRegion('DxGateways')).toBeUndefined();
    expect(issueRegion('Health: issues')).toBeUndefined();
  });
});

describe('groupIssues / describeGroup', () => {
  const services = ['Vpcs', 'Subnets', 'RouteTables'];

  it('collapses a blocked region into one group with a count and the region', () => {
    const issues = services.map((s) => failed(`sa-east-1/${s}`, scp(`ec2:Describe${s}`)));
    const groups = groupIssues(issues);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ cause: 'org-policy', count: 3, regions: [{ region: 'sa-east-1', count: 3 }] });
    expect(describeGroup(groups[0])).toBe('Blocked by an organization policy: 3 calls in sa-east-1');
  });

  it('orders groups by cause and ignores truncated issues', () => {
    const groups = groupIssues([
      failed('a/VPCs', 'socket hang up'),
      failed('b/VPCs', NO_POLICY),
      failed('c/VPCs', scp('ec2:DescribeVpcs')),
      { label: 'Health: issues', kind: 'truncated', message: 'stopped after 25 pages' },
    ]);
    expect(groups.map((g) => g.cause)).toEqual(['org-policy', 'missing-permission', 'other']);
  });

  it('lists the busiest regions and counts the rest', () => {
    const regions = ['aa-east-1', 'bb-east-1', 'cc-east-1', 'dd-east-1', 'ee-east-1'];
    const issues = regions.flatMap((r, idx) =>
      Array.from({ length: 5 - idx }, (_, n) => failed(`${r}/S${n}`, scp('ec2:DescribeVpcs'))),
    );
    const text = describeGroup(groupIssues(issues)[0]);
    expect(text).toContain('across 5 regions: aa-east-1 (5), bb-east-1 (4), cc-east-1 (3), dd-east-1 (2), +1 more');
  });

  it('names the missing actions and the role restriction', () => {
    const missing = describeGroup(groupIssues([failed('us-east-1/RouteTables', NO_POLICY)])[0]);
    expect(missing).toBe('Missing read permission: ec2:DescribeRouteTables (1 call in us-east-1)');
    const role = describeGroup(groupIssues([failed('us-east-1/Subnets', EXPLICIT_IDENTITY)])[0]);
    expect(role).toContain('Denied by your role, session or permissions boundary: ec2:DescribeSubnets');
    expect(describeGroup(groupIssues([failed('a/VPCs', 'boom')])[0])).toBe('Other errors: 1 call');
  });

  it('exposes the threshold the banner uses', () => {
    expect(COMPACT_AT).toBe(5);
  });
});

describe('maskIdentifiers', () => {
  it('replaces the caller and the denying policy, and keeps the action', () => {
    expect(maskIdentifiers(scp('ec2:DescribeVpcs'))).toBe(
      'User: your signed-in role is not authorized to perform: ec2:DescribeVpcs with an explicit deny in a service control policy: an organization policy',
    );
  });

  it('masks account ids, emails, organization ids and access keys', () => {
    expect(maskIdentifiers('account 111122223333 or 1111-2222-3333')).toBe('account [account] or [account]');
    expect(maskIdentifiers('mail jane.doe@example.com')).toBe('mail [email]');
    expect(maskIdentifiers('policy o-demo123456 and p-demo1234')).toBe('policy [org-id] and [org-id]');
    // Built at runtime so a secret scanner never sees a key-shaped literal in the repo.
    const fakeKey = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');
    expect(maskIdentifiers('key ' + fakeKey)).toBe('key [access key]');
  });

  it('keeps trailing punctuation after an ARN', () => {
    expect(maskIdentifiers('denied for arn:aws:iam::111122223333:user/auditor.')).toBe('denied for your user.');
  });

  it('leaves regions, resource labels and ordinary words alone', () => {
    const plain = 'ap-southeast-1/VpcRouteTables stop-abcdefgh vpc-0123456789abcdef0 us-east-1';
    expect(maskIdentifiers(plain)).toBe(plain);
  });

  it('is idempotent', () => {
    const once = maskIdentifiers(scp('ec2:DescribeVpcs'));
    expect(maskIdentifiers(once)).toBe(once);
  });
});
