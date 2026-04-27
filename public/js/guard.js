// Protección de vistas: redirige a login si no hay sesión válida
(function(window){
  function onReady(fn){
    if(document.readyState === 'complete' || document.readyState === 'interactive') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  onReady(function(){
    // Intentar usar el helper `auth` si está disponible
    var isLoginPage = /(?:\/)??login\.html$/.test(location.pathname) || /\/public\/login\.html$/.test(location.pathname);

    function redirectToLogin(){
      // Intentar varias rutas relativas/absolutas para cubrir server y file://
      var candidates = [
        'public/login.html',
        './public/login.html',
        '/public/login.html',
        'login.html',
        './login.html',
        '/login.html'
      ];
      // Si ya estamos en login, no hacer nada
      if(isLoginPage) return;

      // Helper para mostrar un mensaje breve al usuario
      try { console.warn('[guard] redirigiendo a login, probando candidatos', candidates); } catch(e){}

      // Intentar cada candidato: al asignar location.href el navegador intentará cargarlo.
      // Usamos replace en vez de href para no agregar a history.
      for(var i=0;i<candidates.length;i++){
        try{
          var cand = candidates[i];
          // Si la URL ya parece absoluta (starts with /) lo usamos
          if(cand.charAt(0) === '/'){
            location.replace(cand);
            return;
          }
          // Construir URL relativa desde la ubicación actual
          var base = location.href.replace(/[^\/]*$/, '');
          var attempt = base + cand;
          // registrar intento
          try { console.log('[guard] intentando', attempt); } catch(e){}
          location.replace(attempt);
          return;
        }catch(e){
          // seguir con el siguiente
        }
      }
      // Como último recurso, asignar el primer candidato
      location.replace(candidates[0]);
    }

    function redirectToHome(){
      var home = '/index.html';
      // si estamos dentro de /public/ (ej: public/login.html) subir al root
      if(location.pathname.indexOf('/public/') === 0) home = location.pathname.replace('/public/login.html','/index.html');
      location.href = home;
    }

    // Si el helper auth aún no existe, try to load after a short delay
    var check = function(){
      if(window.auth && typeof window.auth.isAuthenticated === 'function'){
        try{ console.log('[guard] auth disponible, isAuthenticated=', window.auth.isAuthenticated()); }catch(e){}
        var ok = window.auth.isAuthenticated();
        if(ok){ if(isLoginPage) redirectToHome(); }
        else { if(!isLoginPage) redirectToLogin(); }
      } else {
        // intentar de nuevo una vez más (esperar recursos carguen)
        setTimeout(function(){
          if(window.auth && typeof window.auth.isAuthenticated === 'function'){
            try{ console.log('[guard] auth disponible tras espera, isAuthenticated=', window.auth.isAuthenticated()); }catch(e){}
            var ok2 = window.auth.isAuthenticated();
            if(ok2){ if(isLoginPage) redirectToHome(); }
            else { if(!isLoginPage) redirectToLogin(); }
          } else {
            // Si no hay auth disponible, no podemos validar; como fallback bloqueamos acceso
            try{ console.warn('[guard] auth no disponible, forzando redirección a login'); }catch(e){}
            if(!isLoginPage) redirectToLogin();
          }
        }, 300);
      }
    };

    check();
  });

})(window);
