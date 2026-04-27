// Pequeño helper HTTP para llamadas autenticadas
(function(window){
  function headersFrom(obj){
    var h = new Headers();
    for(var k in obj) if(Object.prototype.hasOwnProperty.call(obj,k)) h.append(k, obj[k]);
    return h;
  }

  function fetchWithAuth(url, options){
    options = options || {};
    options.headers = options.headers || {};
    var token = window.auth && window.auth.getToken && window.auth.getToken();
    if(token){
      options.headers['Authorization'] = 'Bearer ' + token;
    }
    return fetch(url, options).then(function(res){
      if(res.status === 401){
        window.auth && window.auth.logout && window.auth.logout(true);
        return Promise.reject({ status:401, message:'Unauthorized' });
      }
      return res;
    });
  }

  window.http = { fetchWithAuth };
})(window);
