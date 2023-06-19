import * as TJS from 'typescript-json-schema';
import { SchemaMapping } from './types';
export declare const convertToOpenapiSchemas: (jsonSchemas: TJS.Definition) => Promise<SchemaMapping>;
