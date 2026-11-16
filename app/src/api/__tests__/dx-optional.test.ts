import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  classifyDxError,
  createDxProbe,
  describeDx,
  dxEmptyStateCopy,
  dxSkipped,
  dxStatusFrom,
  isDxActive,
  loggedDx,
  stripDxData,
  withoutDx,
} from '../dx-optional';
import type { TopologyData } from '../../types/topology';

const DENIED =
  'User: arn:aws:iam::123456789012:user/x is not authorized to perform: directconnect:DescribeConnections because no identity-based policy allows it';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('classifyDxError', () => {
  it('recognises an IAM denial and keeps it apart from bad credentials', () => {
    expect(classifyDxError(DENIED)).toBe('permission');
    expect(classifyDxError('AccessDeniedException: nope')).toBe('permission');
    expect(classifyDxError('ExpiredToken: The security token included in the request is expired')).toBe('credentials');
  });

  it('treats an unreachable endpoint (for example a region without Direct Connect) as unreachable', () => {
    expect(classifyDxError('Failed to fetch')).toBe('unreachable');
    expect(classifyDxError('getaddrinfo ENOTFOUND directconnect.xx-north-1.amazonaws.com')).toBe('unreachable');
  });

  it('falls back to a generic error', () => {
    expect(classifyDxError('ThrottlingException: Rate exceeded')).toBe('error');
  });
});

describe('loggedDx', () => {
  it('passes results through when Direct Connect works', async () => {
    const probe = createDxProbe(true);
    expect(await loggedDx('us-east-1/Connections', async () => [1, 2], probe)).toEqual([1, 2]);
    expect(dxSkipped(probe)).toBe(false);
  });

  it('never calls the API when Direct Connect is turned off', async () => {
    const probe = createDxProbe(false);
    const call = vi.fn(async () => [1]);
    expect(await loggedDx('DxGateways', call, probe)).toEqual([]);
    expect(call).not.toHaveBeenCalled();
  });

  it('skips quietly on a permission denial, records the action, and stops further calls', async () => {
    const probe = createDxProbe(true);
    expect(await loggedDx('us-east-1/Connections', async () => { throw new Error(DENIED); }, probe)).toEqual([]);
    expect([...probe.deniedActions]).toEqual(['directconnect:DescribeConnections']);
    expect(dxSkipped(probe)).toBe(true);

    const later = vi.fn(async () => [1]);
    expect(await loggedDx('eu-west-1/Connections', later, probe)).toEqual([]);
    expect(later).not.toHaveBeenCalled();
  });

  it('records an unreachable region but keeps calling other regions', async () => {
    const probe = createDxProbe(true);
    await loggedDx('xx-north-1/Connections', async () => { throw new Error('Failed to fetch'); }, probe);
    expect([...probe.unreachableRegions]).toEqual(['xx-north-1']);
    expect(dxSkipped(probe)).toBe(false);
    expect(await loggedDx('us-east-1/Connections', async () => [1], probe)).toEqual([1]);
  });

  it('files a global (unslashed) unreachable call under global', async () => {
    const probe = createDxProbe(true);
    await loggedDx('DxGateways', async () => { throw new Error('Failed to fetch'); }, probe);
    expect([...probe.unreachableRegions]).toEqual(['global']);
  });

  it('records other errors without switching Direct Connect off', async () => {
    const probe = createDxProbe(true);
    await loggedDx('us-east-1/Lags', async () => { throw new Error('ThrottlingException: Rate exceeded'); }, probe);
    expect(probe.errors).toHaveLength(1);
    expect(dxSkipped(probe)).toBe(false);
  });
});

describe('dxStatusFrom', () => {
  it('reports off when turned off', () => {
    expect(dxStatusFrom(createDxProbe(false), false)).toEqual({ state: 'off' });
  });

  it('reports unavailable with the denied action', async () => {
    const probe = createDxProbe(true);
    await loggedDx('us-east-1/Connections', async () => { throw new Error(DENIED); }, probe);
    const s = dxStatusFrom(probe, false);
    expect(s.state).toBe('unavailable');
    expect(s.reason).toBe('permission');
    expect(s.detail).toContain('directconnect:DescribeConnections');
  });

  it('reports none (not an error) for an account with no Direct Connect resources', () => {
    expect(dxStatusFrom(createDxProbe(true), false)).toEqual({ state: 'none' });
  });

  it('reports ok when resources were found', () => {
    expect(dxStatusFrom(createDxProbe(true), true)).toEqual({ state: 'ok' });
  });

  it('keeps ok but notes a partial failure when some data was found', async () => {
    const probe = createDxProbe(true);
    await loggedDx('xx-north-1/Connections', async () => { throw new Error('Failed to fetch'); }, probe);
    const s = dxStatusFrom(probe, true);
    expect(s.state).toBe('ok');
    expect(s.detail).toContain('xx-north-1');
  });

  it('reports unavailable (error) when nothing was found and calls failed', async () => {
    const probe = createDxProbe(true);
    await loggedDx('us-east-1/Lags', async () => { throw new Error('ThrottlingException: Rate exceeded'); }, probe);
    const s = dxStatusFrom(probe, false);
    expect(s.state).toBe('unavailable');
    expect(s.reason).toBe('error');
  });
});

function topo(): TopologyData {
  return {
    connections: [{ connectionId: 'dxcon-1' }],
    virtualInterfaces: [{ virtualInterfaceId: 'dxvif-1' }],
    dxGateways: [{ directConnectGatewayId: 'dxgw-1' }],
    dxGatewayAssociations: [{}],
    locations: [{ locationCode: 'X' }],
    lags: [{ lagId: 'dxlag-1' }],
    vpcs: [{ vpcId: 'vpc-1' }],
    maintenanceEvents: [{}],
  } as unknown as TopologyData;
}

describe('isDxActive', () => {
  it('treats a missing status (mock data, old snapshots) and ok as active', () => {
    expect(isDxActive(null)).toBe(true);
    expect(isDxActive({})).toBe(true);
    expect(isDxActive({ dxStatus: { state: 'ok' } })).toBe(true);
  });

  it('is inactive for off, none and unavailable', () => {
    expect(isDxActive({ dxStatus: { state: 'off' } })).toBe(false);
    expect(isDxActive({ dxStatus: { state: 'none' } })).toBe(false);
    expect(isDxActive({ dxStatus: { state: 'unavailable' } })).toBe(false);
  });
});

describe('stripDxData / withoutDx', () => {
  it('clears Direct Connect fields but keeps VPC data', () => {
    const t = topo();
    stripDxData(t);
    expect(t.connections).toEqual([]);
    expect(t.virtualInterfaces).toEqual([]);
    expect(t.dxGateways).toEqual([]);
    expect(t.dxGatewayAssociations).toEqual([]);
    expect(t.locations).toEqual([]);
    expect(t.lags).toEqual([]);
    expect(t.maintenanceEvents).toBeUndefined();
    expect(t.vpcs).toHaveLength(1);
  });

  it('withoutDx returns a stripped copy with the status and leaves the original alone', () => {
    const original = topo();
    const copy = withoutDx(original, { state: 'off' });
    expect(copy.dxGateways).toEqual([]);
    expect(copy.dxStatus).toEqual({ state: 'off' });
    expect(copy.vpcs).toHaveLength(1);
    expect(original.dxGateways).toHaveLength(1);
    expect(original.dxStatus).toBeUndefined();
  });
});

describe('describeDx', () => {
  it('says the deployment disabled it when locked off', () => {
    const c = describeDx(undefined, true, true);
    expect(c.label).toBe('DX off');
    expect(c.title).toContain('DX_ENABLED=false');
  });

  it('shows off when the user turned it off or the load made no DX calls', () => {
    expect(describeDx(undefined, false, false).label).toBe('DX off');
    expect(describeDx({ state: 'off' }, true, false).label).toBe('DX off');
  });

  it('shows none found as a calm, muted state', () => {
    const c = describeDx({ state: 'none' }, true, false);
    expect(c.label).toBe('DX: none found');
    expect(c.tone).toBe('muted');
  });

  it('shows skipped with the reason as a warning', () => {
    const c = describeDx({ state: 'unavailable', reason: 'permission', detail: 'missing permission: directconnect:DescribeConnections' }, true, false);
    expect(c.label).toBe('DX skipped');
    expect(c.tone).toBe('warn');
    expect(c.title).toContain('directconnect:DescribeConnections');
  });

  it('shows on, and flags a partial problem', () => {
    expect(describeDx({ state: 'ok' }, true, false)).toMatchObject({ label: 'DX on', tone: 'ok' });
    expect(describeDx({ state: 'ok', detail: 'unreachable in xx-north-1' }, true, false)).toMatchObject({ label: 'DX on', tone: 'warn' });
    expect(describeDx(undefined, true, false).label).toBe('DX on');
  });
});

describe('dxEmptyStateCopy', () => {
  it('keeps the normal none-found text when the account was checked or the status is unknown', () => {
    expect(dxEmptyStateCopy(undefined, true)).toBeNull();
    expect(dxEmptyStateCopy({ state: 'none' }, true)).toBeNull();
    expect(dxEmptyStateCopy({ state: 'ok' }, true)).toBeNull();
  });

  it('says Direct Connect is turned off instead of claiming the account has none', () => {
    const c = dxEmptyStateCopy({ state: 'off' }, true)!;
    expect(c.heading).toBe('Direct Connect is turned off');
    expect(c.body).toContain('was not checked');
    expect(c.body).toContain('Unattached resources zone');
    expect(c.hint).toContain('DX switch');
  });

  it('leaves out the canvas sentence when there is nothing else to show', () => {
    expect(dxEmptyStateCopy({ state: 'off' }, false)!.body).not.toContain('canvas');
  });

  it('explains a skipped Direct Connect with its reason and the fix', () => {
    const denied = dxEmptyStateCopy({ state: 'unavailable', reason: 'permission', detail: 'missing permission: directconnect:DescribeConnections' }, true)!;
    expect(denied.heading).toBe('Direct Connect was skipped');
    expect(denied.body).toContain('directconnect:DescribeConnections');
    expect(denied.hint).toContain('read-only permission');
    const failed = dxEmptyStateCopy({ state: 'unavailable', reason: 'error' }, true)!;
    expect(failed.body).toContain('unavailable');
    expect(failed.hint).toContain('Refresh');
  });
});
