// Gestor simple de notificaciones agrupadas en la parte inferior
(function(window){
  function qs(s){ return document.querySelector(s); }
  function escapeHtml(str){ return String(str).replace(/[&<>"]+/g, function(s){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]); }); }

  const containerId = 'custom-notify-container';
  function getContainer(){
    let c = document.getElementById(containerId);
    if(!c){
      c = document.createElement('div');
      c.id = containerId;
      c.className = 'custom-notify-container';
      document.body.appendChild(c);
    }
    return c;
  }

  const map = new Map(); // key -> {el, count, timeout}

  function closeNotification(key){
    const entry = map.get(key);
    if(!entry) return;
    try{ entry.el.classList.add('hide'); setTimeout(()=>{ entry.el.remove(); }, 250); }catch(e){}
    clearTimeout(entry.timeout);
    map.delete(key);
  }

  function show(message, opts){
    opts = opts || {};
    const type = opts.type || 'primary';
    const duration = (typeof opts.duration === 'number') ? opts.duration : 5000;
    const key = opts.key || message;

    // If exists, increment counter (update badge only, do not alter message)
    if(map.has(key)){
      const entry = map.get(key);
      entry.count += 1;
      const badge = entry.el.querySelector('.notify-badge');
      if(badge) badge.textContent = entry.count;
      entry.el.classList.remove('pulse');
      // reflow then add for animation
      void entry.el.offsetWidth;
      entry.el.classList.add('pulse');
      clearTimeout(entry.timeout);
      entry.timeout = setTimeout(()=> closeNotification(key), duration);
      return entry;
    }

    const container = getContainer();
    const item = document.createElement('div');
    item.className = 'custom-notify uk-card uk-card-body uk-card-small';
    item.setAttribute('data-notify-key', key);
    // structure: icon | message | badge
    // Use inline SVG icons (styled via CSS) for reliable contrast control
    const svgIcons = {
      warning: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden focusable="false" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h17a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      danger: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden focusable="false" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
      success: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden focusable="false" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>',
      primary: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden focusable="false" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
    };
    const chosenIcon = opts.iconSvg || svgIcons[type] || svgIcons.primary;
    item.innerHTML = '<div class="notify-icon" aria-hidden>' + chosenIcon + '</div>' +
                     '<div class="notify-body"><span class="notify-text">' + escapeHtml(message) + '</span></div>' +
                     '<div class="notify-badge" aria-hidden>1</div>';
    item.setAttribute('data-notify-type', type);
    // apply type class
    item.classList.add('notify-' + type);
    container.appendChild(item);

    const timeoutId = setTimeout(()=> closeNotification(key), duration);
    map.set(key, { el: item, count: 1, timeout: timeoutId });

    // click to dismiss
    item.addEventListener('click', function(){ closeNotification(key); });
    return { el: item };
  }

  // expose
  window.notify = { show, closeNotification };
})(window);
