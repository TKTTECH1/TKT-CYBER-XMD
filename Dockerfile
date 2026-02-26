FROM quay.io/qasimtech/Dex-Bot-md:latest

WORKDIR /root/mega-md

RUN git clone https://github.com/TKTTECH1/TKT-CYBER-XMD . && \
    npm install

EXPOSE 5000

CMD ["npm", "start"]
