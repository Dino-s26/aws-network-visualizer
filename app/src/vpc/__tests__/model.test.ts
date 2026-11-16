import { describe, it, expect } from 'vitest';
import { getDemoNetworkModel } from '../demo-data';
import { indexModel, isPublicSubnet } from '../lookup';
import { parseIpRange, rangeCovers } from '../../utils/cidr';

const m = getDemoNetworkModel();
const idx = indexModel(m);
const inside = (outer: string, inner: string) => rangeCovers(parseIpRange(outer), parseIpRange(inner));

describe('demo network model: safety', () => {
  it('returns a fresh object each call', () => {
    const a = getDemoNetworkModel();
    a.vpcs.length = 0;
    expect(getDemoNetworkModel().vpcs.length).toBeGreaterThan(0);
  });

  it('uses only documentation-safe identifiers', () => {
    expect(m.accounts).toEqual(['111122223333']);
    for (const v of m.vpcs) expect(v.accountId).toBe('111122223333');
    for (const e of m.networkInterfaces) {
      if (e.publicIp) expect(inside('203.0.113.0/24', e.publicIp + '/32')).toBe(true);
    }
    const everyId = [
      ...m.vpcs, ...m.subnets, ...m.routeTables, ...m.securityGroups, ...m.networkAcls, ...m.networkInterfaces,
      ...m.internetGateways, ...m.natGateways, ...m.vpcEndpoints, ...m.prefixLists, ...m.transitGateways,
      ...m.tgwAttachments, ...m.tgwRouteTables, ...m.peeringConnections, ...m.flowLogs,
    ].map((x) => x.id);
    for (const id of everyId) expect(id).toContain('demo');
    expect(new Set(everyId).size).toBe(everyId.length);
  });
});

describe('demo network model: internal consistency', () => {
  it('puts every subnet in an existing VPC and inside one of its CIDRs', () => {
    for (const s of m.subnets) {
      const vpc = idx.vpcs.get(s.vpcId);
      expect(vpc, s.id).toBeDefined();
      expect(vpc!.cidrs.some((c) => inside(c, s.cidr)), s.id).toBe(true);
      expect(s.region).toBe(vpc!.region);
    }
  });

  it('resolves a route table and a network ACL for every subnet, in the same VPC', () => {
    for (const s of m.subnets) {
      expect(idx.routeTableBySubnet.get(s.id)?.vpcId, s.id).toBe(s.vpcId);
      expect(idx.naclBySubnet.get(s.id)?.vpcId, s.id).toBe(s.vpcId);
    }
  });

  it('points every active route at something that exists', () => {
    for (const rt of m.routeTables) {
      for (const r of rt.routes.filter((x) => x.state === 'active')) {
        const label = rt.id + ' -> ' + r.targetId;
        if (r.targetType === 'igw') expect(idx.internetGateways.has(r.targetId), label).toBe(true);
        if (r.targetType === 'nat') expect(idx.natGateways.has(r.targetId), label).toBe(true);
        if (r.targetType === 'tgw') expect(idx.transitGateways.has(r.targetId), label).toBe(true);
        if (r.targetType === 'pcx') expect(idx.peeringConnections.has(r.targetId), label).toBe(true);
        if (r.targetType === 'vpce') expect(idx.vpcEndpoints.has(r.targetId), label).toBe(true);
        if (r.destinationPrefixListId) expect(idx.prefixLists.has(r.destinationPrefixListId), label).toBe(true);
        expect(Boolean(r.destination) !== Boolean(r.destinationPrefixListId), label).toBe(true);
      }
    }
  });

  it('places every network interface in an existing subnet, with its IP inside that subnet', () => {
    for (const e of m.networkInterfaces) {
      const s = idx.subnets.get(e.subnetId);
      expect(s, e.id).toBeDefined();
      expect(s!.vpcId).toBe(e.vpcId);
      for (const ip of e.privateIps) expect(inside(s!.cidr, ip + '/32'), e.id).toBe(true);
      for (const sg of e.securityGroupIds) expect(idx.securityGroups.get(sg)?.vpcId, e.id).toBe(e.vpcId);
    }
  });

  it('resolves security group references and network ACL subnets', () => {
    for (const sg of m.securityGroups) {
      expect(idx.vpcs.has(sg.vpcId), sg.id).toBe(true);
      for (const r of sg.rules) {
        if (r.source.kind === 'sg') expect(idx.securityGroups.has(r.source.groupId), sg.id).toBe(true);
        if (r.source.kind === 'prefix-list') expect(idx.prefixLists.has(r.source.id), sg.id).toBe(true);
      }
    }
    for (const acl of m.networkAcls) {
      for (const s of acl.subnetIds) expect(idx.subnets.get(s)?.vpcId, acl.id).toBe(acl.vpcId);
    }
  });

  it('resolves gateways, endpoints, transit gateway and peering references', () => {
    for (const g of m.internetGateways) if (g.vpcId) expect(idx.vpcs.has(g.vpcId), g.id).toBe(true);
    for (const n of m.natGateways) expect(idx.subnets.get(n.subnetId)?.vpcId, n.id).toBe(n.vpcId);
    for (const e of m.vpcEndpoints) {
      expect(idx.vpcs.has(e.vpcId), e.id).toBe(true);
      for (const id of e.subnetIds) expect(idx.subnets.has(id), e.id).toBe(true);
      for (const id of e.routeTableIds) expect(idx.routeTables.has(id), e.id).toBe(true);
      for (const id of e.securityGroupIds) expect(idx.securityGroups.has(id), e.id).toBe(true);
      for (const id of e.networkInterfaceIds) expect(idx.networkInterfaces.has(id), e.id).toBe(true);
    }
    for (const a of m.tgwAttachments) {
      expect(idx.transitGateways.has(a.tgwId), a.id).toBe(true);
      if (a.resourceType === 'vpc') expect(idx.vpcs.has(a.resourceId), a.id).toBe(true);
      for (const id of a.subnetIds) expect(idx.subnets.has(id), a.id).toBe(true);
      if (a.associatedRouteTableId) expect(idx.tgwRouteTables.has(a.associatedRouteTableId), a.id).toBe(true);
    }
    for (const rt of m.tgwRouteTables) {
      for (const id of rt.propagatingAttachmentIds) expect(idx.tgwAttachments.has(id), rt.id).toBe(true);
      for (const r of rt.routes) if (r.attachmentId) expect(idx.tgwAttachments.has(r.attachmentId), rt.id).toBe(true);
    }
    for (const p of m.peeringConnections) {
      expect(idx.vpcs.has(p.requester.vpcId), p.id).toBe(true);
      expect(idx.vpcs.has(p.accepter.vpcId), p.id).toBe(true);
    }
  });
});

describe('lookup helpers', () => {
  it('uses the explicit route table association, and falls back to the VPC main table', () => {
    expect(idx.routeTableBySubnet.get('subnet-demo-prod-app-a')?.id).toBe('rtb-demo-prod-app');
    expect(idx.routeTableBySubnet.get('subnet-demo-shared-svc-a')?.id).toBe('rtb-demo-shared-main');
    expect(idx.routeTableBySubnet.get('subnet-demo-dev-app-a')?.id).toBe('rtb-demo-dev-main');
  });

  it('detects public subnets by an active default route to an internet gateway', () => {
    expect(isPublicSubnet(idx, 'subnet-demo-prod-pub-a')).toBe(true);
    expect(isPublicSubnet(idx, 'subnet-demo-prod-app-a')).toBe(false);
    expect(isPublicSubnet(idx, 'subnet-demo-prod-data-a')).toBe(false);
    expect(isPublicSubnet(idx, 'subnet-does-not-exist')).toBe(false);
  });

  it('groups subnets by VPC and interfaces by subnet', () => {
    expect(idx.subnetsByVpc.get('vpc-demo-prod')).toHaveLength(6);
    expect(idx.enisBySubnet.get('subnet-demo-prod-pub-a')?.map((e) => e.id).sort()).toEqual(['eni-demo-alb-a', 'eni-demo-nat-a']);
  });
});

describe('demo network model: deliberate findings (targets for posture and reachability)', () => {
  it('has SSH open to the internet on an interface with a public IP', () => {
    const sg = idx.securityGroups.get('sg-demo-bastion')!;
    expect(sg.rules.some((r) => r.direction === 'ingress' && r.fromPort === 22 && r.source.kind === 'cidr' && r.source.cidr === '0.0.0.0/0')).toBe(true);
    const eni = idx.networkInterfaces.get('eni-demo-bastion')!;
    expect(eni.publicIp).toBeDefined();
    expect(isPublicSubnet(idx, eni.subnetId)).toBe(true);
  });

  it('has a one-way peering path: shared routes to dev, dev has no route back', () => {
    const shared = idx.routeTables.get('rtb-demo-shared-main')!;
    const dev = idx.routeTables.get('rtb-demo-dev-main')!;
    expect(shared.routes.some((r) => r.targetId === 'pcx-demo-shared-dev')).toBe(true);
    expect(dev.routes.some((r) => r.targetType === 'pcx')).toBe(false);
  });

  it('has blackhole routes in a VPC route table and in the transit gateway route table', () => {
    expect(idx.routeTables.get('rtb-demo-prod-data')!.routes.some((r) => r.state === 'blackhole')).toBe(true);
    expect(idx.tgwRouteTables.get('tgw-rtb-demo-main')!.routes.some((r) => r.state === 'blackhole')).toBe(true);
  });

  it('has an unused default VPC and flow logs on only one VPC', () => {
    const def = m.vpcs.find((v) => v.isDefault)!;
    expect(m.networkInterfaces.some((e) => e.vpcId === def.id)).toBe(false);
    expect(m.flowLogs.map((fl) => fl.resourceId)).toEqual(['vpc-demo-prod']);
  });

  it('has an unused security group that is open to the internet', () => {
    const used = new Set(m.networkInterfaces.flatMap((e) => e.securityGroupIds));
    expect(used.has('sg-demo-unused')).toBe(false);
    expect(idx.securityGroups.get('sg-demo-unused')!.rules.some((r) => r.fromPort === 3389 && r.source.kind === 'cidr' && r.source.cidr === '0.0.0.0/0')).toBe(true);
  });
});
