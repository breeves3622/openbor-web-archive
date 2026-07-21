# Stage 1: Build the React application
FROM node:22-alpine as build

WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy source code and build
COPY . ./
RUN npm run build

# Stage 2: Serve the application using Node Express backend
FROM node:22-alpine

WORKDIR /app

# Install production dependencies for the Express server
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the built assets from Stage 1
COPY --from=build /app/dist ./dist

# Copy the server script
COPY server.js ./

EXPOSE 80

CMD ["node", "server.js"]
