// Fallback helper moved from inline to external file
(function(){
  function show(msg){
    var el = document.getElementById('login-error');
    if(!el){
      el = document.createElement('div'); el.id='login-error'; el.style.cssText='color:#ffd0d0;padding:8px;background:rgba(255,0,0,0.06);border-radius:8px;margin-top:6px';
      var parent = document.body; parent.insertBefore(el, parent.firstChild);
    }
    el.style.display='block'; el.textContent = msg;
  }
  window.addEventListener('error', function(e){
    try{ show('Error: '+(e && e.message) ); }catch(_){ }
  });
  window.addEventListener('unhandledrejection', function(e){
    try{ show('Promise Rejection: '+(e && e.reason && e.reason.message ? e.reason.message : JSON.stringify(e.reason)) ); }catch(_){ }
  });
  // detect missing critical assets after short delay
  window.addEventListener('DOMContentLoaded', function(){
    setTimeout(function(){
      // check logo
      var img = document.querySelector('.mobile-card .logo');
      if(img && (!img.complete || img.naturalWidth===0)) show('Logo no cargado (img/logo-tgp.png)');
      // check css by reading a computed style
      try{
        var bg = getComputedStyle(document.body).backgroundColor;
      }catch(e){ bg = null; }
      if(!bg || bg === 'rgb(0, 0, 0)'){
        // nothing for now
      }
    },400);
  });
})();
