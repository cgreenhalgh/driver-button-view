FROM amd64/alpine:3.8

WORKDIR /app

RUN addgroup -S databox && adduser -S -g databox databox && \
apk --no-cache add build-base pkgconfig nodejs npm libzmq zeromq-dev libsodium-dev python  && \
npm install zeromq@4.6.0 --zmq-external --verbose && \
apk del build-base pkgconfig libsodium-dev python zeromq-dev

ADD ./package.json package.json

# only if using git...
#RUN apk --no-cache add git

RUN npm install --production

USER databox
ADD . /app/

LABEL databox.type="driver"

EXPOSE 8080

CMD ["npm","run","start-prod"]
#CMD ["sleep", "30000000"]
