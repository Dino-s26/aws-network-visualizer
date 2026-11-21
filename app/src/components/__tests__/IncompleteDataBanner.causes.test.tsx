// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { IncompleteDataBanner } from '../IncompleteDataBanner';
import { useTopologyStore } from '../../store/topology-store';
import type { FetchIssue, TopologyData } from '../../types/topology';

// Made-up identifiers only.
const CALLER = 'arn:aws:sts::111122223333:assumed-role/AWSReservedSSO_Demo_0123456789abcdef/jane.doe@example.com';
const scp = (action: string) =>
  `User: ${CALLER} is not authorized to perform: ${action} with an explicit deny in a service control policy: arn:aws:organizations::999988887777:policy/o-demo123456/service_control_policy/p-demo1234`;
const SERVICES = ['Vpcs', 'Subnets', 'RouteTables', 'TGWAttachments', 'VpcPeerings', 'VpnConnections', 'CustomerGateways', 'TransitGateways', 'NatGateways', 'VpnGateways'];

const blockedRegion = (n = SERVICES.length): FetchIssue[] =>
  SERVICES.slice(0, n).map((s) => ({ label: `sa-east-1/${s}`, kind: 'failed', message: scp(`ec2:Describe${s}`) }));

function setTopology(issues: FetchIssue[]) {
  useTopologyStore.setState({
    topologyData: { fetchIssues: issues } as unknown as TopologyData,
    isLoading: false,
    error: null,
  } as never);
}

beforeEach(() => {
  useTopologyStore.setState({ topologyData: null, isLoading: false, error: null } as never);
});
afterEach(() => cleanup());

describe('IncompleteDataBanner: many failures with one cause', () => {
  it('summarises a blocked region instead of listing every call', () => {
    setTopology(blockedRegion());
    render(<IncompleteDataBanner />);
    expect(screen.getByText(/Blocked by an organization policy: 10 calls in sa-east-1/)).toBeTruthy();
    expect(screen.queryByText('sa-east-1/Vpcs')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show all 10 technical details' })).toBeTruthy();
  });

  it('does not tell the user to fix an organization-policy block in IAM', () => {
    setTopology(blockedRegion());
    const { container } = render(<IncompleteDataBanner />);
    expect(container.textContent).toContain('An IAM change cannot override it');
    expect(container.textContent).not.toContain('Check your IAM policy grants');
  });

  it('masks account and identity details by default and can reveal them', () => {
    setTopology(blockedRegion());
    const { container } = render(<IncompleteDataBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 10 technical details' }));

    const masked = container.textContent ?? '';
    for (const secret of ['111122223333', '999988887777', 'jane.doe@example.com', 'o-demo123456', 'AWSReservedSSO_Demo']) {
      expect(masked).not.toContain(secret);
    }
    expect(masked).toContain('ec2:DescribeVpcs');
    expect(screen.getByText('sa-east-1/Vpcs')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Show account and role details' }));
    const raw = container.textContent ?? '';
    expect(raw).toContain('jane.doe@example.com');
    expect(raw).toContain('111122223333');
    expect(screen.getByRole('button', { name: 'Hide account and role details' })).toBeTruthy();
  });

  it('closes the list again', () => {
    setTopology(blockedRegion());
    render(<IncompleteDataBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 10 technical details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hide technical details' }));
    expect(screen.queryByText('sa-east-1/Vpcs')).toBeNull();
  });

  it('starts closed and masked again when the topology is replaced', () => {
    setTopology(blockedRegion());
    render(<IncompleteDataBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 10 technical details' }));
    act(() => setTopology(blockedRegion()));
    expect(screen.getByRole('button', { name: 'Show all 10 technical details' })).toBeTruthy();
    expect(screen.queryByText('sa-east-1/Vpcs')).toBeNull();
  });

  it('never uses the banned retry wording, in either view', () => {
    setTopology(blockedRegion());
    const { container } = render(<IncompleteDataBanner />);
    expect(container.textContent).not.toMatch(/retry|refresh|re-run/i);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 10 technical details' }));
    expect(container.textContent).not.toMatch(/retry|refresh|re-run/i);
  });
});

describe('IncompleteDataBanner: small and mixed cases', () => {
  it('shows the rows straight away when there are only a few', () => {
    setTopology(blockedRegion(2));
    render(<IncompleteDataBanner />);
    expect(screen.getByText('sa-east-1/Vpcs')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /technical details/ })).toBeNull();
  });

  it('offers only fixable actions for IAM when causes are mixed', () => {
    setTopology([
      ...blockedRegion(6),
      {
        label: 'us-east-1/RouteTables',
        kind: 'failed',
        message: 'User: arn:aws:iam::111122223333:user/auditor is not authorized to perform: ec2:DescribeRouteTables because no identity-based policy allows the ec2:DescribeRouteTables action',
      },
    ]);
    render(<IncompleteDataBanner />);
    const iam = screen.getByText(/Check your IAM policy grants ec2:DescribeRouteTables\./);
    expect(iam.textContent).not.toContain('ec2:DescribeVpcs');
    expect(screen.getByText(/Missing read permission: ec2:DescribeRouteTables/)).toBeTruthy();
    expect(screen.getByText(/Blocked by an organization policy: 6 calls in sa-east-1/)).toBeTruthy();
  });
});
