-- =====================================
-- SCRIPT: ATAQUES ESPECIAIS DOS MONSTROS
-- Data: 2024-12-03
-- Uso: Executar diretamente no SQL Editor
-- =====================================

-- INSTRUÇÕES:
-- 1. Copie e cole este script inteiro no SQL Editor do Supabase
-- 2. Execute uma vez para adicionar todos os ataques especiais
-- 3. Cada monstro terá ataques únicos baseados em sua natureza

-- =====================================
-- SLIMES (Monstros Iniciais)
-- =====================================

UPDATE monsters SET special_abilities = ARRAY[
    'Divisão Viscosa: 25% chance de se dividir ao receber dano crítico, criando um clone com 50% do HP',
    'Absorção: Regenera 3 HP por turno',
    'Salto Ácido: Ataque que causa dano ao longo do tempo por 2 turnos'
] WHERE name = 'Slime Verde';

UPDATE monsters SET special_abilities = ARRAY[
    'Congelamento: 20% chance de retardar o próximo ataque do inimigo',
    'Forma Líquida: Reduz 30% do dano físico recebido',
    'Rajada Gélida: Ataque que reduz velocidade do alvo por 2 turnos'
] WHERE name = 'Slime Azul';

-- =====================================
-- CRIATURAS PEQUENAS
-- =====================================

UPDATE monsters SET special_abilities = ARRAY[
    'Mordida Infecciosa: 15% chance de causar envenenamento por 3 turnos',
    'Esquiva Ágil: +20% chance de esquivar do próximo ataque após receber dano',
    'Ataque Frenético: Ataca duas vezes quando HP < 30%'
] WHERE name = 'Rato Gigante';

UPDATE monsters SET special_abilities = ARRAY[
    'Punhalada Traiçoeira: Chance de crítico +15% quando inimigo está ferido',
    'Grito de Guerra: Aumenta ATK em 25% por 3 turnos quando HP < 50%',
    'Emboscada: Primeiro ataque sempre causa 150% de dano'
] WHERE name = 'Goblin';

UPDATE monsters SET special_abilities = ARRAY[
    'Lança Venenosa: Ataques têm 20% chance de causar veneno por 2 turnos',
    'Formação de Combate: +10% DEF por cada turno sem receber dano (máx 30%)',
    'Investida Desesperada: ATK +50% quando HP < 25%'
] WHERE name = 'Kobold';

-- =====================================
-- MORTOS-VIVOS
-- =====================================

UPDATE monsters SET special_abilities = ARRAY[
    'Resistência Morta: Imune a efeitos de medo e atordoamento',
    'Golpe Ósseo: 25% chance de reduzir DEF do inimigo por 2 turnos',
    'Reconstituição: Regenera 5 HP por turno quando HP < 50%'
] WHERE name = 'Esqueleto';

UPDATE monsters SET special_abilities = ARRAY[
    'Mordida Infectante: Reduz regeneração natural do inimigo em 50%',
    'Carne Putrefata: Ataques corpo a corpo contra o zumbi causam 2 de dano no atacante',
    'Ressurreição: 10% chance de voltar com 25% HP na morte'
] WHERE name = 'Zumbi';

-- =====================================
-- BESTAS SELVAGENS
-- =====================================

UPDATE monsters SET special_abilities = ARRAY[
    'Perseguição: +2 de velocidade por turno perseguindo o mesmo alvo',
    'Uivo Selvagem: Reduz precisão de todos os inimigos por 2 turnos',
    'Mordida Feroz: Dano dobrado contra inimigos com HP < 40%'
] WHERE name = 'Lobo Selvagem';

UPDATE monsters SET special_abilities = ARRAY[
    'Veneno Paralisante: 30% chance de reduzir velocidade em 50% por 3 turnos',
    'Teia Pegajosa: Impede fuga do inimigo por 2 turnos',
    'Picada Mortal: Dano de veneno aumenta a cada turno'
] WHERE name = 'Aranha Venenosa';

UPDATE monsters SET special_abilities = ARRAY[
    'Investida Brutal: Ataque que causa dano baseado na força bruta',
    'Fúria Sanguinária: ATK +10% a cada 10% de HP perdido',
    'Pisoteio: Ataque em área que afeta múltiplos alvos'
] WHERE name = 'Orc';

UPDATE monsters SET special_abilities = ARRAY[
    'Grito Sobrenatural: Causa medo, reduzindo ATK do inimigo por 2 turnos',
    'Voo Rasante: 35% chance de evitar ataques corpo a corpo',
    'Garras Dilaceradoras: Causa sangramento por 3 turnos'
] WHERE name = 'Harpia';

-- =====================================
-- CONSTRUTOS E GOLEMS
-- =====================================

UPDATE monsters SET special_abilities = ARRAY[
    'Pele de Pedra: Reduz todo dano recebido em 3 pontos (mínimo 1)',
    'Punho Esmagador: Pode atordoar o inimigo por 1 turno',
    'Regeneração Mineral: +8 HP por turno quando não ataca'
] WHERE name = 'Golem de Pedra';

UPDATE monsters SET special_abilities = ARRAY[
    'Espinhos de Cristal: Retorna 25% do dano físico recebido',
    'Reflexo Prismático: 20% chance de refletir magias de volta',
    'Explosão Cristalina: Ao morrer, causa dano em área'
] WHERE name = 'Golem de Cristal';

UPDATE monsters SET special_abilities = ARRAY[
    'Armadura Ancestral: Imunidade a ataques críticos',
    'Força da Terra: ATK aumenta em 5% a cada turno na defensiva',
    'Tremor: Reduz precisão de todos os inimigos por 2 turnos'
] WHERE name = 'Golem Ancestral';

UPDATE monsters SET special_abilities = ARRAY[
    'Núcleo Derretido: Ataques causam dano de fogo por 2 turnos',
    'Erupção: A cada 4 turnos, causa dano em área',
    'Calor Intenso: Reduz eficácia de curas em 50% nos inimigos'
] WHERE name = 'Golem de Lava';

UPDATE monsters SET special_abilities = ARRAY[
    'Possessão Sombria: Move as peças de armadura independentemente',
    'Lâminas Flutuantes: Ataque à distância que ignora 50% da defesa',
    'Reconstituição Mágica: Regenera partes destruídas ao longo do tempo'
] WHERE name = 'Armadura Animada';

-- =====================================
-- MAGOS E USUÁRIOS DE MAGIA
-- =====================================

UPDATE monsters SET special_abilities = ARRAY[
    'Rajada Mágica: Projétil mágico que nunca erra o alvo',
    'Barreira Arcana: +50% resistência mágica por 3 turnos',
    'Drenar Mana: Rouba mana do inimigo para si'
] WHERE name = 'Mago Corrompido';

UPDATE monsters SET special_abilities = ARRAY[
    'Toque da Morte: Reduz HP máximo do inimigo permanentemente',
    'Aura Necrótica: Inimigos perdem 2 HP por turno próximos ao Lich',
    'Exército Morto: Convoca esqueletos menores para auxiliar'
] WHERE name = 'Lich';

UPDATE monsters SET special_abilities = ARRAY[
    'Reanimar Mortos: Chance de transformar inimigos derrotados em aliados',
    'Drenar Vida: Recupera HP igual a 50% do dano causado',
    'Maldição: Reduz todos os atributos do inimigo por 4 turnos'
] WHERE name = 'Necromante';

UPDATE monsters SET special_abilities = ARRAY[
    'Regeneração Natural: +6 HP por turno quando em contato com a terra',
    'Invocar Espinhos: Cria barreira que causa dano ao contato',
    'Comunhão com a Natureza: Aumenta todos os atributos a cada turno'
] WHERE name = 'Druida Corrompido';

-- =====================================
-- CRIATURAS MÍSTICAS
-- =====================================

UPDATE monsters SET special_abilities = ARRAY[
    'Múltiplas Cabeças: Ataca 3 vezes por turno com ATK reduzido',
    'Sopro Elemental: Alterna entre fogo, gelo e raio a cada uso',
    'Adaptação: Ganha resistência ao tipo de dano mais recebido'
] WHERE name = 'Quimera';

UPDATE monsters SET special_abilities = ARRAY[
    'Cabeças Regenerativas: Regenera uma cabeça a cada 3 turnos (máx 5)',
    'Ataque Múltiplo: Número de ataques = número de cabeças',
    'Veneno Hidra: Veneno se espalha para outros inimigos'
] WHERE name = 'Hidra';

UPDATE monsters SET special_abilities = ARRAY[
    'Olhar Petrificante: 15% chance de paralisar inimigo por 1 turno',
    'Escamas Venenosas: Imunidade a venenos e efeitos de status',
    'Rastejada Veloz: Pode atacar duas vezes se não se moveu'
] WHERE name = 'Basilisco';

UPDATE monsters SET special_abilities = ARRAY[
    'Ecolocalização: Nunca erra ataques, mesmo no escuro',
    'Drenar Sangue: Recupera HP e reduz força do inimigo',
    'Voo Noturno: Dobra velocidade durante a noite'
] WHERE name = 'Morcego Vampírico';

-- =====================================
-- ELEMENTAIS
-- =====================================

UPDATE monsters SET special_abilities = ARRAY[
    'Forma Flamejante: Imunidade a dano de fogo e gelo',
    'Explosão Ígnea: Dano em área que aumenta com HP perdido',
    'Aura de Calor: Inimigos próximos perdem 1 mana por turno'
] WHERE name = 'Elemental de Fogo';

UPDATE monsters SET special_abilities = ARRAY[
    'Congelamento Profundo: Pode congelar inimigos por 2 turnos',
    'Armadura de Gelo: +30% defesa, mas -20% velocidade',
    'Tempestade Gelada: Reduz velocidade de todos os inimigos'
] WHERE name = 'Elemental de Gelo';

-- =====================================
-- GIGANTES E TITÃS
-- =====================================

UPDATE monsters SET special_abilities = ARRAY[
    'Investida Gigante: Dano massivo que atravessa defesas',
    'Rugido Intimidador: Reduz ATK de todos os inimigos por 3 turnos',
    'Pele Grossa: Ignora os primeiros 5 pontos de dano de cada ataque'
] WHERE name = 'Ogro';

UPDATE monsters SET special_abilities = ARRAY[
    'Pisão Sísmico: Dano em área que reduz velocidade',
    'Resistência Titânica: Reduz dano de ataques únicos em 50%',
    'Força Colossal: ATK dobrado contra estruturas e defesas'
] WHERE name = 'Titã de Pedra';

UPDATE monsters SET special_abilities = ARRAY[
    'Montanha Viva: +15% de todos os atributos a cada 5 turnos',
    'Avalanche: Ataque devastador com recarga de 3 turnos',
    'Criação de Rochas: Cria obstáculos que bloqueiam ataques'
] WHERE name = 'Troll da Montanha';

-- =====================================
-- CAVALEIROS E GUERREIROS
-- =====================================

UPDATE monsters SET special_abilities = ARRAY[
    'Golpe do Fim: Dano triplicado quando inimigo tem HP < 20%',
    'Aura Sombria: Reduz precisão e velocidade dos inimigos',
    'Resistência Morta: Imune a medo, charme e efeitos mentais'
] WHERE name = 'Cavaleiro da Morte';

UPDATE monsters SET special_abilities = ARRAY[
    'Lábia Demoníaca: Confunde inimigos, fazendo-os atacar aliados',
    'Garras Sombrias: Ataques ignoram 60% da armadura',
    'Teleporte Sombrio: Pode reposicionar-se instantaneamente'
] WHERE name = 'Imp';

UPDATE monsters SET special_abilities = ARRAY[
    'Presença Demoníaca: Inimigos começam com medo (-25% ATK)',
    'Asas da Perdição: Imune a ataques corpo a corpo por 1 turno',
    'Chamas do Inferno: Todos os ataques causam dano de fogo adicional'
] WHERE name = 'Demônio Alado';

-- =====================================
-- DRAGÕES (CRIATURAS ÉPICAS)
-- =====================================

UPDATE monsters SET special_abilities = ARRAY[
    'Sopro de Fogo: Dano em área com chance de queimadura',
    'Voo Majestoso: 50% chance de evitar ataques terrestres',
    'Escamas Dracônicas: Reduz dano de ataques críticos em 50%'
] WHERE name = 'Dragão Jovem';

UPDATE monsters SET special_abilities = ARRAY[
    'Sopro Devastador: Dano massivo em linha reta',
    'Presença Dracônica: Todos os inimigos começam intimidados',
    'Fúria Ancestral: ATK e DEF aumentam quando HP < 50%'
] WHERE name = 'Dragão Adulto';

UPDATE monsters SET special_abilities = ARRAY[
    'Sopro Primordial: Combina todos os elementos (fogo, gelo, raio)',
    'Sabedoria Milenar: Imune a efeitos de status negativos',
    'Regeneração Dracônica: +15 HP por turno',
    'Rugido do Apocalipse: Reduz drasticamente todos os atributos inimigos'
] WHERE name = 'Dragão Ancião';

UPDATE monsters SET special_abilities = ARRAY[
    'Controle Elemental: Pode alternar entre fogo, gelo, raio e terra',
    'Barreira Elemental: Imunidade ao elemento atualmente controlado',
    'Tempestade Primal: Ataque que muda de elemento aleatoriamente'
] WHERE name = 'Dragão Elemental';

UPDATE monsters SET special_abilities = ARRAY[
    'Sopro Glacial: Congela inimigos e reduz velocidade drasticamente',
    'Armadura de Gelo: Regenera armadura natural a cada turno',
    'Hibernação Curativa: Pode passar 1 turno para regenerar 25% HP'
] WHERE name = 'Wyrm Glacial';

-- =====================================
-- ALPHAS E LÍDERES
-- =====================================

UPDATE monsters SET special_abilities = ARRAY[
    'Liderança da Matilha: +20% ATK para todos os lobos próximos',
    'Uivo do Alpha: Pode convocar lobos menores para auxiliar',
    'Instinto de Caça: Críticos em 25% chance contra presas feridas'
] WHERE name = 'Lobo Alpha';

-- =====================================
-- CONFIRMAÇÃO
-- =====================================

-- Verificar quantos monstros foram atualizados
SELECT 
    name,
    behavior,
    array_length(special_abilities, 1) as num_abilities
FROM monsters 
WHERE special_abilities IS NOT NULL AND array_length(special_abilities, 1) > 0
ORDER BY name;

-- Estatísticas finais
SELECT 
    behavior,
    COUNT(*) as total_monsters,
    AVG(array_length(special_abilities, 1)) as avg_abilities_per_monster
FROM monsters 
WHERE special_abilities IS NOT NULL 
GROUP BY behavior
ORDER BY behavior;

-- =====================================
-- RESULTADO ESPERADO
-- =====================================
-- Todos os monstros agora possuem ataques especiais únicos:
-- - 2-4 habilidades especiais por monstro
-- - Habilidades temáticas baseadas na natureza do monstro  
-- - Mecânicas diversificadas (buff, debuff, dano, controle)
-- - Escalamento e complexidade crescente com o nível do monstro 