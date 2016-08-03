#
#    Copyright 2016 Jon Freedman
#
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#
#        http://www.apache.org/licenses/LICENSE-2.0
#
#    Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS,
#    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#    See the License for the specific language governing permissions and
#    limitations under the License.
#

{TextMessage, User} = require 'hubot'

class V2Message extends TextMessage

  constructor: (@symphonyUser, @symphonyMessage) ->
    super(
      new User(
        @symphonyMessage.fromUserId
        {
          name: @symphonyUser.userAttributes?.userName
          displayName: @symphonyUser.userAttributes?.displayName
          emailAddress: @symphonyUser.userAttributes?.emailAddress
          room: @symphonyMessage.streamId
        }
      ),
      @_getMessageText(@symphonyMessage),
      @symphonyMessage.id
    )

  _getMessageText: (symphonyMessage) ->
    match = /<messageML>(.*)<\/messageML>/i.exec symphonyMessage.message
    if match?
      match[1]
    else
      symphonyMessage.message

module.exports = {
  V2Message
}