# ATENÇÃO: PARCIALMENTE DESATUALIZADA!

# Tower Trials - Balanceamento do Jogo

Este documento descreve as decisões de balanceamento implementadas no jogo para garantir uma progressão satisfatória e desafiadora ao longo de aproximadamente 2 semanas de jogo.

## Progressão Geral

O jogo foi projetado para fornecer uma experiência equilibrada onde:

1. Consumíveis são relativamente fáceis de obter, permitindo que jogadores possam fugir de batalhas e ainda progredir
2. Equipamentos são mais difíceis de obter, especialmente os de raridade alta
3. Receitas para desbloquear equipamentos raros e épicos exigem maior esforço e planejamento
4. O jogo fica progressivamente mais difícil à medida que o jogador avança

## Monstros e Drops

### Monstros
- X tipos de monstros distribuídos em Y andares, cada um com seu drop único
- Monstros em andares mais altos têm mais HP, ATK e DEF
- Recompensas (XP e Gold) aumentam com o nível do andar, mas a uma taxa controlada
- A ordem de encontro dos monstros é aleatória para cada andar, aumentando a rejogabilidade

### Sistema de Drops
- Cada monstro tem seu próprio drop exclusivo
- Chances de drop variam por raridade: 
  - Comum: 50-70%
  - Incomum: 50-65%
  - Raro: 35-50%
  - Épico: 25-35%
  - Lendário: 10-15%
- Multiplicadores de chance de drop:
  - +1% por nível do monstro
  - +20% em andares elite
  - +30% em andares evento
  - +50% em andares de boss
- Chances máximas limitadas a 95% para garantir alguma imprevisibilidade

## Economia do Jogo

### Gold
- Fontes de gold:
  - Recompensas por derrotar monstros (principal)
  - Venda de equipamentos (secundária)
  - Venda de drops (complementar)
- Ajustes de balanceamento:
  - Redução da progressão de gold por andar (5 gold por andar em vez de 10)
  - Valor de venda de equipamentos baseado na raridade:
    - Comum: 30% do valor original
    - Incomum: 35% do valor original
    - Raro: 40% do valor original
    - Épico: 45% do valor original
    - Lendário: 50% do valor original

### Preços e Raridades
- Equipamentos por raridade:
  - Comum: 120-160 gold (Nível 1-3)
  - Incomum: 330-390 gold (Nível 5-8)
  - Raro: 780-900 gold (Nível 10-13)
  - Épico: 1800-2100 gold (Nível 15-18)
  - Lendário: 5000 gold (Nível 20)
- Consumíveis:
  - Poções pequenas: 25 gold
  - Poções médias: 60 gold (craftáveis)
  - Poções grandes: 120 gold (craftáveis)
  - Antídoto: 75 gold (craftável)
  - Elixires: 100 gold (craftáveis)

## Sistema de Crafting

### Receitas de Consumíveis
- Receitas padrão usam:
  - 2-3 drops de monstros específicos
  - 1-2 consumíveis de tier mais baixo
- Tempo estimado para obter recursos para 1 consumível de tier alto: ~1-2 horas de jogo

### Sistema de Desbloqueio de Equipamentos
- Inovação: Pergaminhos especiais craftados que desbloqueiam equipamentos raros/épicos
- Pergaminhos requerem drops valiosos:
  - Tier Raro: 2-3 drops raros de andares 10-15
  - Tier Épico: 2-3 drops épicos de andares 16-20
- Desbloqueio permanente por categoria (arma, armadura, acessório)
- Desafios adicionais pelo custo elevado dos equipamentos desblocados

## Recuperação e Sobrevivência

- Sistema de recuperação de HP/Mana adaptativo:
  - Diminui à medida que o jogador avança nos andares
  - Força o uso mais estratégico de consumíveis em andares avançados
- Avisos de nível recomendado:
  - O jogo avisa quando o jogador está abaixo do nível recomendado
  - Incentiva estratégias alternativas como fuga, uso de consumíveis ou grinding

## Estimativa de Progressão

- **Primeiros 5 andares (Dias 1-3)**: Foco em aprender mecânicas, obter equipamentos comuns
- **Andares 6-10 (Dias 4-7)**: Desafio moderado, farmando para equipamentos incomuns
- **Andares 11-15 (Dias 8-11)**: Desafio elevado, desbloqueio de equipamentos raros
- **Andares 16-20 (Dias 12-14)**: Desafio extremo, equipamentos épicos, preparação para equipamentos lendários
- **Endgame (Dia 14+)**: Desbloqueio de equipamentos lendários e obtenção das melhores habilidades

O balanceamento foi projetado para que mesmo jogadores mais experientes precisem de ~2 semanas para chegar ao endgame, enquanto jogadores casuais possam ter uma progressão constante e satisfatória. 