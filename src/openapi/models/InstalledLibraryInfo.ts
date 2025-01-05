/* tslint:disable */
/* eslint-disable */
/**
 * DUMMY Engine
 * DUMMY の音声合成エンジンです。
 *
 * The version of the OpenAPI document: latest
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import { exists, mapValues } from '../runtime';
import type { LibrarySpeaker } from './LibrarySpeaker';
import {
    LibrarySpeakerFromJSON,
    LibrarySpeakerFromJSONTyped,
    LibrarySpeakerToJSON,
} from './LibrarySpeaker';

/**
 * インストール済み音声ライブラリの情報
 * @export
 * @interface InstalledLibraryInfo
 */
export interface InstalledLibraryInfo {
    /**
     * 音声ライブラリの名前
     * @type {string}
     * @memberof InstalledLibraryInfo
     */
    name: string;
    /**
     * 音声ライブラリのUUID
     * @type {string}
     * @memberof InstalledLibraryInfo
     */
    uuid: string;
    /**
     * 音声ライブラリのバージョン
     * @type {string}
     * @memberof InstalledLibraryInfo
     */
    version: string;
    /**
     * 音声ライブラリのダウンロードURL
     * @type {string}
     * @memberof InstalledLibraryInfo
     */
    downloadUrl: string;
    /**
     * 音声ライブラリのバイト数
     * @type {number}
     * @memberof InstalledLibraryInfo
     */
    bytes: number;
    /**
     * 音声ライブラリに含まれるキャラクターのリスト
     * @type {Array<LibrarySpeaker>}
     * @memberof InstalledLibraryInfo
     */
    speakers: Array<LibrarySpeaker>;
    /**
     * アンインストール可能かどうか
     * @type {boolean}
     * @memberof InstalledLibraryInfo
     */
    uninstallable: boolean;
}

/**
 * Check if a given object implements the InstalledLibraryInfo interface.
 */
export function instanceOfInstalledLibraryInfo(value: object): boolean {
    let isInstance = true;
    isInstance = isInstance && "name" in value;
    isInstance = isInstance && "uuid" in value;
    isInstance = isInstance && "version" in value;
    isInstance = isInstance && "downloadUrl" in value;
    isInstance = isInstance && "bytes" in value;
    isInstance = isInstance && "speakers" in value;
    isInstance = isInstance && "uninstallable" in value;

    return isInstance;
}

export function InstalledLibraryInfoFromJSON(json: any): InstalledLibraryInfo {
    return InstalledLibraryInfoFromJSONTyped(json, false);
}

export function InstalledLibraryInfoFromJSONTyped(json: any, ignoreDiscriminator: boolean): InstalledLibraryInfo {
    if ((json === undefined) || (json === null)) {
        return json;
    }
    return {
        
        'name': json['name'],
        'uuid': json['uuid'],
        'version': json['version'],
        'downloadUrl': json['download_url'],
        'bytes': json['bytes'],
        'speakers': ((json['speakers'] as Array<any>).map(LibrarySpeakerFromJSON)),
        'uninstallable': json['uninstallable'],
    };
}

export function InstalledLibraryInfoToJSON(value?: InstalledLibraryInfo | null): any {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    return {
        
        'name': value.name,
        'uuid': value.uuid,
        'version': value.version,
        'download_url': value.downloadUrl,
        'bytes': value.bytes,
        'speakers': ((value.speakers as Array<any>).map(LibrarySpeakerToJSON)),
        'uninstallable': value.uninstallable,
    };
}

