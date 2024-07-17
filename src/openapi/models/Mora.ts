/* eslint-disable */
/**
 * VOICEVOX Engine
 * VOICEVOX の音声合成エンジンです。
 *
 * The version of the OpenAPI document: latest
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import { exists, mapValues } from '../runtime';
/**
 * モーラ（子音＋母音）ごとの情報
 * @export
 * @interface Mora
 */
export interface Mora {
    /**
     * 
     * @type {string}
     * @memberof Mora
     */
    text: string;
    /**
     * 
     * @type {string}
     * @memberof Mora
     */
    consonant?: string;
    /**
     * 
     * @type {number}
     * @memberof Mora
     */
    consonantLength?: number;
    /**
     * 
     * @type {string}
     * @memberof Mora
     */
    vowel: string;
    /**
     * 
     * @type {number}
     * @memberof Mora
     */
    vowelLength: number;
    /**
     * 
     * @type {number}
     * @memberof Mora
     */
    pitch: number;
}

/**
 * Check if a given object implements the Mora interface.
 */
export function instanceOfMora(value: object): boolean {
    let isInstance = true;
    isInstance = isInstance && "text" in value;
    isInstance = isInstance && "vowel" in value;
    isInstance = isInstance && "vowelLength" in value;
    isInstance = isInstance && "pitch" in value;

    return isInstance;
}

export function MoraFromJSON(json: any): Mora {
    return MoraFromJSONTyped(json, false);
}

export function MoraFromJSONTyped(json: any, ignoreDiscriminator: boolean): Mora {
    if ((json === undefined) || (json === null)) {
        return json;
    }
    return {
        
        'text': json['text'],
        'consonant': !exists(json, 'consonant') ? undefined : json['consonant'],
        'consonantLength': !exists(json, 'consonant_length') ? undefined : json['consonant_length'],
        'vowel': json['vowel'],
        'vowelLength': json['vowel_length'],
        'pitch': json['pitch'],
    };
}

export function MoraToJSON(value?: Mora | null): any {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    return {
        
        'text': value.text,
        'consonant': value.consonant,
        'consonant_length': value.consonantLength,
        'vowel': value.vowel,
        'vowel_length': value.vowelLength,
        'pitch': value.pitch,
    };
}

