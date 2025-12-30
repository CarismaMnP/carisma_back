FROM node:alpine
WORKDIR /app
COPY ./package*.json ./
RUN npm ci
COPY . .
RUN mkdir --parents ~/.postgresql && \
    wget "https://storage.yandexcloud.net/cloud-certs/CA.pem" \
         --output-document ~/.postgresql/root.crt && \
    chmod 0600 ~/.postgresql/root.crt

CMD ["npm", "run", "start"]
