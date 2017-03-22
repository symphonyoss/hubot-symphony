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

import EventEmitter from 'events';
import nock from 'nock';
import uuid from 'uuid';
import Log from 'log';
import type {EchoType, SymphonyMessageType} from '../src/symphony';

const logger: Log = new Log(process.env.HUBOT_SYMPHONY_LOG_LEVEL || process.env.HUBOT_LOG_LEVEL || 'info');

type ConstructorArgsType = {
  host: string,
  kmHost?: string,
  agentHost?: string,
  sessionAuthHost?: string,
  startWithHelloWorldMessage?: boolean
};

type SymphonyCreateMessagePayloadType = {
  message: string,
  format: string
}

class NockServer extends EventEmitter {
  messages: Array<SymphonyMessageType>;
  host: string;
  streamId: string;
  firstMessageTimestamp: string;
  datafeedId: string;
  realUserId: number;
  realUserName: string;
  realUserEmail: string;
  botUserId: number;
  _datafeedCreateHttp400Count: number;
  _datafeedReadHttp400Count: number;

  constructor (args: ConstructorArgsType) {
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

    let realUserObject = {
      id: self.realUserId,
      emailAddress: self.realUserEmail,
      firstName: 'John',
      lastName: 'Doe',
      username: self.realUserName,
      displayName: 'John Doe'
    };

    this.botUserId = 7696581411197;
    let botUserName = 'mozart';
    let botUserEmail = 'mozart@symphony.com';

    let botUserObject = {
      id: self.realUserId,
      emailAddress: botUserEmail,
      firstName: 'Wolfgang Amadeus',
      lastName: 'Mozart',
      username: botUserName,
      displayName: 'Mozart'
    };

    this.datafeedId = '1234';

    if (args.startWithHelloWorldMessage || args.startWithHelloWorldMessage === undefined) {
      this.messages.push({
        id: '-sfAvIPTTmyrpORkBuvL_3___qulZoKedA',
        timestamp: self.firstMessageTimestamp,
        v2messageType: 'V2Message',
        streamId: self.streamId,
        message: '<messageML>Hello World</messageML>',
        fromUserId: self.realUserId
      });
    }

    nock.disableNetConnect();

    let checkHeaderMissing = function (val: string): boolean {
      return val === undefined || val === null;
    };

    let defaultScope = nock(this.host)
      .matchHeader('sessionToken', checkHeaderMissing)
      .matchHeader('keyManagerToken', checkHeaderMissing)
      .post('/agent/v1/util/echo')
      .reply(401, {
        code: 401,
        message: 'Invalid session'
      });
    let authScope = nock(sessionAuthHost)
      .matchHeader('sessionToken', checkHeaderMissing)
      .matchHeader('keyManagerToken', checkHeaderMissing)
      .post('/sessionauth/v1/authenticate')
      .reply(200, {
        name: 'sessionToken',
        token: 'SESSION_TOKEN'
      });
    let keyAuthScope = nock(kmHost)
      .matchHeader('sessionToken', checkHeaderMissing)
      .matchHeader('keyManagerToken', checkHeaderMissing)
      .post('/keyauth/v1/authenticate')
      .reply(200, {
        name: 'keyManagerToken',
        token: 'KEY_MANAGER_TOKEN'
      });

    let podScope = nock(this.host)
      .persist()
      .matchHeader('sessionToken', 'SESSION_TOKEN')
      .matchHeader('keyManagerToken', checkHeaderMissing)
      .get('/pod/v1/sessioninfo')
      .reply(200, {
        userId: self.botUserId
      })
      .get(`/pod/v2/user?uid=${self.realUserId}&local=true`)
      .reply(200, realUserObject)
      .get(`/pod/v2/user?email=${self.realUserEmail}&local=true`)
      .reply(200, realUserObject)
      .get(`/pod/v2/user?username=${self.realUserName}&local=true`)
      .reply(200, realUserObject)
      .get(`/pod/v2/user?uid=${self.botUserId}&local=true`)
      .reply(200, botUserObject)
      .get(`/pod/v2/user?email=${botUserEmail}&local=true`)
      .reply(200, botUserObject)
      .get(`/pod/v2/user?username=${botUserName}&local=true`)
      .reply(200, botUserObject)
      .post('/pod/v1/im/create', [self.realUserId])
      .reply(200, {
        id: self.streamId
      });

    let agentScope = nock(agentHost)
      .persist()
      .matchHeader('sessionToken', 'SESSION_TOKEN')
      .matchHeader('keyManagerToken', 'KEY_MANAGER_TOKEN')
      .post('/agent/v1/util/echo')
      .reply(200, function (uri: string, requestBody: EchoType): EchoType {
        return requestBody;
      })
      .post(`/agent/v2/stream/${self.streamId}/message/create`)
      .reply(200, function (uri: string, requestBody: SymphonyCreateMessagePayloadType): SymphonyMessageType {
        let message = {
          id: uuid.v1(),
          timestamp: new Date().valueOf().toString(),
          v2messageType: 'V2Message',
          streamId: self.streamId,
          message: requestBody.message,
          attachments: [],
          fromUserId: self.botUserId
        };
        self._receiveMessage(message);
        return message;
      })
      .get(`/agent/v2/stream/${self.streamId}/message`)
      .reply(200, function (uri: string, requestBody: mixed) {
        return self.messages;
      })
      .post('/agent/v1/datafeed/create')
      .reply(function (uri: string, requestBody: mixed) {
        if (self._datafeedCreateHttp400Count-- > 0) {
          return [400, null];
        }
        return [200, {id: self.datafeedId}];
      })
      .get(`/agent/v2/datafeed/${self.datafeedId}/read`)
      .reply(function (uri: string, requestBody: mixed) {
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

  set datafeedCreateHttp400Count (count: number) {
    this._datafeedCreateHttp400Count = count;
  }

  set datafeedReadHttp400Count (count: number) {
    this._datafeedReadHttp400Count = count;
  }

  close () {
    logger.info(`Cleaning up nock for ${this.host}`);
    nock.cleanAll();
  }

  _receiveMessage (msg: SymphonyMessageType) {
    logger.debug(`Received ${JSON.stringify(msg)}`);
    this.messages.push(msg);
    super.emit('received');
  }
}

module.exports = NockServer;
