/* tslint:disable */
/* eslint-disable */
/**
 * VOICEVOX Engine
 * VOICEVOXの音声合成エンジンです。
 *
 * The version of the OpenAPI document: 0.14.0-preview.11
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

/**
 * 
    fastapiでword_type引数を検証する時に使用するクラス
    
 * @export
 * @enum {string}
 */
export enum WordTypes {
    ProperNoun = 'PROPER_NOUN',
    CommonNoun = 'COMMON_NOUN',
    Verb = 'VERB',
    Adjective = 'ADJECTIVE',
    Suffix = 'SUFFIX'
}

export function WordTypesFromJSON(json: any): WordTypes {
    return WordTypesFromJSONTyped(json, false);
}

export function WordTypesFromJSONTyped(json: any, ignoreDiscriminator: boolean): WordTypes {
    return json as WordTypes;
}

export function WordTypesToJSON(value?: WordTypes | null): any {
    return value as any;
}

