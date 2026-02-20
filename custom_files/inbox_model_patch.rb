# =============================================
  # LYVIO CUSTOMIZATION: WhatsApp Auto-Registration
  # Callback para trigger automático de registro WhatsApp
  # =============================================
  after_create :trigger_whatsapp_registration, if: :whatsapp_channel?

  private

  def trigger_whatsapp_registration
    return unless channel_type == 'Channel::Whatsapp'
    return unless ENV['WHATSAPP_REGISTRATION_WEBHOOK'].present?
    
    Rails.logger.info "[LYVIO] Triggering WhatsApp registration for inbox #{id}"
    WhatsappRegistrationJob.perform_later(self.id)
  rescue => e
    Rails.logger.error "[LYVIO] Failed to trigger WhatsApp registration for inbox #{id}: #{e.message}"
  end

  def whatsapp_channel?
    channel_type == 'Channel::Whatsapp'
  end
  
  # =============================================
  # END LYVIO CUSTOMIZATION
  # =============================================