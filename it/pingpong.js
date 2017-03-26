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

const assert = require('chai').assert;
import {describe, it} from 'mocha';
import Log from 'log';
import Symphony from '../src/symphony';

const logger: Log = new Log(process.env.HUBOT_SYMPHONY_LOG_LEVEL || process.env.HUBOT_LOG_LEVEL || 'info');

describe('Foundation Open Developer Platform integration tests', () => {
  const getEnv = function(key: string): string {
    const value = process.env[key];
    if (value) {
      return value;
    }
    throw new Error(`${key} undefined`);
  };

  it('should send a message from user account and receive it on bot account', () => {
    // create two separate connections so we can send a message from one account to another
    const botConnection = new Symphony({
      host: getEnv('SYMPHONY_HOST'),
      privateKey: getEnv('BOT_USER_KEY'),
      publicKey: getEnv('BOT_USER_CERT'),
      passphrase: getEnv('BOT_USER_PASSWORD'),
      keyManagerHost: getEnv('SYMPHONY_KM_HOST'),
      agentHost: getEnv('SYMPHONY_AGENT_HOST'),
      sessionAuthHost: getEnv('SYMPHONY_SESSIONAUTH_HOST'),
    });
    const userConnection = new Symphony({
      host: getEnv('SYMPHONY_HOST'),
      privateKey: getEnv('SENDER_USER_KEY'),
      publicKey: getEnv('SENDER_USER_CERT'),
      passphrase: getEnv('SENDER_USER_PASSWORD'),
      keyManagerHost: getEnv('SYMPHONY_KM_HOST'),
      agentHost: getEnv('SYMPHONY_AGENT_HOST'),
      sessionAuthHost: getEnv('SYMPHONY_SESSIONAUTH_HOST'),
    });

    logger.info('Connections initiated, starting tests...');

    // print bot & user account diagnostics, send message from user -> bot and verify receipt
    userConnection.whoAmI()
      .then((response) => {
        return userConnection.getUser({userId: response.userId});
      })
      .then((response) => {
        return botConnection.whoAmI();
      })
      .then((response) => {
        return botConnection.getUser({userId: response.userId});
      })
      .then((response) => {
        const botUserId = response.id;
        return botConnection.createDatafeed()
          .then((response) => {
            const datafeedId = response.id;
            logger.info(`Created datafeed: ${datafeedId}`);
            // get conversation between user & bot
            return userConnection.createIM(botUserId)
              .then((response) => {
                const conversationId = response.id;
                logger.info(`Created conversation: ${conversationId}`);
                // send ping from user to bot
                return userConnection.sendMessage(conversationId, 'ping', 'TEXT');
              })
              .then((response) => {
                return botConnection.readDatafeed(datafeedId);
              });
          });
      })
      .then((response) => {
        assert.include(response.map((m) => m.message), '<messageML>ping</messageML>');
      });
  });
});
