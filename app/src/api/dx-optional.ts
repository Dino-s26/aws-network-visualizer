import { deniedAction } from '../utils/fetch-issues';
import type { DxStatus, TopologyData } from '../types/topology';

// Direct Connect is best-effort. If it is turned off, denied, or unreachable we skip
// it quietly instead of failing the load or raising an "incomplete data" banner:
// an account with no Direct Connect is a normal state, not a fault. What happened is
// reported once, as TopologyData.dxStatus, and shown as a small status chip.

export type DxErrorKind = 'permission' | 'credentials' | 'unreachable' | 'error';

/** Sort a Direct Connect failure into the buckets that matter for skipping. */
export function classifyDxError(message: string): DxErrorKind {
  if (deniedAction(message)) return 'permission';
  if (/ExpiredToken|InvalidIdentityToken|SignatureDoesNotMatch|UnrecognizedClient|InvalidClientTokenId/i.test(message)) {
    return 'credentials';
  }
  if (/AccessDenied|UnauthorizedOperation|not authorized/i.test(message)) return 'permission';
  if (/Failed to fetch|NetworkError|ENOTFOUND|EAI_AGAIN|UnknownEndpoint|Could not resolve/i.test(message)) {
    return 'unreachable';
  }
  return 'error';
}

/** Collects what went wrong with Direct Connect during one topology load. */
export interface DxProbe {
  enabled: boolean;
  deniedActions: Set<string>;
  unreachableRegions: Set<string>;
  errors: string[];
}

export function createDxProbe(enabled: boolean): DxProbe {
  return { enabled, deniedActions: new Set(), unreachableRegions: new Set(), errors: [] };
}

/** True when Direct Connect must not be called: turned off, or already known to be denied. */
export function dxSkipped(probe: DxProbe): boolean {
  return !probe.enabled || probe.deniedActions.size > 0;
}

/**
 * Like logged() in fetch-topology.ts, for Direct Connect calls. Takes a thunk so
 * that nothing is sent when DX is skipped. Never records a FetchIssue: failures are
 * collected on the probe and summarised once by dxStatusFrom().
 */
export async function loggedDx<T>(name: string, call: () => Promise<T[]>, probe: DxProbe): Promise<T[]> {
  if (dxSkipped(probe)) return [];
  try {
    const res = await call();
    console.log('[AWS] ' + name + ': ' + res.length + ' items');
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const kind = classifyDxError(msg);
    if (kind === 'permission') {
      probe.deniedActions.add(deniedAction(msg) ?? 'directconnect:*');
    } else if (kind === 'unreachable') {
      probe.unreachableRegions.add(name.includes('/') ? name.split('/')[0] : 'global');
    } else {
      probe.errors.push(name + ': ' + msg);
    }
    console.warn('[AWS] ' + name + ' skipped (' + kind + '):', msg);
    return [];
  }
}

/** Turn what the probe collected, plus whether any DX resource was found, into one status. */
export function dxStatusFrom(probe: DxProbe, hasDx: boolean): DxStatus {
  if (!probe.enabled) return { state: 'off' };
  if (probe.deniedActions.size > 0) {
    return { state: 'unavailable', reason: 'permission', detail: 'missing permission: ' + [...probe.deniedActions].join(', ') };
  }
  const problems: string[] = [];
  if (probe.unreachableRegions.size > 0) problems.push('unreachable in ' + [...probe.unreachableRegions].join(', '));
  if (probe.errors.length > 0) problems.push(probe.errors.length + ' call(s) failed');
  const detail = problems.length > 0 ? problems.join('; ') : undefined;
  if (hasDx) return detail ? { state: 'ok', detail } : { state: 'ok' };
  if (detail) return { state: 'unavailable', reason: 'error', detail };
  return { state: 'none' };
}

/** True when the loaded topology should show Direct Connect. No status means ok (mock data, old snapshots). */
export function isDxActive(t: Pick<TopologyData, 'dxStatus'> | null | undefined): boolean {
  return !t?.dxStatus || t.dxStatus.state === 'ok';
}

/** Drop every Direct Connect field in place, so a partly denied DX cannot drive a misleading score. */
export function stripDxData(t: TopologyData): void {
  t.connections = [];
  t.virtualInterfaces = [];
  t.dxGateways = [];
  t.dxGatewayAssociations = [];
  t.locations = [];
  t.lags = [];
  t.bgpPrefixMetrics = undefined;
  t.maintenanceEvents = undefined;
}

/** Copy of a topology with Direct Connect removed and the given status attached. Does not modify the input. */
export function withoutDx(t: TopologyData, status: DxStatus): TopologyData {
  const copy: TopologyData = { ...t };
  stripDxData(copy);
  copy.dxStatus = status;
  return copy;
}

export interface DxChip {
  label: string;
  title: string;
  tone: 'ok' | 'muted' | 'warn';
}

/** Text and tone for the top-bar Direct Connect chip. */
export function describeDx(status: DxStatus | undefined, enabled: boolean, lockedOff: boolean): DxChip {
  if (lockedOff) {
    return { label: 'DX off', tone: 'muted', title: 'Direct Connect is disabled by this deployment (DX_ENABLED=false).' };
  }
  if (!enabled || status?.state === 'off') {
    return {
      label: 'DX off',
      tone: 'muted',
      title: 'Direct Connect is turned off, so no Direct Connect API calls are made. Click to turn it on and refresh.',
    };
  }
  if (status?.state === 'none') {
    return { label: 'DX: none found', tone: 'muted', title: 'No Direct Connect resources in this account. Showing VPC resources only.' };
  }
  if (status?.state === 'unavailable') {
    return {
      label: 'DX skipped',
      tone: 'warn',
      title: 'Direct Connect was skipped (' + (status.detail ?? 'unavailable') + '). Showing VPC resources only.',
    };
  }
  if (status?.detail) {
    return { label: 'DX on', tone: 'warn', title: 'Direct Connect is on, with a partial problem: ' + status.detail };
  }
  return { label: 'DX on', tone: 'ok', title: 'Direct Connect is on. Click to turn it off and refresh.' };
}

export interface DxEmptyCopy {
  heading: string;
  body: string;
  hint: string;
}

/**
 * Wording for the empty-canvas notice when Direct Connect was turned off or skipped.
 * Returns null when the account was actually checked and has no Direct Connect (or
 * the status is unknown), so the caller keeps its normal "none found" text. The point:
 * never claim an account has no Direct Connect when we did not, or could not, look.
 */
export function dxEmptyStateCopy(status: DxStatus | undefined, hasOtherResources: boolean): DxEmptyCopy | null {
  const rest = hasOtherResources
    ? ' Your VPCs, Transit Gateways and VPN connections are shown on the canvas, grouped by region. Resources with no attachments appear in the Unattached resources zone.'
    : '';
  if (status?.state === 'off') {
    return {
      heading: 'Direct Connect is turned off',
      body: 'Direct Connect was not checked, so no Direct Connect resources are shown.' + rest,
      hint: 'Use the DX switch in the top bar to turn Direct Connect back on.',
    };
  }
  if (status?.state === 'unavailable') {
    return {
      heading: 'Direct Connect was skipped',
      body: 'Direct Connect could not be read (' + (status.detail ?? 'unavailable') + ').' + rest,
      hint:
        status.reason === 'permission'
          ? 'Grant the missing read-only permission and refresh, or turn Direct Connect off with the DX switch.'
          : 'Refresh to try again, or turn Direct Connect off with the DX switch.',
    };
  }
  return null;
}
