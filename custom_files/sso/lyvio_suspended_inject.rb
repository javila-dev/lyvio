# Lyvio Suspended Page Script Injection
Rails.application.config.after_initialize do
  begin
    layout_path = Rails.root.join('app', 'views', 'layouts', 'vueapp.html.erb')
    
    if File.exist?(layout_path)
      content = File.read(layout_path)
      
      unless content.include?('suspended-page.js')
        modified = content.sub(
          '</body>',
          "<!-- Lyvio Suspended Page Script -->\n    <script src=\"/custom-scripts/suspended-page.js\" defer></script>\n  </body>"
        )
        
        File.write(layout_path, modified)
        Rails.logger.info "Lyvio Suspended: Script inyectado correctamente"
      else
        Rails.logger.info "Lyvio Suspended: Script ya esta presente"
      end
    else
      Rails.logger.warn "Lyvio Suspended: No se encontro vueapp.html.erb"
    end
  rescue => e
    Rails.logger.error "Lyvio Suspended: Error al inyectar script - #{e.message}"
  end
end