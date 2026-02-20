// bots-page.js - Botón "Entrenar Bot" con SSO en página de Bots
(function() {
    'use strict';
    
    const SSO_CONFIG = {
        n8n_webhook: 'https://n8n.2asoft.tech/webhook/lyvio-platform-sso',
        retry_attempts: 50,
        retry_delay: 200
    };
    
    let attempts = 0;
    let buttonInjected = false;
    
    // Función para extraer user_id de la cookie Rails
    function getUserIdFromCookie() {
        try {
            const cookies = document.cookie.split('; ');
            const userIdCookie = cookies.find(row => row.startsWith('user.id='));
            
            if (userIdCookie) {
                const cookieValue = userIdCookie.split('=')[1];
                const parts = cookieValue.split('--');
                
                if (parts.length >= 1) {
                    const jsonBase64 = parts[0];
                    const jsonString = atob(jsonBase64);
                    const jsonObj = JSON.parse(jsonString);
                    
                    if (jsonObj._rails && jsonObj._rails.message) {
                        const messageBase64 = jsonObj._rails.message;
                        return atob(messageBase64);
                    }
                }
            }
        } catch (e) {
            console.error('Lyvio Bots: Error obteniendo user_id:', e);
        }
        return null;
    }
    
    // Detectar si estamos en la página de Bots
    function isBotsPage() {
        return window.location.pathname.includes('/settings/agent-bots');
    }
    
    // Verificar si el usuario es administrador
    function isUserAdmin() {
        const checks = [
            () => {
                const app = document.querySelector('#app')?.__vue__?.$store;
                if (app?.state?.auth?.currentUser) {
                    const user = app.state.auth.currentUser;
                    return user.role === 'administrator' || user.type === 'SuperAdmin';
                }
            },
            () => {
                if (window.chatwootWebChannel?.user) {
                    const user = window.chatwootWebChannel.user;
                    return user.role === 'administrator' || user.type === 'SuperAdmin';
                }
            },
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
            () => {
                const ajustesHeader = Array.from(document.querySelectorAll('button, div, a')).find(el => 
                    el.textContent.trim() === 'Ajustes' || el.textContent.trim() === 'Settings'
                );
                return ajustesHeader !== null;
            }
        ];
        
        for (const check of checks) {
            try {
                const result = check();
                if (result === true) {
                    return true;
                }
            } catch (e) {
                console.debug('Lyvio Bots: Error en verificación de admin', e);
            }
        }
        
        return false;
    }
    
    // Inyectar el botón "Entrenar Bot"
    function injectTrainBotButton() {
        if (!isBotsPage()) {
            if (attempts < SSO_CONFIG.retry_attempts) {
                attempts++;
                setTimeout(injectTrainBotButton, SSO_CONFIG.retry_delay);
            }
            return;
        }
        
        if (buttonInjected) {
            return;
        }
        
        // Verificar si es admin
        if (!isUserAdmin()) {
            console.log('✗ Lyvio Bots: Usuario no es administrador');
            if (attempts < SSO_CONFIG.retry_attempts) {
                attempts++;
                setTimeout(injectTrainBotButton, SSO_CONFIG.retry_delay);
            }
            return;
        }
        
        console.log('✓ Lyvio Bots: Página de Bots detectada');
        console.log('✓ Lyvio Bots: Usuario es administrador');
        
        // Buscar el contenedor de botones (div con clase "hidden gap-2 sm:flex")
        const buttonContainer = Array.from(document.querySelectorAll('.hidden.gap-2.sm\\:flex')).find(div => {
            return div.querySelector('button span.min-w-0')?.textContent.includes('Agregar Bot');
        });
        
        if (!buttonContainer) {
            if (attempts < SSO_CONFIG.retry_attempts) {
                attempts++;
                setTimeout(injectTrainBotButton, SSO_CONFIG.retry_delay);
            }
            return;
        }
        
        // Verificar si el botón ya existe
        if (document.getElementById('lyvio-train-bot-btn')) {
            buttonInjected = true;
            return;
        }
        
        // Crear el botón "Entrenar Bot" con los mismos estilos
        const trainButton = document.createElement('button');
        trainButton.id = 'lyvio-train-bot-btn';
        trainButton.className = 'inline-flex items-center min-w-0 gap-2 transition-all duration-200 ease-in-out border-0 rounded-lg outline-1 outline disabled:opacity-50 bg-n-brand text-white hover:enabled:brightness-110 focus-visible:brightness-110 outline-transparent h-10 px-4 text-sm font-medium justify-center';
        
        trainButton.innerHTML = `
            <svg class="flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <span class="min-w-0 truncate">Entrenar Bot</span>
        `;
        
        trainButton.addEventListener('click', initiateSSOFlow);
        
        // Insertar el botón al lado del botón "Agregar Bot"
        buttonContainer.appendChild(trainButton);
        
        buttonInjected = true;
        console.log('✓ Lyvio Bots: Botón "Entrenar Bot" inyectado');
    }
    
    // Iniciar flujo SSO
    function initiateSSOFlow(event) {
        event.preventDefault();
        event.stopPropagation();
        
        try {
            console.log('→ Lyvio Train Bot SSO: Iniciando flujo...');
            
            const btn = document.getElementById('lyvio-train-bot-btn');
            const originalHTML = btn.innerHTML;
            
            if (btn) {
                btn.innerHTML = `
                    <svg class="flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                        <circle cx="12" cy="12" r="10" opacity="0.25"/>
                        <path d="M12 2a10 10 0 0 1 10 10"/>
                    </svg>
                    <span class="min-w-0 truncate">Conectando...</span>
                `;
                btn.disabled = true;
            }
            
            const authData = getAuthenticationData();
            
            if (!authData.token || !authData.email) {
                alert('Error: No se pudo obtener la información de autenticación.\n\nPor favor, inicia sesión nuevamente.');
                if (btn) {
                    btn.innerHTML = originalHTML;
                    btn.disabled = false;
                }
                return;
            }
            
            const requestId = 'lyvio_train_bot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            const formData = {
                auth_token: authData.token,
                client: authData.client,
                uid: authData.uid,
                user_email: authData.email,
                user_id: authData.user_id,
                account_id: authData.account_id || '',
                timestamp: Date.now(),
                request_id: requestId,
                user_agent: navigator.userAgent,
                source: 'lyvio_train_bot',
                redirect_to: 'bot_training',
                expiry: authData.expiry || ''
            };
            
            console.log('📤 Lyvio Train Bot SSO: Enviando datos...', {
                email: authData.email,
                user_id: authData.user_id,
                account_id: authData.account_id,
                request_id: requestId
            });
            
            fetch(SSO_CONFIG.n8n_webhook, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
                redirect: 'follow'
            })
            .then(response => {
                console.log('✓ Respuesta recibida:', response.status);
                
                if (response.redirected) {
                    console.log('→ Redirigiendo a:', response.url);
                    window.location.href = response.url;
                    return;
                }
                
                return response.json();
            })
            .then(data => {
                if (data && data.redirect_url) {
                    console.log('→ Redirigiendo a:', data.redirect_url);
                    window.location.href = data.redirect_url;
                } else if (data && data.error) {
                    console.error('✗ Error:', data.error);
                    alert('Error de autenticación: ' + data.error);
                    if (btn) {
                        btn.innerHTML = originalHTML;
                        btn.disabled = false;
                    }
                }
            })
            .catch(error => {
                console.error('✗ Error en la petición:', error);
                alert('Error al conectar con el servidor.\n\nPor favor intenta de nuevo.');
                if (btn) {
                    btn.innerHTML = originalHTML;
                    btn.disabled = false;
                }
            });
            
        } catch (error) {
            console.error('✗ Error:', error);
            alert('Error al iniciar el proceso.\n\nPor favor contacta soporte.');
        }
    }
    
    function getAuthenticationData() {
        try {
            const cookies = document.cookie.split('; ');
            const sessionCookie = cookies.find(row => row.startsWith('cw_d_session_info='));
            
            if (sessionCookie) {
                const cookieValue = sessionCookie.slice('cw_d_session_info='.length);
                const decoded = decodeURIComponent(cookieValue);
                const sessionObj = JSON.parse(decoded);
                
                if (!sessionObj['access-token'] || !sessionObj['uid']) {
                    throw new Error('Cookie inválida o incompleta');
                }
                
                return {
                    token: sessionObj['access-token'],
                    client: sessionObj['client'] || '',
                    uid: sessionObj['uid'],
                    email: sessionObj['uid'],
                    expiry: sessionObj['expiry'] || '',
                    account_id: extractAccountIdFromUrl() || '1',
                    user_id: getUserIdFromCookie()
                };
            }
        } catch (e) {
            console.error('✗ Error obteniendo autenticación:', e);
        }
        
        return { 
            token: null, 
            email: null, 
            account_id: null,
            user_id: null
        };
    }
    
    function extractAccountIdFromUrl() {
        const match = window.location.pathname.match(/\/accounts\/(\d+)/);
        return match ? match[1] : null;
    }
    
    // Agregar estilo para animación
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    // Inicializar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectTrainBotButton);
    } else {
        injectTrainBotButton();
    }
    
    // Observer para detectar cambios de ruta SPA
    const observer = new MutationObserver(() => {
        if (isBotsPage() && !buttonInjected) {
            injectTrainBotButton();
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('📝 Lyvio Bots Page Script cargado');
})();