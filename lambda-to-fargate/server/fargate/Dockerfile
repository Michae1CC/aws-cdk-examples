FROM --platform=linux/amd64 node:14
USER root

COPY . .

EXPOSE 80
RUN npm install
RUN npm run build

CMD ["node", "index.js"]
