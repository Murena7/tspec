import express from 'express';
import { Tspec } from '../types';
export declare const initTspecServer: (options?: Tspec.InitTspecServerOptions) => Promise<void>;
export declare const TspecDocsMiddleware: (generateOptions?: Tspec.GenerateParams) => Promise<express.RequestHandler[]>;
