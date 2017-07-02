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

import fs from 'fs';
import request from 'request';
import querystring from 'querystring';
import memoize from 'memoizee';
import Log from 'log';

const logger: Log = new Log(process.env.HUBOT_SYMPHONY_LOG_LEVEL || process.env.HUBOT_LOG_LEVEL || 'info');

type ConstructorArgsType = {
  host: string,
  privateKey: string,
  publicKey: string,
  passphrase: string,
  keyManagerHost?: string,
  sessionAuthHost?: string,
  agentHost?: string
};

export type AuthenticateResponseType = {
  name: string,
  token: string
};

export type EchoType = {
  message: string
};

export type SymphonyUserIdType = {
  userId: number
};

export type GetUserArgsType = {
  userId?: number,
  username?: string,
  emailAddress?: string
};

export type SymphonyUserType = {
  id: number,
  emailAddress: string,
  firstName: string,
  lastName: string,
  displayName: string,
  company: string,
  username: string
};

export type SymphonyAttachmentType = {
  id: string,
  name: string,
  size: number
};

export type SymphonyMessageType = {
  id: string,
  timestamp: string,
  v2messageType: string,
  streamId: string,
  message: string,
  attachments?: Array<SymphonyAttachmentType>,
  fromUserId: number
};

export type CreateDatafeedResponseType = {
  id: string
};

export type CreateIMResponseType = {
  id: string
};

type KeyValuePairType = {
  key: string,
  value: string
};

type CreateRoomFeaturesType = {
  membersCanInvite?: boolean,
  discoverable?: boolean,
  public?: boolean,
  readOnly?: boolean,
  copyProtected?: boolean
};

export type CreateRoomType = {
  name: string,
  description: string,
  keywords: Map<string, string>,
  features?: CreateRoomFeaturesType
};

type UpdateRoomFeaturesType = {
  membersCanInvite?: boolean,
  discoverable?: boolean,
  copyProtected?: boolean
};

export type UpdateRoomType = {
  name: string,
  description: string,
  keywords: Map<string, string>,
  features?: UpdateRoomFeaturesType
};

export type RoomInfoType = {
  roomAttributes: {
    name: string,
    keywords: Array<KeyValuePairType>,
    description: string,
    membersCanInvite: boolean,
    discoverable: boolean,
    readOnly: boolean,
    copyProtected: boolean,
    public: boolean
  },
  roomSystemInfo: {
    id: string,
    creationDate: number,
    createdByUserId: number,
    active: boolean
  }
};

export type RoomInfoAlternateType = {
  roomAttributes: {
    name: string,
    keywords: Array<KeyValuePairType>,
    description: string,
    membersCanInvite: boolean,
    discoverable: boolean
  },
  roomSystemInfo: {
    id: string,
    creationDate: number,
    createdByUserId: number,
    active: boolean
  },
  immutableRoomAttributes: {
    readOnly: boolean,
    copyProtected: boolean,
    public: boolean
  }
};

export type RoomMembershipType = {
  id: number,
  owner: boolean,
  joinDate: number
};

export type RoomMemberActionType = {
  format: string,
  message: string
}

type HttpHeaderType = {
  [key: string]: string
};

type HttpResponseType = {
  statusCode: number
};

/**
 * Wrapper of Symphony REST API
 * @author Jon Freedman
 */
class Symphony {
  host: string;
  keyManagerHost: string;
  sessionAuthHost: string;
  agentHost: string;
  privateKey: string;
  publicKey: string;
  passphrase: string;
  sessionAuth: () => Promise<AuthenticateResponseType>;
  keyAuth: () => Promise<AuthenticateResponseType>;

  /**
   * @param {ConstructorArgsType} args
   * @constructor
   */
  constructor(args: ConstructorArgsType) {
    this.host = args.host;
    this.keyManagerHost = args.keyManagerHost || args.host;
    this.sessionAuthHost = args.sessionAuthHost || args.host;
    this.agentHost = args.agentHost || args.host;
    this.privateKey = args.privateKey;
    this.publicKey = args.publicKey;
    this.passphrase = args.passphrase;
    logger.info(`Connecting to ${this.host}`);
    if (this.keyManagerHost !== this.host) {
      logger.info(`Using separate KeyManager ${this.keyManagerHost}`);
    }
    if (this.sessionAuthHost !== this.host) {
      logger.info(`Using separate SessionAuth ${this.sessionAuthHost}`);
    }
    if (this.agentHost !== this.host) {
      logger.info(`Using separate Agent ${this.agentHost}`);
    }
    // refresh tokens on a weekly basis
    const weeklyRefresh = memoize(this._httpPost.bind(this), {maxAge: 604800000, length: 2});
    this.sessionAuth = function(): Promise<AuthenticateResponseType> {
      return weeklyRefresh(this.sessionAuthHost, '/sessionauth/v1/authenticate');
    };
    this.keyAuth = function(): Promise<AuthenticateResponseType> {
      return weeklyRefresh(this.keyManagerHost, '/keyauth/v1/authenticate');
    };
    Promise.all([this.sessionAuth(), this.keyAuth()]).then((values: Array<AuthenticateResponseType>) => {
      const [sessionToken, kmToken] = values;
      logger.info(`Initialising with sessionToken: ${sessionToken.token} and keyManagerToken: ${kmToken.token}`);
    });
  }

  /**
   * A test endpoint, which simply returns the input provided.
   *
   * See {@link https://rest-api.symphony.com/docs/echo|Echo}
   *
   * @param {EchoType} body
   * @return {Promise.<EchoType>}
   */
  echo(body: EchoType): Promise<EchoType> {
    return this._httpAgentPost('/agent/v1/util/echo', body);
  }

  /**
   * Returns the userId of the calling user.
   *
   * See {@link https://rest-api.symphony.com/docs/session-info|Session User}
   *
   * @return {Promise.<SymphonyUserIdType>}
   */
  whoAmI(): Promise<SymphonyUserIdType> {
    return this._httpPodGet('/pod/v1/sessioninfo');
  }

  /**
   * Lookup a user by userId, email, or username.  Searches are performed locally.
   *
   * See {@link https://rest-api.symphony.com/docs/user-lookup|User Lookup}
   *
   * @param {GetUserArgsType} args
   * @return {Promise.<SymphonyUserType>}
   */
  getUser(args: GetUserArgsType): Promise<SymphonyUserType> {
    if (args.userId !== undefined && args.userId !== null) {
      return this._httpPodGet(`/pod/v2/user?uid=${args.userId}&local=true`);
    }
    if (args.username !== undefined && args.username !== null) {
      return this._httpPodGet(`/pod/v2/user?username=${args.username}&local=true`);
    }
    if (args.emailAddress !== undefined && args.emailAddress !== null) {
      return this._httpPodGet(`/pod/v2/user?email=${args.emailAddress}&local=true`);
    }
    return Promise.reject('No valid user argument supplied');
  }

  /**
   * Posts a message to an existing stream.
   *
   * See {@link https://rest-api.symphony.com/docs/create-message-v2|Create Message}
   *
   * @param {string} streamId
   * @param {string} message
   * @param {string} format <code>TEXT</code> or <code>MESSAGEML</code>
   * @return {Promise.<SymphonyMessageType>}
   */
  sendMessage(streamId: string, message: string, format: string): Promise<SymphonyMessageType> {
    const body = {
      message: message,
      format: format,
    };
    return this._httpAgentPost(`/agent/v2/stream/${streamId}/message/create`, body);
  }

  /**
   * Get messages from an existing stream (IM, MIM, or chatroom).  Additionally returns any attachments associated with
   * the message.
   *
   * See {@link https://rest-api.symphony.com/docs/messages-v2|Messages}
   *
   * @param {string} streamId
   * @return {Promise.<Array.<SymphonyMessageType>>}
   */
  getMessages(streamId: string): Promise<Array<SymphonyMessageType>> {
    return this._httpAgentGet(`/agent/v2/stream/${streamId}/message`);
  }

  /**
   * Create a new real time messages / events stream ("datafeed"). The datafeed provides messages and events from all
   * conversations that the user is in.  Returns the ID of the datafeed that has just been created. This ID should then
   * be used as input to the {@link Symphony#readDatafeed} endpoint.
   *
   * See {@link https://rest-api.symphony.com/docs/create-messagesevents-stream|Create Messages/Events Stream}
   *
   * @return {Promise.<CreateDatafeedResponseType>}
   */
  createDatafeed(): Promise<CreateDatafeedResponseType> {
    return this._httpAgentPost('/agent/v4/datafeed/create', undefined);
  }

  /**
   * Read messages from a given real time messages / events stream ("datafeed"). The datafeed provides messages and
   * events from all conversations that the user is in.
   *
   * See {@link https://rest-api.symphony.com/docs/read-messagesevents-stream|Read Messages/Events Stream}
   *
   * @param {string} datafeedId
   * @return {Promise.<Array.<SymphonyMessageType>>}
   */
  readDatafeed(datafeedId: string): Promise<Array<SymphonyMessageType>> {
    return this._httpAgentGet(`/agent/v4/datafeed/${datafeedId}/read`);
  }

  /**
   * Creates a new single-party instant message conversation or returns an existing IM or MIM between the specified user
   * and the calling user.
   *
   * See {@link https://rest-api.symphony.com/docs/create-im-or-mim|Create IM or MIM}
   *
   * @param {number} userId
   * @return {Promise.<CreateIMResponseType>}
   */
  createIM(userId: number): Promise<CreateIMResponseType> {
    return this._httpPodPost('/pod/v1/im/create', [userId]);
  }

  /**
   * Creates a new internal chatroom.
   *
   * See {@link https://rest-api.symphony.com/docs/create-room-v2|Create Room}
   *
   * @param {CreateRoomType} roomInfo
   * @return {Promise.<RoomInfoType>}
   */
  createRoom(roomInfo: CreateRoomType): Promise<RoomInfoType> {
    const getFeature = function(feature: string): boolean {
      if (roomInfo.features) {
        return roomInfo.features[feature] || false;
      }
      return false;
    };
    const body = {
      name: roomInfo.name,
      description: roomInfo.description,
      keywords: [],
      membersCanInvite: getFeature('membersCanInvite'),
      discoverable: getFeature('discoverable'),
      public: getFeature('public'),
      readOnly: getFeature('readOnly'),
      copyProtected: getFeature('copyProtected'),
    };
    for (const [key, value] of roomInfo.keywords.entries()) {
      body.keywords.push({
        key: key,
        value: value,
      });
    }
    return this._httpPodPost('/pod/v2/room/create', body);
  }

  /**
   * Returns information about a particular chat room.
   *
   * See {@link https://rest-api.symphony.com/docs/room-info-v2|Room Info}
   *
   * @param {string} roomId
   * @return {Promise.<RoomInfoType>}
   */
  getRoomInfo(roomId: string): Promise<RoomInfoType> {
    return this._httpPodGet(`/pod/v2/room/${roomId}/info`);
  }

  /**
   * Updates the attributes of an existing chat room.
   *
   * See {@link https://rest-api.symphony.com/docs/update-room-v2|Update Room}
   *
   * @param {string} roomId
   * @param {UpdateRoomType} roomInfo
   * @return {Promise.<RoomInfoType>}
   */
  updateRoom(roomId: string, roomInfo: UpdateRoomType): Promise<RoomInfoType> {
    const getFeature = function(feature: string): boolean {
      if (roomInfo.features) {
        return roomInfo.features[feature] || false;
      }
      return false;
    };
    const body = {
      name: roomInfo.name,
      description: roomInfo.description,
      keywords: [],
      membersCanInvite: getFeature('membersCanInvite'),
      discoverable: getFeature('discoverable'),
      copyProtected: getFeature('copyProtected'),
    };
    for (const [key, value] of roomInfo.keywords.entries()) {
      body.keywords.push({
        key: key,
        value: value,
      });
    }
    return this._httpPodPost(`/pod/v2/room/${roomId}/update`, body);
  }

  /**
   * Deactivate or reactivate a chatroom. At creation, a new chatroom is active.
   *
   * See {@link https://rest-api.symphony.com/docs/de-or-re-activate-room|De/Re-activate Room}
   *
   * @param {string} roomId
   * @param {boolean} status
   * @return {Promise.<RoomInfoAlternateType>}
   */
  setRoomActiveStatus(roomId: string, status: boolean): Promise<RoomInfoAlternateType> {
    return this._httpPodPost(`/pod/v1/room/${roomId}/setActive?${querystring.stringify({active: status})}`);
  }

  /**
   * Returns a list of all the current members of a stream (IM, MIM, or chatroom).
   *
   * See {@link https://rest-api.symphony.com/docs/stream-members|Stream Members}
   *
   * @param {string} roomId
   * @return {Promise.<RoomMembershipType>}
   */
  getMembers(roomId: string): Promise<Array<RoomMembershipType>> {
    return this._httpPodGet(`/pod/v2/room/${roomId}/membership/list`);
  }

  /**
   * Adds a new member to an existing room.
   *
   * See {@link https://rest-api.symphony.com/docs/add-member|Add Member}
   *
   * @param {string} roomId
   * @param {number} userId
   * @return {Promise.<RoomMemberActionType>}
   */
  addMember(roomId: string, userId: number): Promise<RoomMemberActionType> {
    return this._httpPodPost(`/pod/v1/room/${roomId}/membership/add`, {id: userId});
  }

  /**
   * Removes an existing member from an existing room.
   *
   * See {@link https://rest-api.symphony.com/docs/remove-member|Remove Member}
   *
   * @param {string} roomId
   * @param {number} userId
   * @return {Promise.<RoomMemberActionType>}
   */
  removeMember(roomId: string, userId: number): Promise<RoomMemberActionType> {
    return this._httpPodPost(`/pod/v1/room/${roomId}/membership/remove`, {id: userId});
  }

  /**
   * Promotes user to owner of the chat room.
   *
   * See {@link https://rest-api.symphony.com/docs/promote-owner|Promote Owner}
   *
   * @param {string} roomId
   * @param {number} userId
   * @return {Promise.<RoomMemberActionType>}
   */
  promoteMember(roomId: string, userId: number): Promise<RoomMemberActionType> {
    return this._httpPodPost(`/pod/v1/room/${roomId}/membership/promoteOwner`, {id: userId});
  }

  /**
   * Demotes room owner to a participant in the chat room.
   *
   * See {@link https://rest-api.symphony.com/docs/demote-owner|Demote Owner}
   *
   * @param {string} roomId
   * @param {number} userId
   * @return {Promise.<RoomMemberActionType>}
   */
  demoteMember(roomId: string, userId: number): Promise<RoomMemberActionType> {
    return this._httpPodPost(`/pod/v1/room/${roomId}/membership/demoteOwner`, {id: userId});
  }

  /**
   * Make a HTTP GET call against the Symphony pod API and return a <code>Promise</code> of the response.
   *
   * @param {string} path Symphony API path
   * @return {Promise.<T>}
   * @template T
   * @private
   */
  _httpPodGet<T>(path: string): Promise<T> {
    return this.sessionAuth().then((sessionToken: AuthenticateResponseType): Promise<T> => {
      let headers = {
        sessionToken: sessionToken.token,
      };
      return this._httpGet(this.host, path, headers);
    });
  }

  /**
   * Make a HTTP POST call against the Symphony pod API and return a <code>Promise</code> of the response.
   *
   * @param {string} path Symphony API path
   * @param {mixed} body Message payload if appropriate
   * @return {Promise.<T>}
   * @template T
   * @private
   */
  _httpPodPost<T>(path: string, body: ?mixed): Promise<T> {
    return this.sessionAuth().then((sessionToken: AuthenticateResponseType): Promise<T> => {
      let headers = {
        sessionToken: sessionToken.token,
      };
      return this._httpPost(this.host, path, headers, body);
    });
  }

  /**
   * Make a HTTP GET call against the Symphony agent API and return a <code>Promise</code> of the response.
   *
   * @param {string} path Symphony API path
   * @return {Promise.<T>}
   * @template T
   * @private
   */
  _httpAgentGet<T>(path: string): Promise<T> {
    return Promise.all([this.sessionAuth(), this.keyAuth()])
      .then((values: Array<AuthenticateResponseType>): Promise<T> => {
        const [sessionToken, keyManagerToken] = values;
        let headers = {
          sessionToken: sessionToken.token,
          keyManagerToken: keyManagerToken.token,
        };
        return this._httpGet(this.agentHost, path, headers);
      });
  }

  /**
   * Make a HTTP POST call against the Symphony agent API and return a <code>Promise</code> of the response.
   *
   * @param {string} path Symphony API path
   * @param {mixed} body Message payload if appropriate
   * @return {Promise.<T>}
   * @template T
   * @private
   */
  _httpAgentPost<T>(path: string, body: ?mixed): Promise<T> {
    return Promise.all([this.sessionAuth(), this.keyAuth()])
      .then((values: Array<AuthenticateResponseType>): Promise<T> => {
        const [sessionToken, keyManagerToken] = values;
        let headers = {
          sessionToken: sessionToken.token,
          keyManagerToken: keyManagerToken.token,
        };
        return this._httpPost(this.agentHost, path, headers, body);
      });
  }

  /**
   * Make a HTTP GET call against Symphony and return a <code>Promise</code> of the response.
   *
   * @param {string} host Symphony host
   * @param {string} path Symphony API path
   * @param {HttpHeaderType} headers HTTP headers
   * @return {Promise.<T>}
   * @template T
   * @private
   */
  _httpGet<T>(host: string, path: string, headers: HttpHeaderType = {}): Promise<T> {
    return this._httpRequest('GET', host, path, headers, undefined);
  }

  /**
   * Make a HTTP POST call against Symphony and return a <code>Promise</code> of the response.
   *
   * @param {string} host Symphony host
   * @param {string} path Symphony API path
   * @param {HttpHeaderType} headers HTTP headers
   * @param {mixed} body Message payload if appropriate
   * @return {Promise.<T>}
   * @template T
   * @private
   */
  _httpPost<T>(host: string, path: string, headers: HttpHeaderType = {}, body: ?mixed): Promise<T> {
    return this._httpRequest('POST', host, path, headers, body);
  }

  /**
   * Make a HTTP method call against Symphony and return a <code>Promise</code> of the response.
   *
   * @param {string} method HTTP method verb
   * @param {string} host Symphony host
   * @param {string} path Symphony API path
   * @param {HttpHeaderType} headers HTTP headers
   * @param {mixed} body Message payload if appropriate
   * @return {Promise.<T>}
   * @template T
   * @private
   */
  _httpRequest<T>(method: string, host: string, path: string, headers: HttpHeaderType, body: ?mixed): Promise<T> {
    let self = this;
    return new Promise(function(resolve, reject) {
      let options = {
        baseUrl: `https://${host}`,
        url: path,
        json: true,
        headers: headers,
        method: method,
        key: fs.readFileSync(self.privateKey),
        cert: fs.readFileSync(self.publicKey),
        passphrase: self.passphrase,
        body: undefined,
      };
      if (body !== undefined && body !== null) {
        options.body = body;
      }
      logger.debug(`sending ${options.method} to https://${host}${path}: ${JSON.stringify(options.body)}`);
      request(options, (err, res: HttpResponseType, data: T) => {
        if (err !== undefined && err !== null) {
          const statusCode = res ? res.statusCode : 'unknown';
          logger.warning(`received ${statusCode} error response from https://${host}${path}: ${err}`);
          reject(new Error(err));
        } else if (Math.floor(res.statusCode / 100) !== 2) {
          const err = `received ${res.statusCode} response from https://${host}${path}: ${JSON.stringify(data)}`;
          logger.warning(err);
          reject(new Error(err));
        } else {
          logger.debug(`received ${res.statusCode} response from https://${host}${path}: ${JSON.stringify(data)}`);
          resolve(data);
        }
      });
    });
  }
}

module.exports = Symphony;
