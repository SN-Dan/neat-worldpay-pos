FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package and install deps
COPY package*.json ./
RUN npm install

# Copy source code and certs
COPY . .

# Expose secure WebSocket port
EXPOSE 8443

# Start server
CMD ["npm", "start"]