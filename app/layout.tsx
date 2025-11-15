import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'Aegis AI',
  description: 'Aegis MCP mock automation console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <nav className="bg-white shadow">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 justify-between">
              <div className="flex">
                <Link href="/" className="flex flex-shrink-0 items-center text-xl font-bold text-indigo-600">
                  Aegis AI
                </Link>
                <div className="ml-10 flex space-x-8">
                  <Link href="/" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2 border-transparent hover:border-indigo-500">
                    Dashboard
                  </Link>
                  <Link href="/tasks" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900 border-b-2 border-transparent hover:border-indigo-500">
                    Tasks
                  </Link>
                  <Link href="/monitors" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900 border-b-2 border-transparent hover:border-indigo-500">
                    Monitors
                  </Link>
                  <Link href="/docs" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900 border-b-2 border-transparent hover:border-indigo-500">
                    API Docs
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
