import type { NaclEntry, NetworkModel, SgPeer, SgRule } from './model';

// Synthetic VPC estate for demo mode and as a shared test fixture. Every value is
// documentation-safe: example account 111122223333, private 10.x ranges, public IPs
// from 203.0.113.0/24 (TEST-NET-3), a prefix list from 198.51.100.0/24 (TEST-NET-2),
// and IDs that contain "demo" so they can never be mistaken for real resources.
//
// Deliberate problems, for the security posture rules and the reachability engine:
//   1. sg-demo-bastion allows SSH (22) from the whole internet, on an ENI with a public IP.
//   2. rtb-demo-dev-main has no route back to the shared VPC over the peering (one-way path).
//   3. rtb-demo-prod-data has a blackhole route to a deleted peering.
//   4. tgw-rtb-demo-main has a blackhole static route.
//   5. vpc-demo-default is an unused default VPC.
//   6. Only vpc-demo-prod has VPC Flow Logs.
//   7. sg-demo-unused is attached to nothing and allows RDP (3389) from the internet.

const ACCOUNT = '111122223333';
const R1 = 'ap-southeast-1';
const R2 = 'ap-southeast-3';
const ANY = '0.0.0.0/0';

const cidr = (c: string): SgPeer => ({ kind: 'cidr', cidr: c });
const group = (groupId: string): SgPeer => ({ kind: 'sg', groupId });
const tcpIn = (port: number, source: SgPeer): SgRule => ({ direction: 'ingress', protocol: 'tcp', fromPort: port, toPort: port, source });
const allOut: SgRule = { direction: 'egress', protocol: '-1', source: cidr(ANY) };

const allowAll = (): NaclEntry[] => [
  { ruleNumber: 100, egress: false, protocol: '-1', action: 'allow', cidr: ANY },
  { ruleNumber: 32767, egress: false, protocol: '-1', action: 'deny', cidr: ANY },
  { ruleNumber: 100, egress: true, protocol: '-1', action: 'allow', cidr: ANY },
  { ruleNumber: 32767, egress: true, protocol: '-1', action: 'deny', cidr: ANY },
];

/** A fresh copy each call, so callers can never corrupt shared state. */
export function getDemoNetworkModel(): NetworkModel {
  return {
    accounts: [ACCOUNT],
    regions: [R1, R2],
    vpcs: [
      { id: 'vpc-demo-prod', region: R1, accountId: ACCOUNT, name: 'prod-app', cidrs: ['10.10.0.0/16'], ipv6Cidrs: [], isDefault: false, tags: { Name: 'prod-app' } },
      { id: 'vpc-demo-shared', region: R1, accountId: ACCOUNT, name: 'shared-services', cidrs: ['10.20.0.0/16'], ipv6Cidrs: [], isDefault: false, tags: { Name: 'shared-services' } },
      { id: 'vpc-demo-dev', region: R2, accountId: ACCOUNT, name: 'dev-sandbox', cidrs: ['10.30.0.0/16'], ipv6Cidrs: [], isDefault: false, tags: { Name: 'dev-sandbox' } },
      { id: 'vpc-demo-default', region: R1, accountId: ACCOUNT, cidrs: ['172.31.0.0/16'], ipv6Cidrs: [], isDefault: true, tags: {} },
    ],
    subnets: [
      { id: 'subnet-demo-prod-pub-a', vpcId: 'vpc-demo-prod', region: R1, az: R1 + 'a', cidr: '10.10.0.0/24', mapPublicIpOnLaunch: true, name: 'prod-public-a', tags: {} },
      { id: 'subnet-demo-prod-pub-b', vpcId: 'vpc-demo-prod', region: R1, az: R1 + 'b', cidr: '10.10.1.0/24', mapPublicIpOnLaunch: true, name: 'prod-public-b', tags: {} },
      { id: 'subnet-demo-prod-app-a', vpcId: 'vpc-demo-prod', region: R1, az: R1 + 'a', cidr: '10.10.10.0/24', mapPublicIpOnLaunch: false, name: 'prod-app-a', tags: {} },
      { id: 'subnet-demo-prod-app-b', vpcId: 'vpc-demo-prod', region: R1, az: R1 + 'b', cidr: '10.10.11.0/24', mapPublicIpOnLaunch: false, name: 'prod-app-b', tags: {} },
      { id: 'subnet-demo-prod-data-a', vpcId: 'vpc-demo-prod', region: R1, az: R1 + 'a', cidr: '10.10.20.0/24', mapPublicIpOnLaunch: false, name: 'prod-data-a', tags: {} },
      { id: 'subnet-demo-prod-data-b', vpcId: 'vpc-demo-prod', region: R1, az: R1 + 'b', cidr: '10.10.21.0/24', mapPublicIpOnLaunch: false, name: 'prod-data-b', tags: {} },
      { id: 'subnet-demo-shared-svc-a', vpcId: 'vpc-demo-shared', region: R1, az: R1 + 'a', cidr: '10.20.10.0/24', mapPublicIpOnLaunch: false, name: 'shared-svc-a', tags: {} },
      { id: 'subnet-demo-shared-svc-b', vpcId: 'vpc-demo-shared', region: R1, az: R1 + 'b', cidr: '10.20.11.0/24', mapPublicIpOnLaunch: false, name: 'shared-svc-b', tags: {} },
      { id: 'subnet-demo-dev-pub-a', vpcId: 'vpc-demo-dev', region: R2, az: R2 + 'a', cidr: '10.30.0.0/24', mapPublicIpOnLaunch: true, name: 'dev-public-a', tags: {} },
      { id: 'subnet-demo-dev-app-a', vpcId: 'vpc-demo-dev', region: R2, az: R2 + 'a', cidr: '10.30.10.0/24', mapPublicIpOnLaunch: false, name: 'dev-app-a', tags: {} },
      { id: 'subnet-demo-default-a', vpcId: 'vpc-demo-default', region: R1, az: R1 + 'a', cidr: '172.31.0.0/20', mapPublicIpOnLaunch: true, tags: {} },
    ],
    routeTables: [
      { id: 'rtb-demo-prod-main', vpcId: 'vpc-demo-prod', region: R1, isMain: true, subnetIds: [], tags: {}, routes: [
        { destination: '10.10.0.0/16', targetType: 'local', targetId: 'local', state: 'active' },
      ] },
      { id: 'rtb-demo-prod-public', vpcId: 'vpc-demo-prod', region: R1, isMain: false, subnetIds: ['subnet-demo-prod-pub-a', 'subnet-demo-prod-pub-b'], name: 'prod-public', tags: {}, routes: [
        { destination: '10.10.0.0/16', targetType: 'local', targetId: 'local', state: 'active' },
        { destination: ANY, targetType: 'igw', targetId: 'igw-demo-prod', state: 'active' },
      ] },
      { id: 'rtb-demo-prod-app', vpcId: 'vpc-demo-prod', region: R1, isMain: false, subnetIds: ['subnet-demo-prod-app-a', 'subnet-demo-prod-app-b'], name: 'prod-app', tags: {}, routes: [
        { destination: '10.10.0.0/16', targetType: 'local', targetId: 'local', state: 'active' },
        { destination: ANY, targetType: 'nat', targetId: 'nat-demo-prod-a', state: 'active' },
        { destination: '10.20.0.0/16', targetType: 'tgw', targetId: 'tgw-demo-hub', state: 'active' },
        { destinationPrefixListId: 'pl-demo-s3', targetType: 'vpce', targetId: 'vpce-demo-s3', state: 'active' },
      ] },
      { id: 'rtb-demo-prod-data', vpcId: 'vpc-demo-prod', region: R1, isMain: false, subnetIds: ['subnet-demo-prod-data-a', 'subnet-demo-prod-data-b'], name: 'prod-data', tags: {}, routes: [
        { destination: '10.10.0.0/16', targetType: 'local', targetId: 'local', state: 'active' },
        { destination: '10.20.0.0/16', targetType: 'tgw', targetId: 'tgw-demo-hub', state: 'active' },
        { destination: '10.99.0.0/16', targetType: 'pcx', targetId: 'pcx-demo-deleted', state: 'blackhole' },
      ] },
      { id: 'rtb-demo-shared-main', vpcId: 'vpc-demo-shared', region: R1, isMain: true, subnetIds: [], tags: {}, routes: [
        { destination: '10.20.0.0/16', targetType: 'local', targetId: 'local', state: 'active' },
        { destination: '10.10.0.0/16', targetType: 'tgw', targetId: 'tgw-demo-hub', state: 'active' },
        { destination: '10.30.0.0/16', targetType: 'pcx', targetId: 'pcx-demo-shared-dev', state: 'active' },
      ] },
      { id: 'rtb-demo-dev-main', vpcId: 'vpc-demo-dev', region: R2, isMain: true, subnetIds: [], tags: {}, routes: [
        { destination: '10.30.0.0/16', targetType: 'local', targetId: 'local', state: 'active' },
      ] },
      { id: 'rtb-demo-dev-public', vpcId: 'vpc-demo-dev', region: R2, isMain: false, subnetIds: ['subnet-demo-dev-pub-a'], name: 'dev-public', tags: {}, routes: [
        { destination: '10.30.0.0/16', targetType: 'local', targetId: 'local', state: 'active' },
        { destination: ANY, targetType: 'igw', targetId: 'igw-demo-dev', state: 'active' },
      ] },
      { id: 'rtb-demo-default-main', vpcId: 'vpc-demo-default', region: R1, isMain: true, subnetIds: [], tags: {}, routes: [
        { destination: '172.31.0.0/16', targetType: 'local', targetId: 'local', state: 'active' },
        { destination: ANY, targetType: 'igw', targetId: 'igw-demo-default', state: 'active' },
      ] },
    ],
    securityGroups: [
      { id: 'sg-demo-web', vpcId: 'vpc-demo-prod', region: R1, name: 'web', isDefault: false, tags: {}, rules: [tcpIn(443, cidr(ANY)), allOut] },
      { id: 'sg-demo-app', vpcId: 'vpc-demo-prod', region: R1, name: 'app', isDefault: false, tags: {}, rules: [tcpIn(8080, group('sg-demo-web')), allOut] },
      { id: 'sg-demo-db', vpcId: 'vpc-demo-prod', region: R1, name: 'db', isDefault: false, tags: {}, rules: [tcpIn(5432, group('sg-demo-app')), allOut] },
      { id: 'sg-demo-endpoints', vpcId: 'vpc-demo-prod', region: R1, name: 'endpoints', isDefault: false, tags: {}, rules: [tcpIn(443, cidr('10.10.0.0/16')), allOut] },
      { id: 'sg-demo-unused', vpcId: 'vpc-demo-prod', region: R1, name: 'legacy-rdp', isDefault: false, tags: {}, rules: [tcpIn(3389, cidr(ANY)), allOut] },
      { id: 'sg-demo-prod-default', vpcId: 'vpc-demo-prod', region: R1, name: 'default', isDefault: true, tags: {}, rules: [{ direction: 'ingress', protocol: '-1', source: group('sg-demo-prod-default') }, allOut] },
      { id: 'sg-demo-shared-svc', vpcId: 'vpc-demo-shared', region: R1, name: 'shared-svc', isDefault: false, tags: {}, rules: [tcpIn(443, cidr('10.0.0.0/8')), allOut] },
      { id: 'sg-demo-shared-default', vpcId: 'vpc-demo-shared', region: R1, name: 'default', isDefault: true, tags: {}, rules: [{ direction: 'ingress', protocol: '-1', source: group('sg-demo-shared-default') }, allOut] },
      { id: 'sg-demo-bastion', vpcId: 'vpc-demo-dev', region: R2, name: 'bastion', isDefault: false, tags: {}, rules: [tcpIn(22, cidr(ANY)), allOut] },
      { id: 'sg-demo-dev-default', vpcId: 'vpc-demo-dev', region: R2, name: 'default', isDefault: true, tags: {}, rules: [{ direction: 'ingress', protocol: '-1', source: group('sg-demo-dev-default') }, allOut] },
      { id: 'sg-demo-default-default', vpcId: 'vpc-demo-default', region: R1, name: 'default', isDefault: true, tags: {}, rules: [{ direction: 'ingress', protocol: '-1', source: group('sg-demo-default-default') }, allOut] },
    ],
    networkAcls: [
      { id: 'acl-demo-prod-default', vpcId: 'vpc-demo-prod', region: R1, isDefault: true, tags: {}, entries: allowAll(), subnetIds: ['subnet-demo-prod-pub-a', 'subnet-demo-prod-pub-b', 'subnet-demo-prod-app-a', 'subnet-demo-prod-app-b'] },
      { id: 'acl-demo-prod-data', vpcId: 'vpc-demo-prod', region: R1, isDefault: false, tags: {}, subnetIds: ['subnet-demo-prod-data-a', 'subnet-demo-prod-data-b'], entries: [
        { ruleNumber: 100, egress: false, protocol: 'tcp', action: 'allow', cidr: '10.10.10.0/23', fromPort: 5432, toPort: 5432 },
        { ruleNumber: 32767, egress: false, protocol: '-1', action: 'deny', cidr: ANY },
        { ruleNumber: 100, egress: true, protocol: 'tcp', action: 'allow', cidr: '10.10.10.0/23', fromPort: 1024, toPort: 65535 },
        { ruleNumber: 32767, egress: true, protocol: '-1', action: 'deny', cidr: ANY },
      ] },
      { id: 'acl-demo-shared-default', vpcId: 'vpc-demo-shared', region: R1, isDefault: true, tags: {}, entries: allowAll(), subnetIds: ['subnet-demo-shared-svc-a', 'subnet-demo-shared-svc-b'] },
      { id: 'acl-demo-dev-default', vpcId: 'vpc-demo-dev', region: R2, isDefault: true, tags: {}, entries: allowAll(), subnetIds: ['subnet-demo-dev-pub-a', 'subnet-demo-dev-app-a'] },
      { id: 'acl-demo-default-default', vpcId: 'vpc-demo-default', region: R1, isDefault: true, tags: {}, entries: allowAll(), subnetIds: ['subnet-demo-default-a'] },
    ],
    networkInterfaces: [
      { id: 'eni-demo-alb-a', vpcId: 'vpc-demo-prod', subnetId: 'subnet-demo-prod-pub-a', region: R1, privateIps: ['10.10.0.10'], publicIp: '203.0.113.20', securityGroupIds: ['sg-demo-web'], type: 'interface', attachedTo: { kind: 'elb' } },
      { id: 'eni-demo-nat-a', vpcId: 'vpc-demo-prod', subnetId: 'subnet-demo-prod-pub-a', region: R1, privateIps: ['10.10.0.5'], publicIp: '203.0.113.10', securityGroupIds: [], type: 'nat_gateway', attachedTo: { kind: 'nat', id: 'nat-demo-prod-a' } },
      { id: 'eni-demo-app-a', vpcId: 'vpc-demo-prod', subnetId: 'subnet-demo-prod-app-a', region: R1, privateIps: ['10.10.10.10'], securityGroupIds: ['sg-demo-app'], type: 'interface', attachedTo: { kind: 'instance', id: 'i-demo-app-a' } },
      { id: 'eni-demo-app-b', vpcId: 'vpc-demo-prod', subnetId: 'subnet-demo-prod-app-b', region: R1, privateIps: ['10.10.11.10'], securityGroupIds: ['sg-demo-app'], type: 'interface', attachedTo: { kind: 'instance', id: 'i-demo-app-b' } },
      { id: 'eni-demo-db-a', vpcId: 'vpc-demo-prod', subnetId: 'subnet-demo-prod-data-a', region: R1, privateIps: ['10.10.20.10'], securityGroupIds: ['sg-demo-db'], type: 'interface', attachedTo: { kind: 'other' } },
      { id: 'eni-demo-vpce-ssm-a', vpcId: 'vpc-demo-prod', subnetId: 'subnet-demo-prod-app-a', region: R1, privateIps: ['10.10.10.50'], securityGroupIds: ['sg-demo-endpoints'], type: 'vpc_endpoint', attachedTo: { kind: 'endpoint', id: 'vpce-demo-ssm' } },
      { id: 'eni-demo-shared-svc-a', vpcId: 'vpc-demo-shared', subnetId: 'subnet-demo-shared-svc-a', region: R1, privateIps: ['10.20.10.10'], securityGroupIds: ['sg-demo-shared-svc'], type: 'interface', attachedTo: { kind: 'instance', id: 'i-demo-shared-a' } },
      { id: 'eni-demo-bastion', vpcId: 'vpc-demo-dev', subnetId: 'subnet-demo-dev-pub-a', region: R2, privateIps: ['10.30.0.10'], publicIp: '203.0.113.30', securityGroupIds: ['sg-demo-bastion'], type: 'interface', attachedTo: { kind: 'instance', id: 'i-demo-bastion' } },
      { id: 'eni-demo-dev-app', vpcId: 'vpc-demo-dev', subnetId: 'subnet-demo-dev-app-a', region: R2, privateIps: ['10.30.10.10'], securityGroupIds: ['sg-demo-dev-default'], type: 'interface', attachedTo: { kind: 'instance', id: 'i-demo-dev-app' } },
    ],
    internetGateways: [
      { id: 'igw-demo-prod', region: R1, vpcId: 'vpc-demo-prod' },
      { id: 'igw-demo-dev', region: R2, vpcId: 'vpc-demo-dev' },
      { id: 'igw-demo-default', region: R1, vpcId: 'vpc-demo-default' },
    ],
    natGateways: [
      { id: 'nat-demo-prod-a', vpcId: 'vpc-demo-prod', subnetId: 'subnet-demo-prod-pub-a', region: R1, connectivity: 'public', publicIp: '203.0.113.10', state: 'available' },
    ],
    vpcEndpoints: [
      { id: 'vpce-demo-s3', vpcId: 'vpc-demo-prod', region: R1, serviceName: 'com.amazonaws.' + R1 + '.s3', type: 'Gateway', subnetIds: [], routeTableIds: ['rtb-demo-prod-app'], securityGroupIds: [], networkInterfaceIds: [], privateDnsEnabled: false, state: 'available' },
      { id: 'vpce-demo-ssm', vpcId: 'vpc-demo-prod', region: R1, serviceName: 'com.amazonaws.' + R1 + '.ssm', type: 'Interface', subnetIds: ['subnet-demo-prod-app-a'], routeTableIds: [], securityGroupIds: ['sg-demo-endpoints'], networkInterfaceIds: ['eni-demo-vpce-ssm-a'], privateDnsEnabled: true, state: 'available' },
    ],
    prefixLists: [
      { id: 'pl-demo-s3', region: R1, name: 'com.amazonaws.' + R1 + '.s3', cidrs: ['198.51.100.0/24'], awsManaged: true },
    ],
    transitGateways: [{ id: 'tgw-demo-hub', region: R1, ownerId: ACCOUNT, name: 'hub' }],
    tgwAttachments: [
      { id: 'tgw-attach-demo-prod', tgwId: 'tgw-demo-hub', region: R1, resourceType: 'vpc', resourceId: 'vpc-demo-prod', subnetIds: ['subnet-demo-prod-app-a', 'subnet-demo-prod-app-b'], associatedRouteTableId: 'tgw-rtb-demo-main', state: 'available' },
      { id: 'tgw-attach-demo-shared', tgwId: 'tgw-demo-hub', region: R1, resourceType: 'vpc', resourceId: 'vpc-demo-shared', subnetIds: ['subnet-demo-shared-svc-a', 'subnet-demo-shared-svc-b'], associatedRouteTableId: 'tgw-rtb-demo-main', state: 'available' },
    ],
    tgwRouteTables: [
      { id: 'tgw-rtb-demo-main', tgwId: 'tgw-demo-hub', region: R1, propagatingAttachmentIds: ['tgw-attach-demo-prod', 'tgw-attach-demo-shared'], routes: [
        { destination: '10.10.0.0/16', state: 'active', type: 'propagated', attachmentId: 'tgw-attach-demo-prod' },
        { destination: '10.20.0.0/16', state: 'active', type: 'propagated', attachmentId: 'tgw-attach-demo-shared' },
        { destination: '10.50.0.0/16', state: 'blackhole', type: 'static' },
      ] },
    ],
    peeringConnections: [
      { id: 'pcx-demo-shared-dev', state: 'active', requester: { vpcId: 'vpc-demo-shared', region: R1, accountId: ACCOUNT }, accepter: { vpcId: 'vpc-demo-dev', region: R2, accountId: ACCOUNT } },
    ],
    flowLogs: [
      { id: 'fl-demo-prod', resourceId: 'vpc-demo-prod', trafficType: 'ALL', destinationType: 'cloud-watch-logs', status: 'ACTIVE' },
    ],
  };
}
