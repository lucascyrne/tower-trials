'use client';

import React from 'react';
import { CharacterSelect } from '@/components/game/CharacterSelect';

export default function GamePlayPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
      <CharacterSelect />
    </div>
  );
} 