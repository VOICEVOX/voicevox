FROM node:14.17.4

COPY . /work
WORKDIR /work
RUN npm ci
EXPOSE 3000

CMD ["/bin/sh"]