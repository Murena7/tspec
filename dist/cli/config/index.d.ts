import { Tspec } from '../../types/tspec';
export declare const isTspecFileConfigAvailable: (inputPath?: string) => Promise<boolean>;
export declare const getTspecConfigFromConfigFile: (inputPath?: string) => Promise<Tspec.GenerateParams>;
