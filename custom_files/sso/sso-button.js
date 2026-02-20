// sso-button.js - Botón SSO en Sidebar Admin de Lyvio (Solo Administradores)
(function() {
    'use strict';
    
    const SSO_CONFIG = {
        n8n_webhook: 'https://n8n.2asoft.tech/webhook/lyvio-platform-sso',
        button_text: 'Administración',
        button_id: 'lyvio-sso-admin-btn',
        retry_attempts: 25,
        retry_delay: 800
    };
    
    let attempts = 0;
    
    // Verificar si el usuario es administrador
    function isUserAdmin() {
        const checks = [
            // Desde el store de Vue/Vuex
            () => {
                const app = document.querySelector('#app')?.__vue__?.$store;
                if (app?.state?.auth?.currentUser) {
                    const user = app.state.auth.currentUser;
                    return user.role === 'administrator' || user.type === 'SuperAdmin';
                }
            },
            // Desde window globals
            () => {
                if (window.chatwootWebChannel?.user) {
                    const user = window.chatwootWebChannel.user;
                    return user.role === 'administrator' || user.type === 'SuperAdmin';
                }
            },
            // Desde localStorage
            () => {
                const currentUser = localStorage.getItem('currentUser');
                if (currentUser) {
                    try {
                        const user = JSON.parse(currentUser);
                        return user.role === 'administrator' || user.type === 'SuperAdmin';
                    } catch (e) {
                        return false;
                    }
                }
            },
            // Verificar si el menú de Ajustes está visible (solo admins)
            () => {
                const ajustesHeader = Array.from(document.querySelectorAll('button, div, a')).find(el => 
                    el.textContent.trim() === 'Ajustes' || el.textContent.trim() === 'Settings'
                );
                return ajustesHeader !== null && ajustesHeader !== undefined;
            }
        ];
        
        for (const check of checks) {
            try {
                const result = check();
                if (result === true) {
                    console.log('✓ Lyvio SSO: Usuario identificado como administrador');
                    return true;
                }
            } catch (e) {
                console.debug('Lyvio SSO: Error en verificación de admin', e);
            }
        }
        
        return false;
    }
    
    function addSSOButton() {
        // PRIMERO: Verificar que el usuario sea admin
        if (!isUserAdmin()) {
            console.log('✗ Lyvio SSO: Usuario no es administrador, botón no se mostrará');
            return;
        }
        
        // Verificar si ya existe
        if (document.querySelector(`#${SSO_CONFIG.button_id}`)) {
            return;
        }
        
        // Buscar el UL que contiene los items del menú de Ajustes
        // Según el DOM, es el ul que tiene class "grid m-0 list-none sidebar-group-children"
        let settingsContainer = null;
        
        // Buscar todos los UL con esas clases
        const allULs = document.querySelectorAll('ul.sidebar-group-children');
        
        // El que nos interesa es el que contiene "Configuración de la cuenta"
        for (const ul of allULs) {
            if (ul.textContent.includes('Configuración de la cuenta') || 
                ul.textContent.includes('Account Settings')) {
                settingsContainer = ul;
                console.log('✓ Lyvio SSO: Contenedor de Ajustes encontrado');
                break;
            }
        }
        
        if (!settingsContainer) {
            if (attempts < SSO_CONFIG.retry_attempts) {
                attempts++;
                console.log(`⟳ Lyvio SSO: Reintentando... (${attempts}/${SSO_CONFIG.retry_attempts})`);
                setTimeout(addSSOButton, SSO_CONFIG.retry_delay);
            } else {
                console.warn('✗ Lyvio SSO: No se pudo encontrar el contenedor de Ajustes');
            }
            return;
        }
        
        // Buscar el LI "Configuración de la cuenta" específicamente
        const allItems = Array.from(settingsContainer.querySelectorAll('li'));
        let configItem = null;
        
        for (const item of allItems) {
            // Buscar por el atributo name o por el texto
            const nameAttr = item.getAttribute('name');
            const linkText = item.querySelector('a')?.textContent?.trim();
            const linkHref = item.querySelector('a')?.href;
            
            if (nameAttr?.includes('Settings Account Settings') || 
                nameAttr?.includes('Account Settings') ||
                linkText?.includes('Configuración de la cuenta') ||
                linkText?.includes('Account Settings') ||
                linkHref?.includes('settings/general')) {
                configItem = item;
                console.log('✓ Lyvio SSO: Item "Configuración de la cuenta" encontrado');
                break;
            }
        }
        
        if (!configItem) {
            console.warn('✗ Lyvio SSO: No se encontró el item "Configuración de la cuenta"');
            return;
        }
        
        // Crear el nuevo LI con la estructura EXACTA de Chatwoot
        const ssoItem = document.createElement('li');
        ssoItem.id = SSO_CONFIG.button_id;
        
        // Clases EXACTAS del LI (sin el style inline)
        ssoItem.className = 'py-0.5 ltr:pl-3 rtl:pr-3 rtl:mr-3 ltr:ml-3 relative text-n-slate-11 child-item before:bg-n-slate-4 after:bg-transparent after:border-n-slate-4 before:left-0 rtl:before:right-0';
        ssoItem.setAttribute('name', 'Lyvio SSO Admin');
        
        // Crear el link con la estructura EXACTA
        const ssoLink = document.createElement('a');
        ssoLink.id = 'lyvio-sso-link';
        ssoLink.href = '#';
        ssoLink.title = SSO_CONFIG.button_text;
        
        // Clases EXACTAS del link (SIN las clases de estado activo)
        ssoLink.className = 'flex h-8 items-center gap-2 px-2 py-1 rounded-lg max-w-[9.438rem] hover:bg-gradient-to-r from-transparent via-n-slate-3/70 to-n-slate-3/70 group';
        
        // HTML interno EXACTO
        ssoLink.innerHTML = `<span class="i-lucide-building-2 size-4 inline-block"></span><div class="flex-1 truncate min-w-0">${SSO_CONFIG.button_text}</div>`;
        
        // Agregar el link al LI
        ssoItem.appendChild(ssoLink);
        
        // Click handler
        ssoLink.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            initiateSSOFlow();
        });
        
        // Insertar después de "Configuración de la cuenta"
        if (configItem.nextSibling) {
            settingsContainer.insertBefore(ssoItem, configItem.nextSibling);
        } else {
            settingsContainer.appendChild(ssoItem);
        }
        
        console.log('✓ Lyvio SSO: Botón agregado correctamente después de "Configuración de la cuenta"');
    }
    
    function initiateSSOFlow() {
        try {
            console.log('→ Lyvio SSO: Iniciando flujo de autenticación...');
            
            // Mostrar indicador de carga
            const btn = document.querySelector('#lyvio-sso-link');
            if (btn) {
                const originalHTML = btn.innerHTML;
                btn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;" class="inline-block">
                        <circle cx="12" cy="12" r="10" opacity="0.25"/>
                        <path d="M12 2a10 10 0 0 1 10 10"/>
                    </svg>
                    <div class="flex-1 truncate min-w-0">Conectando...</div>
                `;
                btn.style.pointerEvents = 'none';
                btn.style.opacity = '0.7';
                btn.dataset.originalHtml = originalHTML;
                
                // Agregar animación de spin si no existe
                if (!document.querySelector('#lyvio-sso-spin-style')) {
                    const style = document.createElement('style');
                    style.id = 'lyvio-sso-spin-style';
                    style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
                    document.head.appendChild(style);
                }
            }
            
            // Obtener el token de autenticación
            const authData = getAuthenticationData();
            
            if (!authData.token) {
                console.error('✗ Lyvio SSO: No se pudo obtener el token de sesión');
                alert('No se pudo obtener la sesión de Chatwoot.\n\nPor favor:\n1. Recarga la página\n2. Vuelve a intentar\n3. Si el problema persiste, contacta soporte');
                restoreButton();
                return;
            }
            
            console.log('✓ Lyvio SSO: Token obtenido correctamente');
            console.log('→ Lyvio SSO: Enviando solicitud a n8n...');
            
            // Generar request_id único para prevenir replay attacks
            const requestId = `sso-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            
            // Datos a enviar
            const formData = {
                auth_token: authData.token,
                client: authData.client,
                uid: authData.uid,
                user_email: authData.email || '',
                user_role: authData.role || 'administrator',
                account_id: authData.account_id || '',
                timestamp: Date.now(),
                request_id: requestId,
                user_agent: navigator.userAgent,
                source: 'lyvio_web_admin',
                redirect_to: 'admin_dashboard', 
                expiry: authData.expiry || ''
            };
            
            console.log('📤 Lyvio SSO: Datos a enviar:', {
                email: authData.email,
                account_id: authData.account_id,
                request_id: requestId
            });
            
            // Enviar con fetch API
            fetch(SSO_CONFIG.n8n_webhook, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
                redirect: 'follow'
            })
            .then(response => {
                console.log('✓ Respuesta de n8n recibida:', response.status);
                
                // Si n8n devuelve un redirect, seguirlo
                if (response.redirected) {
                    console.log('→ Redirigiendo a:', response.url);
                    window.location.href = response.url;
                    return;
                }
                
                // Si devuelve JSON con redirect_url
                return response.json();
            })
            .then(data => {
                if (data && data.redirect_url) {
                    console.log('→ Redirigiendo a URL de respuesta:', data.redirect_url);
                    window.location.href = data.redirect_url;
                } else if (data && data.error) {
                    console.error('✗ Error desde n8n:', data.error);
                    alert('Error de autenticación: ' + data.error);
                    restoreButton();
                }
            })
            .catch(error => {
                console.error('✗ Error en la petición:', error);
                alert('Error al conectar con el servidor.\n\nPor favor intenta de nuevo.');
                restoreButton();
            });
            
        } catch (error) {
            console.error('✗ Lyvio SSO Error:', error);
            alert('Error al iniciar SSO.\n\nDetalles: ' + error.message + '\n\nPor favor contacta soporte.');
            restoreButton();
        }
    }
    
    function restoreButton() {
        const btn = document.querySelector('#lyvio-sso-link');
        if (btn && btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
            delete btn.dataset.originalHtml;
        }
    }
    
    function getAuthenticationData() {
        console.log('🔍 Lyvio SSO: Buscando datos de autenticación...');
        
        // PRIORIDAD 1: Leer desde la cookie cw_d_session_info
        try {
            const cookies = document.cookie.split('; ');
            const sessionCookie = cookies.find(row => row.startsWith('cw_d_session_info='));
            
            if (sessionCookie) {
                console.log('✓ Cookie encontrada, procesando...');
                
                // Extraer el valor (todo después de '=')
                const cookieValue = sessionCookie.slice('cw_d_session_info='.length);
                
                // Decodificar URL encoding
                const decoded = decodeURIComponent(cookieValue);
                
                // Parsear JSON - envuelto en try/catch específico
                let sessionObj;
                try {
                    sessionObj = JSON.parse(decoded);
                } catch (parseError) {
                    console.error('✗ Error parseando JSON de cookie:', parseError.message);
                    throw parseError;
                }
                
                // Validar que tengamos los campos necesarios
                if (!sessionObj['access-token']) {
                    throw new Error('Cookie válida pero falta access-token');
                }
                
                if (!sessionObj['uid']) {
                    throw new Error('Cookie válida pero falta uid (email)');
                }
                
                console.log('✓ Lyvio SSO: Datos obtenidos correctamente de cookie');
                console.log('  - Email:', sessionObj['uid']);
                console.log('  - Token presente:', !!sessionObj['access-token']);
                
                return {
                    token: sessionObj['access-token'],
                    client: sessionObj['client'] || '',
                    uid: sessionObj['uid'],
                    email: sessionObj['uid'],
                    expiry: sessionObj['expiry'] || '',
                    role: 'administrator',
                    account_id: extractAccountIdFromUrl() || '1'
                };
            } else {
                console.warn('✗ Cookie cw_d_session_info no encontrada');
            }
        } catch (e) {
            console.error('✗ Error en getAuthenticationData:', e);
            console.error('  Stack:', e.stack);
        }
        
        // Si llegamos aquí, falló la cookie principal
        console.error('✗ Lyvio SSO: No se pudo obtener token de la cookie');
        return { 
            token: null, 
            email: null, 
            role: null, 
            account_id: null 
        };
    }
    
    // Función auxiliar para extraer account_id de la URL
    function extractAccountIdFromUrl() {
        const match = window.location.pathname.match(/\/accounts\/(\d+)/);
        return match ? match[1] : null;
    }
    
    // Observer para cambios en el DOM
    const observer = new MutationObserver(() => {
        if (!document.querySelector(`#${SSO_CONFIG.button_id}`) && isUserAdmin()) {
            attempts = 0;
            addSSOButton();
        }
    });
    
    // Inicializar
    function init() {
        console.log('🚀 Lyvio SSO: Inicializando...');
        
        let checkCount = 0;
        const maxChecks = 60;
        
        const checkAuth = setInterval(() => {
            checkCount++;
            
            if (isUserAdmin()) {
                console.log('✓ Lyvio SSO: Administrador detectado, agregando botón...');
                clearInterval(checkAuth);
                
                setTimeout(() => {
                    addSSOButton();
                    
                    observer.observe(document.body, {
                        childList: true,
                        subtree: true
                    });
                }, 500);
            } else if (checkCount >= maxChecks) {
                console.log('⏱ Lyvio SSO: Timeout - No se detectó administrador');
                clearInterval(checkAuth);
            }
        }, 500);
    }
    
    // Ejecutar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100);
    }
    
    console.log('📝 Lyvio SSO Script cargado');
})();