FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/
RUN npm ci --workspace=apps/web
COPY apps/web ./apps/web
ARG VITE_API_URL=http://localhost:5000/api/v1
ARG VITE_SOCKET_PATH=/socket.io
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_PATH=$VITE_SOCKET_PATH
RUN npm run build --workspace=apps/web

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
