#!/bin/bash
# Run hubot-symphony integration tests against the Foundation Open Developer Platform

# To run this script, you must install NodeJS and run npm install:
# $ brew update
# $ brew upgrade node
# $ npm install

export SYMPHONY_HOST=foundation-dev.symphony.com
export SYMPHONY_KM_HOST=foundation-dev-api.symphony.com
export SYMPHONY_SESSIONAUTH_HOST=foundation-dev-api.symphony.com
export SYMPHONY_AGENT_HOST=foundation-dev-api.symphony.com

export HUBOT_SYMPHONY_LOG_LEVEL=notice

npm run it