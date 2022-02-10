/* tslint:disable */
/* eslint-disable */
/**
 * VOICEVOX ENGINE
 * VOICEVOXの音声合成エンジンです。
 *
 * The version of the OpenAPI document: 0.10.2
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import { exists, mapValues } from '../runtime';
import {
    Mora,
    MoraFromJSON,
    MoraFromJSONTyped,
    MoraToJSON,
} from './';

/**
 * アクセント句ごとの情報
 * @export
 * @interface AccentPhrase
 */
export interface AccentPhrase {
    /**
     * 
     * @type {Array<Mora>}
     * @memberof AccentPhrase
     */
    moras: Array<Mora>;
    /**
     * 
     * @type {number}
     * @memberof AccentPhrase
     */
    accent: number;
    /**
     * 
     * @type {Mora}
     * @memberof AccentPhrase
     */
    pauseMora?: Mora | null;
    /**
     * 
     * @type {boolean}
     * @memberof AccentPhrase
     */
    isInterrogative?: boolean;
}

export function AccentPhraseFromJSON(json: any): AccentPhrase {
    return AccentPhraseFromJSONTyped(json, false);
}

export function AccentPhraseFromJSONTyped(json: any, ignoreDiscriminator: boolean): AccentPhrase {
    if ((json === undefined) || (json === null)) {
        return json;
    }
    return {
        
        'moras': ((json['moras'] as Array<any>).map(MoraFromJSON)),
        'accent': json['accent'],
        'pauseMora': !exists(json, 'pause_mora') ? undefined : MoraFromJSON(json['pause_mora']),
        'isInterrogative': !exists(json, 'is_interrogative') ? undefined : json['is_interrogative'],
    };
}

export function AccentPhraseToJSON(value?: AccentPhrase | null): any {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    return {
        
        'moras': ((value.moras as Array<any>).map(MoraToJSON)),
        'accent': value.accent,
        'pause_mora': MoraToJSON(value.pauseMora),
        'is_interrogative': value.isInterrogative,
    };
}

