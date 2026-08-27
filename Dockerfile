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
# LYVIO BRANDING: Parchear installation_config.yml (fuente del seed)
# Esto evita que db:chatwoot_prepare re-seedee con "Chatwoot"
# ========================================
RUN sed -i \
    -e 's/value: Chatwoot$/value: Lyvio/g' \
    -e "s/value: 'Chatwoot'$/value: 'Lyvio'/g" \
    /app/config/installation_config.yml && \
    echo "=== LYVIO: Verificando installation_config.yml ===" && \
    grep -A1 "name: INSTALLATION_NAME" /app/config/installation_config.yml && \
    grep -A1 "name: BRAND_NAME" /app/config/installation_config.yml && \
    echo "=== installation_config.yml parcheado ==="

# ========================================
# LYVIO CUSTOMIZATION: Ocultar tab "Todos" para agentes
# ========================================

# Copiar archivos modificados
COPY custom_files/patches/permissions.js \
     /app/app/javascript/dashboard/constants/permissions.js

# Copiar y ejecutar patch del controller
COPY custom_files/patches/controller_patch.sh /tmp/controller_patch.sh
RUN sed -i 's/\r$//' /tmp/controller_patch.sh && \
    chmod +x /tmp/controller_patch.sh && \
    /tmp/controller_patch.sh && \
    rm /tmp/controller_patch.sh

# Verificar cambios aplicados
RUN echo "=== LYVIO: Verificando modificaciones ===" && \
    grep -A2 "all: {" /app/app/javascript/dashboard/constants/permissions.js && \
    grep "restrict_all_conversations_access" /app/app/controllers/api/v1/accounts/conversations_controller.rb && \
    echo "=== Modificaciones aplicadas correctamente ==="

# ========================================
# LYVIO BILLING: banner de período de gracia (pago fallido)
# Reutiliza el PaymentPendingBanner nativo de Chatwoot (atado a
# isOnChatwootCloud, inactivo en self-hosted) leyendo en cambio los
# custom_attributes que lyvio-platform escribe vía Platform API.
# ========================================

COPY custom_files/patches/Banner.vue \
     /app/app/javascript/dashboard/components/ui/Banner.vue
COPY custom_files/patches/PaymentPendingBanner.vue \
     /app/app/javascript/dashboard/components/app/PaymentPendingBanner.vue

RUN echo "=== LYVIO BILLING: Verificando banner de período de gracia ===" && \
    grep -c "lyvio_billing_status" /app/app/javascript/dashboard/components/app/PaymentPendingBanner.vue && \
    grep -c "actionButtonLoading" /app/app/javascript/dashboard/components/ui/Banner.vue && \
    echo "=== OK ==="

# ========================================
# LYVIO SSO: Botón "Administración" en el menú de perfil
# NOTA: Chatwoot rediseñó el sidebar (components-next), la vieja inyección
# por DOM (sso-button.js buscando "ul.sidebar-group-children") dejó de
# funcionar porque esas clases ya no existen. Ahora se parchea el
# componente Vue oficial del menú de perfil directamente en build-time.
# ========================================

COPY custom_files/patches/SidebarProfileMenu.vue \
     /app/app/javascript/dashboard/components-next/sidebar/SidebarProfileMenu.vue

RUN echo "=== LYVIO SSO: Verificando patch de SidebarProfileMenu.vue ===" && \
    grep -A2 "initiateLyvioSSO" /app/app/javascript/dashboard/components-next/sidebar/SidebarProfileMenu.vue && \
    echo "=== SidebarProfileMenu.vue parcheado correctamente ==="

RUN mkdir -p /app/public/custom-scripts

# ========================================
# LYVIO SUSPENDED PAGE
# ========================================

COPY custom_files/sso/suspended-page.js /app/public/custom-scripts/suspended-page.js
COPY custom_files/sso/lyvio_suspended_inject.rb /app/config/initializers/lyvio_suspended_inject.rb

RUN echo "=== LYVIO SUSPENDED: Verificando instalación ===" && \
    ls -la /app/public/custom-scripts/ && \
    echo "=== Script Suspended Page instalado correctamente ==="

# ========================================
# LYVIO BOTS PAGE
# ========================================

COPY custom_files/sso/bots-page.js /app/public/custom-scripts/bots-page.js
COPY custom_files/sso/lyvio_bots_inject.rb /app/config/initializers/lyvio_bots_inject.rb

RUN echo "=== LYVIO BOTS: Verificando instalación ===" && \
    ls -la /app/public/custom-scripts/ && \
    echo "=== Script Bots Page instalado correctamente ==="

# ========================================
# LYVIO BRANDING: initializer (boot) + job programado (cada 5 min)
# Sobreescribe INSTALLATION_NAME/BRAND_NAME por si acaso el seed corre con
# imagen vieja, y se re-verifica periódicamente por si se revierte en caliente.
# ========================================

COPY custom_files/branding/lyvio_branding.rb /app/config/initializers/lyvio_branding.rb
COPY custom_files/branding/lyvio_enforce_branding_job.rb /app/app/jobs/lyvio_enforce_branding_job.rb

RUN cat >> /app/config/schedule.yml << 'EOF'

# executed every 5 minutes as a safety net in case INSTALLATION_NAME/BRAND_NAME
# ever drifts back to the Chatwoot defaults while the process keeps running
lyvio_enforce_branding_job:
  cron: '*/5 * * * *'
  class: 'LyvioEnforceBrandingJob'
  queue: scheduled_jobs
EOF

RUN echo "=== LYVIO BRANDING: Verificando job + schedule ===" && \
    grep -A3 "lyvio_enforce_branding_job" /app/config/schedule.yml && \
    grep -c "class LyvioEnforceBrandingJob" /app/app/jobs/lyvio_enforce_branding_job.rb && \
    echo "=== OK ==="

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

# Copiar installation_config.yml parcheado (evita re-seed con "Chatwoot")
COPY --from=build /app/config/installation_config.yml \
                  /app/config/installation_config.yml

# Copiar initializers
COPY --from=build /app/config/initializers/lyvio_suspended_inject.rb \
                  /app/config/initializers/lyvio_suspended_inject.rb
COPY --from=build /app/config/initializers/lyvio_bots_inject.rb \
                  /app/config/initializers/lyvio_bots_inject.rb
COPY --from=build /app/config/initializers/lyvio_branding.rb \
                  /app/config/initializers/lyvio_branding.rb
COPY --from=build /app/app/jobs/lyvio_enforce_branding_job.rb \
                  /app/app/jobs/lyvio_enforce_branding_job.rb
COPY --from=build /app/config/schedule.yml \
                  /app/config/schedule.yml

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