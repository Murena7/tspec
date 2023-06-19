export declare function isDefined<T>(val: T): val is NonNullable<T>;
export declare function assertIsDefined<T>(val: T, msg?: string): asserts val is NonNullable<T>;
/**
 * NOTE(hyeonseong): This function does exhaustiveness checking to ensure
 * that you have discriminated a union so that no type remains.
 * Use this to get the typescript compiler to help discover cases that were not considered.
 */
export declare function checkNever(x: never): void;
