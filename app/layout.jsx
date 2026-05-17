import './globals.css';

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
            <a
              href="/"
              className="text-lg font-bold uppercase tracking-widest text-foreground"
            >
              bd<span className="text-primary">blan</span>
            </a>
            <nav className="flex gap-5 text-sm font-medium text-muted-foreground">
              <a href="/" className="uppercase tracking-wide hover:text-primary">
                LANs
              </a>
              <a
                href="/admin"
                className="uppercase tracking-wide hover:text-primary"
              >
                Admin
              </a>
            </nav>
          </div>
        </header>
        <main className="container py-6">{children}</main>
      </body>
    </html>
  );
}
