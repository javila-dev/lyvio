#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$PROJECT_DIR/logs/brand-cron.log"

mkdir -p "$PROJECT_DIR/logs"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "🎨 Iniciando aplicación de branding..."

cd "$PROJECT_DIR"

CONTAINER_NAME="chatwoot-lyvio"

# Aplicar branding
docker exec "$CONTAINER_NAME" bundle exec rails runner -e production "
  configs = {
    'BRAND_NAME' => 'Lyvio',
    'INSTALLATION_NAME' => 'Lyvio',
    'BRAND_URL' => 'https://lyvio.io',
    'WIDGET_BRAND_URL' => 'https://lyvio.io'
  }
  
  configs.each do |key, value|
    c = InstallationConfig.find_or_initialize_by(name: key)
    old_value = c.value
    c.value = value
    c.locked = false
    
    if c.save
      if old_value != value
        puts \"✅ #{key}: #{old_value} → #{value}\"
      else
        puts \"✓ #{key}: sin cambios\"
      end
    else
      puts \"❌ Error guardando #{key}\"
    end
  end
  
  GlobalConfig.clear_cache if defined?(GlobalConfig)
  Rails.cache.clear if Rails.cache
  
  puts '✅ Branding aplicado exitosamente'
" 2>&1 | tee -a "$LOG_FILE"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    log "✅ Branding aplicado correctamente"
else
    log "❌ Error al aplicar branding (código: $EXIT_CODE)"
fi

exit $EXIT_CODE
