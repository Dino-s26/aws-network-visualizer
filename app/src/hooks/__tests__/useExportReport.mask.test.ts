import { describe, it, expect } from 'vitest';
import type { FetchIssue, TopologyData } from '../../types/topology';
import { renderIncompleteDataNoticeHtml } from '../useExportReport';

const CALLER = 'arn:aws:sts::111122223333:assumed-role/AWSReservedSSO_Demo_0123456789abcdef/jane.doe@example.com';
const SCP = `User: ${CALLER} is not authorized to perform: ec2:DescribeVpcs with an explicit deny in a service control policy: arn:aws:organizations::999988887777:policy/o-demo123456/service_control_policy/p-demo1234`;

const topologyWith = (fetchIssues: FetchIssue[]) => ({ fetchIssues }) as unknown as TopologyData;

describe('incomplete-data notice in the exported report', () => {
  const html = renderIncompleteDataNoticeHtml(topologyWith([{ label: 'sa-east-1/Vpcs', kind: 'failed', message: SCP }]));

  it('masks account and identity details, since the report is the thing that gets shared', () => {
    for (const secret of ['111122223333', '999988887777', 'jane.doe@example.com', 'o-demo123456', 'AWSReservedSSO_Demo']) {
      expect(html).not.toContain(secret);
    }
    expect(html).toContain('your signed-in role');
    expect(html).toContain('an organization policy');
  });

  it('keeps the denied action and the resource label', () => {
    expect(html).toContain('ec2:DescribeVpcs');
    expect(html).toContain('sa-east-1/Vpcs');
  });

  it('gives organization-policy advice instead of IAM advice, without banned wording', () => {
    expect(html).toContain('An IAM change cannot override it');
    expect(html).not.toContain('Check your IAM policy grants');
    expect(html).not.toMatch(/retry|refresh|re-run/i);
  });
});
