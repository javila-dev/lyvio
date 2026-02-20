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
COPY brand/android-icon-144x144.png   /app/public/android-icon-144x144.png
COPY brand/ms-icon-144x144.png        /app/public/ms-icon-144x144.png
COPY brand/ms-icon-144x144.png        /app/public/mstile-144x144.png
COPY brand/site.webmanifest           /app/public/site.webmanifest
COPY brand/site.webmanifest           /app/public/manifest.json
COPY brand/favicon.ico                /app/public/favicon.ico
COPY brand/favicon.svg                /app/public/favicon.svg
COPY brand/favicon-16x16.png  /app/public/favicon-16x16.png
COPY brand/favicon-32x32.png  /app/public/favicon-32x32.png
COPY brand/favicon-96x96.png  /app/public/favicon-96x96.png

# Logo del widget embebido
COPY brand/logo.svg               /app/app/javascript/widget/assets/images/logo.svg

# ========================================
# LYVIO CUSTOMIZATION: Ocultar tab "Todos" para agentes
# ========================================

# Copiar archivos modificados
COPY custom_files/patches/permissions.js \
     /app/app/javascript/dashboard/constants/permissions.js

# Copiar y ejecutar patch del controller
COPY custom_files/patches/controller_patch.sh /tmp/controller_patch.sh
RUN chmod +x /tmp/controller_patch.sh && \
    /tmp/controller_patch.sh && \
    rm /tmp/controller_patch.sh

# Verificar cambios aplicados
RUN echo "=== LYVIO: Verificando modificaciones ===" && \
    grep -A2 "all: {" /app/app/javascript/dashboard/constants/permissions.js && \
    grep "restrict_all_conversations_access" /app/app/controllers/api/v1/accounts/conversations_controller.rb && \
    echo "=== Modificaciones aplicadas correctamente ==="

# ========================================
# LYVIO SSO: Script de autenticación con Platform
# ========================================

# Crear directorio para scripts personalizados
RUN mkdir -p /app/public/custom-scripts

# Copiar el script SSO
COPY custom_files/sso/sso-button.js /app/public/custom-scripts/sso-button.js

# Copiar el initializer de Rails para inyectar el script
COPY custom_files/sso/lyvio_sso_inject.rb /app/config/initializers/lyvio_sso_inject.rb

# Verificar que el script se copió
RUN echo "=== LYVIO SSO: Verificando instalación ===" && \
    ls -la /app/public/custom-scripts/ && \
    cat /app/config/initializers/lyvio_sso_inject.rb && \
    echo "=== Script SSO instalado correctamente ==="

# ========================================
# LYVIO SUSPENDED PAGE: Script de redirección a pago
# ========================================

# Copiar el script para página suspendida
COPY custom_files/sso/suspended-page.js /app/public/custom-scripts/suspended-page.js

# Copiar el initializer de Rails para inyectar el script
COPY custom_files/sso/lyvio_suspended_inject.rb /app/config/initializers/lyvio_suspended_inject.rb

# Verificar que el script se copió
RUN echo "=== LYVIO SUSPENDED: Verificando instalación ===" && \
    ls -la /app/public/custom-scripts/ && \
    cat /app/config/initializers/lyvio_suspended_inject.rb && \
    echo "=== Script Suspended Page instalado correctamente ==="

# ========================================
# LYVIO BOTS PAGE: Botón entrenar bot
# ========================================

# Copiar el script para página de bots
COPY custom_files/sso/bots-page.js /app/public/custom-scripts/bots-page.js

# Copiar el initializer de Rails para inyectar el script
COPY custom_files/sso/lyvio_bots_inject.rb /app/config/initializers/lyvio_bots_inject.rb

# Verificar que el script se copió
RUN echo "=== LYVIO BOTS: Verificando instalación ===" && \
    ls -la /app/public/custom-scripts/ && \
    cat /app/config/initializers/lyvio_bots_inject.rb && \
    echo "=== Script Bots Page instalado correctamente ==="

# ========================================
# FIN LYVIO CUSTOMIZATION
# ========================================

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

# Copiar archivos modificados del build stage
COPY --from=build /app/app/javascript/dashboard/constants/permissions.js \
                  /app/app/javascript/dashboard/constants/permissions.js
COPY --from=build /app/app/controllers/api/v1/accounts/conversations_controller.rb \
                  /app/app/controllers/api/v1/accounts/conversations_controller.rb

# Copiar configuración SSO
COPY --from=build /app/config/initializers/lyvio_sso_inject.rb \
                  /app/config/initializers/lyvio_sso_inject.rb

# Copiar configuración Suspended Page
COPY --from=build /app/config/initializers/lyvio_suspended_inject.rb \
                  /app/config/initializers/lyvio_suspended_inject.rb

# Copiar configuración Bots Page
COPY --from=build /app/config/initializers/lyvio_bots_inject.rb \
                  /app/config/initializers/lyvio_bots_inject.rb

# Estáticos que sirve la app
COPY --from=build /app/public/assets        /app/public/assets
COPY --from=build /app/public/packs         /app/public/packs
COPY --from=build /app/public/vite          /app/public/vite
COPY --from=build /app/public/brand-assets  /app/public/brand-assets
COPY --from=build /app/public/custom-scripts /app/public/custom-scripts

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
RUN mkdir -p /app/tmp/pids /app/tmp/cache /app/log /app/storage /app/public/packs /app/public/vite /app/public/custom-scripts && \
    chown -R 1001:1001 /app && \
    chmod -R u+rwX,g+rwX /app/tmp /app/log /app/storage

USER 1001