FROM node:16.16.0

WORKDIR /opt
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o rustup_install.sh
RUN chmod 755 rustup_install.sh
RUN echo 1 | sh rustup_install.sh -y
ENV PATH="/root/.cargo/bin:$PATH"
RUN cargo install typos-cli
COPY . /work
WORKDIR /work
RUN npm ci
EXPOSE 3000

CMD ["/bin/sh"]