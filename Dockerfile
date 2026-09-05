FROM node:22-bookworm

RUN apt-get update && apt-get install -y git python3-pip build-essential curl
RUN npm install -g @openai/codex

WORKDIR /workspace
CMD ["/bin/bash"]