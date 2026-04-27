// Poblador de la barra superior de usuario
// user-bar loader
(function(window){
  console.log('user-bar: loaded');
  function qs(s){ return document.querySelector(s); }

  function getSessionObject(){
    try{
      // Preferir auth.getSession si existe
      if(window.auth && typeof window.auth.getSession === 'function'){
        const s = window.auth.getSession();
        console.debug('user-bar: auth.getSession ->', s);
        if(s) return s;
      }
    }catch(e){/* ignore */}
    try{
      const raw = localStorage.getItem('app_session');
      console.debug('user-bar: localStorage.app_session raw ->', raw);
      if(!raw) return null;
      const s = JSON.parse(raw);
      // If user is primitive (id) or missing fields, try to recover from separate app_user
      try{
        if((s && s.user && typeof s.user !== 'object') || (s && s.user && (!s.user.name || !s.user.email))){
          const rawUser = localStorage.getItem('app_user');
          if(rawUser){
            try{
              const userObj = JSON.parse(rawUser);
              s.user = userObj;
              try{ localStorage.setItem('app_session', JSON.stringify(s)); console.debug('user-bar: merged app_user into app_session'); }catch(e){}
            }catch(e){ /* ignore parse errors */ }
          }
        }
      }catch(e){ /* ignore */ }
      return s;
    }catch(e){ return null; }
  }

  function _parseJwt(token){
    try{
      const parts = token.split('.');
      if(parts.length !== 3) return null;
      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g,'+').replace(/_/g,'/'));
      return JSON.parse(decodeURIComponent(escape(decoded)));
    }catch(e){ return null; }
  }

  function render(){
    const bar = qs('#user-bar');
    if(!bar) return;
    const s = getSessionObject();
    console.debug('user-bar: render session ->', s);
    // If session exists and token present, try to ensure s.user has name/email/role from JWT token
    if(s && s.token){
      const claims = _parseJwt(s.token);
      console.debug('user-bar: parsed token claims ->', claims);
      // If backend stored a primitive (id) in s.user, convert to object
      if(s.user && typeof s.user !== 'object'){
        try{ s.user = { id: s.user }; }catch(e){ s.user = { id: String(s.user) }; }
        try{ localStorage.setItem('app_session', JSON.stringify(s)); console.debug('user-bar: converted primitive user to object'); }catch(e){}
      }
      if(s.user){
        // If user exists but missing fields, augment from token claims
        let needSave = false;
        try{
          if((!s.user.name || String(s.user.name).trim() === '') && claims){
            s.user.name = claims.name || claims.given_name || claims.preferred_username || claims.sub || s.user.name || '';
            needSave = true;
          }
          if((!s.user.email || String(s.user.email).trim() === '') && claims){
            s.user.email = claims.email || s.user.email || '';
            needSave = true;
          }
          if((!s.user.role || String(s.user.role).trim() === '') && claims){
            s.user.role = claims.role || (claims.roles && (Array.isArray(claims.roles) ? claims.roles[0] : claims.roles)) || s.user.role || '';
            needSave = true;
          }
        }catch(e){ console.warn('user-bar: error augmenting user from claims', e); }
        if(needSave){ try{ localStorage.setItem('app_session', JSON.stringify(s)); console.debug('user-bar: augmented user from token and persisted'); }catch(e){ console.warn('user-bar: could not persist augmented user', e); } }
      } else if(claims){
        const inferredUser = {
          name: claims.name || claims.given_name || claims.preferred_username || claims.sub || '',
          email: claims.email || '',
          role: claims.role || (claims.roles && (Array.isArray(claims.roles) ? claims.roles[0] : claims.roles)) || ''
        };
        s.user = inferredUser;
        try{ localStorage.setItem('app_session', JSON.stringify(s)); console.debug('user-bar: persisted inferred user to app_session'); }catch(e){ console.warn('user-bar: could not persist inferred user', e); }
      }
    }
    if(!s || !s.user){ bar.style.display = 'none'; adjustBodyPadding(); return; }
    const user = s.user;
    const nameEl = qs('#user-name');
    const emailEl = qs('#user-email');
    const roleEl = qs('#user-role');

    if(nameEl) nameEl.textContent = user.name || '';
    if(emailEl) emailEl.textContent = user.email || '';
    if(roleEl) roleEl.textContent = user.role ? ('(' + user.role + ')') : '';
    bar.style.display = 'block';
    
    adjustBodyPadding();
  }

  // Ajusta el padding-top del body para que el toolbar no sobreponga el contenido
  function adjustBodyPadding(){
    try{
      const bar = qs('#user-bar');
      if(!bar) return;
      const style = window.getComputedStyle(bar);
      const visible = style.display !== 'none';
      // Always push page content down by the bar height when visible
      if(visible){
        const h = bar.getBoundingClientRect().height || 0;
        // add a small extra gap
        const pad = Math.ceil(h + 8);
        if(document.body.style.paddingTop !== pad + 'px') document.body.style.paddingTop = pad + 'px';
      } else {
        if(document.body.style.paddingTop) document.body.style.paddingTop = '';
      }
    }catch(e){ console.warn('user-bar: adjustBodyPadding failed', e); }
  }

  // Logout implementation disponible a todo el módulo y globalmente
  function _doLogout(){
    console.log('user-bar: executing logout');
    try{
      if(window.auth && typeof window.auth.logout === 'function'){
        try{ window.auth.logout(false); }catch(e){ console.warn('user-bar: auth.logout(false) threw', e); }
      }
    }catch(e){ console.warn('user-bar: error calling auth.logout', e); }
    try{ localStorage.removeItem('app_session'); localStorage.removeItem('app_user'); }catch(e){ console.warn('user-bar: error clearing localStorage', e); }
    try{
      const target = new URL('public/login.html', location.href).href;
      console.log('user-bar: redirect target ->', target);
      location.href = target;
    }catch(e){ console.error('user-bar: redirect failed', e); }
  }

  function init(){
    render();

    console.log('user-bar: init');
    const logout = qs('#logout-btn');
    if(logout){
      console.log('user-bar: attaching logout click handler');
      try{ logout.addEventListener('click', _doLogout); }catch(e){ console.warn('user-bar: addEventListener failed', e); }
      // Also set onclick in case addEventListener didn't attach due to timing/CSP
      try{ logout.onclick = _doLogout; }catch(e){ console.warn('user-bar: could not set onclick', e); }
    } else {
      console.log('user-bar: logout button not found');
    }
    // Delegated listener: catch clicks even if button is replaced dynamically
    try{
      document.addEventListener('click', function(ev){
        const t = ev.target;
        if(!t) return;
        if(t.id === 'logout-btn' || (t.closest && t.closest('#logout-btn'))){
          console.log('user-bar: delegated logout click detected');
          _doLogout();
        }
      }, true);
    }catch(e){ console.warn('user-bar: could not attach delegated click listener', e); }
    // Exponer globalmente por si se quiere invocar desde consola
    try{ window.forceLogout = _doLogout; }catch(e){}
    // Force styles to make original logout clickable
    try{
      const orig = qs('#logout-btn');
      if(orig){ try{ orig.style.pointerEvents = 'auto'; orig.style.zIndex = 1000000; }catch(e){} }
    }catch(e){ console.warn('user-bar: could not update logout button styles', e); }
    // Escuchar cambios básicos en storage para re-render
    window.addEventListener('storage', function(){ render(); });

    // Ensure body padding is recalculated on load and resize
    try{ window.addEventListener('load', adjustBodyPadding); }catch(e){}
    try{ window.addEventListener('resize', adjustBodyPadding); }catch(e){}
    // MutationObserver to catch dynamic changes in the user-bar and force padding recalculation
    try{
      const barEl = qs('#user-bar');
      if(barEl && typeof MutationObserver !== 'undefined'){
        const mo = new MutationObserver(function(){ adjustBodyPadding(); });
        mo.observe(barEl, { attributes: true, childList: true, subtree: true });
      }
    }catch(e){ console.warn('user-bar: MutationObserver setup failed', e); }
    // Also ensure a small delayed recalculation after init
    try{ setTimeout(adjustBodyPadding, 60); }catch(e){}
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already loaded
    init();
  }

  // Exponer render por si otra parte quiere actualizar la barra
  window.userBar = { render };
})(window);
