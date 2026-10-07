import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LocalFile } from '../services/files';

/** Files can arrive with a screen: shared from another app, or handed over by NW. */
type WithFiles = { files?: LocalFile[] };

export type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  Convert: (WithFiles & { toolId?: string; target?: string }) | undefined;
  Resize: WithFiles | undefined;
  Enhance: WithFiles | undefined;
  PdfTools: (WithFiles & { tool?: string }) | undefined;
  /** `errorCode`: open NW explaining that error. */
  Nw: (WithFiles & { errorCode?: string; prompt?: string }) | undefined;
  Result: { entryId: string };
  History: undefined;
  Settings: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
