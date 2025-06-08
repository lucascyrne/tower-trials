import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useGame } from '@/resources/game/game-hook'
import { CharacterService } from '@/resources/game/character.service'
import { toast } from 'sonner'
import { InventoryPanel } from '@/components/inventory/InventoryPanel'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import type { Character } from '@/resources/game/models/character.model'

export const Route = createFileRoute('/_authenticated/game/play/inventory')({
  component: InventoryPage,
  validateSearch: (search) => ({
    character: (search.character as string) || '',
  }),
})

function InventoryPage() {
  const navigate = useNavigate()
  const { character: characterId } = Route.useSearch()
  const { loadCharacterForHub } = useGame()
  const [selectedChar, setSelectedChar] = useState<Character | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [characterLoaded, setCharacterLoaded] = useState(false)

  const loadSelectedCharacter = async (showLoadingSpinner = true, skipCacheCheck = false) => {
    if (!characterId) {
      navigate({ to: '/game/play' })
      return
    }

    // Evitar carregamentos duplicados se não for um refresh manual
    if (!skipCacheCheck && characterLoaded && selectedChar?.id === characterId && !showLoadingSpinner) {
      return
    }

    if (showLoadingSpinner) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    
    setError(null)

    try {
      const response = await CharacterService.getCharacter(characterId)
      if (response.success && response.data) {
        setSelectedChar(response.data)
        await loadCharacterForHub(response.data)
        setCharacterLoaded(true)
      } else {
        const errorMsg = response.error || 'Erro desconhecido ao carregar personagem'
        setError(errorMsg)
        toast.error('Erro ao carregar personagem', {
          description: errorMsg
        })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido'
      console.error('Erro ao carregar personagem:', error)
      setError(errorMsg)
      toast.error('Erro ao carregar personagem', {
        description: errorMsg
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadSelectedCharacter(true)
  }, [characterId]) // Só executar quando o ID do personagem mudar

  const handleInventoryChange = () => {
    // Atualizar dados sem recarregar a página completa
    loadSelectedCharacter(false, true) // true para skipCacheCheck
  }

  const handleRefresh = () => {
    loadSelectedCharacter(false, true) // true para skipCacheCheck
  }

  const handleReturnToHub = () => {
    if (characterId) {
      navigate({ to: '/game/play/hub', search: { character: characterId } })
    } else {
      navigate({ to: '/game/play' })
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-black p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400 mb-4"></div>
          <h2 className="text-2xl font-bold mb-2 text-slate-100">Carregando Inventário</h2>
          <p className="text-slate-400">Aguarde enquanto carregamos seus itens...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !selectedChar) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-black p-4">
        <div className="w-full max-w-md text-center">
          <Card className="p-6 bg-slate-800/50 border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-red-400">Erro ao Carregar Inventário</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-400">
                {error || 'Não foi possível carregar o personagem selecionado.'}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => loadSelectedCharacter()}
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: '/game/play' })}
                  className="flex-1 border-slate-600 text-slate-300"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReturnToHub}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Hub
            </Button>
            
            <div>
              <h1 className="text-3xl font-bold text-slate-100">Inventário</h1>
              <p className="text-slate-400">
                {selectedChar.name} • Nível {selectedChar.level}
              </p>
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </div>

        <InventoryPanel 
          character={selectedChar} 
          onInventoryChange={handleInventoryChange} 
        />
      </div>
    </div>
  )
} 