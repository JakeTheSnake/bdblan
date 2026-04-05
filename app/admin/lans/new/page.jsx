'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Each row in the players list carries everything the form needs:
//   accountId: string (empty for manual-entry rows)
//   personaName: string (editable)
//   selected: boolean (whether this player is part of the LAN)
//   isRadiant/heroName/heroImg: optional, only set for rows imported from a match
//   manual: true for blank rows the admin adds by hand (always "selected")

function blankRow() {
  return { accountId: '', personaName: '', selected: true, manual: true };
}

export default function NewLanPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [players, setPlayers] = useState([blankRow(), blankRow(), blankRow(), blankRow(), blankRow()]);
  const [hostAccountId, setHostAccountId] = useState('');

  const [seedMatchId, setSeedMatchId] = useState('');
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [matchInfo, setMatchInfo] = useState(null);
  const [matchError, setMatchError] = useState(null);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function updatePlayer(idx, patch) {
    setPlayers((ps) => ps.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function addManualPlayer() {
    setPlayers((ps) => [...ps, blankRow()]);
  }

  async function loadFromMatch() {
    const id = seedMatchId.trim();
    if (!id) return;
    setLoadingMatch(true);
    setMatchError(null);
    setMatchInfo(null);
    try {
      const res = await fetch(`/api/admin/matches/${id}`);
      const body = await res.json();
      if (!res.ok) {
        setMatchError(body.error || 'failed to load match');
        return;
      }
      setMatchInfo(body);
      setStartDate(body.startDate);
      // Replace the player rows with the 10 match players. All start
      // unselected — the admin ticks the ones that should be LAN members.
      // Anonymous players (null account_id) can't be members and are shown
      // disabled.
      setPlayers(
        body.players.map((p) => ({
          accountId: p.accountId != null ? String(p.accountId) : '',
          personaName: p.personaName || '',
          selected: false,
          manual: false,
          isRadiant: p.isRadiant,
          heroName: p.heroName,
          heroImg: p.heroImg,
          isAnonymous: p.isAnonymous,
        })),
      );
      setHostAccountId('');
    } catch (e) {
      setMatchError(String(e?.message || e));
    } finally {
      setLoadingMatch(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    const cleanPlayers = players
      .filter((p) => p.selected && p.accountId !== '' && !p.isAnonymous)
      .map((p) => ({
        accountId: Number(p.accountId),
        personaName: p.personaName.trim() || undefined,
      }));

    if (cleanPlayers.length === 0) {
      setBusy(false);
      setError('select at least one player');
      return;
    }
    if (!hostAccountId) {
      setBusy(false);
      setError('pick a host');
      return;
    }

    const res = await fetch('/api/admin/lans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        startDate,
        endDate,
        players: cleanPlayers,
        hostAccountId: Number(hostAccountId),
      }),
    });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 207) {
      setError(body.error || 'failed to create LAN');
      return;
    }
    setResult(body);
    if (body.lanId) {
      setTimeout(() => router.push(`/lan/${body.lanId}`), 1200);
    }
  }

  const radiantRows = players.map((p, i) => ({ p, i })).filter(({ p }) => p.isRadiant === true);
  const direRows = players.map((p, i) => ({ p, i })).filter(({ p }) => p.isRadiant === false);
  const manualRows = players.map((p, i) => ({ p, i })).filter(({ p }) => p.isRadiant === undefined);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">New LAN</h1>
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-input bg-background px-3 py-2"
            required
          />
        </div>

        {/* Prefill from first match */}
        <div className="rounded border border-dashed p-3">
          <label className="mb-1 block text-sm font-medium">Prefill from first match</label>
          <p className="mb-2 text-xs text-muted-foreground">
            Paste the match ID of the first game of the event. We&apos;ll fetch it, set the
            &ldquo;from&rdquo; date, and list the 10 players so you can tick the LAN members.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={seedMatchId}
              onChange={(e) => setSeedMatchId(e.target.value)}
              placeholder="match id"
              className="flex-1 rounded border border-input bg-background px-3 py-2"
            />
            <button
              type="button"
              onClick={loadFromMatch}
              disabled={loadingMatch || !seedMatchId.trim()}
              className="rounded border border-input px-3 py-2 text-sm disabled:opacity-50"
            >
              {loadingMatch ? 'Loading…' : 'Load match'}
            </button>
          </div>
          {matchError ? <div className="mt-2 text-sm text-destructive">{matchError}</div> : null}
          {matchInfo ? (
            <div className="mt-2 text-xs text-muted-foreground">
              Loaded match {matchInfo.matchId} — started {matchInfo.startDate}. Start date set.
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded border border-input bg-background px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded border border-input bg-background px-3 py-2"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Players</label>

          {radiantRows.length > 0 ? (
            <TeamGroup
              title="Radiant"
              accent="text-team-us"
              rows={radiantRows}
              hostAccountId={hostAccountId}
              onUpdate={updatePlayer}
              onHost={setHostAccountId}
            />
          ) : null}
          {direRows.length > 0 ? (
            <TeamGroup
              title="Dire"
              accent="text-team-them"
              rows={direRows}
              hostAccountId={hostAccountId}
              onUpdate={updatePlayer}
              onHost={setHostAccountId}
            />
          ) : null}

          {manualRows.length > 0 ? (
            <div className="mt-3">
              <div className="mb-1 text-xs uppercase text-muted-foreground">Manual entries</div>
              <div className="space-y-2">
                {manualRows.map(({ p, i }) => (
                  <ManualRow
                    key={i}
                    idx={i}
                    p={p}
                    hostAccountId={hostAccountId}
                    onUpdate={updatePlayer}
                    onHost={setHostAccountId}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={addManualPlayer}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground"
          >
            + add player manually
          </button>
        </div>

        {error ? <div className="text-sm text-destructive">{error}</div> : null}
        {result ? (
          <div className="rounded border border-green-500 bg-green-50 p-3 text-sm">
            LAN #{result.lanId} created. {result.discovered ?? 0} matches found, {result.ingested ?? 0} ingested.
            {result.syncError ? <div className="text-destructive">Sync error: {result.syncError}</div> : null}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Creating & syncing…' : 'Create LAN'}
        </button>
      </form>
    </div>
  );
}

function TeamGroup({ title, accent, rows, hostAccountId, onUpdate, onHost }) {
  return (
    <div className="mb-3">
      <div className={`mb-1 text-xs uppercase ${accent}`}>{title}</div>
      <div className="space-y-1">
        {rows.map(({ p, i }) => (
          <MatchRow
            key={i}
            idx={i}
            p={p}
            hostAccountId={hostAccountId}
            onUpdate={onUpdate}
            onHost={onHost}
          />
        ))}
      </div>
    </div>
  );
}

function MatchRow({ idx, p, hostAccountId, onUpdate, onHost }) {
  const disabled = p.isAnonymous;
  return (
    <div
      className={
        'grid grid-cols-[auto_40px_1fr_1fr_auto] items-center gap-2 rounded border p-2 ' +
        (disabled ? 'opacity-50' : '')
      }
    >
      <input
        type="checkbox"
        checked={p.selected}
        disabled={disabled}
        onChange={(e) => onUpdate(idx, { selected: e.target.checked })}
      />
      {p.heroImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.heroImg} alt="" className="h-6 w-auto rounded" />
      ) : (
        <div className="h-6 w-10 rounded bg-muted" />
      )}
      <div className="min-w-0">
        <input
          type="text"
          value={p.personaName}
          onChange={(e) => onUpdate(idx, { personaName: e.target.value })}
          disabled={disabled}
          className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
        />
        <div className="truncate text-xs text-muted-foreground">
          {p.heroName || `hero ${p.heroId || '?'}`}
        </div>
      </div>
      <div className="truncate text-xs text-muted-foreground">
        {disabled ? 'anonymous' : p.accountId}
      </div>
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        <input
          type="radio"
          name="host"
          disabled={disabled || !p.selected}
          checked={hostAccountId !== '' && Number(hostAccountId) === Number(p.accountId)}
          onChange={() => onHost(p.accountId)}
        />
        host
      </label>
    </div>
  );
}

function ManualRow({ idx, p, hostAccountId, onUpdate, onHost }) {
  return (
    <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
      <input
        type="number"
        placeholder="account_id (Steam32)"
        value={p.accountId}
        onChange={(e) => onUpdate(idx, { accountId: e.target.value })}
        className="rounded border border-input bg-background px-3 py-2"
      />
      <input
        type="text"
        placeholder="persona name (optional)"
        value={p.personaName}
        onChange={(e) => onUpdate(idx, { personaName: e.target.value })}
        className="rounded border border-input bg-background px-3 py-2"
      />
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        <input
          type="radio"
          name="host"
          checked={hostAccountId !== '' && Number(hostAccountId) === Number(p.accountId)}
          onChange={() => onHost(p.accountId)}
        />
        host
      </label>
    </div>
  );
}
