import { useEffect, useState } from 'react';

const TAB_SCOPE_KEY = 'offside:tab-scope';
const OWNER_PREFIX = 'offside:tab-scope-owner:';
const OWNER_TTL_MS = 60_000;
const HEARTBEAT_MS = 10_000;

function newScope(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function readOrCreateScope(): string {
  try {
    const saved = sessionStorage.getItem(TAB_SCOPE_KEY);
    if (saved !== null && saved.length > 0) return saved;
    const created = newScope();
    sessionStorage.setItem(TAB_SCOPE_KEY, created);
    return created;
  } catch {
    return newScope();
  }
}

const TAB_INSTANCE = newScope();

type ScopeOwner = { instance: string; touchedAt: number };

function ownerKey(scope: string): string {
  return `${OWNER_PREFIX}${scope}`;
}

function readOwner(scope: string): ScopeOwner | null {
  try {
    const raw = localStorage.getItem(ownerKey(scope));
    if (raw === null) return null;
    const owner = JSON.parse(raw) as Partial<ScopeOwner>;
    return typeof owner.instance === 'string' && typeof owner.touchedAt === 'number'
      ? { instance: owner.instance, touchedAt: owner.touchedAt }
      : null;
  } catch {
    return null;
  }
}

function claimScope(scope: string): boolean {
  try {
    const current = readOwner(scope);
    if (
      current !== null &&
      current.instance !== TAB_INSTANCE &&
      Date.now() - current.touchedAt < OWNER_TTL_MS
    ) {
      return false;
    }
    localStorage.setItem(
      ownerKey(scope),
      JSON.stringify({ instance: TAB_INSTANCE, touchedAt: Date.now() } satisfies ScopeOwner),
    );
    return readOwner(scope)?.instance === TAB_INSTANCE;
  } catch {
    // sessionStorage/in-memory scope still prevents sharing within this mount.
    return true;
  }
}

function touchScope(scope: string): void {
  try {
    if (readOwner(scope)?.instance === TAB_INSTANCE) {
      localStorage.setItem(
        ownerKey(scope),
        JSON.stringify({ instance: TAB_INSTANCE, touchedAt: Date.now() } satisfies ScopeOwner),
      );
    }
  } catch {
    /* no-op */
  }
}

function releaseScope(scope: string): void {
  try {
    if (readOwner(scope)?.instance === TAB_INSTANCE) localStorage.removeItem(ownerKey(scope));
  } catch {
    /* no-op */
  }
}

export function tabScopedStorageKey(baseKey: string, scope: string): string {
  return `${baseKey}:${scope}`;
}

/**
 * sessionStorage survives reloads but is cloned by some duplicate-tab flows.
 * A per-runtime localStorage lease detects that clone and rotates only the
 * newcomer scope, keeping draft recovery in the original tab while preventing
 * the two creation sessions from reading or writing the same draft.
 */
export function useTabScopedStorageKey(baseKey: string): string {
  const [scope, setScope] = useState(readOrCreateScope);

  useEffect(() => {
    if (claimScope(scope)) {
      const heartbeat = window.setInterval(() => touchScope(scope), HEARTBEAT_MS);
      const release = () => releaseScope(scope);
      window.addEventListener('pagehide', release, { once: true });
      return () => {
        window.clearInterval(heartbeat);
        window.removeEventListener('pagehide', release);
      };
    }

    // A duplicate tab has a cloned session scope but a different runtime.
    // Rotate its scope; the incumbent lease remains untouched.
    const nextScope = newScope();
    try {
      sessionStorage.setItem(TAB_SCOPE_KEY, nextScope);
    } catch {
      // The generated in-memory scope still isolates this mounted form.
    }
    setScope(nextScope);
    return undefined;
  }, [scope]);

  return tabScopedStorageKey(baseKey, scope);
}
