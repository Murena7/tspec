import debug from 'debug';
import { OpenAPIV3 } from 'openapi-types';
import { Tspec } from '../types/tspec';
export declare const DEBUG: debug.Debugger;
export declare const generateTspec: (params?: Tspec.GenerateParams) => Promise<OpenAPIV3.Document>;
