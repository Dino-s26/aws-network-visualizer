// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { useTopologyStore } from '../topology-store';
import type { DxNode } from '../../types/topology';

/**
 * updateNodeDimensions must be idempotent. The canvas library reports a container's
 * size back after every re-measure, and with `expandParent` it asks for the same growth
 * again each time the nodes are replaced. If applying an unchanged size still replaces
 * the node object, that is an endless loop in which no edge ever finishes drawing
 * (seen when expanding the Unattached resources zone).
 */
const node = (id: string, size?: { width: number; height: number }): DxNode =>
  ({
    id,
    type: 'awsCloud',
    position: { x: 0, y: 0 },
    data: {},
    ...(size ? { width: size.width, height: size.height, style: { width: size.width, height: size.height } } : {}),
  }) as unknown as DxNode;

const current = () => useTopologyStore.getState().currentNodes;
const update = (...changes: { id: string; width: number; height: number }[]) =>
  useTopologyStore.getState().updateNodeDimensions(changes);

beforeEach(() => {
  useTopologyStore.setState({ currentNodes: [], recommendedCurrentNodes: [] });
});

describe('updateNodeDimensions', () => {
  it('applies a real size change to the node, its style and its container data', () => {
    useTopologyStore.setState({ currentNodes: [node('cloud', { width: 100, height: 100 })] });
    update({ id: 'cloud', width: 200, height: 150 });
    const n = current()[0];
    expect(n.width).toBe(200);
    expect(n.height).toBe(150);
    expect(n.style).toMatchObject({ width: 200, height: 150 });
    expect(n.data).toMatchObject({ containerWidth: 200, containerHeight: 150 });
  });

  it('gives a node that has no size yet its first size', () => {
    useTopologyStore.setState({ currentNodes: [node('cloud')] });
    update({ id: 'cloud', width: 300, height: 200 });
    expect(current()[0].width).toBe(300);
  });

  it('leaves the state untouched when the size has not changed', () => {
    useTopologyStore.setState({ currentNodes: [node('cloud', { width: 100, height: 100 })] });
    update({ id: 'cloud', width: 200, height: 150 });
    const arrayBefore = current();
    const nodeBefore = current()[0];
    update({ id: 'cloud', width: 200, height: 150 });
    expect(current()).toBe(arrayBefore);
    expect(current()[0]).toBe(nodeBefore);
  });

  it('treats sub-pixel differences as the same size', () => {
    useTopologyStore.setState({ currentNodes: [node('cloud', { width: 200, height: 150 })] });
    const nodeBefore = current()[0];
    update({ id: 'cloud', width: 200.3, height: 149.8 });
    expect(current()[0]).toBe(nodeBefore);
  });

  it('still updates when only one dimension changed', () => {
    useTopologyStore.setState({ currentNodes: [node('cloud', { width: 200, height: 150 })] });
    update({ id: 'cloud', width: 200, height: 260 });
    expect(current()[0].height).toBe(260);
  });

  it('only replaces the nodes named in the change', () => {
    useTopologyStore.setState({
      currentNodes: [node('cloud', { width: 100, height: 100 }), node('region', { width: 50, height: 50 })],
    });
    const regionBefore = current()[1];
    update({ id: 'cloud', width: 400, height: 300 });
    expect(current()[0].width).toBe(400);
    expect(current()[1]).toBe(regionBefore);
  });

  it('applies the same rule to the recommended view', () => {
    useTopologyStore.setState({ recommendedCurrentNodes: [node('cloud', { width: 100, height: 100 })] });
    update({ id: 'cloud', width: 200, height: 150 });
    const before = useTopologyStore.getState().recommendedCurrentNodes;
    update({ id: 'cloud', width: 200, height: 150 });
    expect(useTopologyStore.getState().recommendedCurrentNodes).toBe(before);
    expect(before[0].width).toBe(200);
  });
});
