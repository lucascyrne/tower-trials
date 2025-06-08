// React and Next.js imports
import { Link } from '@tanstack/react-router';

// UI component imports
import { Button } from '../ui/button';

// Icon imports
import { Github, Twitter } from 'lucide-react';

import { Container, Section } from './craft';

export default function Footer() {
  return (
    <footer className="bg-gradient-to-t from-background/90 to-background/70 border-t border-border">
      <Section>
        <Container className="grid gap-12 md:grid-cols-[1.5fr_0.5fr_0.5fr]">
          <div className="not-prose flex flex-col gap-6">
            <Link to="/" className="group">
              <h3 className="sr-only">Tower Trials</h3>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 group-hover:from-purple-500 group-hover:to-pink-700 transition-colors">
                Tower Trials
              </h1>
            </Link>
            <p className="text-muted-foreground">
              Enfrente desafios, suba a torre e torne-se uma lenda neste RPG roguelike épico.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <h5 className="font-bold text-primary">Links</h5>
            <Link to="/game/ranking" className="text-muted-foreground hover:text-primary transition-colors">Ranking Global</Link>
            <Link to="/game/guide" className="text-muted-foreground hover:text-primary transition-colors">Guia do Jogo</Link>
          </div>
          <div className="flex flex-col gap-3">
            <h5 className="font-bold text-primary">Legal</h5>
            {/* <Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">Privacidade</Link>
            <Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">Termos</Link> */}
          </div>
        </Container>
        <Container className="not-prose mt-8 flex flex-col justify-between gap-6 border-t border-border pt-8 md:flex-row md:items-center md:gap-2">
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary transition-colors">
              <Github className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary transition-colors">
              <Twitter className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-muted-foreground">© 2024 Tower Trials. Todos os direitos reservados.</p>
        </Container>
      </Section>
    </footer>
  );
}
