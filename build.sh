#!/bin/bash

set -ex

# switch node version
. /home/tiger/.nvm/nvm.sh
 
DIR=`pwd`

BUILD="$DIR/dist"
OUTPUT="$DIR/output"
RESOURCE="$DIR/output_resource"

mkdir -p $OUTPUT
mkdir -p $RESOURCE

# Install dependencies, build!
nvm install v18.14.0
nvm use v18.14.0
npm install
npm run build

# copy files
cp -RL .next/static output_resource