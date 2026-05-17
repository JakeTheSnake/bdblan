import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'bdblan',
  description: 'Dota 2 LAN stats',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <header className="border-b border-border bg-card">
          <div className="container flex h-14 items-center justify-between">
            <Link
              href="/"
              className="text-lg font-bold uppercase tracking-widest text-foreground"
            >
              bdb<span className="text-primary">lan</span>
            </Link>
            <nav className="flex gap-5 text-sm font-medium text-muted-foreground">
              <Link href="/" className="uppercase tracking-wide hover:text-primary">
                LANs
              </Link>
              <Link
                href="/admin"
                className="uppercase tracking-wide hover:text-primary"
              >
                Admin
              </Link>
            </nav>
          </div>
        </header>
        <main className="container py-6">{children}</main>
      </body>
    </html>
  );
}
