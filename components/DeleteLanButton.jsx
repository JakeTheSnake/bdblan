'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteLanButton({ lanId, lanName }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onClick() {
    const ok = window.confirm(
      `Delete LAN "${lanName}"?\n\nThis removes the event, its player list, ` +
        `and any matches that are only part of this LAN. This cannot be undone.`,
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/lans/${lanId}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setBusy(false);
      setError(body.error || 'delete failed');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="text-xs text-destructive hover:underline disabled:opacity-50"
      >
        {busy ? 'Deleting…' : 'Delete LAN'}
      </button>
      {error ? <div className="text-xs text-destructive">{error}</div> : null}
    </div>
  );
}
