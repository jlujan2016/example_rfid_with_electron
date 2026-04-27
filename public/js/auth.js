// Helpers de sesión
(function(window){
  const STORAGE_KEY = 'app_session';

  function _now(){ return Date.now(); }

  function _parseJwt(token){
    try{
      const parts = token.split('.');
      if(parts.length !== 3) return null;
      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g,'+').replace(/_/g,'/'));
      return JSON.parse(decodeURIComponent(escape(decoded)));
    }catch(e){ return null; }
  }

  // Set session: if token is JWT and has exp, use that expiry; otherwise use hours param or global config
  function setSession(token, hours){
    let expiry = null;
    const jwt = _parseJwt(token);
    if(jwt && jwt.exp){
      // exp is seconds since epoch
      expiry = jwt.exp * 1000;
    }
    if(!expiry){
      const hrs = (typeof hours === 'number') ? hours : (window.APP_CONFIG && window.APP_CONFIG.SESSION_DURATION_HOURS) || 8;
      expiry = _now() + hrs * 3600 * 1000;
    }
    // Preserve any existing session fields (e.g., user) when setting token
    let existing = null;
    try{ existing = JSON.parse(localStorage.getItem(STORAGE_KEY)); }catch(e){ existing = null; }
    const payload = Object.assign({}, existing && typeof existing === 'object' ? existing : {}, { token: token, expiry: expiry });
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); }catch(e){ console.warn('auth.setSession: could not persist session', e); }
  }

  function getSession(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return null;
    try{
      const obj = JSON.parse(raw);
      if(!obj.token || !obj.expiry) return null;
      if(_now() > obj.expiry){
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return obj;
    }catch(e){ return null; }
  }

  function isAuthenticated(){
    return !!getSession();
  }

  function getToken(){
    const s = getSession();
    return s ? s.token : null;
  }

  function logout(redirectToLogin){
    localStorage.removeItem(STORAGE_KEY);
    try{ sessionStorage.removeItem(STORAGE_KEY); }catch(e){}
    if(redirectToLogin){
      try{
        console.debug('auth.logout: redirecting to public/login.html');
        location.href = 'public/login.html';
      }catch(e){
        console.error('auth.logout: redirect failed', e);
      }
    }
  }

  // Small helper: fetch with Authorization header and auto-logout on 401
  function fetchWithAuth(url, opts){
    opts = opts || {};
    opts.headers = opts.headers || {};
    const token = getToken();
    if(token){
      opts.headers['Authorization'] = 'Bearer ' + token;
    }
    return fetch(url, opts).then(res => {
      if(res.status === 401){
        logout(true);
        return Promise.reject({ status:401, message:'Unauthorized' });
      }
      return res;
    });
  }

  window.auth = { setSession, getSession, isAuthenticated, getToken, logout, fetchWithAuth };
})(window);
