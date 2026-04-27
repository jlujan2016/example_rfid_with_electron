// Manejo de la pantalla de configuración de servidor
(function(window){
  const STORAGE_KEY = 'app_api_host';

  function qs(sel){ return document.querySelector(sel); }

  async function setHost(url){
    if(!url) { localStorage.removeItem(STORAGE_KEY);
      if(window.api && window.api.unsetSettings) await window.api.unsetSettings('api.baseUrl');
      if(window.api && window.api.reloadApiConfig){ try{ await window.api.reloadApiConfig(); }catch(e){ console.warn('reloadApiConfig failed', e); } }
      return; }
    // Prefer electron-settings via preload bridge when available
    if(window.api && window.api.saveSettings){
      try{
        const res = await window.api.saveSettings('api.baseUrl', url);
        if(res && res.success){
          localStorage.setItem(STORAGE_KEY, url);
          if(window.api && window.api.reloadApiConfig){ try{ await window.api.reloadApiConfig(); }catch(e){ console.warn('reloadApiConfig failed', e); } }
          return { success: true, value: url };
        }
        return { success: false, error: res && res.error };
      }catch(err){
        console.error('Error saving settings via API:', err);
        return { success: false, error: err && err.message };
      }
    }

    localStorage.setItem(STORAGE_KEY, url);
    return { success: true, value: url };
  }

  async function getHost(){
    // Prefer electron-settings via preload bridge when available
    if(window.api && window.api.getSettings){
      try{
        const res = await window.api.getSettings('api.baseUrl');
        if(res && res.success && res.value) return res.value;
      }catch(err){
        console.error('Error reading settings via API:', err);
      }
    }
    return localStorage.getItem(STORAGE_KEY) || '';
  }

  function showMessage(msg, ok){
    const el = qs('#settings-msg');
    if(!el) return;
    el.style.display = 'block';
    el.style.background = ok ? 'rgba(16,128,16,0.12)' : 'rgba(128,16,16,0.12)';
    el.textContent = msg;
  }

  function normalizeUrl(raw){
    if(!raw) return '';
    raw = raw.trim();
    // if starts with http/https keep, otherwise prefix http://
    if(!/^https?:\/\//i.test(raw)) raw = 'http://' + raw;
    return raw.replace(/\/$/, '');
  }

  document.addEventListener('DOMContentLoaded', function(){
    const input = qs('#server-host');
    const validateBtn = qs('#validate-btn');
    const enterBtn = qs('#enter-creds-btn');
    const backBtn = qs('#back-btn');

    if(input) {
      // populate input from electron-settings when available
      (async function(){
        const hv = await getHost();
        if(hv) input.value = hv;
      })();
    }

    validateBtn && validateBtn.addEventListener('click', function(){
      const raw = input.value;
      const url = normalizeUrl(raw);
      if(!url){ showMessage('Ingrese una URL válida', false); return; }
      showMessage('Validando...', true);
      // Intentar fetch al endpoint de live del backend
      const probe = url + '/api/live';
      fetch(probe, { method: 'GET', mode: 'cors' }).then(async function(res){
        if(res.ok){
          const saved = await setHost(url);
          if(saved && saved.success){
            showMessage('Conexión exitosa y guardada', true);
          } else {
            showMessage('Conectado pero no se pudo guardar: ' + (saved && saved.error), false);
          }
        } else {
          showMessage('Respuesta no OK: ' + res.status, false);
        }
      }).catch(function(err){
        showMessage('Error al conectar: ' + (err && err.message ? err.message : err), false);
      });
    });

    enterBtn && enterBtn.addEventListener('click', async function(){
      const raw = input.value;
      const url = normalizeUrl(raw);
      if(!url){ showMessage('Ingrese una URL válida', false); return; }
      await setHost(url);
      // redirigir a login
      location.href = 'login.html';
    });

    backBtn && backBtn.addEventListener('click', function(){
      // volver a login
      location.href = 'login.html';
    });
  });

  // Exponer helper global para otras partes del app
  window.appConfig = window.appConfig || {};
  // async getter (uses electron-settings when available)
  window.appConfig.getApiHost = getHost;
  // sync fallback (reads localStorage)
  window.appConfig.getApiHostSync = function(){ return localStorage.getItem(STORAGE_KEY) || ''; };
  window.appConfig.setApiHost = setHost;

})(window);
