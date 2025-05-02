'use client';

import PublicOnlyFeature from '@/components/hocs/public-only-feature';
import Footer from '@/components/core/footer';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <PublicOnlyFeature>
      <main className="flex min-h-screen flex-col">
        <div className="flex flex-1 items-center justify-center p-4">{children}</div>
        <Footer />
      </main>
    </PublicOnlyFeature>
  );
}
