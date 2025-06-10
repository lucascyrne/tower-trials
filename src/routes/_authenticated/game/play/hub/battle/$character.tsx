import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, useRef } from 'react'
import GameBattle from '@/components/game/game-battle'
import { useGame } from '@/resources/game/game-hook'
import { toast } from 'sonner'

function BattlePage() {
  const navigate = useNavigate()
  const { character: characterId } = Route.useParams()
  const { loading } = useGame()
  const [isLoading, setIsLoading] = useState(true)
  
  // NOVO: Controle para evitar múltiplas inicializações
  const initializedRef = useRef(false)
  const mountedRef = useRef(false)

  // Controle de montagem do componente
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      initializedRef.current = false
    }
  }, [])

  // Monitor de carregamento global - otimizado
  useEffect(() => {
    if (!mountedRef.current) return
    
    if (!loading.loadProgress && !loading.performAction) {
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          setIsLoading(false)
        }
      }, 100) // Reduzir delay para transições mais rápidas
      
      return () => clearTimeout(timer)
    } else {
      setIsLoading(true)
    }
  }, [loading.loadProgress, loading.performAction])

  // Validar se o personagem existe no URL - apenas uma vez na montagem
  useEffect(() => {
    if (!mountedRef.current) return
    
    if (!characterId) {
      if (initializedRef.current) return // Evitar múltiplas navegações
      
      initializedRef.current = true
      toast.error('Personagem não especificado', {
        description: 'Redirecionando para a seleção de personagens'
      })
      navigate({ to: '/game/play' })
    } else {
      initializedRef.current = true
    }
  }, [characterId, navigate])

  // Renderizar skeleton loader enquanto carrega
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
        <div className="w-full max-w-6xl">
          <div className="text-center mb-8">
            <div className="h-8 w-64 bg-muted/50 animate-pulse rounded mx-auto mb-4"></div>
            <div className="h-4 w-48 bg-muted/30 animate-pulse rounded mx-auto"></div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card rounded-lg overflow-hidden shadow animate-pulse">
                <div className="p-4 bg-muted/20">
                  <div className="h-6 bg-muted/40 rounded w-24 mx-auto"></div>
                </div>
                <div className="p-6">
                  <div className="aspect-square bg-muted/30 rounded-md mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-muted/40 rounded w-full"></div>
                    <div className="h-2 bg-muted/30 rounded w-full"></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-8 bg-muted/20 rounded"></div>
                      <div className="h-8 bg-muted/20 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="bg-card rounded-lg p-4 animate-pulse">
            <div className="h-6 bg-muted/40 rounded w-32 mx-auto mb-4"></div>
            <div className="flex gap-2 justify-center">
              <div className="h-10 bg-muted/30 rounded w-24"></div>
              <div className="h-10 bg-muted/30 rounded w-24"></div>
              <div className="h-10 bg-muted/30 rounded w-24"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
      <GameBattle />
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/game/play/hub/battle/$character')({
  component: BattlePage,
}) 