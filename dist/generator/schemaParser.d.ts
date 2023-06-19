import { OpenAPIV3 } from 'openapi-types';
import { Schema, SchemaMapping } from './types';
export declare const accessSchema: (obj: Schema | undefined, schemas: SchemaMapping) => OpenAPIV3.SchemaObject | undefined;
export declare const accessProperty: (obj: Schema | undefined, key: string, schemas: SchemaMapping) => Schema | undefined;
export declare const getTextPropertyByPath: <O extends {
    required: boolean;
}>(obj: Schema, path: string, schemas: SchemaMapping, options?: O | undefined) => O extends {
    required: true;
} ? string : string | undefined;
export declare const getTextListPropertyByPath: (obj: Schema, path: string, schemas: SchemaMapping, options?: {
    required: boolean;
}) => string[];
export declare const getObjectPropertyByPath: <O extends {
    required: boolean;
}>(obj: Schema, path: string, schemas: SchemaMapping, options?: O | undefined) => {
    properties: {
        [name: string]: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
    };
    type?: OpenAPIV3.NonArraySchemaObjectType | undefined;
    title?: string | undefined;
    description?: string | undefined;
    format?: string | undefined;
    default?: any;
    multipleOf?: number | undefined;
    maximum?: number | undefined;
    exclusiveMaximum?: boolean | undefined;
    minimum?: number | undefined;
    exclusiveMinimum?: boolean | undefined;
    maxLength?: number | undefined;
    minLength?: number | undefined;
    pattern?: string | undefined;
    additionalProperties?: boolean | OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined;
    maxItems?: number | undefined;
    minItems?: number | undefined;
    uniqueItems?: boolean | undefined;
    maxProperties?: number | undefined;
    minProperties?: number | undefined;
    required?: string[] | undefined;
    enum?: any[] | undefined;
    allOf?: (OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject)[] | undefined;
    oneOf?: (OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject)[] | undefined;
    anyOf?: (OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject)[] | undefined;
    not?: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined;
    nullable?: boolean | undefined;
    discriminator?: OpenAPIV3.DiscriminatorObject | undefined;
    readOnly?: boolean | undefined;
    writeOnly?: boolean | undefined;
    xml?: OpenAPIV3.XMLObject | undefined;
    externalDocs?: OpenAPIV3.ExternalDocumentationObject | undefined;
    example?: any;
    deprecated?: boolean | undefined;
} | undefined;
