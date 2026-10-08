import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LocalFile } from '../services/files';

/** Files can arrive with a screen: shared from another app, or handed over by NW. */
type WithFiles = { files?: LocalFile[] };

/** The bottom bar's tabs (Ask NW is a button that opens the Nw screen). */
export type TabParamList = {
  Scan: undefined;
  /** "Convert": every tool. */
  Home: undefined;
  History: undefined;
};

export type RootStackParamList = {
  Welcome: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  Convert: (WithFiles & { toolId?: string; target?: string }) | undefined;
  Resize: WithFiles | undefined;
  Enhance: WithFiles | undefined;
  PdfTools: (WithFiles & { tool?: string }) | undefined;
  /** `errorCode`: open NW explaining that error. */
  Nw: (WithFiles & { errorCode?: string; prompt?: string }) | undefined;
  Result: { entryId: string };
  Settings: undefined;
  /** Pages from the scanner (or picked photos), and the scanner's own PDF. */
  ScanResult: { pages: LocalFile[]; pdf?: LocalFile | null };
  /** Pictures or PDFs to read text from. */
  ReadText: WithFiles | undefined;
  DeveloperMode: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type TabProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
