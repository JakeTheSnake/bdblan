import './globals.css';

export const metadata = {
  title: 'bdblan',
  description: 'Dota 2 LAN stats',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <header className="border-b">
          <div className="container flex h-14 items-center justify-between">
            <a href="/" className="font-semibold">bdblan</a>
            <nav className="flex gap-4 text-sm text-muted-foreground">
              <a href="/" className="hover:text-foreground">LANs</a>
              <a href="/admin" className="hover:text-foreground">Admin</a>
            </nav>
          </div>
        </header>
        <main className="container py-6">{children}</main>
      </body>
    </html>
  );
}
