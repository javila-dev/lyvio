<script>
import { mapGetters } from 'vuex';
import { differenceInCalendarDays } from 'date-fns';
import { useAdmin } from 'dashboard/composables/useAdmin';
import { useAccount } from 'dashboard/composables/useAccount';
import Banner from 'dashboard/components/ui/Banner.vue';

// ========================================
// LYVIO BILLING: banner de período de gracia
// ========================================
// Este componente venía atado a isOnChatwootCloud (banner nativo de Chatwoot
// Cloud, inactivo en self-hosted). Lo reutilizamos leyendo los
// custom_attributes que lyvio-platform escribe en la Account de Chatwoot vía
// Platform API cuando una suscripción entra en 'past_due'
// (ver Subscription._sync_billing_status_to_chatwoot en lyvio-platform).
const N8N_SSO_WEBHOOK = 'https://n8n.2asoft.tech/webhook/lyvio-platform-sso';

const EMPTY_BILLING_INFO = {
  status: null,
  graceEndsAt: null,
};

export default {
  components: { Banner },
  setup() {
    const { isAdmin } = useAdmin();
    const { accountId } = useAccount();

    return {
      accountId,
      isAdmin,
    };
  },
  data() {
    return {
      isConnectingToBilling: false,
    };
  },
  computed: {
    ...mapGetters({
      getAccount: 'accounts/getAccount',
    }),
    billingInfo() {
      const account = this.getAccount(this.accountId);
      if (!account) return EMPTY_BILLING_INFO;

      const { custom_attributes: attrs } = account;
      if (!attrs || !attrs.lyvio_billing_status) return EMPTY_BILLING_INFO;

      return {
        status: attrs.lyvio_billing_status,
        graceEndsAt: attrs.lyvio_billing_grace_ends_at
          ? new Date(attrs.lyvio_billing_grace_ends_at)
          : null,
      };
    },
    daysRemaining() {
      if (!this.billingInfo.graceEndsAt) return null;
      return differenceInCalendarDays(this.billingInfo.graceEndsAt, new Date());
    },
    shouldShowBanner() {
      if (!this.isAdmin) return false;
      if (this.billingInfo.status !== 'past_due') return false;
      return this.daysRemaining !== null && this.daysRemaining >= 0;
    },
    bannerMessage() {
      const days = this.daysRemaining;
      const daysLabel = days === 1 ? '1 día' : `${days} días`;
      return `Tu último pago no pudo procesarse. Tienes ${daysLabel} para actualizar tu método de pago antes de que tu cuenta sea suspendida.`;
    },
    actionButtonMessage() {
      return this.isConnectingToBilling
        ? 'Conectando...'
        : 'Actualizar método de pago';
    },
  },
  methods: {
    routeToBilling() {
      if (this.isConnectingToBilling) return;
      this.isConnectingToBilling = true;

      try {
        const cookies = document.cookie.split('; ');
        const sessionCookie = cookies.find(row =>
          row.startsWith('cw_d_session_info=')
        );

        if (!sessionCookie) {
          window.alert(
            'No se pudo obtener la sesión de Chatwoot.\n\nPor favor recarga la página e intenta de nuevo.'
          );
          this.isConnectingToBilling = false;
          return;
        }

        const decoded = decodeURIComponent(
          sessionCookie.slice('cw_d_session_info='.length)
        );
        const session = JSON.parse(decoded);

        if (!session['access-token'] || !session.uid) {
          window.alert(
            'Sesión inválida.\n\nPor favor recarga la página e intenta de nuevo.'
          );
          this.isConnectingToBilling = false;
          return;
        }

        const requestId = `sso-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 15)}`;

        fetch(N8N_SSO_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auth_token: session['access-token'],
            client: session.client || '',
            uid: session.uid,
            user_email: session.uid,
            user_role: 'administrator',
            account_id: this.accountId || '',
            timestamp: Date.now(),
            request_id: requestId,
            user_agent: navigator.userAgent,
            source: 'lyvio_billing_banner',
            redirect_to: 'billing_update',
            expiry: session.expiry || '',
          }),
          redirect: 'follow',
        })
          .then(response => {
            if (response.redirected) {
              window.location.href = response.url;
              return null;
            }
            return response.json();
          })
          .then(data => {
            if (data && data.redirect_url) {
              window.location.href = data.redirect_url;
            } else if (data && data.error) {
              window.alert(`Error de autenticación: ${data.error}`);
              this.isConnectingToBilling = false;
            } else if (data) {
              this.isConnectingToBilling = false;
            }
          })
          .catch(() => {
            window.alert(
              'Error al conectar con el servidor.\n\nPor favor intenta de nuevo.'
            );
            this.isConnectingToBilling = false;
          });
      } catch (error) {
        window.alert(
          'Error al iniciar el proceso.\n\nPor favor contacta soporte.'
        );
        this.isConnectingToBilling = false;
      }
    },
  },
};
</script>

<!-- eslint-disable-next-line vue/no-root-v-if -->
<template>
  <Banner
    v-if="shouldShowBanner"
    color-scheme="warning"
    :banner-message="bannerMessage"
    :action-button-label="actionButtonMessage"
    :action-button-loading="isConnectingToBilling"
    has-action-button
    @primary-action="routeToBilling"
  />
</template>
