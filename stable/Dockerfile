# --- BUILD STAGE (Alpine) ---
FROM chatwoot/chatwoot:latest AS build
WORKDIR /app
USER root

# Herramientas de build
RUN apk add --no-cache nodejs npm git libc6-compat python3 make g++
RUN npm i -g pnpm@10 && pnpm -v && node -v && npm -v

# Rutas destino
RUN mkdir -p /app/public/brand-assets /app/public /app/app/assets/images /app/assets/images /app/app/javascript/widget/assets/images

# --------- BRANDING UI (SPA) ---------
COPY brand/logo.svg               /app/public/brand-assets/logo.svg
COPY brand/logo-dark.svg          /app/public/brand-assets/logo_dark.svg
COPY brand/logo_thumbnail.svg     /app/public/brand-assets/logo_thumbnail.svg

# --------- EMAILS (Rails mailer) ---------
COPY brand/email_logo.png         /app/app/assets/images/chatwoot_logo.png
COPY brand/email_logo.png         /app/assets/images/chatwoot_logo.png

# --------- PWA / FAVICONS EN RAÍZ ---------
COPY brand/apple-touch-icon.png       /app/public/apple-touch-icon.png
COPY brand/android-chrome-192x192.png /app/public/android-chrome-192x192.png
COPY brand/android-chrome-512x512.png /app/public/android-chrome-512x512.png
# 144x144 (Android/MS tiles)
COPY brand/android-icon-144x144.png   /app/public/android-icon-144x144.png
COPY brand/ms-icon-144x144.png        /app/public/ms-icon-144x144.png
COPY brand/ms-icon-144x144.png        /app/public/mstile-144x144.png
# Manifiestos (algunos layouts usan manifest.json)
COPY brand/site.webmanifest           /app/public/site.webmanifest
COPY brand/site.webmanifest           /app/public/manifest.json
# Favicon
COPY brand/favicon.ico                /app/public/favicon.ico
COPY brand/favicon.svg                /app/public/favicon.svg
# Favicons PNG que exige el <head>
COPY brand/favicon-16x16.png  /app/public/favicon-16x16.png
COPY brand/favicon-32x32.png  /app/public/favicon-32x32.png
COPY brand/favicon-96x96.png  /app/public/favicon-96x96.png


# (opcional) logo del widget embebido
COPY brand/logo.svg               /app/app/javascript/widget/assets/images/logo.svg

# Vars de build
ENV RAILS_ENV=production NODE_ENV=production \
    SECRET_KEY_BASE=dummy_key_for_build_only \
    DISABLE_DATABASE_ENVIRONMENT_CHECK=1 \
    RAILS_SERVE_STATIC_FILES=true \
    NODE_OPTIONS="--max-old-space-size=4096" \
    GENERATE_SOURCEMAP=false \
    HUSKY=0

# Dependencias front y precompile
RUN rm -rf node_modules .pnpm-store || true
RUN pnpm install --no-frozen-lockfile --prefer-offline
RUN bundle exec rake assets:precompile

# --- RUNTIME STAGE ---
FROM chatwoot/chatwoot:latest AS runtime
WORKDIR /app
USER root

# Estáticos que sirve la app
COPY --from=build /app/public/assets        /app/public/assets
COPY --from=build /app/public/packs         /app/public/packs
COPY --from=build /app/public/vite          /app/public/vite
COPY --from=build /app/public/brand-assets  /app/public/brand-assets

# PWA / manifests / favicons
COPY --from=build /app/public/apple-touch-icon.png        /app/public/apple-touch-icon.png
COPY --from=build /app/public/android-chrome-192x192.png  /app/public/android-chrome-192x192.png
COPY --from=build /app/public/android-chrome-512x512.png  /app/public/android-chrome-512x512.png
COPY --from=build /app/public/android-icon-144x144.png    /app/public/android-icon-144x144.png
COPY --from=build /app/public/ms-icon-144x144.png         /app/public/ms-icon-144x144.png
COPY --from=build /app/public/mstile-144x144.png          /app/public/mstile-144x144.png
COPY --from=build /app/public/site.webmanifest            /app/public/site.webmanifest
COPY --from=build /app/public/manifest.json               /app/public/manifest.json
COPY --from=build /app/public/favicon.ico                 /app/public/favicon.ico
COPY --from=build /app/public/favicon-16x16.png           /app/public/favicon-16x16.png
COPY --from=build /app/public/favicon-32x32.png           /app/public/favicon-32x32.png
COPY --from=build /app/public/favicon-96x96.png           /app/public/favicon-96x96.png
COPY --from=build /app/public/favicon.svg                 /app/public/favicon.svg

# Permisos runtime
RUN mkdir -p /app/tmp/pids /app/tmp/cache /app/log /app/storage /app/public/packs /app/public/vite && \
    chown -R 1001:1001 /app && \
    chmod -R u+rwX,g+rwX /app/tmp /app/log /app/storage

USER 1001
