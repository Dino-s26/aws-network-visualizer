import { describe, it, expect } from 'vitest';
import { FIT_PADDING, growContainersToFit, shouldApplyDimensionChange, type FitNode } from '../container-fit';

const node = (id: string, parentId: string | undefined, x: number, y: number, width: number, height: number): FitNode => ({
  id, parentId, x, y, width, height,
});
const containers = (...ids: string[]) => (id: string) => ids.includes(id);

describe('growContainersToFit', () => {
  it('changes nothing when every child is inside with room to spare', () => {
    const nodes = [node('cloud', undefined, 0, 0, 800, 600), node('a', 'cloud', 50, 60, 200, 80)];
    expect(growContainersToFit(nodes, 'cloud', containers('cloud'))).toEqual([]);
  });

  it('grows to the right and bottom to hold a child dragged past the edge, plus padding', () => {
    const nodes = [node('cloud', undefined, 0, 0, 400, 300), node('a', 'cloud', 350, 280, 200, 80)];
    expect(growContainersToFit(nodes, 'cloud', containers('cloud'))).toEqual([
      { id: 'cloud', width: 350 + 200 + FIT_PADDING, height: 280 + 80 + FIT_PADDING },
    ]);
  });

  it('only grows the dimension that is too small', () => {
    const nodes = [node('cloud', undefined, 0, 0, 400, 900), node('a', 'cloud', 350, 10, 200, 80)];
    expect(growContainersToFit(nodes, 'cloud', containers('cloud'))).toEqual([
      { id: 'cloud', width: 350 + 200 + FIT_PADDING, height: 900 },
    ]);
  });

  it('never shrinks a container, even when it is far larger than its contents', () => {
    const nodes = [node('cloud', undefined, 0, 0, 5000, 4000), node('a', 'cloud', 10, 10, 100, 50)];
    expect(growContainersToFit(nodes, 'cloud', containers('cloud'))).toEqual([]);
  });

  it('cascades: a region that grew past the AWS box makes the AWS box grow too', () => {
    const nodes = [
      node('cloud', undefined, 0, 0, 600, 500),
      node('region', 'cloud', 100, 100, 480, 300),
      node('vpc', 'region', 400, 200, 200, 80), // dragged to the region edge: needs 400+200+24 = 624 wide
    ];
    const out = growContainersToFit(nodes, 'region', containers('cloud', 'region'));
    expect(out.map((c) => c.id)).toEqual(['region', 'cloud']);
    const region = out[0];
    expect(region.width).toBe(624);
    // The AWS box is sized from the region's NEW width: 100 + 624 + pad.
    expect(out[1].width).toBe(100 + 624 + FIT_PADDING);
  });

  it('keeps climbing through a parent that is not a container', () => {
    const nodes = [
      node('cloud', undefined, 0, 0, 300, 300),
      node('group', 'cloud', 20, 20, 100, 100), // not a container
      node('a', 'group', 10, 10, 50, 50),
      node('far', 'cloud', 280, 20, 100, 40),
    ];
    const out = growContainersToFit(nodes, 'group', containers('cloud'));
    expect(out).toEqual([{ id: 'cloud', width: 280 + 100 + FIT_PADDING, height: 300 }]);
  });

  it('does nothing without a parent or with an unknown parent', () => {
    const nodes = [node('a', undefined, 0, 0, 10, 10)];
    expect(growContainersToFit(nodes, undefined, containers('a'))).toEqual([]);
    expect(growContainersToFit(nodes, 'missing', containers('missing'))).toEqual([]);
  });

  it('terminates on a parent cycle instead of looping forever', () => {
    const loop = [node('a', 'b', 0, 0, 10, 10), node('b', 'a', 0, 0, 10, 10)];
    const out = growContainersToFit(loop, 'a', containers('a', 'b'));
    expect(out.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('rounds up to whole pixels', () => {
    const nodes = [node('cloud', undefined, 0, 0, 100, 100), node('a', 'cloud', 100.4, 0, 50.3, 10)];
    expect(growContainersToFit(nodes, 'cloud', containers('cloud'))[0].width).toBe(Math.ceil(100.4 + 50.3 + FIT_PADDING));
  });
});

describe('shouldApplyDimensionChange', () => {
  const ids = {
    resizable: new Set(['site', 'dxloc']),
    expandable: new Set(['aws-cloud', 'region-1']),
  };
  const dims = { width: 100, height: 100 };

  it('copies a manual resize of the AWS box and of a region', () => {
    expect(shouldApplyDimensionChange({ id: 'aws-cloud', dimensions: dims, resizing: true }, ids)).toBe(true);
    expect(shouldApplyDimensionChange({ id: 'region-1', dimensions: dims, resizing: true }, ids)).toBe(true);
  });

  it('copies the growth the canvas library applies when a child is dragged to the edge', () => {
    expect(shouldApplyDimensionChange({ id: 'aws-cloud', dimensions: dims, setAttributes: true }, ids)).toBe(true);
    expect(shouldApplyDimensionChange({ id: 'region-1', dimensions: dims, setAttributes: 'width' }, ids)).toBe(true);
  });

  it('keeps the old rule for customer sites and DX locations: manual resize only', () => {
    expect(shouldApplyDimensionChange({ id: 'site', dimensions: dims, resizing: true }, ids)).toBe(true);
    expect(shouldApplyDimensionChange({ id: 'dxloc', dimensions: dims, resizing: true }, ids)).toBe(true);
    expect(shouldApplyDimensionChange({ id: 'site', dimensions: dims, setAttributes: true }, ids)).toBe(false);
  });

  it('ignores measurement-only changes, unknown nodes and changes without dimensions', () => {
    expect(shouldApplyDimensionChange({ id: 'aws-cloud', dimensions: dims }, ids)).toBe(false);
    expect(shouldApplyDimensionChange({ id: 'region-1', dimensions: dims, resizing: false }, ids)).toBe(false);
    expect(shouldApplyDimensionChange({ id: 'other', dimensions: dims, resizing: true }, ids)).toBe(false);
    expect(shouldApplyDimensionChange({ id: 'aws-cloud', resizing: true }, ids)).toBe(false);
  });
});
