FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend

COPY Frontend/package.json Frontend/package-lock.json ./
RUN npm ci

COPY Frontend/index.html Frontend/vite.config.js Frontend/tailwind.config.js Frontend/postcss.config.js ./
COPY Frontend/src ./src
ARG VITE_USE_MOCK=false
ARG VITE_API_USER_ID=u_isha
ARG VITE_API_BASE_URL=
ENV VITE_USE_MOCK=${VITE_USE_MOCK} \
    VITE_API_USER_ID=${VITE_API_USER_ID} \
    VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:alpine AS frontend

COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html
COPY Frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

FROM python:3.11-slim AS backend

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/home/app/.cache/huggingface

WORKDIR /app

RUN groupadd --system app && useradd --system --gid app --create-home app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/chroma_db ./chroma_db
COPY docs ./docs
COPY backend/users.json ./users.json

RUN mkdir -p /home/app/.cache/huggingface \
    && chown -R app:app /app /home/app/.cache

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=600s --retries=3 \
    CMD python -c "from urllib.request import urlopen; urlopen('http://127.0.0.1:8000/health', timeout=3)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
