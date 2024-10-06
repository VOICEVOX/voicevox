/* tslint:disable */
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
import type { StyleInfo } from './StyleInfo';
import {
    StyleInfoFromJSON,
    StyleInfoFromJSONTyped,
    StyleInfoToJSON,
} from './StyleInfo';

/**
 * キャラクターの追加情報
 * @export
 * @interface SpeakerInfo
 */
export interface SpeakerInfo {
    /**
     * policy.md
     * @type {string}
     * @memberof SpeakerInfo
     */
    policy: string;
    /**
     * 立ち絵画像をbase64エンコードしたもの、あるいはURL
     * @type {string}
     * @memberof SpeakerInfo
     */
    portrait: string;
    /**
     * スタイルの追加情報
     * @type {Array<StyleInfo>}
     * @memberof SpeakerInfo
     */
    styleInfos: Array<StyleInfo>;
}

/**
 * Check if a given object implements the SpeakerInfo interface.
 */
export function instanceOfSpeakerInfo(value: object): boolean {
    let isInstance = true;
    isInstance = isInstance && "policy" in value;
    isInstance = isInstance && "portrait" in value;
    isInstance = isInstance && "styleInfos" in value;

    return isInstance;
}

export function SpeakerInfoFromJSON(json: any): SpeakerInfo {
    return SpeakerInfoFromJSONTyped(json, false);
}

export function SpeakerInfoFromJSONTyped(json: any, ignoreDiscriminator: boolean): SpeakerInfo {
    if ((json === undefined) || (json === null)) {
        return json;
    }
    return {
        
        'policy': json['policy'],
        'portrait': json['portrait'],
        'styleInfos': ((json['style_infos'] as Array<any>).map(StyleInfoFromJSON)),
    };
}

export function SpeakerInfoToJSON(value?: SpeakerInfo | null): any {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    return {
        
        'policy': value.policy,
        'portrait': value.portrait,
        'style_infos': ((value.styleInfos as Array<any>).map(StyleInfoToJSON)),
    };
}

