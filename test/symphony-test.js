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
import {TextListener} from 'hubot';
import type {RoomMembershipType} from '../src/symphony';
import Symphony from '../src/symphony';
import {V2Message} from '../src/message';
import NockServer from './nock-server';
import FakeRobot from './fakes';

describe('On-premise key manager / agent', () => {
  let nock: NockServer;
  let symphony: Symphony;

  beforeEach(() => {
    nock = new NockServer({
      host: 'https://foundation.symphony.com',
      kmHost: 'https://keymanager.notsymphony.com',
      agentHost: 'https://agent.alsonotsymphony.com',
      sessionAuthHost: 'https://foundation-api.symphony.com',
    });
    symphony = new Symphony({
      host: 'foundation.symphony.com',
      privateKey: './test/resources/privateKey.pem',
      publicKey: './test/resources/publicKey.pem',
      passphrase: 'changeit',
      keyManagerHost: 'keymanager.notsymphony.com',
      agentHost: 'agent.alsonotsymphony.com',
      sessionAuthHost: 'foundation-api.symphony.com',
    });
  });

  afterEach(() => {
    nock.close();
  });

  it('should connect to separate key manager / agent url', (done) => {
    let msg = {message: 'bar'};
    symphony.echo(msg)
      .then((response) => {
        assert.deepEqual(msg, response);
        done();
      })
      .catch((error) => {
        done(`Failed with error ${error}`);
      });
  });

  it('should connect to separate pod url', (done) => {
    symphony.whoAmI()
      .then((response) => {
        assert.equal(nock.botUserId, response.userId);
        done();
      })
      .catch((error) => {
        done(`Failed with error ${error}`);
      });
  });
});

describe('REST API test suite', () => {
  let nock: NockServer;
  let symphony: Symphony;

  beforeEach(() => {
    nock = new NockServer({host: 'https://foundation.symphony.com'});
    symphony = new Symphony({
      host: 'foundation.symphony.com',
      privateKey: './test/resources/privateKey.pem',
      publicKey: './test/resources/publicKey.pem',
      passphrase: 'changeit',
    });
  });

  afterEach(() => {
    nock.close();
  });

  it('echo should obtain session and key tokens and echo response', (done) => {
    let msg = {message: 'bar'};
    symphony.echo(msg)
      .then((response) => {
        assert.deepEqual(msg, response);
        done();
      })
      .catch((error) => {
        done(`Failed with error ${error}`);
      });
  });

  it('whoAmI should get userId', (done) => {
    symphony.whoAmI()
      .then((response) => {
        assert.equal(nock.botUserId, response.userId);
        done();
      })
      .catch((error) => {
        done(`Failed with error ${error}`);
      });
  });

  for (const [label, func] of [
    ['getUser by email should expose user details', () => symphony.getUser({emailAddress: nock.realUserEmail})],
    ['getUser by username should expose user details', () => symphony.getUser({username: nock.realUserName})],
    ['getUser by userId should expose user details', () => symphony.getUser({userId: nock.realUserId})],
  ]) {
    it(label, (done) => {
      func()
        .then((response) => {
          assert.equal(nock.realUserId, response.id);
          assert.equal(nock.realUserName, response.username);
          assert.equal(nock.realUserEmail, response.emailAddress);
          done();
        })
        .catch((error) => {
          done(`Failed with error ${error}`);
        });
    });
  }

  it('sendMessage should obtain session and key tokens and get message ack', (done) => {
    let msg = '<messageML>Testing 123...</messageML>';
    symphony.sendMessage(nock.streamId, msg, 'MESSAGEML')
      .then((response) => {
        assert.equal(msg, response.message);
        assert.equal(nock.botUserId, response.fromUserId);
        done();
      })
      .catch((error) => {
        done(`Failed with error ${error}`);
      });
  });

  it('getMessages should get all messages', (done) => {
    let msg = '<messageML>Yo!</messageML>';
    symphony.sendMessage(nock.streamId, msg, 'MESSAGEML')
      .then((response) => {
        assert.equal(msg, response.message);
        return symphony.getMessages(nock.streamId);
      })
      .then((response) => {
        assert.isAtLeast(response.length, 2);
        assert.include(response.map((m) => m.message), '<messageML>Hello World</messageML>');
        assert.include(response.map((m) => m.message), msg);
        done();
      })
      .catch((error) => {
        done(`Failed with error ${error}`);
      });
  });

  it('createDatafeed should generate a datafeed id', (done) => {
    symphony.createDatafeed()
      .then((response) => {
        assert.equal(nock.datafeedId, response.id);
        done();
      })
      .catch((error) => {
        done(`Failed with error ${error}`);
      });
  });

  it('readDatafeed should pull messages', (done) => {
    let msg1 = '<messageML>foo</messageML>';
    let msg2 = '<messageML>bar</messageML>';
    symphony.createDatafeed()
      .then((initialResponse) => {
        // ensure that any previous message state is drained
        return symphony.readDatafeed(initialResponse.id)
          .then((response) => {
            return symphony.sendMessage(nock.streamId, msg1, 'MESSAGEML');
          })
          .then((response) => {
            assert.equal(msg1, response.message);
            return symphony.readDatafeed(initialResponse.id);
          })
          .then((response) => {
            assert.equal(1, response.length);
            assert.equal(msg1, response[0].message);
            return symphony.sendMessage(nock.streamId, msg2, 'MESSAGEML');
          })
          .then((response) => {
            assert.equal(msg2, response.message);
            return symphony.readDatafeed(initialResponse.id);
          })
          .then((response) => {
            assert.equal(1, response.length);
            assert.equal(msg2, response[0].message);
            done();
          });
      })
      .catch((error) => {
        done(`Failed with error ${error}`);
      });
  });

  it('readDatafeed should not fail if no messages are available', (done) => {
    symphony.createDatafeed()
      .then((initialResponse) => {
        // ensure that any previous message state is drained
        symphony.readDatafeed(initialResponse.id)
          .then(() => {
            return symphony.readDatafeed(initialResponse.id);
          })
          .then((response) => {
            assert.isUndefined(response);
            done();
          });
      })
      .catch((error) => {
        done(`Failed with error ${error}`);
      });
  });

  it('createIM should generate a stream id', (done) => {
    symphony.createIM(nock.realUserId)
      .then((response) => {
        assert.equal(nock.streamId, response.id);
        done();
      })
      .catch((error) => {
        done(`Failed with error ${error}`);
      });
  });

  it('createRoom should generate room info', (done) => {
    const roomInfo = {
      name: 'foo',
      description: 'bar',
      keywords: new Map([['x', 'y']]),
      features: {
        membersCanInvite: true,
      },
    };
    symphony.createRoom(roomInfo)
      .then((response) => {
        assert.equal('foo', response.roomAttributes.name);
        assert.equal('bar', response.roomAttributes.description);
        assert.deepEqual([{key: 'x', value: 'y'}], response.roomAttributes.keywords);
        assert.isTrue(response.roomAttributes.membersCanInvite);
        assert.isFalse(response.roomAttributes.discoverable);
        assert.isFalse(response.roomAttributes.readOnly);
        assert.isFalse(response.roomAttributes.copyProtected);
        assert.isFalse(response.roomAttributes.public);
        assert.equal(nock.streamId, response.roomSystemInfo.id);
        assert.equal(nock.botUserId, response.roomSystemInfo.createdByUserId);
        assert.isTrue(response.roomSystemInfo.active);
        done();
      })
      .catch((error) => {
        done(`Failed with error ${error}`);
      });
  });

  it('getRoomInfo should return room info', (done) => {
    symphony.getRoomInfo(nock.streamId)
      .then((response) => {
        assert.equal('foo', response.roomAttributes.name);
        assert.equal('bar', response.roomAttributes.description);
        assert.deepEqual([{key: 'x', value: 'y'}], response.roomAttributes.keywords);
        assert.isFalse(response.roomAttributes.membersCanInvite);
        assert.isFalse(response.roomAttributes.discoverable);
        assert.isFalse(response.roomAttributes.readOnly);
        assert.isFalse(response.roomAttributes.copyProtected);
        assert.isFalse(response.roomAttributes.public);
        assert.equal(nock.streamId, response.roomSystemInfo.id);
        assert.equal(nock.botUserId, response.roomSystemInfo.createdByUserId);
        assert.isTrue(response.roomSystemInfo.active);
        done();
      })
      .catch((error) => {
        done(`Failed with error ${error}`);
      });
  });

  it('updateRoom should return room info', (done) => {
    const roomInfo = {
      name: 'foo1',
      description: 'bar2',
      keywords: new Map([['x', 'y3']]),
      features: {
        discoverable: true,
      },
    };
    symphony.updateRoom(nock.streamId, roomInfo)
      .then((response) => {
        assert.equal('foo1', response.roomAttributes.name);
        assert.equal('bar2', response.roomAttributes.description);
        assert.deepEqual([{key: 'x', value: 'y3'}], response.roomAttributes.keywords);
        assert.isFalse(response.roomAttributes.membersCanInvite);
        assert.isTrue(response.roomAttributes.discoverable);
        assert.isFalse(response.roomAttributes.readOnly);
        assert.isFalse(response.roomAttributes.copyProtected);
        assert.isFalse(response.roomAttributes.public);
        assert.equal(nock.streamId, response.roomSystemInfo.id);
        assert.equal(nock.botUserId, response.roomSystemInfo.createdByUserId);
        assert.isTrue(response.roomSystemInfo.active);
        done();
      })
      .catch((error) => {
        done(`Failed with error ${error}`);
      });
  });

  it('setRoomActiveStatus should return room info', (done) => {
    symphony.setRoomActiveStatus(nock.streamId, false)
      .then((response) => {
        assert.equal('foo', response.roomAttributes.name);
        assert.equal('bar', response.roomAttributes.description);
        assert.deepEqual([{key: 'x', value: 'y'}], response.roomAttributes.keywords);
        assert.isFalse(response.roomAttributes.membersCanInvite);
        assert.isFalse(response.roomAttributes.discoverable);
        assert.equal(nock.streamId, response.roomSystemInfo.id);
        assert.equal(nock.botUserId, response.roomSystemInfo.createdByUserId);
        assert.isFalse(response.roomSystemInfo.active);
        assert.isFalse(response.immutableRoomAttributes.readOnly);
        assert.isFalse(response.immutableRoomAttributes.copyProtected);
        assert.isFalse(response.immutableRoomAttributes.public);
        done();
      })
      .catch((error) => {
        done(`Failed with error ${error}`);
      });
  });

  it('getMembers should return members', (done) => {
    symphony.getMembers(nock.streamId)
      .then((response: Array<RoomMembershipType>) => {
        assert.lengthOf(response, 2);
        assert.deepInclude(response, {
          id: nock.botUserId,
          owner: true,
          joinDate: 1461426797875,
        }, 'contains bot user');
        assert.deepInclude(response, {
          id: nock.realUserId,
          owner: false,
          joinDate: 1461430710531,
        }, 'contains real user');
        done();
      })
      .catch((error) => {
        done(`Failed with error ${error}`);
      });
  });

  for (const [label, func, message] of [
    [
      'addMember should acknowledge addition',
      () => symphony.addMember(nock.streamId, nock.realUserId), 'Member added',
    ],
    [
      'removeMember should acknowledge removal',
      () => symphony.removeMember(nock.streamId, nock.realUserId), 'Member removed',
    ],
    [
      'promoteMember should acknowledge promotion',
      () => symphony.promoteMember(nock.streamId, nock.realUserId), 'Member promoted to owner',
    ],
    [
      'demoteMember should acknowledge demotion',
      () => symphony.demoteMember(nock.streamId, nock.realUserId), 'Member demoted to participant',
    ],
  ]) {
    it(label, (done) => {
      func()
        .then((response) => {
          assert.equal(response.format, 'TEXT');
          assert.equal(response.message, message);
          done();
        })
        .catch((error) => {
          done(`Failed with error ${error}`);
        });
    });
  }
});

describe('Object model test suite', () => {
  for (const text of ['<messageML>Hello World</messageML>', 'Hello World']) {
    it(`parse a V2Message containing '${text}'`, () => {
      let msg = {
        id: 'foobar',
        timestamp: '1464629912263',
        v2messageType: 'V2Message',
        streamId: 'baz',
        message: text,
        fromUserId: 12345,
      };
      let user = {
        id: 12345,
        name: 'johndoe',
        displayName: 'John Doe',
      };
      let v2 = new V2Message(user, msg);
      assert.equal('Hello World', v2.text);
      assert.equal('foobar', v2.id);
      assert.equal(12345, v2.user.id);
      assert.equal('johndoe', v2.user.name);
      assert.equal('John Doe', v2.user.displayName);
      assert.equal('baz', v2.room);
    });
  }

  it('regex test', (done) => {
    let msg = {
      id: 'foobar',
      timestamp: '1464629912263',
      v2messageType: 'V2Message',
      streamId: 'baz',
      message: 'butler ping',
      fromUserId: 12345,
    };
    let user = {
      id: 12345,
      name: 'johndoe',
      displayName: 'John Doe',
    };
    let robot = new FakeRobot();
    let callback = () => {
      done();
    };
    let listener = new TextListener(robot, /^\s*[@]?butler[:,]?\s*(?:PING$)/i, {}, callback);
    listener.call(new V2Message(user, msg));
  });
});
