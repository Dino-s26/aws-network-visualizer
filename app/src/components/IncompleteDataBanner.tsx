import { useState, type CSSProperties } from 'react';
import { useTopologyStore } from '../store/topology-store';
import { useIsLight } from '../hooks/useTheme';
import { COLORS } from '../utils/colors';
import type { TopologyData } from '../types/topology';
import { summariseIssues, guidanceFor } from '../utils/fetch-issues';
import { COMPACT_AT, describeGroup, groupIssues, maskIdentifiers } from '../utils/issue-display';

/**
 * Persistent notice that the loaded topology is missing data.
 *
 * `logged()` in fetch-topology.ts deliberately returns `[]` for a resource that
 * failed rather than aborting the whole load — one dead service should not blank
 * the canvas. The cost is that a failure is indistinguishable from an empty
 * account, and nothing told the user: the errors were collected into a local
 * array and dropped, so an AccessDenied on VPC route tables produced a topology
 * that looked complete and correct.
 *
 * That matters more than "some panels are empty", which is why this is not
 * dismissable-and-forgotten like EmptyStateBanner. Several rules read absence as
 * a pass — an empty `vpcRouteTables` means `ruleBlackholeRoutes` finds no
 * blackholes and `ruleVpcNoHybridRoute` finds nothing missing — so a failed
 * fetch can RAISE the resiliency score. The score and any exported report are
 * then confidently wrong, and the user has no way to know.
 *
 * Collapsible, not dismissable: the header stays on screen for the life of the
 * topology so a shared screenshot or an exported report is never taken from a
 * view that silently hid this. Refreshing or switching account/scenario
 * replaces `topologyData`, which is what clears it.
 *
 * Readability: one blocked region produces a failure per service, so a long list
 * of near-identical rows is summarised by cause first (see issue-display.ts) and
 * the per-call rows are tucked behind a button once there are more than
 * COMPACT_AT. Messages are shown with account and identity details masked, since
 * this banner is the thing people screenshot; a toggle reveals the raw text.
 */
export function IncompleteDataBanner() {
  const topologyData = useTopologyStore((s) => s.topologyData);
  const isLoading = useTopologyStore((s) => s.isLoading);
  const error = useTopologyStore((s) => s.error);
  const light = useIsLight();

  // Keyed on the topology object rather than a bare boolean so a refresh or an
  // account switch re-expands it for the new context.
  const [collapsedFor, setCollapsedFor] = useState<TopologyData | null>(null);
  const collapsed = topologyData != null && collapsedFor === topologyData;
  // Same keying: a new load starts with the list closed and identifiers masked.
  const [listFor, setListFor] = useState<TopologyData | null>(null);
  const [revealFor, setRevealFor] = useState<TopologyData | null>(null);
  const showList = topologyData != null && listFor === topologyData;
  const reveal = topologyData != null && revealFor === topologyData;

  const issues = topologyData?.fetchIssues ?? [];

  // App.tsx already owns the full-screen error and loading states; don't stack.
  if (isLoading || error) return null;
  if (issues.length === 0) return null;

  const guidance = guidanceFor(issues);
  const groups = groupIssues(issues);
  const compact = issues.length > COMPACT_AT;
  const showRows = !compact || showList;
  const show = (message: string) => (reveal ? message : maskIdentifiers(message));
  const hasMasked = issues.some((i) => maskIdentifiers(i.message) !== i.message);

  const amber = COLORS.severity.warning;
  const smallButton: CSSProperties = {
    background: 'transparent',
    border: `1px solid ${amber}`,
    borderRadius: 4,
    color: 'inherit',
    cursor: 'pointer',
    fontSize: 11,
    padding: '1px 6px',
  };

  return (
    <div
      role="alert"
      style={{
        background: light ? '#FFFBEB' : 'rgba(120, 53, 15, 0.35)',
        border: `1px solid ${amber}`,
        borderRadius: 8,
        padding: '10px 12px',
        maxWidth: 460,
        maxHeight: 'calc(100vh - 140px)',
        overflowY: 'auto',
        fontSize: 12,
        color: light ? '#78350F' : '#FDE68A',
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden style={{ color: amber, fontSize: 14 }}>
          ⚠
        </span>
        <strong style={{ flex: 1, fontSize: 12.5 }}>
          Topology may be incomplete — {summariseIssues(issues)}
        </strong>
        <button
          type="button"
          onClick={() => setCollapsedFor(collapsed ? null : (topologyData ?? null))}
          aria-expanded={!collapsed}
          style={smallButton}
        >
          {collapsed ? 'Details' : 'Hide'}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Stated before the list, because the list alone reads as a
              cosmetic gap rather than a reason to distrust the score. */}
          <div style={{ marginTop: 6, lineHeight: 1.45 }}>
            Resiliency scores and exported reports may be inaccurate — a resource
            that failed to load is indistinguishable from one that does not
            exist, so some checks may report no finding rather than “unknown”.
          </div>

          {groups.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.5 }}>
              {groups.map((g) => (
                <li key={g.cause}>{describeGroup(g)}</li>
              ))}
            </ul>
          )}

          {guidance.map((line) => (
            <div key={line} style={{ marginTop: 6, opacity: 0.9 }}>
              {line}
            </div>
          ))}

          {compact && (
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setListFor(showList ? null : (topologyData ?? null))}
                aria-expanded={showList}
                style={smallButton}
              >
                {showList ? 'Hide technical details' : `Show all ${issues.length} technical details`}
              </button>
            </div>
          )}

          {showRows && (
            <>
              <ul
                style={{
                  margin: '6px 0 0',
                  paddingLeft: 18,
                  lineHeight: 1.5,
                  maxHeight: '40vh',
                  overflowY: 'auto',
                }}
              >
                {issues.map((issue) => (
                  <li key={`${issue.kind}:${issue.label}`}>
                    <code style={{ fontSize: 11 }}>{issue.label}</code>
                    {issue.kind === 'truncated' ? ' — incomplete: ' : ' — failed: '}
                    {show(issue.message)}
                  </li>
                ))}
              </ul>
              {hasMasked && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setRevealFor(reveal ? null : (topologyData ?? null))}
                    aria-pressed={reveal}
                    style={smallButton}
                  >
                    {reveal ? 'Hide account and role details' : 'Show account and role details'}
                  </button>
                  <span style={{ opacity: 0.8 }}>
                    {reveal ? 'Showing raw messages.' : 'Masked so a shared screenshot does not expose them.'}
                  </span>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
