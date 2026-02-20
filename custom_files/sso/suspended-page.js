// suspended-page.js - Personalización página cuenta suspendida con SSO
(function() {
    'use strict';
    
    const SSO_CONFIG = {
        n8n_webhook: 'https://n8n.2asoft.tech/webhook/lyvio-platform-sso',
        retry_attempts: 3,
        retry_delay: 1000
    };
    
    let attempts = 0;
    
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
            console.error('Lyvio Suspended: Error obteniendo user_id:', e);
        }
        return null;
    }
    
    // Detectar si estamos en la página de cuenta suspendida
    function isSuspendedPage() {
        // Verificar URL
        if (window.location.pathname.includes('/suspended')) {
            return true;
        }
        
        // Verificar contenido
        const bodyText = document.body.textContent.toLowerCase();
        if (bodyText.includes('suspended') || bodyText.includes('suspendida')) {
            return true;
        }
        
        return false;
    }
    
    function customizeSuspendedPage() {
        if (!isSuspendedPage()) {
            if (attempts < SSO_CONFIG.retry_attempts) {
                attempts++;
                setTimeout(customizeSuspendedPage, SSO_CONFIG.retry_delay);
            }
            return;
        }
        
        console.log('✓ Lyvio: Página de cuenta suspendida detectada');
        console.log('ℹ️  Mostrando botón de pago (n8n verificará permisos de admin)');
        
        // Limpiar contenido existente
        document.body.innerHTML = '';
        
        // Crear nueva estructura
        const wrapper = document.createElement('div');
        wrapper.id = 'lyvio-suspended-wrapper';
        wrapper.style.cssText = `
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f7;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            margin: 0;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 9999;
        `;
        
        const card = document.createElement('div');
        card.style.cssText = `
            background: white;
            border-radius: 12px;
            border: 1px solid #e5e5e5;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            max-width: 480px;
            width: 100%;
            padding: 48px;
            text-align: center;
        `;
        
        card.innerHTML = `
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
            <div style="width: 64px; height: 64px; margin: 0 auto 24px; background: #ff3b30; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            </div>
            <h1 style="color: #1d1d1f; font-size: 32px; font-weight: 600; margin: 0 0 12px 0; letter-spacing: -0.5px;">
                Cuenta Suspendida
            </h1>
            <p style="color: #6e6e73; font-size: 17px; line-height: 1.5; margin: 0 0 32px 0;">
                Tu cuenta ha sido suspendida debido a un problema con el método de pago. 
                Por favor actualiza tu información para continuar.
            </p>
            <button id="lyvio-payment-btn" style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                background: #007aff;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 500;
                font-size: 16px;
                cursor: pointer;
                transition: all 0.2s ease;
                min-width: 200px;
                box-shadow: 0 1px 3px rgba(0, 122, 255, 0.3);
            ">
                Actualizar Método de Pago
            </button>
            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e5e5;">
                <p style="color: #86868b; font-size: 14px; margin: 0;">
                    ¿Necesitas ayuda? Contáctanos en<br>
                    <a href="mailto:soporte@lyvio.com" style="color: #007aff; text-decoration: none;">soporte@lyvio.com</a>
                </p>
            </div>
        `;
        
        wrapper.appendChild(card);
        document.body.appendChild(wrapper);
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.overflow = 'hidden';
        
        // Agregar evento al botón
        const btn = document.getElementById('lyvio-payment-btn');
        btn.addEventListener('mouseenter', () => {
            btn.style.background = '#0051d5';
            btn.style.transform = 'translateY(-1px)';
            btn.style.boxShadow = '0 4px 12px rgba(0, 122, 255, 0.4)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.background = '#007aff';
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = '0 1px 3px rgba(0, 122, 255, 0.3)';
        });
        btn.addEventListener('click', initiateSSOFlow);
        
        console.log('✓ Lyvio: Página de cuenta suspendida personalizada');
    }
    
    function initiateSSOFlow() {
        try {
            console.log('→ Lyvio Payment SSO: Iniciando flujo...');
            
            const btn = document.getElementById('lyvio-payment-btn');
            if (btn) {
                btn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; animation: spin 1s linear infinite; vertical-align: middle; margin-right: 8px;">
                        <circle cx="12" cy="12" r="10" opacity="0.25"/>
                        <path d="M12 2a10 10 0 0 1 10 10"/>
                    </svg>
                    Conectando...
                `;
                btn.style.pointerEvents = 'none';
                btn.style.opacity = '0.7';
            }
            
            const authData = getAuthenticationData();
            
            if (!authData.token || !authData.email) {
                alert('Error: No se pudo obtener la información de autenticación.\n\nPor favor, inicia sesión nuevamente.');
                restoreButton();
                return;
            }
            
            const requestId = 'lyvio_payment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
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
                source: 'lyvio_suspended_payment',
                redirect_to: 'billing_update', 
                expiry: authData.expiry || ''
            };
            
            console.log('📤 Lyvio Payment SSO: Enviando datos...', {
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
                    restoreButton();
                }
            })
            .catch(error => {
                console.error('✗ Error en la petición:', error);
                alert('Error al conectar con el servidor.\n\nPor favor intenta de nuevo.');
                restoreButton();
            });
            
        } catch (error) {
            console.error('✗ Error:', error);
            alert('Error al iniciar el proceso.\n\nPor favor contacta soporte.');
            restoreButton();
        }
    }
    
    function restoreButton() {
        const btn = document.getElementById('lyvio-payment-btn');
        if (btn) {
            btn.innerHTML = 'Actualizar Método de Pago';
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
        }
    }
    
    function getAuthenticationData() {
        console.log('🔍 Lyvio Payment SSO: Buscando datos de autenticación...');
        
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
                
                console.log('✓ Datos obtenidos correctamente');
                console.log('  - Email:', sessionObj['uid']);
                console.log('  - Token presente:', !!sessionObj['access-token']);
                
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
    
    // Inicializar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', customizeSuspendedPage);
    } else {
        customizeSuspendedPage();
    }
    
    console.log('📝 Lyvio Suspended Page Script cargado');
})();