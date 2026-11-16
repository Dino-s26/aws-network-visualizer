// Normalized, read-only picture of AWS VPC networking for the VPC observability views.
// Plain data only. Objects refer to each other by ID, mirroring how the AWS APIs
// describe them, so fetchers stay simple mappers and engines (posture, reachability)
// stay pure functions. Field names are ours, not the SDK's.

export type Tags = Record<string, string>;

export interface VpcNet {
  id: string;
  region: string;
  accountId: string;
  name?: string;
  /** IPv4 CIDRs, primary first. */
  cidrs: string[];
  ipv6Cidrs: string[];
  isDefault: boolean;
  tags: Tags;
}

export interface Subnet {
  id: string;
  vpcId: string;
  region: string;
  az: string;
  cidr: string;
  ipv6Cidr?: string;
  mapPublicIpOnLaunch: boolean;
  name?: string;
  tags: Tags;
}

export type RouteTargetType =
  | 'local'
  | 'igw'
  | 'egress-only-igw'
  | 'nat'
  | 'tgw'
  | 'pcx'
  | 'vgw'
  | 'vpce'
  | 'eni'
  | 'instance'
  | 'core-network'
  | 'other';

export interface Route {
  /** Destination CIDR (IPv4 or IPv6). Absent when the route targets a prefix list. */
  destination?: string;
  destinationPrefixListId?: string;
  targetType: RouteTargetType;
  targetId: string;
  state: 'active' | 'blackhole';
  /** True when the route was learned through VGW route propagation. */
  propagated?: boolean;
}

export interface RouteTable {
  id: string;
  vpcId: string;
  region: string;
  /** The VPC main table applies to every subnet without an explicit association. */
  isMain: boolean;
  /** Explicitly associated subnets. */
  subnetIds: string[];
  routes: Route[];
  name?: string;
  tags: Tags;
}

export type SgPeer =
  | { kind: 'cidr'; cidr: string }
  | { kind: 'sg'; groupId: string }
  | { kind: 'prefix-list'; id: string };

export interface SgRule {
  direction: 'ingress' | 'egress';
  /** '-1' means all protocols; otherwise tcp, udp, icmp, icmpv6 or a protocol number. */
  protocol: string;
  fromPort?: number;
  toPort?: number;
  /** The other side: source for ingress, destination for egress. */
  source: SgPeer;
  description?: string;
}

export interface SecurityGroup {
  id: string;
  vpcId: string;
  region: string;
  name: string;
  isDefault: boolean;
  rules: SgRule[];
  tags: Tags;
}

export interface NaclEntry {
  /** Evaluated in ascending order; 32767 is the implicit deny. */
  ruleNumber: number;
  egress: boolean;
  protocol: string;
  action: 'allow' | 'deny';
  cidr: string;
  fromPort?: number;
  toPort?: number;
}

export interface NetworkAcl {
  id: string;
  vpcId: string;
  region: string;
  isDefault: boolean;
  subnetIds: string[];
  entries: NaclEntry[];
  tags: Tags;
}

export interface NetworkInterface {
  id: string;
  vpcId: string;
  subnetId: string;
  region: string;
  privateIps: string[];
  publicIp?: string;
  securityGroupIds: string[];
  /** AWS interface type, e.g. interface, nat_gateway, vpc_endpoint. */
  type: string;
  attachedTo?: { kind: 'instance' | 'nat' | 'endpoint' | 'elb' | 'lambda' | 'other'; id?: string };
  description?: string;
}

export interface InternetGateway {
  id: string;
  region: string;
  vpcId?: string;
}

export interface NatGateway {
  id: string;
  vpcId: string;
  subnetId: string;
  region: string;
  connectivity: 'public' | 'private';
  publicIp?: string;
  state: string;
}

export interface VpcEndpoint {
  id: string;
  vpcId: string;
  region: string;
  serviceName: string;
  type: 'Gateway' | 'Interface' | 'GatewayLoadBalancer';
  subnetIds: string[];
  routeTableIds: string[];
  securityGroupIds: string[];
  networkInterfaceIds: string[];
  privateDnsEnabled: boolean;
  state: string;
}

export interface PrefixList {
  id: string;
  region: string;
  name: string;
  cidrs: string[];
  awsManaged: boolean;
}

export interface Tgw {
  id: string;
  region: string;
  ownerId: string;
  name?: string;
}

export interface TgwAttachment {
  id: string;
  tgwId: string;
  region: string;
  resourceType: 'vpc' | 'vpn' | 'direct-connect-gateway' | 'peering' | 'connect' | 'other';
  resourceId: string;
  /** For VPC attachments: the subnets holding the attachment ENIs. */
  subnetIds: string[];
  associatedRouteTableId?: string;
  state: string;
}

export interface TgwRoute {
  destination: string;
  state: 'active' | 'blackhole';
  type: 'static' | 'propagated';
  attachmentId?: string;
}

export interface TgwRouteTable {
  id: string;
  tgwId: string;
  region: string;
  routes: TgwRoute[];
  propagatingAttachmentIds: string[];
}

export interface PeeringSide {
  vpcId: string;
  region: string;
  accountId: string;
}

export interface PeeringConnection {
  id: string;
  requester: PeeringSide;
  accepter: PeeringSide;
  state: string;
}

export interface FlowLog {
  id: string;
  /** VPC, subnet or network interface ID the flow log is attached to. */
  resourceId: string;
  trafficType: 'ALL' | 'ACCEPT' | 'REJECT';
  destinationType: string;
  status: string;
}

export interface NetworkModel {
  accounts: string[];
  regions: string[];
  vpcs: VpcNet[];
  subnets: Subnet[];
  routeTables: RouteTable[];
  securityGroups: SecurityGroup[];
  networkAcls: NetworkAcl[];
  networkInterfaces: NetworkInterface[];
  internetGateways: InternetGateway[];
  natGateways: NatGateway[];
  vpcEndpoints: VpcEndpoint[];
  prefixLists: PrefixList[];
  transitGateways: Tgw[];
  tgwAttachments: TgwAttachment[];
  tgwRouteTables: TgwRouteTable[];
  peeringConnections: PeeringConnection[];
  flowLogs: FlowLog[];
}
