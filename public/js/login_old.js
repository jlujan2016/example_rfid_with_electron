// Lógica del formulario de login
(function(window){
  function qs(sel){ return document.querySelector(sel); }

  function showError(msg){
    const el = qs('#login-error');
    if(el){ el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
  }

  async function submitForm(e){
    alert("entro logeo");
    e && e.preventDefault();
    showError('');
    console.log('login: submitForm start');
    const user = qs('#username').value.trim();
    const pass = qs('#password').value;
    if(!user || !pass){ showError('Ingrese usuario y contraseña'); return; }

    const payload = { username: user, password: pass };

    // Obtener host configurado (async) y construir endpoint
    let host = '';
    if(window.appConfig && typeof window.appConfig.getApiHost === 'function'){
      try{ host = await window.appConfig.getApiHost(); }catch(e){ console.warn('getApiHost error', e); }
    }
    host = (host || '').toString().trim().replace(/\/$/, '');
    const endpoint = host ? (host + '/api/auth/login') : '/api/auth/login';


    try{
      let response = null;
      let data = null;

      // Use centralized makeRequest (main process) which respects configured baseUrl
      if(window.api && typeof window.api.makeRequest === 'function'){
        try{
          const target = host ? (host + '/api/auth/login') : '/api/auth/login';
          response = await window.api.makeRequest(target, 'POST', payload);
          console.debug('login: raw response from makeRequest ->', response);
        }catch(e){
          console.error('api.makeRequest error', e);
          response = null;
        }
      } else {
        // If bridge not present, fail early (we intentionally avoid fetch here)
        showError('No hay bridge `makeRequest` disponible');
        return;
      }

      console.log('login: raw response ->', response);
      if(!response) { showError('Respuesta inválida del servidor'); return; }

      // Normalizar respuesta: algunos endpoints devuelven { success: true } u otros { isSuccess: true }
      let r = response;
      if(response && response.data && typeof response.data === 'object') r = response.data;
      console.debug('login: normalized response (r) ->', r);

      // Consider as ok if explicit flags present OR a token is returned
      const hasToken = !!( (r && (r.token || r.access_token)) || (response && (response.token || response.access_token)) );
      const ok = (r && (r.isSuccess === true || r.success === true)) || hasToken;
      console.debug('login: ok=', ok, 'hasToken=', hasToken);
      if(!ok){ showError(response.error || response.message || (r && r.error) || 'Credenciales inválidas'); return; }

      //Login exitoso, guardar datos de usuario y token
      try{
        // Soportar varias formas de respuesta: response.token, response.data.token, response.access_token
        let token = null;
        // Buscar token en varias ubicaciones (respuesta normalizada en `r` o en la raíz)
        if(r && r.token) token = r.token;
        else if(r && r.access_token) token = r.access_token;
        else if(response && response.token) token = response.token;
        else if(response && response.access_token) token = response.access_token;

        console.debug('login: detected token ->', token);
        if(token){
          // Primero delegar a auth.setSession para que calcule expiry si es JWT
          let computedExpiry = null;
          if(window.auth && typeof window.auth.setSession === 'function'){
            try{ window.auth.setSession(token); const s = window.auth.getSession(); if(s && s.expiry) computedExpiry = s.expiry; }catch(e){ console.warn('auth.setSession/getSession error', e); }
          }

          // Si el backend proporcionó expires_in, usarlo para calcular expiry (preferir `r`)
          if(!computedExpiry && (r.expires_in || response.expires_in)){ computedExpiry = Date.now() + ((r.expires_in || response.expires_in) * 1000); }

          // Fallback expiry
          if(!computedExpiry) computedExpiry = Date.now() + (8 * 3600 * 1000);

          // Construir objeto de sesión completo
          const userObj = response.user || (response.data && response.data.user) || null;
          const sessionObj = {
            token: token,
            token_type: r.token_type || response.token_type || response.access_token_type || 'bearer',
            expires_in: r.expires_in || response.expires_in || null,
            expiry: computedExpiry,
            user: userObj
          };

          // Guardar session completa en el mismo STORAGE_KEY que usa auth
            try{ localStorage.setItem('app_session', JSON.stringify(sessionObj)); console.debug('login: saved app_session'); }catch(e){ console.warn('No se pudo guardar app_session', e); }
            // Asegurar que `auth` también conoce la sesión (consistencia)
            try{ if(window.auth && typeof window.auth.setSession === 'function'){ window.auth.setSession(token); console.debug('login: auth.setSession called'); } }catch(e){ console.warn('login: auth.setSession error', e); }

          // También guardar user por separado (compatibilidad)
          try{ if(userObj) localStorage.setItem('app_user', JSON.stringify(userObj)); }catch(e){ console.warn('No se pudo guardar app_user', e); }

          // Persistir token en la configuración del main (electron-settings)
          try{
            if(window.api && typeof window.api.saveSettings === 'function'){
              try{
                await window.api.saveSettings('api.token', token);
                if(window.api.reloadApiConfig) await window.api.reloadApiConfig();
                console.debug('login: persisted api.token to main config');
              }catch(e){ console.warn('login: could not persist token to main config', e); }
            }
          }catch(e){ /* noop */ }
        }

        // Redirigir al destino o raíz. En entorno Electron/file://, si estamos en /public/ usar ../index.html
        let redirectTo = (r && (r.redirect || (r.data && r.data.redirect))) || (response && (response.redirect || (response.data && response.data.redirect)));
        if(!redirectTo || redirectTo === '/' || redirectTo === ''){
          // si la página actual está dentro de /public/, subir un nivel
          const inPublic = (location.pathname || location.href).indexOf('/public/') !== -1;
          redirectTo = (inPublic ? '../index.html' : 'index.html');
        } else {
          // Normalizar rutas que empiezan con '/'
          if(typeof redirectTo === 'string' && redirectTo.startsWith('/')) redirectTo = redirectTo.replace(/^\//, '');
        }
        console.debug('login: redirectTo ->', redirectTo);
        // Navegar usando URL para resolver correctamente en file:// context
        try{ const target = new URL(redirectTo, location.href).href; console.debug('login: redirect target ->', target); location.href = target; }catch(e){ try{ location.assign(redirectTo); }catch(e2){ console.error('login: redirect failed', e2); } }
        return;
      }catch(e){
        console.error('Error procesando respuesta de login:', e);
        showError('Error al procesar respuesta de login');
        return;
      }

    }catch(err){
      console.error('Login error', err);
      showError('Error al conectar con el servidor: ' + (err && err.message ? err.message : err));
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    const form = qs('#login-form');
    form && form.addEventListener('submit', submitForm);
    qs('#login-button') && qs('#login-button').addEventListener('click', submitForm);
    qs('#toggle-pass') && qs('#toggle-pass').addEventListener('click', function(){
      const p = qs('#password'); p.type = (p.type === 'password') ? 'text' : 'password';
    });
    // settings button navigates to settings.html
    var settingsBtn = document.querySelector('.settings-btn');
    if(settingsBtn){
      settingsBtn.addEventListener('click', function(){ location.href = 'settings.html'; });
    }
  });

})(window);
