import debug from 'debug';
import { OpenAPIV3 } from 'openapi-types';
import { SchemaMapping } from './types';
export declare const DEBUG: debug.Debugger;
export declare const getOpenapiPaths: (openapiSchemas: SchemaMapping, tspecSymbols: string[]) => OpenAPIV3.PathsObject;
