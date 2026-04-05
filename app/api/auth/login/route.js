import { NextResponse } from 'next/server';
import { verifyCredentials, createSession } from '@/lib/auth.js';

export async function POST(req) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) {
    return NextResponse.json({ error: 'missing credentials' }, { status: 400 });
  }
  const ok = await verifyCredentials(username, password);
  if (!ok) {
    return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });
  }
  await createSession();
  return NextResponse.json({ ok: true });
}
