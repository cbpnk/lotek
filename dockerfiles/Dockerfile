FROM etherpad/etherpad:1.8.13
RUN npm install ep_full_hyperlinks && \
    npm install ep_mathjax && \
    npm install ep_headings2

ENV MINIFY=false EDIT_ONLY=true DB_TYPE=sqlite DB_FILENAME=persistent/dirty.db
CMD ["node", "--experimental-worker", "node_modules/ep_etherpad-lite/node/server.js", "--apikey", "/opt/etherpad-lite/persistent/APIKEY.txt"]
