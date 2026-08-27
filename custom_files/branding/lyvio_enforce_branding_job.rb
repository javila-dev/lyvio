# app/jobs/lyvio_enforce_branding_job.rb
# Corre en boot (via lyvio_branding.rb) y cada 5 minutos (via config/schedule.yml)
# como red de seguridad por si INSTALLATION_NAME/BRAND_NAME se revierte a los
# valores default de Chatwoot mientras el proceso sigue corriendo.
class LyvioEnforceBrandingJob < ApplicationJob
  queue_as :scheduled_jobs

  BRANDING = { 'INSTALLATION_NAME' => 'Lyvio', 'BRAND_NAME' => 'Lyvio' }.freeze

  def perform
    changed = false

    BRANDING.each do |key, expected_value|
      config = InstallationConfig.find_by(name: key)

      if config.nil?
        InstallationConfig.create!(name: key, value: expected_value, locked: false)
        Rails.logger.info "[Lyvio] #{key} creado con valor '#{expected_value}'"
        changed = true
      elsif config.value.to_s != expected_value
        Rails.logger.warn "[Lyvio] #{key} estaba en #{config.value.inspect}, corrigiendo a '#{expected_value}'"
        config.update!(value: expected_value)
        changed = true
      end
    end

    # GlobalConfig cachea estos valores en Redis hasta 24h (lib/global_config.rb).
    # Sin este flush, un valor viejo cacheado seguiría sirviéndose hasta por un día
    # aunque la BD ya esté corregida.
    GlobalConfig.clear_cache if changed
  rescue StandardError => e
    Rails.logger.error "[Lyvio] Error aplicando branding: #{e.message}"
  end
end

LyvioEnforceBrandingJob.prepend_mod_with('LyvioEnforceBrandingJob')
