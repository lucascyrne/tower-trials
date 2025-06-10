import { type ReactNode, createContext, useContext, useCallback, useRef } from 'react';
import { type ActionType } from '../game-model';
import { GameService } from '../game.service';
import { CharacterService } from '../character.service';
import { useGameState } from './game-state.provider';
import { useGameLog } from './log.provider';
import { useCharacter } from './character.provider';

interface BattleContextType {
  performAction: (action: ActionType, spellId?: string, consumableId?: string) => void;
}

const BattleContext = createContext<BattleContextType | null>(null);

interface BattleProviderProps {
  children: ReactNode;
}

export function BattleProvider({ children }: BattleProviderProps) {
  const { gameState, setGameState, updateLoading } = useGameState();
  const { addGameLogMessage } = useGameLog();
  const { selectedCharacter } = useCharacter();

  // Ref para controle simples de ações
  const lastActionRef = useRef<{
    timestamp: number;
    action: string;
    processing: boolean;
  }>({
    timestamp: 0,
    action: '',
    processing: false
  });

  // Função principal de ação
  const performAction = useCallback(async (action: ActionType, spellId?: string, consumableId?: string) => {
    // Controle de debounce MAIS RIGOROSO
    const now = Date.now();
    const timeSinceLastAction = now - lastActionRef.current.timestamp;
    const isSameAction = lastActionRef.current.action === action;
    
    console.log(`[BattleProvider] === AÇÃO SOLICITADA: ${action} ===`);
    console.log(`[BattleProvider] Debounce: última ação ${lastActionRef.current.action} há ${timeSinceLastAction}ms`);
    
    // VALIDAÇÕES MAIS RIGOROSAS para evitar loops
    if (!selectedCharacter) {
      console.warn(`[BattleProvider] Ação bloqueada - sem personagem selecionado`);
      return;
    }
    
    if (lastActionRef.current.processing) {
      console.warn(`[BattleProvider] Ação bloqueada - já processando ação: ${lastActionRef.current.action}`);
      return;
    }
    
    if (gameState.mode === 'gameover') {
      console.warn(`[BattleProvider] Ação bloqueada - personagem morto`);
      return;
    }
    
    // Debounce mais agressivo para mesma ação
    if (isSameAction && timeSinceLastAction < 2000) {
      console.warn(`[BattleProvider] Ação bloqueada - mesma ação muito rápida (${timeSinceLastAction}ms < 2000ms)`);
      return;
    }
    
    // Debounce geral
    if (timeSinceLastAction < 500) {
      console.warn(`[BattleProvider] Ação bloqueada - muito rápida (${timeSinceLastAction}ms < 500ms)`);
      return;
    }
    
    // Marcar como processando ANTES de qualquer operação assíncrona
    lastActionRef.current = {
      timestamp: now,
      action: action,
      processing: true
    };
    
    updateLoading('performAction', true);
    
    try {
      // Processar ação do jogador
      console.log(`[BattleProvider] Processando ação do jogador: ${action}`);
      
      const playerResult = await GameService.processPlayerAction(
        action,
        gameState,
        spellId,
        consumableId
      );
      
      const { newState, skipTurn, message, skillXpGains, gameLogMessages } = playerResult;
      
      // Adicionar mensagens ao log
      if (gameLogMessages?.length) {
        gameLogMessages.forEach(logMsg => {
          addGameLogMessage(logMsg.message, logMsg.type);
        });
      }
      
      // Aplicar skill XP se houver
      if (skillXpGains?.length && selectedCharacter) {
        try {
          for (const skillGain of skillXpGains) {
            await CharacterService.addSkillXp(selectedCharacter.id, skillGain.skill, skillGain.xp);
          }
        } catch (error) {
          console.error('[BattleProvider] Erro ao aplicar skill XP:', error);
        }
      }
      
      // Processar fuga
      if (action === 'flee' && (newState.fleeSuccessful === true || newState.mode === 'fled')) {
        console.log(`[BattleProvider] === FUGA BEM-SUCEDIDA ===`);
        
        setGameState({
          ...newState,
          mode: 'fled',
          fleeSuccessful: true,
          currentEnemy: null,
          battleRewards: null,
          isPlayerTurn: true
        });
        
        addGameLogMessage(message, 'system');
        lastActionRef.current.processing = false;
        updateLoading('performAction', false);
        return;
      }
      
      // Verificar se deve pular turno
      if (skipTurn) {
        setGameState({
          ...newState,
          gameMessage: message
        });
        
        addGameLogMessage(message, 'system');
        lastActionRef.current.processing = false;
        updateLoading('performAction', false);
        return;
      }
      
      // Verificar se inimigo foi derrotado
      if (newState.currentEnemy && newState.currentEnemy.hp <= 0) {
        console.log('[BattleProvider] === INIMIGO DERROTADO ===');
        
        const defeatedState = await GameService.processEnemyDefeat(newState);
        
        setGameState(defeatedState);
        
        addGameLogMessage(`${newState.currentEnemy.name} foi derrotado!`, 'system');
        lastActionRef.current.processing = false;
        updateLoading('performAction', false);
        return;
      }
      
      // Processar turno do inimigo
      if (newState.currentEnemy && !newState.fleeSuccessful) {
        console.log('[BattleProvider] === INICIANDO TURNO DO INIMIGO ===');
        
        // Mostrar estado intermediário
        setGameState({
          ...newState,
          isPlayerTurn: false,
          gameMessage: message
        });
        
        addGameLogMessage(message, 'player_action');
        
        // Processar turno do inimigo após delay
        setTimeout(async () => {
          try {
            console.log('[BattleProvider] Processando ação do inimigo...');
            
            const enemyResult = await GameService.processEnemyActionWithDelay(
              {
                ...newState,
                isPlayerTurn: false
              },
              action === 'defend',
              1500
            );
            
            const { newState: finalState, skillXpGains: enemySkillXpGains } = enemyResult;
            
            // Aplicar skill XP se houver
            if (enemySkillXpGains?.length && selectedCharacter) {
              try {
                for (const skillGain of enemySkillXpGains) {
                  await CharacterService.addSkillXp(selectedCharacter.id, skillGain.skill, skillGain.xp);
                }
              } catch (error) {
                console.error('[BattleProvider] Erro ao aplicar skill XP de defesa:', error);
              }
            }
            
            // Verificar se jogador morreu
            if (finalState.mode === 'gameover') {
              setGameState(finalState);
              lastActionRef.current.processing = false;
              updateLoading('performAction', false);
              return;
            }
            
            // Atualizar HP/Mana no banco
            if (selectedCharacter) {
              await CharacterService.updateCharacterHpMana(
                selectedCharacter.id,
                finalState.player.hp,
                finalState.player.mana
              );
            }
            
            // Adicionar mensagem do inimigo
            if (finalState.gameMessage?.trim()) {
              const messageType = finalState.gameMessage.includes('causou') && finalState.gameMessage.includes('dano') 
                ? 'damage' 
                : 'enemy_action';
              addGameLogMessage(finalState.gameMessage, messageType);
            }
            
            // Estado final - retorna turno ao jogador
            setGameState({
              ...finalState,
              isPlayerTurn: true
            });
            
          } catch (error) {
            console.error('[BattleProvider] Erro no turno do inimigo:', error);
          } finally {
            lastActionRef.current.processing = false;
            updateLoading('performAction', false);
          }
        }, 800);
      } else {
        // Não há turno do inimigo
        setGameState({
          ...newState,
          gameMessage: message
        });
        
        addGameLogMessage(message, 'player_action');
        lastActionRef.current.processing = false;
        updateLoading('performAction', false);
      }
      
    } catch (error) {
      console.error('[BattleProvider] Erro crítico na ação:', error);
      setGameState({
        ...gameState,
        gameMessage: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      });
    } finally {
      // CLEANUP GARANTIDO - sempre executado mesmo em caso de erro
      lastActionRef.current.processing = false;
      updateLoading('performAction', false);
      console.log(`[BattleProvider] Cleanup executado - ação ${action} finalizada`);
    }
  }, [gameState, selectedCharacter, setGameState, updateLoading, addGameLogMessage]);

  return (
    <BattleContext.Provider value={{ performAction }}>
      {children}
    </BattleContext.Provider>
  );
}

// Hook personalizado para usar o contexto
export function useBattle() {
  const context = useContext(BattleContext);
  
  if (!context) {
    throw new Error('useBattle deve ser usado dentro de um BattleProvider');
  }
  
  return context;
} 