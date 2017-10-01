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
/* eslint-disable require-jsdoc */

import EventEmitter from 'events';
import querystring from 'querystring';
import nock from 'nock';
import uuid from 'uuid';
import Log from 'log';
import type {EchoType, SymphonyMessageV2Type, SymphonyMessageV4Type, RoomInfoType, RoomInfoAlternateType} from '../src/symphony';

const logger: Log = new Log(process.env.HUBOT_SYMPHONY_LOG_LEVEL || process.env.HUBOT_LOG_LEVEL || 'info');

type ConstructorArgsType = {
  host: string,
  kmHost?: string,
  agentHost?: string,
  sessionAuthHost?: string,
  startWithHelloWorldMessage?: boolean
};

type SymphonyCreateMessageV2PayloadType = {
  message: string,
  format: string
};

type SymphonyCreateMessageV4PayloadType = {
  message: string,
  data?: string
};

type KeyValuePairType = {
  key: string,
  value: string
};

type SymphonyCreateRoomPayloadType = {
  name: string,
  description: string,
  keywords: Array<KeyValuePairType>,
  membersCanInvite: boolean,
  discoverable: boolean,
  public: boolean,
  readOnly: boolean,
  copyProtected: boolean
};

type SymphonyUpdateRoomPayloadType = {
  name: string,
  description: string,
  keywords: Array<KeyValuePairType>,
  membersCanInvite: boolean,
  discoverable: boolean,
  copyProtected: boolean
};

class NockServer extends EventEmitter {
  messages: Array<SymphonyMessageV2Type>;
  host: string;
  streamId: string;
  firstMessageTimestamp: string;
  datafeedId: string;
  realUserId: number;
  realUserName: string;
  realUserEmail: string;
  realUserDisplayName: string;
  botUserId: number;
  botUserName: string;
  botUserEmail: string;
  botUserDisplayName: string;
  _datafeedCreateHttp400Count: number;
  _datafeedReadHttp400Count: number;

  constructor(args: ConstructorArgsType) {
    super();

    this.messages = [];
    this.host = args.host;
    this._datafeedCreateHttp400Count = 0;
    this._datafeedReadHttp400Count = 0;

    let kmHost = args.kmHost || args.host;
    let agentHost = args.agentHost || args.host;
    let sessionAuthHost = args.sessionAuthHost || agentHost;
    logger.info(`Setting up mocks for ${this.host} / ${kmHost} / ${agentHost} / ${sessionAuthHost}`);

    let self = this;

    this.streamId = 'WLwnGbzxIdU8ZmPUjAs_bn___qulefJUdA';

    this.firstMessageTimestamp = '1461808889185';

    this.realUserId = 7215545078229;
    this.realUserName = 'johndoe';
    this.realUserEmail = 'johndoe@symphony.com';
    this.realUserDisplayName = 'John Doe';

    let realUserObject = {
      id: self.realUserId,
      emailAddress: self.realUserEmail,
      firstName: 'John',
      lastName: 'Doe',
      username: self.realUserName,
      displayName: self.realUserDisplayName,
    };

    this.botUserId = 7696581411197;
    this.botUserName = 'mozart';
    this.botUserEmail = 'mozart@symphony.com';
    this.botUserDisplayName = 'Mozart';

    let botUserObject = {
      id: self.realUserId,
      emailAddress: self.botUserEmail,
      firstName: 'Wolfgang Amadeus',
      lastName: 'Mozart',
      username: self.botUserName,
      displayName: self.botUserDisplayName,
    };

    this.datafeedId = '1234';

    if (args.startWithHelloWorldMessage || args.startWithHelloWorldMessage === undefined) {
      this.messages.push({
        id: '-sfAvIPTTmyrpORkBuvL_3___qulZoKedA',
        timestamp: self.firstMessageTimestamp,
        v2messageType: 'V2Message',
        streamId: self.streamId,
        message: '<messageML>Hello World</messageML>',
        fromUserId: self.realUserId,
      });
    }

    nock.disableNetConnect();

    let checkHeaderMissing = function(val: string): boolean {
      return val === undefined || val === null;
    };

    /* eslint-disable no-unused-vars */
    const defaultScope = nock(this.host)
    /* eslint-enable no-unused-vars */
      .matchHeader('sessionToken', checkHeaderMissing)
      .matchHeader('keyManagerToken', checkHeaderMissing)
      .post('/agent/v1/util/echo')
      .reply(401, {
        code: 401,
        message: 'Invalid session',
      });

    /* eslint-disable no-unused-vars */
    const authScope = nock(sessionAuthHost)
    /* eslint-enable no-unused-vars */
      .matchHeader('sessionToken', checkHeaderMissing)
      .matchHeader('keyManagerToken', checkHeaderMissing)
      .post('/sessionauth/v1/authenticate')
      .reply(200, {
        name: 'sessionToken',
        token: 'SESSION_TOKEN',
      });

    /* eslint-disable no-unused-vars */
    const keyAuthScope = nock(kmHost)
    /* eslint-enable no-unused-vars */
      .matchHeader('sessionToken', checkHeaderMissing)
      .matchHeader('keyManagerToken', checkHeaderMissing)
      .post('/keyauth/v1/authenticate')
      .reply(200, {
        name: 'keyManagerToken',
        token: 'KEY_MANAGER_TOKEN',
      });

    /* eslint-disable no-unused-vars */
    const podScope = nock(this.host)
    /* eslint-enable no-unused-vars */
      .persist()
      .matchHeader('sessionToken', 'SESSION_TOKEN')
      .matchHeader('keyManagerToken', checkHeaderMissing)
      .get('/pod/v1/sessioninfo')
      .reply(200, {
        userId: self.botUserId,
      })
      .get(`/pod/v2/user?uid=${self.realUserId}&local=true`)
      .reply(200, realUserObject)
      .get(`/pod/v2/user?email=${self.realUserEmail}&local=true`)
      .reply(200, realUserObject)
      .get(`/pod/v2/user?username=${self.realUserName}&local=true`)
      .reply(200, realUserObject)
      .get(`/pod/v2/user?uid=${self.botUserId}&local=true`)
      .reply(200, botUserObject)
      .get(`/pod/v2/user?email=${self.botUserEmail}&local=true`)
      .reply(200, botUserObject)
      .get(`/pod/v2/user?username=${self.botUserName}&local=true`)
      .reply(200, botUserObject)
      .post('/pod/v1/im/create', [self.realUserId])
      .reply(200, {
        id: self.streamId,
      })
      .post('/pod/v2/room/create')
      .reply(200, function(uri: string, requestBody: SymphonyCreateRoomPayloadType): RoomInfoType {
        return {
          roomAttributes: requestBody,
          roomSystemInfo: {
            id: self.streamId,
            creationDate: 1464448273802,
            createdByUserId: self.botUserId,
            active: true,
          },
        };
      })
      .get(`/pod/v2/room/${self.streamId}/info`)
      .reply(200, {
        roomAttributes: {
          name: 'foo',
          description: 'bar',
          keywords: [{key: 'x', value: 'y'}],
          membersCanInvite: false,
          discoverable: false,
          readOnly: false,
          copyProtected: false,
          public: false,
        },
        roomSystemInfo: {
          id: self.streamId,
          creationDate: 1464448273802,
          createdByUserId: self.botUserId,
          active: true,
        },
      })
      .post(`/pod/v1/room/${self.streamId}/setActive`)
      .query(function(query): boolean {
        return query.hasOwnProperty('active');
      })
      .reply(200, function(uri: string, requestBody: mixed): RoomInfoAlternateType {
        const query = querystring.parse(uri.substring(uri.indexOf('?') + 1));
        return {
          roomAttributes: {
            name: 'foo',
            description: 'bar',
            keywords: [{key: 'x', value: 'y'}],
            membersCanInvite: false,
            discoverable: false,
          },
          roomSystemInfo: {
            id: self.streamId,
            creationDate: 1464448273802,
            createdByUserId: self.botUserId,
            active: query.active == 'true',
          },
          immutableRoomAttributes: {
            readOnly: false,
            copyProtected: false,
            public: false,
          },
        };
      })
      .post(`/pod/v2/room/${self.streamId}/update`)
      .reply(200, function(uri: string, requestBody: SymphonyUpdateRoomPayloadType): RoomInfoType {
        return {
          roomAttributes: {
            name: requestBody.name,
            description: requestBody.description,
            keywords: requestBody.keywords,
            membersCanInvite: requestBody.membersCanInvite,
            discoverable: requestBody.discoverable,
            copyProtected: requestBody.copyProtected,
            readOnly: false,
            public: false,
          },
          roomSystemInfo: {
            id: self.streamId,
            creationDate: 1464448273802,
            createdByUserId: self.botUserId,
            active: true,
          },
        };
      })
      .get(`/pod/v2/room/${self.streamId}/membership/list`)
      .reply(200, [
        {
          id: self.botUserId,
          owner: true,
          joinDate: 1461426797875,
        },
        {
          id: self.realUserId,
          owner: false,
          joinDate: 1461430710531,
        },
      ])
      .post(`/pod/v1/room/${self.streamId}/membership/add`)
      .reply(200, {
        format: 'TEXT',
        message: 'Member added',
      })
      .post(`/pod/v1/room/${self.streamId}/membership/remove`)
      .reply(200, {
        format: 'TEXT',
        message: 'Member removed',
      })
      .post(`/pod/v1/room/${self.streamId}/membership/promoteOwner`)
      .reply(200, {
        format: 'TEXT',
        message: 'Member promoted to owner',
      })
      .post(`/pod/v1/room/${self.streamId}/membership/demoteOwner`)
      .reply(200, {
        format: 'TEXT',
        message: 'Member demoted to participant',
      });

    /* eslint-disable no-unused-vars */
    const agentScope = nock(agentHost)
    /* eslint-enable no-unused-vars */
      .persist()
      .matchHeader('sessionToken', 'SESSION_TOKEN')
      .matchHeader('keyManagerToken', 'KEY_MANAGER_TOKEN')
      .post('/agent/v1/util/echo')
      .reply(200, function(uri: string, requestBody: EchoType): EchoType {
        return requestBody;
      })
      .post(`/agent/v2/stream/${self.streamId}/message/create`)
      .reply(200, function(uri: string, requestBody: SymphonyCreateMessageV2PayloadType): SymphonyMessageV2Type {
        const message = {
          id: uuid.v1(),
          timestamp: new Date().valueOf().toString(),
          v2messageType: 'V2Message',
          streamId: self.streamId,
          message: requestBody.message,
          attachments: [],
          fromUserId: self.botUserId,
        };
        self._receiveMessage(message);
        return message;
      })
      .post(`/agent/v4/stream/${self.streamId}/message/create`)
      .reply(200, function(uri: string, requestBody: SymphonyCreateMessageV4PayloadType): SymphonyMessageV4Type {
        let messageML = requestBody.message;
        const match = /<messageML>(.*)<\/messageML>/i.exec(messageML);
        if (match === undefined || match === null) {
          messageML = `<messageML>${messageML}<\/messageML>`;
        }
        const message = {
          messageId: uuid.v1(),
          timestamp: new Date().valueOf().toString(),
          message: messageML,
          attachments: [],
          user: {
            userId: self.botUserId,
            displayName: self.botUserDisplayName,
            email: self.botUserEmail,
            username: self.botUserName,
          },
          stream: {
            streamId: self.streamId,
          }
        };
        self._receiveMessage({
          id: message.messageId,
          timestamp: message.timestamp,
          v2messageType: 'V2Message',
          streamId: message.stream.streamId,
          message: message.message,
          attachments: message.attachments,
          fromUserId: message.user.userId,
        });
        return message;
      })
      .get(`/agent/v2/stream/${self.streamId}/message`)
      .reply(200, function(uri: string, requestBody: mixed) {
        return self.messages;
      })
      .post('/agent/v1/datafeed/create')
      .reply(function(uri: string, requestBody: mixed) {
        if (self._datafeedCreateHttp400Count-- > 0) {
          return [400, null];
        }
        return [200, {id: self.datafeedId}];
      })
      .get(`/agent/v2/datafeed/${self.datafeedId}/read`)
      .reply(function(uri: string, requestBody: mixed) {
        if (self._datafeedReadHttp400Count-- > 0) {
          return [400, null];
        }
        if (self.messages.length == 0) {
          return [204, null];
        }
        let copy = self.messages;
        self.messages = [];
        return [200, copy];
      });
  }

  set datafeedCreateHttp400Count(count: number) {
    this._datafeedCreateHttp400Count = count;
  }

  set datafeedReadHttp400Count(count: number) {
    this._datafeedReadHttp400Count = count;
  }

  close() {
    logger.info(`Cleaning up nock for ${this.host}`);
    nock.cleanAll();
  }

  _receiveMessage(msg: SymphonyMessageV2Type) {
    logger.debug(`Received ${JSON.stringify(msg)}`);
    this.messages.push(msg);
    super.emit('received');
  }
}

module.exports = NockServer;
