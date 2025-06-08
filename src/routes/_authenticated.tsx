import { createFileRoute, Outlet } from '@tanstack/react-router'
import AuthenticatedOnlyFeature from '@/components/hocs/authenticated-only-feature'
import { EmailVerifiedOnlyFeature } from '@/components/hocs/email-verified-only-feature'
import Footer from '@/components/core/footer'
import { useAuth } from '@/resources/auth/auth-hook'
import { Header } from '@/components/core/header'

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
})

function AuthenticatedLayoutInner() {
  const { user } = useAuth()

  return (
    <div className="flex min-h-screen flex-col">
      <Header userName={user?.username || 'Usuário'} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

function AuthenticatedLayout() {
  return (
    <AuthenticatedOnlyFeature>
      <EmailVerifiedOnlyFeature>
        <AuthenticatedLayoutInner />
      </EmailVerifiedOnlyFeature>
    </AuthenticatedOnlyFeature>
  )
} 