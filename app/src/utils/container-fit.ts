/**
 * Helpers for the AWS and region boxes on the canvas.
 *
 * The boxes are real parents of the nodes inside them. The canvas library grows a
 * parent live while a child is dragged to its edge (the child's `expandParent`
 * flag), but it does not cascade: a region that grows may now poke out of the AWS
 * box. growContainersToFit() closes that gap after a drag. Both functions here are
 * pure so they can be tested without a canvas.
 */

export interface FitNode {
  id: string;
  parentId?: string;
  /** Position relative to the parent. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FitChange {
  id: string;
  width: number;
  height: number;
}

/** Breathing room kept between the farthest child and the box edge. */
export const FIT_PADDING = 24;

/**
 * Starting at `startParentId` and walking up, return the new size of every container
 * that is too small for its children. Only ever grows: a manual resize or a shrunken
 * layout is never undone, and left/top overflow is left to the canvas library, which
 * shifts the parent for that.
 */
export function growContainersToFit(
  nodes: FitNode[],
  startParentId: string | undefined,
  isContainer: (id: string) => boolean,
  pad: number = FIT_PADDING,
): FitChange[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const sizes = new Map(nodes.map((n) => [n.id, { width: n.width, height: n.height }]));
  const out: FitChange[] = [];
  const seen = new Set<string>();

  let id = startParentId;
  while (id && !seen.has(id)) {
    seen.add(id);
    const parent = byId.get(id);
    if (!parent) break;
    if (isContainer(id)) {
      const current = sizes.get(id)!;
      let width = current.width;
      let height = current.height;
      for (const kid of nodes) {
        if (kid.parentId !== id) continue;
        const size = sizes.get(kid.id)!;
        width = Math.max(width, kid.x + size.width + pad);
        height = Math.max(height, kid.y + size.height + pad);
      }
      width = Math.ceil(width);
      height = Math.ceil(height);
      if (width > current.width || height > current.height) {
        sizes.set(id, { width, height });
        out.push({ id, width, height });
      }
    }
    // Keep climbing through parents that are not containers (for example a group).
    id = parent.parentId;
  }
  return out;
}

export interface DimensionChangeLike {
  id: string;
  dimensions?: unknown;
  /** Set by the library while a resize handle is being dragged. */
  resizing?: boolean;
  /** Set by the library when a parent grows because a child was dragged to its edge. */
  setAttributes?: boolean | 'width' | 'height';
}

/**
 * Should a library "dimensions" change be copied into the store?
 *
 * - `resizable` containers (customer sites, DX locations): only while a handle is dragged.
 * - `expandable` containers (AWS and region boxes): also when the library grew them
 *   because a child was dragged to their edge.
 * Everything else, and any change without dimensions, is ignored.
 */
export function shouldApplyDimensionChange(
  change: DimensionChangeLike,
  ids: { resizable: { has(id: string): boolean }; expandable: { has(id: string): boolean } },
): boolean {
  if (change.dimensions == null) return false;
  if (ids.expandable.has(change.id)) return change.resizing === true || Boolean(change.setAttributes);
  return change.resizing === true && ids.resizable.has(change.id);
}
