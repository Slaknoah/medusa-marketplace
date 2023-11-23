FROM node:18-alpine AS base
 
FROM base AS builder
RUN apk add --no-cache libc6-compat
# RUN apk add --no-cache --update python3 make g++
RUN apk update
# Set working directory
WORKDIR /app
COPY ./mono-apps/commerce-api/package*.json ./
 
# First install the dependencies (as they change less often)
RUN npm install

COPY ./mono-apps/commerce-api/ .

ENV DISABLE_ADMIN=true

# Build the project
RUN npm run build:server 

# RUN npm run migrate

ENV NODE_ENV=production

CMD npm run start:server