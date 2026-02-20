#!/bin/sh
set -e

CONTROLLER="/app/app/controllers/api/v1/accounts/conversations_controller.rb"

# Backup
cp "$CONTROLLER" "${CONTROLLER}.original"

# Agregar before_action si no existe
if ! grep -q "restrict_all_conversations_access" "$CONTROLLER"; then
    # Buscar la línea con check_authorization y agregar después
    awk '/before_action :check_authorization/ {
        print $0
        print "  before_action :restrict_all_conversations_access, only: [:index]"
        next
    }
    {print}' "$CONTROLLER" > "${CONTROLLER}.tmp"
    mv "${CONTROLLER}.tmp" "$CONTROLLER"
fi

# Agregar método privado si no existe
if ! grep -q "def restrict_all_conversations_access" "$CONTROLLER"; then
    # Buscar "private" y agregar el método después
    awk '/^  private$/ {
        print $0
        print ""
        print "  def restrict_all_conversations_access"
        print "    return if current_user.administrator?"
        print ""
        print "    if params[:assignee_type] == '\''all'\''"
        print "      params[:assignee_type] = '\''me'\''"
        print "      Rails.logger.info \"LYVIO: Non-admin user #{current_user.id} restricted from all conversations\""
        print "    end"
        print "  end"
        next
    }
    {print}' "$CONTROLLER" > "${CONTROLLER}.tmp"
    mv "${CONTROLLER}.tmp" "$CONTROLLER"
fi

echo "✅ Controller patched successfully"
