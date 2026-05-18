import { NextResponse } from 'next/server';

// GET /api/admin/session
// Used by client components to detect admin status without forcing the
// (statically rendered) public pages to read cookies. The proxy.js middleware
// gates everything under /api/admin: a non-admin request gets a 401 before it
// ever reaches this handler, so simply being here means the caller is an admin.
export async function GET() {
  return NextResponse.json({ admin: true });
}
