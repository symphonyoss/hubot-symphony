/**
 *    Copyright 2017 Jon Freedman
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

// @flow

import {TextMessage} from 'hubot';
import type {SymphonyMessageType} from './symphony';

/**
 * Represents a V2Message received from Symphony for use within Hubot
 */
export class V2Message extends TextMessage {
  symphonyMessage: SymphonyMessageType;
  room: string;

  /**
   * @param user Hubot user
   * @param {SymphonyMessageType} symphonyMessage Message from Symphony
   * @constructor
   */
  constructor(user: Object, symphonyMessage: SymphonyMessageType) {
    super(user, V2Message._getMessageText(symphonyMessage), symphonyMessage.id);
    this.symphonyMessage = symphonyMessage;
    this.room = symphonyMessage.streamId;
  }

  /**
   * @param {SymphonyMessageType} symphonyMessage Message from Symphony
   * @returns {string} message text contained within messageML tag
   * @private
   */
  static _getMessageText(symphonyMessage: SymphonyMessageType): string {
    const match = /<messageML>(.*)<\/messageML>/i.exec(symphonyMessage.message);
    if (match === undefined || match === null) {
      return symphonyMessage.message;
    }
    return match[1];
  }
}
