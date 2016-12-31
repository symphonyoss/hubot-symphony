#!/bin/bash
# Run hubot-symphony integration tests against the Foundation Open Developer Platform

# To run this script, you must install NodeJS and run npm install:
# $ brew update
# $ brew upgrade node
# $ npm install

SYMPHONY_HOST=foundation-dev.symphony.com
SYMPHONY_KM_HOST=foundation-dev-api.symphony.com
SYMPHONY_SESSIONAUTH_HOST=foundation-dev-api.symphony.com
SYMPHONY_AGENT_HOST=foundation-dev-api.symphony.com

HUBOT_SYMPHONY_LOG_LEVEL=notice

npm run it