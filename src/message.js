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

//@flow

import {TextMessage} from 'hubot';

type SymphonyMessage = {
    id: string,
    timestamp: number,
    v2messageType: string,
    streamId: string,
    message: string,
    fromUserId: number
}

class V2Message extends TextMessage {
    symphonyMessage: SymphonyMessage;
    room: string;

    constructor(user: Object, symphonyMessage: SymphonyMessage) {
        super(user, V2Message._getMessageText(symphonyMessage), symphonyMessage.id);
        this.symphonyMessage = symphonyMessage;
        this.room = symphonyMessage.streamId
    }

    static _getMessageText(symphonyMessage: SymphonyMessage): string {
        let match =  /<messageML>(.*)<\/messageML>/i.exec(symphonyMessage.message);
        if (match === undefined || match === null) {
            return symphonyMessage.message;
        }
        return match[1];
    }
}

module.exports = V2Message;