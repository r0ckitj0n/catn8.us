import { IToast } from '../../../types/common';
import { IMasterCharacter, IMasterLocation, IMasterMotive, IMasterWeapon } from '../../../types/game';
import { IMasterAssetsCore, IMasterAssetsDetails } from '../../../types/mysteryHooks';

export interface MasterAssetsActionLoaders {
  loadMasterCharacters: () => Promise<IMasterCharacter[]>;
  loadMasterLocations: () => Promise<IMasterLocation[]>;
  loadMasterWeapons: () => Promise<IMasterWeapon[]>;
  loadMasterMotives: () => Promise<IMasterMotive[]>;
  loadMasterCharacterImages: (id: string | number) => Promise<void>;
}

export type MasterAssetsActionState = IMasterAssetsCore & IMasterAssetsDetails & { masterCharacterScenarioEntityId: number | null };

export interface MasterAssetsActionParams {
  caseId: string | number;
  isAdmin: boolean;
  loaders: MasterAssetsActionLoaders;
  mysteryId: string | number;
  scenarioId: string | number;
  setBusy: (busy: boolean) => void;
  setError: (err: string) => void;
  showMysteryToast: (t: IToast) => void;
  state: MasterAssetsActionState;
  watchJobToast: (params: { caseId: number; jobId: number; label: string; onDone?: (result: any) => void }) => Promise<void>;
}
