# config/initializers/lyvio_branding.rb
# Garantiza que INSTALLATION_NAME y BRAND_NAME siempre sean "Lyvio" al boot.
# La corrección recurrente (cada 5 min) vive en LyvioEnforceBrandingJob,
# programado en config/schedule.yml.
Rails.application.config.after_initialize do
  LyvioEnforceBrandingJob.perform_now
rescue StandardError => e
  Rails.logger.warn "[Lyvio] No se pudo aplicar branding en boot: #{e.message}"
end
