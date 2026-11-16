import { useTopologyStore } from '../store/topology-store';
import { useIsLight } from '../hooks/useTheme';
import { config } from '../utils/config';
import { describeDx } from '../api/dx-optional';
import { setDxEnabled, useDxEnabled } from '../utils/dx-preference';

/**
 * Top-bar Direct Connect switch + status chip. Direct Connect is best-effort: on by
 * default, skipped quietly when unavailable. Turning it off means no DX API calls at
 * all. Changing it refreshes the topology so the new setting takes effect.
 */
export function DxToggle({ onRefresh }: { onRefresh: () => void }) {
  const light = useIsLight();
  const topologyData = useTopologyStore((s) => s.topologyData);
  const enabled = useDxEnabled();
  const lockedOff = !config.dxEnabled;
  const chip = describeDx(topologyData?.dxStatus, enabled, lockedOff);

  const tones = {
    ok: light ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
    muted: light ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-white/[0.06] text-white/50 hover:bg-white/10',
    warn: light ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
  } as const;

  return (
    <button
      type="button"
      disabled={lockedOff}
      aria-pressed={enabled && !lockedOff}
      aria-label={'Direct Connect: ' + chip.label + '. ' + chip.title}
      title={chip.title}
      onClick={() => {
        setDxEnabled(!enabled);
        if (topologyData) onRefresh();
      }}
      className={'px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ' + tones[chip.tone] + (lockedOff ? ' cursor-not-allowed opacity-70' : '')}
    >
      {chip.label}
    </button>
  );
}
