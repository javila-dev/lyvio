<script setup>
import { computed, ref } from 'vue';
import Auth from 'dashboard/api/auth';
import { useMapGetter } from 'dashboard/composables/store';
import { useI18n } from 'vue-i18n';
import Avatar from 'next/avatar/Avatar.vue';
import Icon from 'dashboard/components-next/icon/Icon.vue';
import Spinner from 'next/spinner/Spinner.vue';
import SidebarProfileMenuStatus from './SidebarProfileMenuStatus.vue';
import { FEATURE_FLAGS } from 'dashboard/featureFlags';
import { useAdmin } from 'dashboard/composables/useAdmin';

import {
  DropdownContainer,
  DropdownBody,
  DropdownSeparator,
  DropdownItem,
} from 'next/dropdown-menu/base';
import CustomBrandPolicyWrapper from '../../components/CustomBrandPolicyWrapper.vue';

defineProps({
  isCollapsed: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'openKeyShortcutModal']);

defineOptions({
  inheritAttrs: false,
});

const { t } = useI18n();

const currentUser = useMapGetter('getCurrentUser');
const currentUserAvailability = useMapGetter('getCurrentUserAvailability');
const accountId = useMapGetter('getCurrentAccountId');
const globalConfig = useMapGetter('globalConfig/get');
const isFeatureEnabledonAccount = useMapGetter(
  'accounts/isFeatureEnabledonAccount'
);
const { isAdmin } = useAdmin();

const showChatSupport = computed(() => {
  return (
    isFeatureEnabledonAccount.value(
      accountId.value,
      FEATURE_FLAGS.CONTACT_CHATWOOT_SUPPORT_TEAM
    ) && globalConfig.value.chatwootInboxToken
  );
});

const toggleChatSupport = () => {
  if (window.$chatwoot) {
    window.$chatwoot.toggle();
  }
};

// ========================================
// LYVIO SSO: Acceso a la plataforma de administración
// ========================================
const LYVIO_SSO_WEBHOOK = 'https://n8n.2asoft.tech/webhook/lyvio-platform-sso';
const isConnectingToAdmin = ref(false);

const initiateLyvioSSO = () => {
  isConnectingToAdmin.value = true;

  try {
    const cookies = document.cookie.split('; ');
    const sessionCookie = cookies.find(row =>
      row.startsWith('cw_d_session_info=')
    );

    if (!sessionCookie) {
      window.alert(
        'No se pudo obtener la sesión de Chatwoot.\n\nPor favor recarga la página e intenta de nuevo.'
      );
      isConnectingToAdmin.value = false;
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
      isConnectingToAdmin.value = false;
      return;
    }

    const requestId = `sso-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 15)}`;

    fetch(LYVIO_SSO_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: session['access-token'],
        client: session.client || '',
        uid: session.uid,
        user_email: session.uid,
        user_role: 'administrator',
        account_id: accountId.value || '',
        timestamp: Date.now(),
        request_id: requestId,
        user_agent: navigator.userAgent,
        source: 'lyvio_web_admin',
        redirect_to: 'admin_dashboard',
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
          // Dejamos isConnectingToAdmin en true: la página está por navegar
          // fuera, así que el spinner sigue visible hasta que eso ocurra.
          window.location.href = data.redirect_url;
        } else if (data && data.error) {
          window.alert(`Error de autenticación: ${data.error}`);
          isConnectingToAdmin.value = false;
        } else if (data) {
          isConnectingToAdmin.value = false;
        }
      })
      .catch(() => {
        window.alert(
          'Error al conectar con el servidor.\n\nPor favor intenta de nuevo.'
        );
        isConnectingToAdmin.value = false;
      });
  } catch (error) {
    window.alert(
      'Error al iniciar sesión en administración.\n\nPor favor contacta soporte.'
    );
    isConnectingToAdmin.value = false;
  }
};

const menuItems = computed(() => {
  return [
    {
      show: showChatSupport.value,
      showOnCustomBrandedInstance: false,
      label: t('SIDEBAR_ITEMS.CONTACT_SUPPORT'),
      icon: 'i-lucide-life-buoy',
      click: toggleChatSupport,
    },
    {
      show: true,
      showOnCustomBrandedInstance: true,
      label: t('SIDEBAR_ITEMS.KEYBOARD_SHORTCUTS'),
      icon: 'i-lucide-keyboard',
      click: () => {
        emit('openKeyShortcutModal');
      },
    },
    {
      show: true,
      showOnCustomBrandedInstance: true,
      label: t('SIDEBAR_ITEMS.PROFILE_SETTINGS'),
      icon: 'i-lucide-user-pen',
      link: { name: 'profile_settings_index' },
    },
    {
      id: 'lyvio-admin',
      show: isAdmin.value,
      showOnCustomBrandedInstance: true,
      label: 'Administración',
      icon: 'i-lucide-building-2',
      click: initiateLyvioSSO,
    },
    {
      show: true,
      showOnCustomBrandedInstance: true,
      label: t('SIDEBAR_ITEMS.APPEARANCE'),
      icon: 'i-lucide-palette',
      click: () => {
        const ninja = document.querySelector('ninja-keys');
        ninja.open({ parent: 'appearance_settings' });
      },
    },
    {
      show: true,
      showOnCustomBrandedInstance: false,
      label: t('SIDEBAR_ITEMS.DOCS'),
      icon: 'i-lucide-book',
      link: 'https://www.chatwoot.com/hc/user-guide/en',
      nativeLink: true,
      target: '_blank',
    },
    {
      show: true,
      showOnCustomBrandedInstance: false,
      label: t('SIDEBAR_ITEMS.CHANGELOG'),
      icon: 'i-lucide-scroll-text',
      link: 'https://www.chatwoot.com/changelog/',
      nativeLink: true,
      target: '_blank',
    },
    {
      show: currentUser.value.type === 'SuperAdmin',
      showOnCustomBrandedInstance: true,
      label: t('SIDEBAR_ITEMS.SUPER_ADMIN_CONSOLE'),
      icon: 'i-lucide-castle',
      link: '/super_admin',
      nativeLink: true,
      target: '_blank',
    },
    {
      show: true,
      showOnCustomBrandedInstance: true,
      label: t('SIDEBAR_ITEMS.LOGOUT'),
      icon: 'i-lucide-power',
      click: Auth.logout,
    },
  ];
});

const allowedMenuItems = computed(() => {
  return menuItems.value.filter(item => item.show);
});
</script>

<template>
  <DropdownContainer
    class="relative min-w-0"
    :class="isCollapsed ? 'w-auto' : 'w-full'"
    @close="emit('close')"
  >
    <template #trigger="{ toggle, isOpen }">
      <button
        class="flex gap-2 items-center p-1 text-left rounded-lg cursor-pointer hover:bg-n-alpha-1"
        :class="[
          { 'bg-n-alpha-1': isOpen },
          isCollapsed ? 'justify-center' : 'w-full',
        ]"
        :title="isCollapsed ? currentUser.available_name : undefined"
        @click="toggle"
      >
        <Avatar
          :size="32"
          :name="currentUser.available_name"
          :src="currentUser.avatar_url"
          :status="currentUserAvailability"
          class="flex-shrink-0"
        />
        <div v-if="!isCollapsed" class="min-w-0">
          <div class="text-sm font-medium leading-4 truncate text-n-slate-12">
            {{ currentUser.available_name }}
          </div>
          <div class="text-xs truncate text-n-slate-11">
            {{ currentUser.email }}
          </div>
        </div>
      </button>
    </template>
    <DropdownBody class="bottom-12 z-50 mb-2 w-80 ltr:left-0 rtl:right-0">
      <SidebarProfileMenuStatus />
      <DropdownSeparator />
      <template v-for="item in allowedMenuItems" :key="item.label">
        <CustomBrandPolicyWrapper
          :show-on-custom-branded-instance="item.showOnCustomBrandedInstance"
        >
          <DropdownItem
            v-if="item.id === 'lyvio-admin'"
            preserve-open
            :click="item.click"
          >
            <template #icon>
              <Spinner
                v-if="isConnectingToAdmin"
                :size="16"
                class="text-n-slate-11"
              />
              <Icon
                v-else
                class="size-4 text-n-slate-11"
                :icon="item.icon"
              />
            </template>
            <template #label>
              {{ isConnectingToAdmin ? 'Conectando...' : item.label }}
            </template>
          </DropdownItem>
          <DropdownItem v-else v-bind="item" />
        </CustomBrandPolicyWrapper>
      </template>
    </DropdownBody>
  </DropdownContainer>
</template>
