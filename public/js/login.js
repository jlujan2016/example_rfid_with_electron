// Lógica del formulario de login - Acepta cualquier usuario/contraseña
(function(window){
  function qs(sel){ return document.querySelector(sel); }

  function showError(msg){
    const el = qs('#login-error');
    if(el){ el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
  }

  async function submitForm(e){
    e && e.preventDefault();
    showError('');
    
    const user = qs('#username').value.trim();
    const pass = qs('#password').value;
    
    if(!user || !pass){ 
      showError('Ingrese usuario y contraseña'); 
      return; 
    }

    // Aceptar cualquier credencial (solo validar que no estén vacías)
    const mockToken = 'mock_token_' + Date.now() + '_' + Math.random().toString(36).substr(2);
    const expiry = Date.now() + (8 * 3600 * 1000);
    
    const userData = {
      id: Date.now(),
      name: user,
      username: user,
      email: user + '@demo.local',
      role: 'user'
    };
    
    const sessionObj = {
      token: mockToken,
      token_type: 'bearer',
      expiry: expiry,
      user: userData
    };
    
    try{
      localStorage.setItem('app_session', JSON.stringify(sessionObj));
      localStorage.setItem('app_user', JSON.stringify(userData));
      console.debug('Login exitoso para usuario:', user);
      
      // Redirigir
      const inPublic = location.pathname.indexOf('/public/') !== -1;
      const redirectTo = inPublic ? '../index.html' : 'index.html';
      location.href = redirectTo;
    }catch(e){
      console.error('Error guardando sesión:', e);
      showError('Error al guardar la sesión');
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    const form = qs('#login-form');
    form && form.addEventListener('submit', submitForm);
    
    const loginBtn = qs('#login-button');
    loginBtn && loginBtn.addEventListener('click', submitForm);
    
    const togglePass = qs('#toggle-pass');
    togglePass && togglePass.addEventListener('click', function(){
      const p = qs('#password'); 
      if(p) p.type = (p.type === 'password') ? 'text' : 'password';
    });
    
    const settingsBtn = document.querySelector('.settings-btn');
    if(settingsBtn){
      settingsBtn.addEventListener('click', function(){ 
        location.href = 'settings.html'; 
      });
    }
  });
})(window);