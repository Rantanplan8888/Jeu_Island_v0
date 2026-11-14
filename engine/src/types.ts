export type PlayerId = string;
export type IslandId = string;

export interface Resources {
  gold: number;
  wood: number;
}

export type BuildingType = 'mine' | 'sawmill' | 'barracks' | 'port' | 'tower' | 'university';

export interface Building {
  type: BuildingType;
  /** Tour pendant lequel le bâtiment a été construit (0 = présent dès le départ). */
  builtTurn: number;
}

export interface Island {
  id: IslandId;
  /** Coordonnées axiales sur une grille hexagonale. */
  q: number;
  r: number;
  owner: PlayerId | null;
  soldiers: number;
  woodSymbol: boolean;
  goldSymbol: boolean;
  isCapital: boolean;
  /** Vrai si l'île était la capitale d'un joueur au début de la partie. */
  startingCapital: boolean;
  buildings: Building[];
  /**
   * Vue d'un joueur (brouillard) : île vue de loin, dont les soldats et les bâtiments
   * sont inconnus (soldiers vaut 0 et buildings est vide).
   */
  hidden?: boolean;
  /**
   * Vue d'un joueur : île vue de très loin, dont seul le propriétaire est connu
   * (pas de symboles ni de statut de capitale ; `hidden` est aussi vrai).
   */
  remote?: boolean;
}

export interface Player {
  id: PlayerId;
  name: string;
  resources: Resources;
  eliminated: boolean;
  /** Tour pendant lequel le joueur s'est rendu (absent s'il ne s'est pas rendu). */
  surrenderedTurn?: number;
  /** Nombre d'îles rendues lors de la reddition. */
  surrenderedIslands?: number;
}

export interface GameState {
  /** Numéro du tour en cours de saisie (commence à 1). */
  turn: number;
  maxTurns: number;
  players: Record<PlayerId, Player>;
  islands: Record<IslandId, Island>;
  winner: PlayerId | null;
  finished: boolean;
  /** Présent dans la vue d'un joueur (brouillard) : le joueur à qui cette vue est destinée. */
  viewer?: PlayerId;
  /** Îles espionnées pendant la dernière nuit, par joueur : visibles en entier jusqu'à la nuit suivante. */
  spied?: Record<PlayerId, IslandId[]>;
}

export interface RecruitOrder {
  islandId: IslandId;
  soldiers: number;
}

export interface BuildOrder {
  islandId: IslandId;
  building: BuildingType;
}

export interface MoveOrder {
  from: IslandId;
  to: IslandId;
  soldiers: number;
}

export interface AttackOrder {
  from: IslandId;
  to: IslandId;
  soldiers: number;
  /** Mercenaires recrutés pour cette attaque (payés immédiatement, disparaissent après). */
  mercenaries: number;
  /** Bâtiment à détruire si l'île d'un adversaire est conquise. */
  destroyBuilding?: BuildingType;
}

export interface PlayerOrders {
  recruits?: RecruitOrder[];
  builds?: BuildOrder[];
  moves?: MoveOrder[];
  attacks?: AttackOrder[];
  /** Île à espionner cette nuit (une par tour) : sa défense et ses bâtiments seront connus au matin. */
  spy?: IslandId;
}

export type TurnEvent =
  | { kind: 'order_rejected'; player: PlayerId; reason: string }
  | { kind: 'recruited'; player: PlayerId; islandId: IslandId; soldiers: number }
  | { kind: 'built'; player: PlayerId; islandId: IslandId; building: BuildingType }
  | { kind: 'moved'; player: PlayerId; from: IslandId; to: IslandId; soldiers: number }
  | {
      kind: 'battle';
      islandId: IslandId;
      defender: PlayerId | null;
      defense: number;
      attackers: { player: PlayerId; force: number; losses: number; survivors: number }[];
      combinedForce: number;
      conquered: boolean;
      newOwner: PlayerId | null;
      defenderLosses: number;
      destroyedBuilding: BuildingType | null;
    }
  | { kind: 'income'; player: PlayerId; gold: number; wood: number }
  | {
      kind: 'spied';
      player: PlayerId;
      islandId: IslandId;
      owner: PlayerId | null;
      soldiers: number;
      defense: number;
      buildings: BuildingType[];
    }
  | { kind: 'barracks'; islandId: IslandId; player: PlayerId; soldiers: number }
  | { kind: 'eliminated'; player: PlayerId }
  | { kind: 'surrendered'; player: PlayerId; islands: number }
  | { kind: 'game_over'; winner: PlayerId | null };

export interface TurnResult {
  state: GameState;
  events: TurnEvent[];
}
