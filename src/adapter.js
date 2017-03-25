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

import {Adapter, Robot} from 'hubot';
import memoize from 'memoizee';
import backoff from 'backoff';
import Backoff from 'backoff/lib/backoff';
import type {GetUserArgsType, SymphonyMessageType} from './symphony';
import Symphony from './symphony';
import {V2Message} from './message';

const Entities = require('html-entities').XmlEntities;
const entities = new Entities();

type MessageType = {
    text: string,
    format: string
};

type MessageTypeOrString = MessageType | string;

class SymphonyAdapter extends Adapter {
  robot: Robot;
  symphony: Symphony;
  expBackoff: Backoff;
  _userLookup: (GetUserArgsType, ?string) => Promise<Object>;

  constructor (robot: Robot, options: Object = {}) {
    super(robot);
    this.robot = robot;

    if (process.env.HUBOT_SYMPHONY_HOST === undefined || process.env.HUBOT_SYMPHONY_HOST === null) {
      throw new Error('HUBOT_SYMPHONY_HOST undefined');
    }
    if (process.env.HUBOT_SYMPHONY_PUBLIC_KEY === undefined || process.env.HUBOT_SYMPHONY_PUBLIC_KEY === null) {
      throw new Error('HUBOT_SYMPHONY_PUBLIC_KEY undefined');
    }
    if (process.env.HUBOT_SYMPHONY_PRIVATE_KEY === undefined || process.env.HUBOT_SYMPHONY_PRIVATE_KEY === null) {
      throw new Error('HUBOT_SYMPHONY_PRIVATE_KEY undefined');
    }
    if (process.env.HUBOT_SYMPHONY_PASSPHRASE === undefined || process.env.HUBOT_SYMPHONY_PASSPHRASE === null) {
      throw new Error('HUBOT_SYMPHONY_PASSPHRASE undefined');
    }

    this.expBackoff = backoff.exponential({
      initialDelay: 10,
      maxDelay: 60000
    });
    this.expBackoff.on('backoff', (num, delay) => {
      if (num > 0) {
        this.robot.logger.info(`Re-attempting to create datafeed - attempt ${num} after ${delay}ms`);
      }
    });
    this.expBackoff.on('ready', () => {
      this.symphony.createDatafeed()
        .then((response) => {
          if (response.id) {
            this.robot.logger.info(`Created datafeed: ${response.id}`);
            this.removeAllListeners('poll');
            this.on('poll', this._pollDatafeed);
            this.emit('poll', response.id);
            this.robot.logger.debug('First poll event emitted');
            this.emit('connected');
            this.robot.logger.debug('connected event emitted');
            this.expBackoff.reset();
          } else {
            this.robot.emit('error', new Error(`Unable to create datafeed: ${JSON.stringify(response)}`));
            this.expBackoff.backoff();
          }
        })
        .catch((error) => {
          this.robot.emit('error', new Error(`Unable to create datafeed: ${error}`));
          this.expBackoff.backoff();
        });
    });
    this.expBackoff.on('fail', () => {
      this.robot.logger.info('Shutting down...');
      options.shutdownFunc();
    });
    // will time out reconnecting after ~10min
    const failAfter = options.failConnectAfter || 23;
    this.robot.logger.info(`Reconnect attempts = ${failAfter}`);
    this.expBackoff.failAfter(failAfter);
  }

  send (envelope: Object, ...messages: Array<MessageTypeOrString>) {
    this.robot.logger.debug(`Sending ${messages.length} messages to ${envelope.room}`);
    for (const message of messages) {
      if (typeof message === 'string') {
        this.symphony.sendMessage(envelope.room, message, 'TEXT');
      } else {
        this.symphony.sendMessage(envelope.room, message.text, message.format);
      }
    }
  }

  sendDirectMessageToUsername (username: string, ...messages: Array<MessageTypeOrString>) {
    this.robot.logger.debug(`Sending direct message to username: ${username}`);
    this._userLookup({username: username}, undefined)
      .then((response) => {
        this._sendDirectMessageToUserId(response.id, ...messages);
      });
  }

  sendDirectMessageToEmail (email: string, ...messages: Array<MessageTypeOrString>) {
    this.robot.logger.debug(`Sending direct message to email: ${email}`);
    this._userLookup({emailAddress: email}, undefined)
      .then((response) => {
        this._sendDirectMessageToUserId(response.id, ...messages);
      });
  }

  _sendDirectMessageToUserId (userId: number, ...messages: Array<MessageTypeOrString>) {
    this.symphony.createIM(userId)
      .then((response) => {
        this.send({room: response.id}, ...messages);
      });
  }

  reply (envelope: Object, ...messages: Array<string>) {
    this.robot.logger.debug(`Sending ${messages.length} reply messages to ${envelope.user.emailAddress} in ${envelope.room}`);
    for (const message of messages) {
      this.symphony.sendMessage(envelope.room, `<messageML><mention email="${envelope.user.emailAddress}"/>${entities.encode(message)}</messageML>`, 'MESSAGEML');
    }
  }

  run () {
    this.robot.logger.info('Initialising...');

    const getEnv = function(key: string, defaultVal: ?string): string {
      const value = process.env[key];
      if (value) {
        return value;
      }
      if (defaultVal) {
        return defaultVal;
      }
      throw new Error(`${key} undefined`);
    };
    const host: string = getEnv('HUBOT_SYMPHONY_HOST');
    this.symphony = new Symphony({
      host: host,
      privateKey: getEnv('HUBOT_SYMPHONY_PRIVATE_KEY'),
      publicKey: getEnv('HUBOT_SYMPHONY_PUBLIC_KEY'),
      passphrase: getEnv('HUBOT_SYMPHONY_PASSPHRASE'),
      keyManagerHost: getEnv('HUBOT_SYMPHONY_KM_HOST', host),
      sessionAuthHost: getEnv('HUBOT_SYMPHONY_SESSIONAUTH_HOST', host),
      agentHost: getEnv('HUBOT_SYMPHONY_AGENT_HOST', host)
    });
    this.symphony.whoAmI()
      .then((response) => {
        this.robot.userId = response.userId;
        this.symphony.getUser({userId: response.userId})
          .then((response) => {
            this.robot.displayName = response.displayName;
            this.robot.logger.info(`Connected as ${response.displayName}`);
          });
      })
      .catch((error) => {
        this.robot.emit('error', new Error(`Unable to resolve identity: ${error}`));
      });
    // cache user details for an hour
    const hourlyRefresh = memoize(this._getUser.bind(this), {maxAge: 3600000, length: 2});
    this._userLookup = function (query: GetUserArgsType, streamId: ?string): Promise<Object> {
      return hourlyRefresh(query, streamId);
    };
    this._createDatafeed();
  }

  close () {
    this.robot.logger.debug('Removing datafeed poller');
    this.removeListener('poll', this._pollDatafeed);
  }

  _createDatafeed () {
    this.expBackoff.backoff();
  }

  _pollDatafeed (id: string) {
    // defer execution to ensure we don't go into an infinite polling loop
    const self = this;
    process.nextTick(() => {
      self.robot.logger.debug(`Polling datafeed ${id}`);
      self.symphony.readDatafeed(id)
        .then((response) => {
          if (response) {
            self.robot.logger.debug(`Received ${response.length || 0} datafeed messages`);
            for (const msg of response) {
              if (msg.v2messageType === 'V2Message') {
                self._receiveMessage(msg);
              }
            }
          }
          this.emit('poll', id);
        })
        .catch((error) => {
          self.robot.emit('error', new Error(`Unable to read datafeed ${id}: ${error}`));
          self._createDatafeed();
        });
    });
  }

  _receiveMessage (message: SymphonyMessageType) {
    // ignore anything the bot said
    if (message.fromUserId !== this.robot.userId) {
      this._userLookup({userId: message.fromUserId}, message.streamId)
        .then((response) => {
          const v2 = new V2Message(response, message);
          this.robot.logger.debug(`Received '${v2.text}' from ${v2.user.name}`);
          this.receive(v2);
        })
        .catch((error) => {
          this.robot.emit('error', new Error(`Unable to fetch user details: ${error}`));
        });
    }
  }

  _getUser (query: GetUserArgsType, streamId: string): Promise<Object> {
    return this.symphony.getUser(query)
      .then((response) => {
        // record basic user details in hubot's brain, setting the room causes the brain to update each time we're seen in a new conversation
        const userId = response.id;
        const existing = this.robot.brain.userForId(userId);
        existing.name = response.username;
        existing.displayName = response.displayName;
        existing.emailAddress = response.emailAddress;
        if (streamId) {
          existing.room = streamId;
        }
        this.robot.brain.userForId(userId, existing);
        return existing;
      });
  }
}

exports.use = (robot: Robot, options: Object = {}) => {
  options.shutdownFunc = options.shutdownFunc || function (): void {
    process.exit(1);
  };
  return new SymphonyAdapter(robot, options);
};
