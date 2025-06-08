import { createFileRoute, Outlet } from '@tanstack/react-router'
import PublicOnlyFeature from '@/components/hocs/public-only-feature'
import Footer from '@/components/core/footer'

export const Route = createFileRoute('/_public')({
  component: PublicLayout,
})

function PublicLayout() {
  return (
    <PublicOnlyFeature>
      <main className="flex min-h-screen flex-col">
        <div className="flex flex-1 items-center justify-center p-4">
          <Outlet />
        </div>
        <Footer />
      </main>
    </PublicOnlyFeature>
  )
} 