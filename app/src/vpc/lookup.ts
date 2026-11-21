import type {
  InternetGateway,
  NatGateway,
  NetworkAcl,
  NetworkInterface,
  NetworkModel,
  PeeringConnection,
  PrefixList,
  RouteTable,
  SecurityGroup,
  Subnet,
  Tgw,
  TgwAttachment,
  TgwRouteTable,
  VpcEndpoint,
  VpcNet,
} from './model';

// Lookups over a NetworkModel, built once and shared by the map, the posture rules
// and the reachability engine. The two that matter most encode AWS rules that are
// easy to get wrong: which route table and which NACL actually apply to a subnet.

export interface ModelIndex {
  vpcs: Map<string, VpcNet>;
  subnets: Map<string, Subnet>;
  routeTables: Map<string, RouteTable>;
  securityGroups: Map<string, SecurityGroup>;
  networkAcls: Map<string, NetworkAcl>;
  networkInterfaces: Map<string, NetworkInterface>;
  internetGateways: Map<string, InternetGateway>;
  natGateways: Map<string, NatGateway>;
  vpcEndpoints: Map<string, VpcEndpoint>;
  prefixLists: Map<string, PrefixList>;
  transitGateways: Map<string, Tgw>;
  tgwAttachments: Map<string, TgwAttachment>;
  tgwRouteTables: Map<string, TgwRouteTable>;
  peeringConnections: Map<string, PeeringConnection>;
  subnetsByVpc: Map<string, Subnet[]>;
  enisBySubnet: Map<string, NetworkInterface[]>;
  /** Effective route table per subnet: explicit association, else the VPC main table. */
  routeTableBySubnet: Map<string, RouteTable>;
  /** Network ACL per subnet. */
  naclBySubnet: Map<string, NetworkAcl>;
}

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((i) => [i.id, i]));
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

export function indexModel(m: NetworkModel): ModelIndex {
  const mainByVpc = new Map<string, RouteTable>();
  const explicit = new Map<string, RouteTable>();
  for (const rt of m.routeTables) {
    if (rt.isMain) mainByVpc.set(rt.vpcId, rt);
    for (const subnetId of rt.subnetIds) explicit.set(subnetId, rt);
  }
  const routeTableBySubnet = new Map<string, RouteTable>();
  for (const s of m.subnets) {
    const rt = explicit.get(s.id) ?? mainByVpc.get(s.vpcId);
    if (rt) routeTableBySubnet.set(s.id, rt);
  }

  const naclBySubnet = new Map<string, NetworkAcl>();
  for (const acl of m.networkAcls) {
    for (const subnetId of acl.subnetIds) naclBySubnet.set(subnetId, acl);
  }

  return {
    vpcs: byId(m.vpcs),
    subnets: byId(m.subnets),
    routeTables: byId(m.routeTables),
    securityGroups: byId(m.securityGroups),
    networkAcls: byId(m.networkAcls),
    networkInterfaces: byId(m.networkInterfaces),
    internetGateways: byId(m.internetGateways),
    natGateways: byId(m.natGateways),
    vpcEndpoints: byId(m.vpcEndpoints),
    prefixLists: byId(m.prefixLists),
    transitGateways: byId(m.transitGateways),
    tgwAttachments: byId(m.tgwAttachments),
    tgwRouteTables: byId(m.tgwRouteTables),
    peeringConnections: byId(m.peeringConnections),
    subnetsByVpc: groupBy(m.subnets, (s) => s.vpcId),
    enisBySubnet: groupBy(m.networkInterfaces, (e) => e.subnetId),
    routeTableBySubnet,
    naclBySubnet,
  };
}

/** A subnet is public when its effective route table has an active default route to an internet gateway. */
export function isPublicSubnet(idx: ModelIndex, subnetId: string): boolean {
  const rt = idx.routeTableBySubnet.get(subnetId);
  if (!rt) return false;
  return rt.routes.some(
    (r) => r.state === 'active' && r.targetType === 'igw' && (r.destination === '0.0.0.0/0' || r.destination === '::/0'),
  );
}
