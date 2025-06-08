import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useGame } from '@/resources/game/game-hook'
import { CharacterService } from '@/resources/game/character.service'
import type { Character } from '@/resources/game/models/character.model'
import { toast } from 'sonner'
import { MapModal } from '@/components/hub/MapModal'
import { CharacterInfoCard } from '@/components/hub/CharacterInfoCard'
import { ActionMenuGrid } from '@/components/hub/ActionMenuGrid'
import { HubNotifications } from '@/components/hub/HubNotifications'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/game/play/hub')({
  component: GameHubPage,
  validateSearch: (search) => ({
    character: (search.character as string) || '',
  }),
})

function GameHubPage() {
  const navigate = useNavigate()
  const { character: characterId } = Route.useSearch()
  const { gameState, loadCharacterForHub } = useGame()
  const { player } = gameState
  const [isLoading, setIsLoading] = useState(true)
  const [characterLoaded, setCharacterLoaded] = useState(false)
  const [showMapModal, setShowMapModal] = useState(false)
  const [showHealNotification, setShowHealNotification] = useState(false)
  const [healInfo, setHealInfo] = useState<{ oldHp: number; newHp: number; character: string } | null>(null)

  // Carregar personagem selecionado - apenas uma vez
  useEffect(() => {
    const loadSelectedCharacter = async () => {
      if (!characterId) {
        navigate({ to: '/game/play' })
        return
      }

      // Evitar carregamentos duplicados
      if (characterLoaded && player.id === characterId) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const response = await CharacterService.getCharacter(characterId)
        if (response.success && response.data) {
          // Verificar se houve cura significativa comparando com cache anterior
          const cachedPlayer = sessionStorage.getItem(`player_${characterId}`)
          if (cachedPlayer) {
            const previousPlayer = JSON.parse(cachedPlayer)
            const healAmount = response.data.hp - previousPlayer.hp
            const healPercent = (healAmount / response.data.max_hp) * 100
            
            // Se foi curado significativamente (mais de 5% do HP máximo)
            if (healAmount > 0 && healPercent >= 5) {
              setHealInfo({
                oldHp: previousPlayer.hp,
                newHp: response.data.hp,
                character: response.data.name
              })
              setShowHealNotification(true)
              
              // Esconder notificação após 5 segundos
              setTimeout(() => {
                setShowHealNotification(false)
              }, 5000)
            }
          }
          
          // Salvar estado atual para comparação futura
          sessionStorage.setItem(`player_${characterId}`, JSON.stringify(response.data))
          
          await loadCharacterForHub(response.data)
          setCharacterLoaded(true)
        } else {
          toast.error('Erro ao carregar personagem', {
            description: response.error
          })
          navigate({ to: '/game/play' })
        }
      } catch (error) {
        console.error('Erro ao carregar personagem:', error)
        toast.error('Erro ao carregar personagem')
        navigate({ to: '/game/play' })
      } finally {
        setIsLoading(false)
      }
    }

    loadSelectedCharacter()
  }, [characterId]) // Só executar quando o ID do personagem mudar

  // Loading state
  if (isLoading || !player.id) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-500"></div>
      </div>
    )
  }

  // Função para iniciar sempre do andar 1
  const handleStartFromBeginning = async () => {
    try {
      // Resetar para andar 1
      await CharacterService.updateCharacterFloor(player.id, 1)
      navigate({ to: '/game/play/battle/$character', params: { character: player.id } })
    } catch (error) {
      console.error('Erro ao iniciar do começo:', error)
      toast.error('Erro ao iniciar aventura')
    }
  }

  // Função para iniciar de um checkpoint
  const handleStartFromCheckpoint = async (checkpointFloor: number) => {
    try {
      const response = await CharacterService.startFromCheckpoint(player.id, checkpointFloor)
      if (response.success) {
        navigate({ to: '/game/play/battle/$character', params: { character: player.id } })
      } else {
        toast.error('Erro ao iniciar do checkpoint', {
          description: response.error
        })
      }
    } catch (error) {
      console.error('Erro ao iniciar do checkpoint:', error)
      toast.error('Erro ao iniciar do checkpoint')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4">
      <div className="w-full max-w-7xl mx-auto space-y-4">
        {/* Header padronizado */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: '/game/play' })}
              className="self-start"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Trocar Personagem</span>
              <span className="sm:hidden">Trocar</span>
            </Button>
            
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Hub de {player.name}</h1>
              <p className="text-sm sm:text-base text-slate-300">
                Andar {player.floor} • Nível {player.level} • {player.gold} Gold
              </p>
            </div>
          </div>
        </div>

        {/* Notificações */}
        <HubNotifications 
          player={player}
          showHealNotification={showHealNotification}
          healInfo={healInfo}
          onDismissHealNotification={() => setShowHealNotification(false)}
        />

        {/* Layout principal mais compacto */}
        <div className="space-y-4">
          {/* Informações do Personagem */}
          <CharacterInfoCard player={player} />

          {/* Menu de Ações */}
          <ActionMenuGrid
            player={player}
            onStartAdventure={handleStartFromBeginning}
            onOpenMap={() => setShowMapModal(true)}
            onOpenCharacterStats={() => navigate({ to: '/game/play/character-stats', search: { character: player.id } })}
            onOpenShop={() => navigate({ to: '/game/play/shop', search: { character: player.id } })}
            onOpenInventory={() => navigate({ to: '/game/play/inventory', search: { character: player.id } })}
            onOpenEquipment={() => navigate({ to: '/game/play/equipment', search: { character: player.id } })}
            onOpenSpells={() => navigate({ to: '/game/spells', search: { character: player.id } })}
            onOpenCrafting={() => navigate({ to: '/game/crafting', search: { character: player.id } })}
            onOpenCemetery={() => navigate({ to: '/game/cemetery' })}
            onReturnToSelection={() => navigate({ to: '/game/play' })}
          />
        </div>

        {/* Modal do Mapa */}
        <MapModal
          isOpen={showMapModal}
          onClose={() => setShowMapModal(false)}
          character={{ id: player.id, floor: player.floor } as Character}
          onStartFromCheckpoint={handleStartFromCheckpoint}
        />
      </div>
    </div>
  )
} 