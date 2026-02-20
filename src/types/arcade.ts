export type ArcadeGameId = 'tetris' | 'frogger' | 'asteroids' | 'pacman';

export interface ArcadeCatalogEntry {
  id: string;
  title: string;
  description: string;
  href: string;
  image: string;
}
