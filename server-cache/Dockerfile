FROM mhart/alpine-node:10.9.0

# shared
COPY /shared/modules/coinpush /usr/src/app/shared/modules/coinpush

# server
WORKDIR /usr/src/app/server-cache
COPY /server-cache/package.json /server-cache/tsconfig.json ./
RUN npm i --quiet --no-progress
COPY /server-cache/src ./src