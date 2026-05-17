#!/bin/sh
git pull
npm run migrate
npm run build -- --webpack
service bdblan restart
