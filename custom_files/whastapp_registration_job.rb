class WhatsappRegistrationJob < ApplicationJob
  queue_as :high
  retry_on StandardError, wait: 30.seconds, attempts: 3

  def perform(inbox_id)
    inbox = Inbox.find(inbox_id)
    return unless inbox.channel_type == 'Channel::Whatsapp'

    webhook_url = ENV['WHATSAPP_REGISTRATION_WEBHOOK']
    return unless webhook_url.present?

    # Verificar que tenemos todos los datos necesarios
    provider_config = inbox.channel.provider_config
    return unless provider_config['phone_number_id'].present?
    return unless provider_config['api_key'].present?

    payload = {
      account_id: inbox.account_id,
      inbox_id: inbox.id,
      phone_number_id: provider_config['phone_number_id'],
      access_token: provider_config['api_key'],
      phone_number: inbox.channel.phone_number,
      inbox_name: inbox.name,
      business_account_id: provider_config['business_account_id'],
      chatwoot_url: ENV['FRONTEND_URL'] || 'app.lyvio.io',
      triggered_at: Time.current.iso8601
    }

    response = HTTParty.post(webhook_url, {
      body: payload.to_json,
      headers: { 
        'Content-Type' => 'application/json',
        'X-Chatwoot-Event' => 'whatsapp.inbox.created',
        'X-Request-ID' => SecureRandom.uuid,
        'X-Lyvio-Source' => 'chatwoot-embedded-signup'
      },
      timeout: 30
    })

    if response.success?
      Rails.logger.info "[LYVIO] WhatsApp registration webhook successful for inbox #{inbox_id}: #{response.code}"
    else
      Rails.logger.warn "[LYVIO] WhatsApp registration webhook failed for inbox #{inbox_id}: #{response.code} - #{response.body}"
      raise "Webhook failed with status #{response.code}"
    end

  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.error "[LYVIO] Inbox #{inbox_id} not found for WhatsApp registration"
  rescue => e
    Rails.logger.error "[LYVIO] WhatsApp registration webhook failed for inbox #{inbox_id}: #{e.message}"
    raise e # Para que Sidekiq reintente
  end
end