import { useSyncExternalStore } from 'react';
import { config } from './config';

// User preference for the Direct Connect view, kept in localStorage (a UI preference
// only, nothing sensitive). The deployment wins: when DX_ENABLED=false the user
// cannot turn Direct Connect on, so a least-privilege deployment stays that way.
const KEY = 'nwv-dx-enabled';
const listeners = new Set<() => void>();
let memoryPref: '0' | '1' | null = null; // survives when localStorage is unavailable

function readPref(): '0' | '1' | null {
  if (memoryPref) return memoryPref;
  try {
    const v = localStorage.getItem(KEY);
    return v === '0' || v === '1' ? v : null;
  } catch {
    return null; // storage unavailable: fall back to the deployment default
  }
}

/** Whether Direct Connect should be fetched and shown right now. */
export function getDxEnabled(): boolean {
  if (!config.dxEnabled) return false;
  return readPref() !== '0';
}

export function setDxEnabled(next: boolean): void {
  memoryPref = next ? '1' : '0';
  try {
    localStorage.setItem(KEY, memoryPref);
  } catch {
    // not persisted; lasts until reload
  }
  listeners.forEach((l) => l());
}

export function subscribeDxEnabled(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useDxEnabled(): boolean {
  return useSyncExternalStore(subscribeDxEnabled, getDxEnabled, () => config.dxEnabled);
}
