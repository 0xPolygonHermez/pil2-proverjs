#!/bin/sh
set -ex
npm install
npm install -g pkg
pkg . --targets node16-linux-x64,node16-macos-x64 --compress brotli --output bin/proofman-setup # node16-win-x64
echo "binaries were updated successfully!"
