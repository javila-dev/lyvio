# Lyvio SSO Script Injection
Rails.application.config.after_initialize do
  begin
    layout_path = Rails.root.join('app', 'views', 'layouts', 'vueapp.html.erb')
    
    if File.exist?(layout_path)
      content = File.read(layout_path)
      
      unless content.include?('sso-button.js')
        modified = content.sub(
          '</body>',
          "<!-- Lyvio SSO Script -->\n    <script src=\"/custom-scripts/sso-button.js\" defer></script>\n  </body>"
        )
        
        File.write(layout_path, modified)
        Rails.logger.info "Lyvio SSO: Script inyectado correctamente"
      else
        Rails.logger.info "Lyvio SSO: Script ya esta presente"
      end
    else
      Rails.logger.warn "Lyvio SSO: No se encontro vueapp.html.erb"
    end
  rescue => e
    Rails.logger.error "Lyvio SSO: Error al inyectar script - #{e.message}"
  end
end