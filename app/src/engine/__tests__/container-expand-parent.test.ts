import { describe, it, expect } from 'vitest';
import { multiDxgwTopology } from './fixtures/multi-dxgw-topology';
import { vpnOnlyTopology } from './fixtures/vpn-only-topology';
import { buildGraph } from '../topology-builder';
import { applyLayout } from '../layout-engine';
import type { DxNode, DxEdge, TopologyData } from '../../types/topology';

/**
 * The AWS box and the region boxes grow when a node inside them is dragged to their
 * edge. That is the canvas library's `expandParent` feature, and it only works if the
 * layout marks the children for it and does not clamp them inside the parent
 * (`extent: 'parent'` would stop them leaving). These tests pin both.
 */
function layout(topology: TopologyData): DxNode[] {
  const { nodes, edges } = buildGraph(topology, new Set());
  return applyLayout(nodes as DxNode[], edges as DxEdge[]);
}

describe.each([
  ['multi-DXGW estate', multiDxgwTopology],
  ['VPN-only estate', vpnOnlyTopology],
])('%s', (_name, topology) => {
  const nodes = layout(topology);
  const regionIds = new Set(nodes.filter((n) => n.data.category === 'region').map((n) => n.id));
  const awsKids = nodes.filter((n) => n.parentId === 'aws-cloud');
  const regionKids = nodes.filter((n) => n.parentId != null && regionIds.has(n.parentId));

  it('has children inside the AWS box to test', () => {
    expect(awsKids.length).toBeGreaterThan(0);
  });

  it('lets every child of the AWS box grow it', () => {
    for (const kid of awsKids) expect(kid.expandParent, kid.id).toBe(true);
  });

  it('lets every child of a region grow that region', () => {
    for (const kid of regionKids) expect(kid.expandParent, kid.id).toBe(true);
  });

  it('does not clamp those children inside their parent', () => {
    for (const kid of [...awsKids, ...regionKids]) expect(kid.extent, kid.id).toBeUndefined();
  });
});
