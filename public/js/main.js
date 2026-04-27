function playSuccess() {
  // Verificar si el sonido está habilitado
  const soundEnabled = localStorage.getItem('soundEnabled');
  if (soundEnabled === 'false') return;

  const audio = document.getElementById('audio-success');
  audio.currentTime = 0;
  audio.play();
}

function playError() {
  // Verificar si el sonido está habilitado
  const soundEnabled = localStorage.getItem('soundEnabled');
  if (soundEnabled === 'false') return;

  const audio = document.getElementById('audio-error');
  audio.currentTime = 0;
  audio.play();
}

function showAppAlert(message, status = 'danger', timeout = 3000) {
  // Prefer the grouped in-app notifier if available (supports counters)
  try{
    if(window.notify && typeof window.notify.show === 'function'){
      const type = (status === 'danger') ? 'danger' : (status === 'success' ? 'success' : (status === 'warning' ? 'warning' : 'primary'));
      // use message as key so duplicate messages increment the counter
      window.notify.show(message || 'Ocurrió un error', { type, duration: timeout, key: message });
      return;
    }
  }catch(e){ console.warn('showAppAlert: notify.show failed', e); }

  // Fallback to UIkit.notification if available
  if (typeof UIkit !== 'undefined' && UIkit.notification) {
    UIkit.notification({
      message: message || 'Ocurrio un error',
      status,
      pos: 'top-center',
      timeout
    });
    return;
  }

  window.alert(message);
}

let loadingRequestsCount = 0;

function ensureLoadingOverlay() {
  let overlay = document.getElementById('global-loading-overlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'global-loading-overlay';
  overlay.style.cssText = [
    'position: fixed',
    'inset: 0',
    'display: none',
    'align-items: center',
    'justify-content: center',
    'background: rgba(15, 23, 42, 0.35)',
    'backdrop-filter: blur(2px)',
    'z-index: 99998'
  ].join(';');

  overlay.innerHTML = `
    <div style="
      background: #ffffff;
      border-radius: 14px;
      padding: 16px 22px;
      min-width: 220px;
      box-shadow: 0 14px 30px rgba(0,0,0,0.2);
      text-align: center;
      border: 1px solid rgba(0,0,0,0.08);
    ">
      <div uk-spinner="ratio: 0.9"></div>
      <div style="margin-top: 10px; font-weight: 600; color: #1f2937;">Cargando...</div>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

function showGlobalLoading() {
  loadingRequestsCount += 1;
  // No mostrar overlay si el envío automático RFID lo suprimió
  if (window._rfidSuppressLoading) return;
  const overlay = ensureLoadingOverlay();
  overlay.style.display = 'flex';
}

function hideGlobalLoading() {
  loadingRequestsCount = Math.max(0, loadingRequestsCount - 1);
  if (loadingRequestsCount > 0) return;

  const overlay = document.getElementById('global-loading-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

function initApiLoadingEvents() {
  ensureLoadingOverlay();
  window.addEventListener('api-loading', (event) => {
    const isLoading = Boolean(event?.detail?.loading);
    const overlay = document.getElementById('global-loading-overlay');
    if (!overlay) return;
    overlay.style.display = isLoading ? 'flex' : 'none';
  });
}

jQuery(function ($) {
    // Handler para descargar avance
    $(document).on('pointerup', '#downloadAvance', function (e) {
      e.preventDefault();
      const idProcesoElectoral = $('#selectProcesoPrint').val();
      const idOdpe = $('#selectOdpe').val();
      const idVariable = $("#selectVariableRfid").val();
      if (!idProcesoElectoral) {
        showAppAlert('Seleccione un proceso electoral', 'warning');
        return;
      }

      if(!idOdpe) {
        showAppAlert('Seleccione una ODPE', 'warning');
        return;
      }

      if(!idVariable) {
        showAppAlert('Seleccione una variable RFID', 'warning');
        return;
      }


      showGlobalLoading();
      window.api.getMarcacionesReporte({ idProcesoElectoral, idVariable, idOdpe })
        .then(function (response) {
          if (!response || !response.isSuccess || !response.data || !response.data.url) {
            hideGlobalLoading();
            showAppAlert(response?.message || 'No se pudo obtener el archivo', 'danger');
            return;
          }

          window.api.downloadFile({
            url: response.data.url,
            name: response.data.name || 'avance.xlsx',
            path: response.data.path || ''
          })
          .then(function (downloadResult) {
            hideGlobalLoading();
            if (!downloadResult || downloadResult.success === false) {
              const downloadMessage = downloadResult?.detail?.statusCode
                ? `No se pudo guardar el archivo (HTTP ${downloadResult.detail.statusCode})`
                : (downloadResult?.error || 'No se pudo guardar el archivo');
              showAppAlert(downloadMessage, 'danger');
              if (downloadResult?.detail) {
                console.error('Detalle de descarga fallida:', downloadResult.detail);
              }
              return;
            }

            showAppAlert('Archivo guardado en Descargas', 'success', 2200);
          })
          .catch(function (error) {
            hideGlobalLoading();
            showAppAlert('Error al guardar el archivo', 'danger');
            console.error('Error al guardar avance:', error);
          });
        })
        .catch(function (error) {
          hideGlobalLoading();
          showAppAlert('Error al descargar el archivo', 'danger');
          console.error('Error al descargar avance:', error);
        });
    });
      // Funcionalidad para botón limpiar-datos
      $(document).on('pointerup', '#limpiar-datos', function (e) {
        e.preventDefault();
        const idProcesoElectoral = $('#selectProcesoPrint').val() || $('#selectProceso').val();
        const idOdpe = $('#selectOdpe').val();
        const idVariable = $('#selectVariableRfid').val();
        if (!idProcesoElectoral || !idOdpe ||  !idVariable) {
          showAppAlert('Seleccione proceso, ODPE y variable para limpiar datos', 'warning');
          return;
        }

        // Confirmación con UIkit.confirm
        UIkit.modal.confirm('¿Está seguro de limpiar los datos? Esta acción no se puede deshacer.', {
          labels: {
            ok: 'Confirmar',
            cancel: 'Cancelar'
          },
        }).then(function() {
          showGlobalLoading();
          window.api.limpiarDatos({
            idProcesoElectoral,
            idOdpe,
            idVariable,
          })
          .then(function(response) {
            hideGlobalLoading();
            if (!response || response.success === false || response.isSuccess === false) {
              showAppAlert(response?.message || response?.error || 'No se pudo limpiar los datos', 'danger');
              return;
            }

            showAppAlert(response?.message || 'Datos limpiados correctamente', 'success');
            // Refrescar datos
            f.views.getSelects2();
            f.views.getHomeData();
          })
          .catch(function(error) {
            hideGlobalLoading();
            showAppAlert('Error al limpiar datos', 'danger');
            console.error('Error al limpiar datos:', error);
          });
        });
      });
  function renderMarcacionesPagination(marcaciones, pag) {
    let html = '';
    if (!marcaciones || marcaciones.length === 0) {
      html = '<tr><td colspan="100%" class="text-muted uk-text-center">No se encontraron resultados</td></tr>';
    } else {
      marcaciones.forEach(marc => {
        html += `<tr>
                    <td>${marc.code}</td>
                    <td>${marc.rfid_at ? marc.rfid_at : ''}</td>
                    <td>
                        ${marc.rfid_at ? '<img class="table-icon-status" src="public/icons/icon-check.png" alt="">' : ''}
                    </td>
                    <td>${marc.barcode_at ? marc.barcode_at : ''}</td>
                    <td>
                        ${marc.barcode_at ? '<img class="table-icon-status" src="public/icons/icon-check.png" alt="">' : '<img class="table-icon-status" src="public/icons/icon-error.png" alt="">'}
                    </td>
                </tr>`;
      });
    }
    $('#tabla-marcaciones tbody').html(html);

    const $pag = $('#marcaciones-pagination');
    if (!pag || pag.last_page <= 1) {
      $pag.hide();
      return;
    }

    const page = pag.current_page;
    const totalPages = pag.last_page;
    const total = pag.total;
    const from = pag.from || 0;
    const to = pag.to || 0;

    const windowSize = 5;
    let startPage = Math.max(1, page - Math.floor(windowSize / 2));
    let endPage = Math.min(totalPages, startPage + windowSize - 1);
    if (endPage - startPage < windowSize - 1) {
      startPage = Math.max(1, endPage - windowSize + 1);
    }

    let pages = '';
    if (startPage > 1) {
      pages += `<li><a class="marcaciones-page-btn" data-page="1">1</a></li>`;
      if (startPage > 2) pages += `<li class="uk-disabled"><span>…</span></li>`;
    }
    for (let i = startPage; i <= endPage; i++) {
      pages += `<li class="${i === page ? 'uk-active' : ''}"><a class="marcaciones-page-btn" data-page="${i}">${i}</a></li>`;
    }
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) pages += `<li class="uk-disabled"><span>…</span></li>`;
      pages += `<li><a class="marcaciones-page-btn" data-page="${totalPages}">${totalPages}</a></li>`;
    }

    $pag.html(`
      <ul class="uk-pagination uk-flex-center uk-margin-remove-bottom" style="background:#173b6a;">
        <li class="${page === 1 ? 'uk-disabled' : ''}">
          ${page === 1
            ? '<span>&lsaquo;</span>'
            : `<a class="marcaciones-page-btn" data-page="${page - 1}">&lsaquo;</a>`}
        </li>
        ${pages}
        <li class="${page === totalPages ? 'uk-disabled' : ''}">
          ${page === totalPages
            ? '<span>&rsaquo;</span>'
            : `<a class="marcaciones-page-btn" data-page="${page + 1}">&rsaquo;</a>`}
        </li>
      </ul>
      <p class="uk-text-small uk-text-dark uk-text-center uk-margin-small-top">Mostrando ${from}–${to} de ${total} registros &middot; Página ${page} de ${totalPages}</p>
    `).show();
  }

  var f = {
    init: function (settings) {
      for (let elem in settings) {
        f[elem] = settings[elem];
      }
    },
    onReady: function () {
      initApiLoadingEvents();
      f.views.init();
    },
    // Sistema de acumulación de tags RFID
    rfidBuffer: {
      tags: new Set(),        // Set para acumular tags detectados (O(1) lookups)
      timer: null,           // Timer para envío periódico
      intervalMs: 4000,      // Intervalo de envío (4 segundos) - configurable
      maxTags: 300,          // Máximo de tags antes de forzar envío (48 cajas × 4 tags + margen)
      isPaused: false,       // Estado de pausa (inicia activo)

      // Control del progressbar
      progressTimer: null,
      progressStartTime: null,
      progressAnimationFrame: null,

      // Control de mensajes y animaciones para evitar superposición
      messageTimeouts: {
        shake: null,          // Timeout para animación shake
        scale: null,          // Timeout para animación scale
        hide: null            // Timeout para ocultar mensaje
      },
      getLocales(opts = {}) {
        const params = {
          idOdpe: $("#selectOdpeArco").val() || $("#selectOdpe").val(),
          ...opts
        };

        const selectLocal = document.getElementById('selectLocal');
        if (!params.idOdpe) {
          if (selectLocal) selectLocal.innerHTML = '<option value="">-- Seleccionar Local --</option>';
          return;
        }

        window.api.getLocales(params)
          .then(function (response) {
            if (!response || response.success === false) {
              console.error('Error al obtener locales:', response && response.error ? response.error : response);
              return;
            }

            const locales = response.locales || [];
            if (!selectLocal) return;
            selectLocal.innerHTML = '<option value="">-- Seleccionar Local --</option>';
            locales.forEach(l => {
              const option = document.createElement('option');
              option.value = l.id;
              option.textContent = l.name || l.nombre || (l.code || l.codigo) || l.id;
              selectLocal.appendChild(option);
            });
          })
          .catch(error => {
            console.error('Error al obtener locales:', error);
          });
      },
      isSending: false,       // Flag para prevenir envíos simultáneos

      // Throttle para renderCurrentReading (evitar DOM thrashing con muchos tags)
      _renderScheduled: false,

      // Historial de lecturas (últimas 500) - configurable
      readingsHistory: [],
      maxReadings: 500,

      // Agregar lectura al historial
      addReading: function(reading) {
        // Buscar si ya existe una lectura del mismo EPC (dentro de las últimas 10 entradas)
        const recentIndex = this.readingsHistory.slice(0, 10).findIndex(r => r.epc === reading.epc);

        if (recentIndex !== -1) {
          // Si existe, incrementar el contador y actualizar datos
          const existingReading = this.readingsHistory[recentIndex];
          existingReading.count = (existingReading.count || 1) + 1;
          existingReading.rssi = reading.rssi; // Actualizar con último RSSI
          existingReading.timestamp = reading.timestamp || new Date().toISOString();
          existingReading.wasPaused = this.isPaused;

          // Mover al inicio si no está en la primera posición
          if (recentIndex > 0) {
            this.readingsHistory.splice(recentIndex, 1);
            this.readingsHistory.unshift(existingReading);
          }
        } else {
          // Si no existe, agregar nueva entrada
          this.readingsHistory.unshift({
            ...reading,
            timestamp: reading.timestamp || new Date().toISOString(),
            wasPaused: this.isPaused,
            count: 1  // Inicializar contador en 1
          });
        }

        // Mantener solo las últimas configuradas
        if (this.readingsHistory.length > this.maxReadings) {
          this.readingsHistory = this.readingsHistory.slice(0, this.maxReadings);
        }

        // Actualizar contador en el modal si está visible
        $('#readings-count').text(this.readingsHistory.length);

        // Actualizar tabla si el modal está abierto
        if ($('#modal-readings').hasClass('uk-open')) {
          f.views.updateReadingsTable();
        }
      },

      // Limpiar historial
      clearHistory: function() {
        this.readingsHistory = [];
        $('#readings-count').text('0');
        f.views.updateReadingsTable();
      },

      // Agregar un tag al buffer
      addTag: function(epc) {
        // Si está en pausa, no agregar tags
        if (this.isPaused) {
          console.log(`Tag ignorado (sistema en pausa): ${epc}`);
          // Mostrar notificación visual de lectura ignorada
          this.showIgnoredReading(epc);
          return;
        }

        // Si se está enviando al servidor, ignorar nuevos tags temporalmente
        if (this.isSending) {
          console.log(`⏳ Tag ignorado (envío en curso): ${epc}`);
          return;
        }

        // Verificar que no esté duplicado en el buffer actual (Set: O(1))
        if (!this.tags.has(epc)) {
          this.tags.add(epc);

          // Si no hay timer activo, iniciar el countdown
          if (!this.timer) {
            console.log('Tag detectado sin timer activo, iniciando timer de acumulación...');
            this.startTimer();
          }

          // Los tags se acumulan sin límite durante el countdown.
          // Solo se envían cuando el timer expira.
        }
      },

      // Mostrar notificación de lectura ignorada
      showIgnoredReading: function(epc) {
        const $container = $('.rfid-status-compact');
        const $statusIcon = $('.rfid-status-icon');
        const $statusText = $('.rfid-status-text');
        const $countdownText = $('.rfid-countdown-time');

        // Guardar el estado original
        const wasVisible = $container.is(':visible');

        // Mostrar contenedor si está oculto
        if (!wasVisible) {
          $container.fadeIn(200);
        }

        // Agregar clase de alerta
        $container.addClass('ignored-reading');

        // Cambiar textos temporalmente
        $statusIcon.text('⚠');
        $statusText.text('Lectura ignorada - Sistema pausado');
        $countdownText.text('--');

        // Restaurar después de 3 segundos
        setTimeout(() => {
          $container.removeClass('ignored-reading');

          // Restaurar textos originales
          $statusIcon.text('⏸');
          $statusText.text('Sistema pausado');

          // Ocultar si no estaba visible originalmente
          if (!wasVisible) {
            $container.fadeOut(300);
          }
        }, 3000);
      },

      // Limpiar todos los timeouts activos de mensajes
      clearMessageTimeouts: function() {
        Object.keys(this.messageTimeouts).forEach(key => {
          if (this.messageTimeouts[key]) {
            clearTimeout(this.messageTimeouts[key]);
            this.messageTimeouts[key] = null;
          }
        });
      },

      // Ajustar tipografía del mensaje según cantidad de texto
      adjustMessageTypography: function() {
        const $message = $(".uk-card-message");
        if ($message.length === 0) return;

        // Usar text() para ignorar HTML en el conteo
        const text = ($message.text() || '').trim().replace(/\s+/g, ' ');

        // Reset de clases de tamaño (UIkit + nuestras clases)
        $message.removeClass('uk-text-lead uk-text-large uk-text-small');
        $message.removeClass('msg-size-xl msg-size-lg msg-size-md msg-size-sm msg-size-xs');

        if (!text) return;

        const length = text.length;
        const brCount = $message.find('br').length;
        const liCount = $message.find('li').length;

        // Score simple para aproximar “cantidad visual” de contenido.
        // - Los <li> y <br> suelen consumir líneas, así que pesan más.
        const score = length + (brCount * 20) + (liCount * 40);

        // Heurística: poco => XL (4rem), luego LG/MD/SM/XS.
        if (score <= 80) {
          $message.addClass('msg-size-xl');
        } else if (score <= 160) {
          $message.addClass('msg-size-lg');
        } else if (score <= 260) {
          $message.addClass('msg-size-md');
        } else if (score <= 380) {
          $message.addClass('msg-size-sm');
        } else {
          $message.addClass('msg-size-xs');
        }
      },

      transformExampleData: function(data) {
        var datas= {
          "0048": "08577701",
          "0055": "08577702",
          "0054": "08577703",
          "0053": "08577704",
          // "0048": "000002INS"
        };

        return datas[data] || data;
      },

      // Enviar tags acumulados al backend
      sendTags: function() {
        if (this.tags.size === 0) {
          return; // No hay tags para enviar
        }

        // Prevenir envíos simultáneos
        if (this.isSending) {
          console.log('⚠️ Envío ya en proceso, esperando...');
          return;
        }

        // Marcar como enviando (esto pausará la acumulación de nuevos tags)
        this.isSending = true;
        console.log('🔒 Sistema de acumulación pausado durante envío');

        // Suprimir overlay "Cargando..." durante envío automático RFID
        // para no interrumpir la vista de lectura en tiempo real
        window._rfidSuppressLoading = true;
        const overlay = document.getElementById('global-loading-overlay');
        if (overlay) overlay.style.display = 'none';

        // Limpiar el buffer antes de enviar
        const tagsCount = this.tags.size;
        const tagsCopy = [...this.tags]; // Copia del Set como array
        this.tags = new Set();

        // Cancelar cualquier timeout de mensaje anterior
        this.clearMessageTimeouts();

        // Remover animaciones previas inmediatamente
        $(".uk-card-message").removeClass('uk-animation-shake has-error');
        $(".uk-card-message").css('transform', '');

        console.log(`Enviando ${tagsCount} tags según la vista activa:`, tagsCopy);

        // Obtener la vista actual y enviar a la función correspondiente
        window.api.getSettings('view.type')
          .then((result) => {
            const viewType = result.value || 'punto-control-rfid';
            console.log('📤 Enviando tags desde vista:', viewType);

            if (viewType === 'punto-control-impresora') {
              // Vista de impresora: usar validarCodigos y esperar a que termine
              f.views.validarCodigos(tagsCopy, 'rfid')
                .finally(() => {
                  f.rfidBuffer.isSending = false;
                  f.rfidBuffer.drainPendingTags();
                });
            } else if (viewType === 'punto-control-arco') {
              // Vista arco: validar por endpoint de arcos con los tags acumulados
              f.views.validarCodigosArco(tagsCopy)
                .finally(() => {
                  f.rfidBuffer.isSending = false;
                  f.rfidBuffer.drainPendingTags();
                });
            } else {
              // Vista RFID: usar enviarCategorias (comportamiento por defecto)
              const idProcesoElectoral = $("#selectProceso").val();
              const idMaterial = $("#selectMaterial").val();

              if (!idProcesoElectoral || !idMaterial) {
                console.warn('No se ha configurado proceso electoral o material. Tags no enviados.');
                f.rfidBuffer.isSending = false;
                f.rfidBuffer.drainPendingTags();
                return;
              }

              const data = {
                idProcesoElectoral,
                idMaterial,
                codigos: tagsCopy
              };

              // Enviar al backend
              f.rfidBuffer.sendTagsToAPI(data, tagsCount);
            }
          })
          .catch(error => {
            console.error('❌ Error al obtener tipo de vista, usando vista por defecto:', error);
            // Por defecto usar vista RFID
            const idProcesoElectoral = $("#selectProceso").val();
            const idMaterial = $("#selectMaterial").val();

            if (!idProcesoElectoral || !idMaterial) {
              console.warn('No se ha configurado proceso electoral o material. Tags no enviados.');
              f.rfidBuffer.isSending = false;
              f.rfidBuffer.drainPendingTags();
              return;
            }

            const data = {
              idProcesoElectoral,
              idMaterial,
              codigos: tagsCopy
            };

            f.rfidBuffer.sendTagsToAPI(data, tagsCount);
          });
      },

      // Función auxiliar para enviar tags a la API (vista RFID)
      sendTagsToAPI: function(data, tagsCount) {
        window.api.enviarCategorias(data)
          .then(function (response) {
            // Actualizar mensaje
            $(".uk-card-message").html(response.message);
            f.rfidBuffer.adjustMessageTypography();

            if (!response.isSuccess) {
              playError();
              $(".uk-card-message").addClass('has-error');
              $(".uk-card-message").addClass('uk-animation-shake');

              // Guardar timeout de shake (10 segundos)
              f.rfidBuffer.messageTimeouts.shake = setTimeout(function() {
                $(".uk-card-message").removeClass('uk-animation-shake');
              }, 10000);

              if(response.data.caja_traslado){
                $("#n_caja_traslado").text(response.data.caja_traslado);
              }
              return;
            }

            if (response.data.hasError) {
              playError();
              $(".uk-card-message").addClass('has-error');
              $(".uk-card-message").addClass('uk-animation-shake');

              // Guardar timeout de shake (10 segundos)
              f.rfidBuffer.messageTimeouts.shake = setTimeout(function() {
                $(".uk-card-message").removeClass('uk-animation-shake');
              }, 10000);
            } else {
              playSuccess();
              $(".uk-card-message").removeClass('has-error');
              $(".uk-card-message").css({
                'transform': 'scale(1.05)',
                'transition': 'transform 0.3s ease'
              });

              // Guardar timeout de scale (2 segundos)
              f.rfidBuffer.messageTimeouts.scale = setTimeout(function() {
                $(".uk-card-message").css('transform', 'scale(1)');
              }, 2000);
            }

            $("#n_caja_traslado").text(response.data.caja_traslado);
            $("#odpe").text(response.data.odpe);
            $("#local").text(response.data.local);

            f.views.renderMesas(response.data.mesas);

            $("#progress-bar").attr('max', response.data.porcentaje.total);
            $("#progress-bar").attr('value', response.data.porcentaje.count);

            console.log(`✅ Envío completado: ${tagsCount} tags procesados`);
          })
          .catch(function (error) {
            console.error('Error al enviar tags:', error);
            playError();
            $(".uk-card-message").addClass('has-error');
            $(".uk-card-message").html('Error de conexión');
            f.rfidBuffer.adjustMessageTypography();
            $(".uk-card-message").addClass('uk-animation-shake');

            // Guardar timeout de shake (10 segundos)
            f.rfidBuffer.messageTimeouts.shake = setTimeout(function() {
              $(".uk-card-message").removeClass('uk-animation-shake');
            }, 10000);
          })
          .finally(function() {
            // Liberar el flag de envío
            f.rfidBuffer.isSending = false;
            // Enviar tags que se acumularon mientras este envío estaba en curso
            f.rfidBuffer.drainPendingTags();
          });
      },

      // Enviar tags pendientes que se acumularon durante un envío anterior
      drainPendingTags: function() {
        console.log('🔓 Sistema de acumulación reanudado');
        
        if (this.tags.size > 0 && !this.isSending) {
          console.log(`🔄 Procesando ${this.tags.size} tags acumulados durante espera...`);
          // Esperar un breve delay antes de enviar para agrupar tags recientes
          setTimeout(() => {
            if (this.tags.size > 0 && !this.isSending) {
              this.sendTags();
            }
          }, 500);
        } else {
          // No hay más envíos pendientes: restaurar overlay después de un breve delay
          // para cubrir llamadas API secundarias (ej: getHomeData) en los .then()
          setTimeout(() => {
            window._rfidSuppressLoading = false;
          }, 2000);
        }
      },

      // Iniciar el timer de envío (una sola vez)
      startTimer: function() {
        if (this.timer) {
          return; // Ya está iniciado
        }

        console.log(`Timer de acumulación iniciado (${this.intervalMs}ms)`);

        // Iniciar el progressbar solo si no está ya visible (evita reset visual)
        this.startProgressBar();

        // Usar setTimeout en lugar de setInterval para ejecutar solo una vez
        this.timer = setTimeout(() => {
          console.log('Tiempo de acumulación completado, enviando tags...');
          this.timer = null;

          // Intentar enviar
          if (this.tags.size > 0 && this.isSending) {
            // API anterior aún en curso: reintentar en corto sin resetear progressbar
            console.log('⏳ Envío previo aún en curso, reintentando en 500ms...');
            this.timer = setTimeout(() => {
              this.timer = null;
              this.sendTags();
              // Si no quedan tags, ocultar progressbar
              if (this.tags.size === 0) {
                this.stopProgressBar();
              }
            }, 500);
            return;
          }

          this.sendTags();
          // Si no quedan tags pendientes, ocultar progressbar
          if (this.tags.size === 0) {
            this.stopProgressBar();
          }
        }, this.intervalMs);
      },

      // Detener el timer
      stopTimer: function() {
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
          console.log('Timer de acumulación detenido');
        }

        // Detener el progressbar
        this.stopProgressBar();
      },

      // Iniciar animación del progressbar
      startProgressBar: function() {
        const $container = $('.rfid-status-compact');
        const $progress = $('.rfid-progress-bar');
        const $countdown = $('.rfid-countdown-time');

        // Si la animación ya está corriendo, no reiniciar (evita reset visual)
        if (this.progressAnimationFrame) {
          return;
        }

        // Mostrar el contenedor
        $container.fadeIn(300);

        // Guardar tiempo de inicio
        this.progressStartTime = Date.now();

        // Función de animación
        const animate = () => {
          if (this.isPaused) {
            // Si está pausado, detener la animación
            return;
          }

          const elapsed = Date.now() - this.progressStartTime;
          const remaining = Math.max(0, this.intervalMs - elapsed);
          const percentage = (remaining / this.intervalMs) * 100;

          // Actualizar progressbar
          $progress.val(percentage);

          // Actualizar texto del countdown
          const seconds = Math.ceil(remaining / 1000);
          $countdown.text(seconds + 's');

          // Cambiar clase del contenedor según el tiempo restante
          if (percentage < 20) {
            $container.removeClass('active').addClass('warning');
          } else {
            $container.removeClass('warning').addClass('active');
          }

          // Continuar animación si hay tiempo restante o si hay un timer activo
          // (el timer activo indica que un nuevo ciclo se inició)
          if (remaining > 0) {
            this.progressAnimationFrame = requestAnimationFrame(animate);
          } else if (this.timer) {
            // Timer nuevo arrancó → reiniciar countdown para el siguiente ciclo
            this.progressStartTime = Date.now();
            this.progressAnimationFrame = requestAnimationFrame(animate);
          } else {
            // No hay timer activo ni tiempo restante → animación terminó
            this.progressAnimationFrame = null;
          }
        };

        // Iniciar animación
        animate();
      },

      // Detener animación del progressbar
      stopProgressBar: function() {
        if (this.progressAnimationFrame) {
          cancelAnimationFrame(this.progressAnimationFrame);
          this.progressAnimationFrame = null;
        }

        $('.rfid-status-compact').fadeOut(300);
      },

      // Reiniciar progressbar (fuerza reset visual del countdown)
      resetProgressBar: function() {
        if (this.progressAnimationFrame) {
          cancelAnimationFrame(this.progressAnimationFrame);
          this.progressAnimationFrame = null;
        }

        this.progressStartTime = Date.now();
        this.startProgressBar();
      },

      // Pausar el sistema de lecturas
      pause: function() {
        this.isPaused = true;
        console.log('Sistema RFID pausado');

        // Pausar el progressbar
        this.stopProgressBar();

        f.views.updateRFIDStatus();
      },

      // Reanudar el sistema de lecturas
      resume: function() {
        this.isPaused = false;
        console.log('Sistema RFID reanudado');

        // Reanudar el progressbar si el timer está activo
        if (this.timer) {
          this.resetProgressBar();
        }

        f.views.updateRFIDStatus();
      },

      // Toggle play/pause
      toggle: function() {
        if (this.isPaused) {
          this.resume();
        } else {
          this.pause();
        }
      }
    },
    views: {
      init: function () {
        // Cargar vista primero (prioritario)
        f.views.initViewType();
        // Sincronizar selector cuando se abra el modal
        f.views.syncViewTypeSelector();

        f.views.loadresources();
        // f.views.mousemove_game();
        // f.views.mousemove_ropa_container_v_beta();
        // f.views.botones_ropa_beta();
        f.views.restart_game();
        f.views.test_buttons();
        f.views.saveSelects();
        f.views.getSelects();
        f.views.loadApiSettings();
        f.views.saveApiSettings();
        f.views.loadAntennaSettings();
        f.views.saveAntennaSettings();
        f.views.getAntennaConfig();
        f.views.applyBeeperNow();
        f.views.toggleAntennaConnectionType();
        f.views.togglePassword();
        f.views.initReadingsModal();
        f.views.saveGeneralSettings();
        f.views.initRFIDToggle();
        f.views.updateRFIDStatus();

        // Cargar settings del buffer ANTES de iniciar la conexión RFID
        f.views.loadGeneralSettings().then(() => {
          f.views.initRFIDConnection();
        });

        $(document).on('pointerup', '.marcaciones-page-btn', function(e) {
          e.preventDefault();
          const page = parseInt($(this).data('page'));
          if (!isNaN(page) && page >= 1) f.views.getHomeData(page);
        });
      },
      // Inicializar tipo de vista (se ejecuta primero)
      initViewType: function() {
        window.api.getSettings('view.type')
          .then((result) => {
            const viewType = result.value || 'punto-control-rfid';
            console.log('🔵 Vista cargada desde settings:', viewType);
            console.log('🔵 Resultado completo:', result);
            f.views.switchView(viewType);

          })
          .catch(error => {
            console.error('❌ Error al cargar tipo de vista:', error);
            // Usar valor por defecto si hay error
            f.views.switchView('punto-control-rfid');
          });
      },
      // Sincronizar selector cuando se abre el modal de configuración
      syncViewTypeSelector: function() {
        // Escuchar cuando se abre el modal de configuración
        UIkit.util.on('#modal-config', 'shown', function () {
          window.api.getSettings('view.type')
            .then((result) => {
              const viewType = result.value || 'punto-control-rfid';
              console.log('🔄 Sincronizando selector al abrir modal:', viewType);
              $('#view-type-selector').val(viewType);
            })
            .catch(error => {
              console.error('❌ Error al sincronizar selector:', error);
              $('#view-type-selector').val('punto-control-rfid');
            });
        });
      },
      // Cambiar entre vistas de la aplicación
      switchView: function(viewType) {
        console.log('🔄 Cambiando a vista:', viewType);

        // Ocultar todas las vistas usando css directo
        $('#punto-control-impresora').css('display', 'none');
        $('#punto-control-rfid').css('display', 'none');
        $('#punto-control-arco').css('display', 'none');

        // Mostrar la vista seleccionada
        if (viewType === 'punto-control-impresora') {
          console.log('✅ Mostrando vista: punto-control-impresora');
          $('#punto-control-impresora').css('display', 'block');
        } else if (viewType === 'punto-control-rfid') {
          console.log('✅ Mostrando vista: punto-control-rfid');
          $('#punto-control-rfid').css('display', 'block');
        } else if (viewType === 'punto-control-arco') {
          console.log('✅ Mostrando vista: punto-control-arco');
          $('#punto-control-arco').css('display', 'block');
        } else {
          // Por defecto mostrar punto-control-rfid
          console.log('✅ Mostrando vista por defecto: punto-control-rfid');
          $('#punto-control-rfid').css('display', 'block');
        }
      },
      // Inicializar conexión RFID mediante IPC
      initRFIDConnection: function() {
        console.log('Inicializando listeners RFID mediante IPC...');

        // Limpiar listeners previos para evitar duplicados en caso de re-init
        if (window.api.removeRFIDListeners) {
          window.api.removeRFIDListeners();
        }

        // Escuchar eventos de tags detectados desde el main process
        window.api.onRFIDTagDetected((data) => {
          console.log('Tag RFID detectado desde main process:', data);

          // Agregar al historial de lecturas
          f.rfidBuffer.addReading(data);

          // Agregar el EPC al buffer (funciona para ambas vistas)
          if (data.epc) {
            const transformedEPC = f.rfidBuffer.transformExampleData(data.epc);
            f.rfidBuffer.addTag(transformedEPC);

            // Mostrar en tiempo real el grupo acumulado del ciclo actual.
            // Throttle: máximo 1 render por frame para evitar lag con muchos tags
            if (!f.rfidBuffer.isPaused && f.rfidBuffer.tags.size > 0 && !f.rfidBuffer._renderScheduled) {
              f.rfidBuffer._renderScheduled = true;
              requestAnimationFrame(() => {
                f.rfidBuffer._renderScheduled = false;
                if (f.rfidBuffer.tags.size > 0) {
                  f.views.renderCurrentReading();
                }
              });
            }
          }
        });

        // Escuchar cambios de estado de conexión
        window.api.onRFIDStatusChange((status) => {
          console.log('Estado RFID:', status.connected ? 'Conectado' : 'Desconectado');

          // Actualizar indicador en el modal
          f.views.updateAntennaConnectionStatus(status.connected);

          if (status.connected) {
            // NO iniciar timer automáticamente, esperar primera lectura
            console.log('✓ Lector RFID conectado - Listo para recibir lecturas');
          } else {
            // Detener el timer si estaba corriendo
            f.rfidBuffer.stopTimer();
          }
        });

        // Verificar estado inicial
        window.api.getRFIDStatus()
          .then((result) => {
            if (result.success && result.connected) {
              console.log('✓ Conexión RFID activa - Esperando primera lectura...');
              // NO iniciar timer automáticamente, esperar primera lectura
              f.views.updateAntennaConnectionStatus(true);
            } else {
              console.log('⏳ Esperando conexión RFID...');
              f.views.updateAntennaConnectionStatus(false);
            }
          })
          .catch(error => {
            console.error('Error al verificar estado RFID:', error);
            f.views.updateAntennaConnectionStatus(false);
          });
      },
      toggleAntennaConnectionType: function() {
        $(document).on("change", "input[name='antenna-connection-type']", function() {
          const selectedType = $("input[name='antenna-connection-type']:checked").val();

          if (selectedType === 'tcp') {
            $("#tcp-config").show();
            $("#usb-config").hide();
          } else {
            $("#tcp-config").hide();
            $("#usb-config").show();
          }
        });
      },
      loadAntennaSettings: function() {
        // Cargar configuración de antena al iniciar
        window.api.getAntennaConfig()
          .then((result) => {
            if (result.success && result.config) {
              const config = result.config;

              // Tipo de conexión
              $(`input[name='antenna-connection-type'][value='${config.conexion.tipo}']`).prop('checked', true);

              // Mostrar/ocultar configuraciones según tipo
              if (config.conexion.tipo === 'tcp') {
                $("#tcp-config").show();
                $("#usb-config").hide();
              } else {
                $("#tcp-config").hide();
                $("#usb-config").show();
              }

              // TCP/IP
              $('#antenna-ip').val(config.conexion.ip || '192.168.99.202');
              $('#antenna-port').val(config.conexion.puerto || 8889);

              // USB
              $('#antenna-usb-port').val(config.conexion.usbPort || '/dev/ttyUSB0');
              $('#antenna-baud-rate').val(config.conexion.baudRate || 115200);

              // Lector
              $('#antenna-distance').val(config.lector.distanciaMetros || 1);
              $('#antenna-beeper-enabled').prop('checked', config.lector.beeper.habilitado !== false);
              $('#antenna-beeper-duration').val(config.lector.beeper.duracion || 100);

              // Tags
              $('#antenna-duplicate-threshold').val(config.tags.umbralDuplicados || 200);

              // Servidor
              $('#antenna-server-port').val(config.servidor.puerto || 3000);
            }
          })
          .catch(error => {
            console.error('Error al cargar configuración de antena:', error);
          });
      },
      saveAntennaSettings: function() {
        $(document).on("pointerup", ".uk-save-antenna-settings", function (e) {
          e.preventDefault();

          const connectionType = $("input[name='antenna-connection-type']:checked").val();

          // Validaciones básicas
          if (connectionType === 'tcp') {
            const ip = $("#antenna-ip").val().trim();
            const port = parseInt($("#antenna-port").val());

            if (!ip) {
              showAppAlert('Ingrese la dirección IP de la antena', 'warning');
              return;
            }

            if (!port || port < 1 || port > 65535) {
              showAppAlert('Puerto inválido. Debe estar entre 1 y 65535', 'warning');
              return;
            }
          } else {
            const usbPort = $("#antenna-usb-port").val().trim();

            if (!usbPort) {
              showAppAlert('Ingrese el puerto USB', 'warning');
              return;
            }
          }

          const distance = parseFloat($("#antenna-distance").val());
          if (!distance || distance < 0.1 || distance > 15) {
            showAppAlert('Distancia inválida. Debe estar entre 0.1 y 15 metros', 'warning');
            return;
          }

          // Construir objeto de configuración
          const config = {
            conexion: {
              tipo: connectionType,
              ip: $("#antenna-ip").val().trim(),
              puerto: parseInt($("#antenna-port").val()),
              usbPort: $("#antenna-usb-port").val().trim(),
              baudRate: parseInt($("#antenna-baud-rate").val())
            },
            lector: {
              distanciaMetros: distance,
              beeper: {
                habilitado: $("#antenna-beeper-enabled").is(':checked'),
                duracion: parseInt($("#antenna-beeper-duration").val()) || 100
              }
            },
            servidor: {
              puerto: parseInt($("#antenna-server-port").val()) || 3000,
              ipPC: '192.168.99.101'
            },
            tags: {
              umbralDuplicados: parseInt($("#antenna-duplicate-threshold").val()) || 200,
              rssi: {
                max: 200,
                min: 0
              }
            }
          };

          // Guardar configuración
          window.api.saveAntennaConfig(config)
            .then(() => {
              console.log('Configuración de antena guardada correctamente');
              showAppAlert('Configuración guardada correctamente. Reinicie la aplicación para aplicar los cambios.', 'success', 2800);

              // Cerrar el modal
              UIkit.modal('#modal-config').hide();
            })
            .catch((error) => {
              console.error('Error al guardar configuración de antena:', error);
              showAppAlert('Error al guardar la configuración', 'danger');
            });
        });
      },
      getAntennaConfig: function() {
        $(document).on("pointerup", ".uk-get-antenna-config", function (e) {
          e.preventDefault();

          const $btn = $(this);
          const originalText = $btn.html();

          // Mostrar loading
          $btn.prop('disabled', true);
          $btn.html('<div uk-spinner="ratio: 0.6"></div> Obteniendo...');
          UIkit.update($btn);

          // Obtener configuración del lector
          window.api.getReaderConfig()
            .then((result) => {
              if (result.success) {
                // Llenar campos con la configuración obtenida
                if (result.config.potencia !== undefined) {
                  // Convertir potencia a distancia aproximada
                  const distancia = result.config.distanciaEstimada || 2;
                  $('#antenna-distance').val(distancia);
                }

                if (result.config.beeper !== undefined) {
                  $('#antenna-beeper-enabled').prop('checked', result.config.beeper.habilitado);
                  if (result.config.beeper.duracion) {
                    $('#antenna-beeper-duration').val(result.config.beeper.duracion);
                  }
                }

                showAppAlert('✓ Configuración obtenida del lector correctamente', 'success', 2000);

                console.log('Configuración del lector:', result.config);
              } else {
                throw new Error(result.error || 'Error desconocido');
              }
            })
            .catch((error) => {
              console.error('Error al obtener configuración:', error);
              UIkit.notification({
                message: '✗ Error: ' + (error.message || 'No se pudo obtener la configuración'),
                status: 'danger',
                pos: 'top-center',
                timeout: 3000
              });
            })
            .finally(() => {
              // Restaurar botón
              $btn.prop('disabled', false);
              $btn.html(originalText);
              UIkit.update($btn);
            });
        });
      },
      applyBeeperNow: function() {
        $(document).on("pointerup", ".uk-apply-beeper-now", function (e) {
          e.preventDefault();

          const beeperEnabled = $("#antenna-beeper-enabled").is(':checked');
          const beeperDuration = parseInt($("#antenna-beeper-duration").val()) || 100;

          const config = {
            habilitado: beeperEnabled,
            duracion: beeperDuration
          };

          // Enviar comando al backend para aplicar inmediatamente
          window.api.applyBeeperConfig(config)
            .then((result) => {
              if (result.success) {
                showAppAlert(`✓ Beeper ${beeperEnabled ? 'activado' : 'desactivado'} correctamente`, 'success', 2000);
              } else {
                throw new Error(result.error || 'Error desconocido');
              }
            })
            .catch((error) => {
              console.error('Error al aplicar configuración del beeper:', error);
              UIkit.notification({
                message: '✗ Error al aplicar la configuración del beeper',
                status: 'danger',
                pos: 'top-center',
                timeout: 3000
              });
            });
        });
      },
      togglePassword: function() {
        $(document).on("click", ".uk-toggle-password", function (e) {
          e.preventDefault();

          const button = $(this);
          const input = $("#config-api-key");
          const currentType = input.attr("type");

          if (currentType === "password") {
            input.attr("type", "text");
            button.attr("uk-icon", "icon: eye-slash");
            UIkit.icon(button);
          } else {
            input.attr("type", "password");
            button.attr("uk-icon", "icon: eye");
            UIkit.icon(button);
          }
        });
      },
      // Actualizar tabla de lecturas
      updateReadingsTable: function() {
        const tbody = $('#readings-table-body');
        tbody.empty();

        if (f.rfidBuffer.readingsHistory.length === 0) {
          tbody.append(`
            <tr>
              <td colspan="8" class="uk-text-center uk-text-muted">
                <span uk-icon="icon: info; ratio: 1.2"></span>
                <p class="uk-text-small">No hay lecturas disponibles</p>
              </td>
            </tr>
          `);
          return;
        }

        f.rfidBuffer.readingsHistory.forEach((reading, index) => {
          const date = new Date(reading.timestamp);
          const formattedTime = date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const formattedDate = date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' });

          // Determinar el estado
          const statusClass = reading.wasPaused ? 'status-paused' : 'status-active';
          const statusText = reading.wasPaused ? 'Pausado' : 'Activo';
          const statusIcon = reading.wasPaused ? '⏸' : '▶';

          const row = `
            <tr>
              <td class="uk-text-nowrap uk-text-small">${index + 1}</td>
              <td class="uk-text-monospace" style="font-size: 11px;">${reading.epc || '-'}</td>
              <td class="uk-text-center uk-text-monospace" style="font-size: 11px;">${reading.pc || '-'}</td>
              <td class="uk-text-center">
                <span class="uk-badge ${this.getRSSIBadgeClass(reading.rssi)}">${reading.rssi || '-'}</span>
              </td>
              <td class="uk-text-center">${reading.antenna || '-'}</td>
              <td class="uk-text-center">
                <span class="uk-badge">${reading.count || 1}</span>
              </td>
              <td class="uk-text-center">
                <span class="status-badge ${statusClass}">${statusIcon} ${statusText}</span>
              </td>
              <td class="uk-text-nowrap uk-text-small">
                ${formattedDate}<br>
                <span class="uk-text-muted" style="font-size: 10px;">${formattedTime}</span>
              </td>
            </tr>
          `;

          tbody.append(row);
        });
      },
      // Obtener clase de badge según RSSI
      getRSSIBadgeClass: function(rssi) {
        if (!rssi) return '';

        const rssiNum = parseFloat(rssi);
        if (rssiNum >= -50) return 'uk-badge-success';
        if (rssiNum >= -70) return 'uk-badge-warning';
        return 'uk-badge-danger';
      },
      // Inicializar eventos del modal de lecturas
      initReadingsModal: function() {
        // Actualizar tabla cuando se abre el modal
        $('#modal-readings').on('show', function() {
          f.views.updateReadingsTable();
        });

        // Botón para limpiar historial
        $('#clear-readings-btn').on('click', function() {
          if (confirm('¿Está seguro de que desea limpiar todo el historial de lecturas?')) {
            f.rfidBuffer.clearHistory();
          }
        });
      },
      // Inicializar control de play/pause para RFID
      initRFIDToggle: function() {
        $('#rfid-toggle-btn').on('click', function() {
          //alert("Aqui se termina");
          f.rfidBuffer.toggle();
        });
      },
      // Actualizar estado de conexión de antena en modal
      updateAntennaConnectionStatus: function(isConnected) {
        const $statusContainer = $('#antenna-connection-status');
        const $statusIndicator = $('#antenna-status-indicator');
        const $statusTitle = $('#antenna-status-title');
        const $statusDescription = $('#antenna-status-description');
        const $statusIcon = $('#antenna-status-icon');

        if (isConnected) {
          $statusContainer.removeClass('antenna-disconnected antenna-connecting').addClass('antenna-connected');
          $statusTitle.text('Antena Conectada');
          $statusDescription.text('El lector RFID está funcionando correctamente');
          $statusIcon.attr('uk-icon', 'icon: check; ratio: 1.2');
        } else {
          $statusContainer.removeClass('antenna-connected antenna-connecting').addClass('antenna-disconnected');
          $statusTitle.text('Antena Desconectada');
          $statusDescription.text('No se detecta conexión con el lector RFID');
          $statusIcon.attr('uk-icon', 'icon: close; ratio: 1.2');
        }

        UIkit.icon($statusIcon);
      },

      // Actualizar indicador visual de estado RFID
      updateRFIDStatus: function() {
        const $btn = $('#rfid-toggle-btn');
        const $container = $('.rfid-status-compact');
        const $statusIcon = $('.rfid-status-icon');
        const $statusText = $('.rfid-status-text');
        const $countdownText = $('.rfid-countdown-time');

        const setToggleButtonIcon = (iconName) => {
          $btn.attr('uk-icon', `icon: ${iconName}`);
          UIkit.update($btn[0]);
        };

        if (f.rfidBuffer.isPaused) {
          // Estado pausado
          $btn.removeClass('active').addClass('paused');
          setToggleButtonIcon('play');

          $container.removeClass('active').addClass('paused');
          $statusIcon.text('⏸');
          $statusText.text('Sistema pausado');
          $countdownText.text('--');
        } else {
          // Estado activo
          $btn.removeClass('paused').addClass('active');
          setToggleButtonIcon('pause');

          $container.removeClass('paused').addClass('active');
          $statusIcon.text('▶');
          $statusText.text('Sistema activo');
        }
      },
      saveSelects: function () {
        $(document).on("pointerup", ".uk-save-point", function (e) {
          e.preventDefault();

          const isArco = $('#punto-control-arco').is(':visible');

          // Soportar tanto el modal tradicional (material) como el modal de arco (variable)
          let proceso = $("#selectProceso").val();
          let material = $("#selectMaterial").val();

          if (!proceso) {
            showAppAlert('Seleccione un proceso electoral', 'warning');
            return;
          }

          if (!material) {
            const msg = isArco ? 'Seleccione una variable' : 'Seleccione un material';
            showAppAlert(msg, 'warning');
            return;
          }

          // Forzar que proceso sea string simple
          if (typeof proceso !== 'string') {
            proceso = String(proceso);
          }

          // Limpiar valor guardado si es inválido
          window.api.getSettings('select.proceso').then((result) => {
            if (result && typeof result.value === 'object') {
              window.api.unsetSettings('select.proceso').catch(() => {});
            }
          });

          // Actualizar texto de material/variable en UI si existe

        $("#material-text").text($("#selectMaterial").find("option:selected").text());


          window.api.findProcesoElectoral({ id: proceso})
            .then(function (response) {
              console.log('repsonse', response)
              if (response && response.data && response.data.proceso) {
                if (isArco) {
                  $("#proceso_electoral-arco").text(response.data.proceso.name);
                  $("#proceso_electoral_descripcion_arco").html(response.data.proceso.description);
                } else {
                  $("#proceso_electoral").text(response.data.proceso.name);
                  $("#proceso_electoral_descripcion").html(response.data.proceso.description);
                }
              }
            })
            .catch(error => {
              console.error('Error al obtener proceso electoral:', error);
            });

          // Guardar en electron-settings. Usar claves independientes para ARCO

            window.api.saveSettings('select.proceso', proceso)
              .then(() => window.api.saveSettings('select.material', material))
              .then(() => {
                console.log('Configuración guardada correctamente');
                UIkit.modal('#modal-change-ponit').hide();
              })
              .catch((error) => {
                console.error('Error al guardar configuración:', error);
                showAppAlert('Error al guardar la configuración', 'danger');
              });
        });

        $(document).on("pointerup", ".uk-save-point-print", (e) => {
          e.preventDefault();

          const proceso = $("#selectProcesoPrint").val();
          if (!proceso) {
            showAppAlert('Seleccione un proceso electoral', 'warning');
            return;
          }

            window.api.findProcesoElectoral({ id: proceso})
            .then(function (response) {
                console.log('repsonse', response)

                if (response && response.data && response.data.proceso) {
                $("#proceso_electoral-impresona").text(response.data.proceso.name);
                $("#proceso_electoral_descripcion_impresora").html(response.data.proceso.description);
                }
            })
            .catch(error => {
            console.error('Error al obtener proceso electoral:', error);
            });

            // Guardar en electron-settings usando una clave separada para no colisionar con select.proceso
            window.api.saveSettings('select.impresora.proceso', proceso)
                .then(() => Promise.all([
                window.api.unsetSettings('select.proceso.impresora'),
                window.api.unsetSettings('select.odpe'),
                window.api.unsetSettings('select.variable')
                ]))
                .then(() => {
                console.log('Configuración guardada correctamente');
                // Cerrar el modal
                UIkit.modal('#modal-change-ponit').hide();

                f.views.getSelects2();

              // Intento adicional: aplicar variable ARCO guardada después de que se carguen los selects (si existe)
              setTimeout(function() {
                const selectVariableArcoEl = document.getElementById('selectVariableArco');
                if (!selectVariableArcoEl) return;
                window.api.getSettings('select.variable.arco')
                  .then(function(resVar) {
                    const sv = resVar && resVar.value ? resVar.value : '';
                    if (!sv) return;
                    const opt = selectVariableArcoEl.querySelector(`option[value="${sv}"]`);
                    if (opt) {
                      if (window.jQuery) { $(selectVariableArcoEl).val(sv).trigger('change'); }
                      else { selectVariableArcoEl.value = sv; selectVariableArcoEl.dispatchEvent(new Event('change', { bubbles: true })); }
                    } else {
                      const tmp = document.createElement('option');
                      tmp.value = sv;
                      tmp.textContent = sv;
                      selectVariableArcoEl.appendChild(tmp);
                      if (window.jQuery) { $(selectVariableArcoEl).val(sv).trigger('change'); }
                      else { selectVariableArcoEl.value = sv; selectVariableArcoEl.dispatchEvent(new Event('change', { bubbles: true })); }
                    }
                  })
                  .catch(err => console.error('Error al aplicar variable ARCO guardada:', err));
              }, 250);
                })
                .catch((error) => {
                console.error('Error al guardar configuración:', error);
                showAppAlert('Error al guardar la configuración', 'danger');
                });
        });

        $(document).on("pointerup", ".uk-save-point-arco", (e) => {
          e.preventDefault();

          const proceso = $("#selectProcesoArco").val();
          if (!proceso) {
            showAppAlert('Seleccione un proceso electoral', 'warning');
            return;
          }

            window.api.findProcesoElectoral({ id: proceso})
            .then(function (response) {
                console.log('repsonse', response)

                if (response && response.data && response.data.proceso) {
                $("#proceso_electoral-arco").text(response.data.proceso.name);
                $("#proceso_electoral_descripcion_arco").html(response.data.proceso.description);
                }
            })
            .catch(error => {
            console.error('Error al obtener proceso electoral:', error);
            });

            // Guardar en electron-settings usando una clave separada para no colisionar con select.proceso
            const selectedVariable = $('#selectVariableArco').val() || '';
            window.api.saveSettings('select.proceso.arco', proceso)
              .then(() => window.api.saveSettings('select.variable.arco', selectedVariable))
              .then(() => {
                // Notificar y cerrar el modal correcto
                showAppAlert('Configuración ARCO guardada correctamente', 'success');
                UIkit.modal('#modal-change-point-arco').hide();

                // Aplicar variable ARCO guardada en selects (intento adicional)
                setTimeout(function() {
                  const selectVariableArcoEl = document.getElementById('selectVariableArco');
                  if (!selectVariableArcoEl) return;
                  const sv = selectedVariable;
                  if (!sv) return;
                  const opt = selectVariableArcoEl.querySelector(`option[value="${sv}"]`);
                  if (opt) {
                    if (window.jQuery) { $(selectVariableArcoEl).val(sv).trigger('change'); }
                    else { selectVariableArcoEl.value = sv; selectVariableArcoEl.dispatchEvent(new Event('change', { bubbles: true })); }
                  } else {
                    const tmp = document.createElement('option');
                    tmp.value = sv;
                    tmp.textContent = sv;
                    selectVariableArcoEl.appendChild(tmp);
                    if (window.jQuery) { $(selectVariableArcoEl).val(sv).trigger('change'); }
                    else { selectVariableArcoEl.value = sv; selectVariableArcoEl.dispatchEvent(new Event('change', { bubbles: true })); }
                  }
                  try { $('#nombre-variable').text($(selectVariableArcoEl).find('option:selected').text() || ''); } catch(e){}
                }, 250);
              })
              .catch((error) => {
                console.error('Error al guardar configuración ARCO:', error);
                showAppAlert('Error al guardar la configuración', 'danger');
              });
        });
      },
      loadApiSettings: function() {
        // Cargar configuración de API al iniciar
        Promise.all([
          window.api.getSettings('api.baseUrl'),
          window.api.getSettings('api.token')
        ]).then(([baseUrlResult, tokenResult]) => {
          const savedBaseUrl = baseUrlResult.value;
          const savedToken = tokenResult.value;

          // Establecer valores en los inputs si existen
          if (savedBaseUrl) {
            $('#config-api-host').val(savedBaseUrl);
          }
          if (savedToken) {
            $('#config-api-key').val(savedToken);
          }
        }).catch(error => {
          console.error('Error al cargar configuración de API:', error);
        });
      },
      saveApiSettings: function() {
        $(document).on("pointerup", ".uk-save-api-settings", function (e) {
          e.preventDefault();

          const apiHost = $("#config-api-host").val().trim();
          const apiKey = $("#config-api-key").val().trim();

          if (!apiHost) {
            showAppAlert('Ingrese la URL de la API', 'warning');
            return;
          }

          if (!apiKey) {
            showAppAlert('Ingrese el token de acceso', 'warning');
            return;
          }

          // Validar formato de URL
          try {
            new URL(apiHost);
          } catch (error) {
            showAppAlert('URL inválida. Ejemplo: http://192.168.0.101', 'warning');
            return;
          }

          // Guardar en electron-settings
          window.api.saveSettings('api.baseUrl', apiHost)
            .then(() => window.api.saveSettings('api.token', apiKey))
            .then(() => window.api.reloadApiConfig())
            .then(() => {
              console.log('Configuración de API guardada correctamente');
              showAppAlert('Configuración guardada. La aplicación se recargará.', 'success', 2500);

              // Recargar la página para aplicar los cambios
              location.reload();
            })
            .catch((error) => {
              console.error('Error al guardar configuración de API:', error);
              showAppAlert('Error al guardar la configuración', 'danger');
            });
        });
      },
      loadGeneralSettings: function() {
        // Cargar configuración de vista desde electron-settings en el selector
        window.api.getSettings('view.type')
          .then((result) => {
            const viewType = result.value || 'punto-control-rfid';
            console.log('📋 Cargando selector de vista:', viewType);
            console.log('📋 Valor completo recibido:', result);
            $('#view-type-selector').val(viewType);
            console.log('📋 Valor asignado al selector:', $('#view-type-selector').val());
          })
          .catch(error => {
            console.error('❌ Error al cargar tipo de vista para selector:', error);
            $('#view-type-selector').val('punto-control-rfid');
          });

        // Cargar configuración de sonido desde localStorage
        const soundEnabled = localStorage.getItem('soundEnabled');

        // Si no existe, establecer como habilitado por defecto
        if (soundEnabled === null) {
          localStorage.setItem('soundEnabled', 'true');
          $('#sound-enabled').prop('checked', true);
        } else {
          $('#sound-enabled').prop('checked', soundEnabled === 'true');
        }

        // Cargar configuración del buffer desde electron-settings
        return Promise.all([
          window.api.getSettings('buffer.intervalMs'),
          window.api.getSettings('buffer.maxTags'),
          window.api.getSettings('buffer.maxReadings')
        ]).then(([intervalResult, maxTagsResult, maxReadingsResult]) => {
          // Intervalo de envío (convertir de segundos a milisegundos)
          const intervalSeconds = intervalResult.value || 4;
          $('#buffer-interval').val(intervalSeconds);
          f.rfidBuffer.intervalMs = intervalSeconds * 1000;

          // Máximo de tags
          const maxTags = maxTagsResult.value || 50;
          $('#buffer-max-tags').val(maxTags);
          f.rfidBuffer.maxTags = maxTags;

          // Máximo de lecturas en historial
          const maxReadings = maxReadingsResult.value || 100;
          $('#buffer-max-readings').val(maxReadings);
          f.rfidBuffer.maxReadings = maxReadings;

          console.log('Configuración del buffer cargada:', {
            intervalMs: f.rfidBuffer.intervalMs,
            maxTags: f.rfidBuffer.maxTags,
            maxReadings: f.rfidBuffer.maxReadings
          });
        }).catch(error => {
          console.error('Error al cargar configuración del buffer:', error);
          // Usar valores por defecto si hay error
          $('#buffer-interval').val(4);
          $('#buffer-max-tags').val(50);
          $('#buffer-max-readings').val(100);
        });
      },
      saveGeneralSettings: function() {
        $(document).on("click", ".uk-save-general-settings", function (e) {
          e.preventDefault();

          // Obtener tipo de vista
          const viewType = $("#view-type-selector").val();
          console.log('💾 Valor del selector antes de guardar:', viewType);
          console.log('💾 Opciones disponibles:', $('#view-type-selector option').map(function() {
            return $(this).val() + ' (selected: ' + $(this).prop('selected') + ')';
          }).get());

          // Validaciones
          const intervalSeconds = parseInt($("#buffer-interval").val());
          const maxTags = parseInt($("#buffer-max-tags").val());
          const maxReadings = parseInt($("#buffer-max-readings").val());

          if (!intervalSeconds || intervalSeconds < 1 || intervalSeconds > 300) {
            showAppAlert('El intervalo de envío debe estar entre 1 y 300 segundos', 'warning');
            return;
          }

          if (!maxTags || maxTags < 1 || maxTags > 1000) {
            showAppAlert('El máximo de tags debe estar entre 1 y 1000', 'warning');
            return;
          }

          if (!maxReadings || maxReadings < 10 || maxReadings > 1000) {
            showAppAlert('El máximo de lecturas debe estar entre 10 y 1000', 'warning');
            return;
          }

          const soundEnabled = $("#sound-enabled").is(':checked');

          // Guardar sonido en localStorage
          localStorage.setItem('soundEnabled', soundEnabled.toString());

          console.log('💾 Guardando tipo de vista:', viewType);

          // Guardar configuración de forma secuencial para asegurar persistencia
          window.api.saveSettings('view.type', viewType)
            .then((result) => {
              console.log('📦 Resultado del guardado:', result);

              if (!result.success) {
                console.error('❌ Error al guardar:', result.error);
                throw new Error(result.error || 'Error desconocido al guardar');
              }

              console.log('✅ Vista guardada exitosamente');
              // Pequeño delay adicional para asegurar que se escriba al disco
              return new Promise(resolve => setTimeout(resolve, 150));
            })
            .then(() => {
              // Verificar inmediatamente que se guardó
              console.log('🔍 Verificando valor guardado...');
              return window.api.getSettings('view.type');
            })
            .then((verifyResult) => {
              console.log('🔍 Verificación inmediata:', verifyResult);
              if (verifyResult.value !== viewType) {
                console.error('⚠️ ERROR CRÍTICO: El valor no se guardó correctamente!', {
                  esperado: viewType,
                  guardado: verifyResult.value
                });
                showAppAlert('Error crítico: No se pudo guardar el tipo de vista. Por favor contacte al administrador.', 'danger', 4500);
                throw new Error('El tipo de vista no se guardó correctamente');
              }
              console.log('✅ Tipo de vista verificado correctamente:', viewType);
              // Ahora guardar el resto de la configuración
              return Promise.all([
                window.api.saveSettings('buffer.intervalMs', intervalSeconds),
                window.api.saveSettings('buffer.maxTags', maxTags),
                window.api.saveSettings('buffer.maxReadings', maxReadings)
              ]);
            })
            .then(() => {
              console.log('✅ Toda la configuración guardada correctamente');

            // Actualizar valores en el buffer
            const hadTimer = !!f.rfidBuffer.timer;

            // Detener timer actual si existe
            if (f.rfidBuffer.timer) {
              f.rfidBuffer.stopTimer();
            }

            // Actualizar configuración
            f.rfidBuffer.intervalMs = intervalSeconds * 1000;
            f.rfidBuffer.maxTags = maxTags;
            f.rfidBuffer.maxReadings = maxReadings;

            // Reiniciar timer solo si estaba activo (tenía tags acumulándose)
            if (hadTimer && f.rfidBuffer.tags.size > 0) {
              f.rfidBuffer.startTimer();
            }

            // Cambiar vista si es necesario
            f.views.switchView(viewType);

            // Cargar datos de la vista activa
            f.views.loadViewData(viewType);

            console.log('✅ Configuración general guardada:', {
              viewType: viewType,
              soundEnabled: soundEnabled,
              intervalMs: f.rfidBuffer.intervalMs,
              maxTags: f.rfidBuffer.maxTags,
              maxReadings: f.rfidBuffer.maxReadings
            });

            showAppAlert('✓ Configuración guardada y aplicada correctamente', 'success', 2000);

            // Cerrar el modal
            setTimeout(() => {
              UIkit.modal('#modal-config').hide();
            }, 500);
          }).catch(error => {
            console.error('❌ Error al guardar configuración:', error);
            UIkit.notification({
              message: '✗ Error al guardar la configuración: ' + error.message,
              status: 'danger',
              pos: 'top-center',
              timeout: 3000
            });
          });
        });
      },
      getSelects() {
        window.api.getSelects()
          .then(function (response) {
            const selectProceso = document.getElementById('selectProceso');
            const selectProcesoPrint = document.getElementById('selectProcesoPrint');
            const selectProcesoArco = document.getElementById('selectProcesoArco');

            if (selectProceso) selectProceso.innerHTML = '<option value="">-- Seleccione proceso --</option>';
            if (selectProcesoPrint) selectProcesoPrint.innerHTML = '<option value="">-- Seleccione proceso --</option>';
            if (selectProcesoArco) selectProcesoArco.innerHTML = '<option value="">-- Seleccione proceso --</option>';

            (response.procesos || []).forEach(p => {
              const option = document.createElement('option');
              option.value = p.id;
              option.textContent = p.name;
              if (selectProceso) selectProceso.appendChild(option);
              if (selectProcesoPrint) selectProcesoPrint.appendChild(option.cloneNode(true));
              if (selectProcesoArco) selectProcesoArco.appendChild(option.cloneNode(true));
            });

            return window.api.getSettings('view.type');
          })
          .then(function (result) {
            const viewType = result.value || 'punto-control-rfid';
            f.views.loadViewData(viewType);
          })
          .catch(function (error) {
            console.error('Error al cargar procesos electorales:', error);
          });
      },

      // Despachar carga de datos según la vista activa
      loadViewData: function(viewType) {
        if (viewType === 'punto-control-rfid') {
          f.views.loadDataRFID();
        } else if (viewType === 'punto-control-impresora') {
          f.views.loadDataImpresora();
        } else if (viewType === 'punto-control-arco') {
          f.views.loadDataArco();
        }
      },

      // Vista 1 RFID: proceso + material (según proceso)
      loadDataRFID: function() {
        Promise.all([
          window.api.getSettings('select.proceso'),
          window.api.getSettings('select.material')
        ]).then(([procesoResult, materialResult]) => {
          const savedProceso = typeof procesoResult.value === 'string' ? procesoResult.value : '';
          const savedMaterial = materialResult.value || '';
          const selectProceso = document.getElementById('selectProceso');
          const selectMaterial = document.getElementById('selectMaterial');

          if (procesoResult.value && typeof procesoResult.value === 'object') {
            window.api.unsetSettings('select.proceso').catch(() => {});
          }

          if (savedProceso && selectProceso) {
            if (window.jQuery) { $(selectProceso).val(savedProceso).trigger('change'); }
            else { selectProceso.value = savedProceso; selectProceso.dispatchEvent(new Event('change', { bubbles: true })); }

            window.api.findProcesoElectoral({ id: savedProceso })
              .then(function (response) {
                if (response && response.data && response.data.proceso) {
                  $("#proceso_electoral").text(response.data.proceso.name);
                  $("#proceso_electoral_descripcion").html(response.data.proceso.description);
                }
              })
              .catch(err => console.error('Error al obtener proceso electoral:', err));

            window.api.getSelectsMateriales({ idProcesoElectoral: savedProceso })
              .then(function (response) {
                if (response.success && Array.isArray(response.materiales) && selectMaterial) {
                  selectMaterial.innerHTML = '<option value="">-- Seleccione material --</option>';
                  response.materiales.forEach(m => {
                    const option = document.createElement('option');
                    option.value = m.id;
                    option.textContent = m.name;
                    selectMaterial.appendChild(option);
                  });
                  if (savedMaterial && selectMaterial.querySelector(`option[value="${savedMaterial}"]`)) {
                    if (window.jQuery) { $(selectMaterial).val(savedMaterial).trigger('change'); }
                    else { selectMaterial.value = savedMaterial; selectMaterial.dispatchEvent(new Event('change', { bubbles: true })); }
                    $("#material-text").text(selectMaterial.options[selectMaterial.selectedIndex]?.textContent || '');
                  } else {
                    $("#material-text").text('');
                  }
                }
              })
              .catch(err => console.error('Error al cargar materiales:', err));
          }

          if (!savedProceso || !savedMaterial) {
            UIkit.modal('#modal-change-ponit').show();
          }
        }).catch(error => {
          console.error('Error al cargar datos RFID:', error);
          UIkit.modal('#modal-change-ponit').show();
        });
      },

      // Vista 2 Impresora: proceso + odpe (según proceso) + variables (según proceso)
      loadDataImpresora: function() {
        Promise.all([
          window.api.getSettings('select.impresora.proceso'),
          window.api.getSettings('select.proceso.impresora')
        ]).then(([procesoPrintResult, legacyResult]) => {
          const savedProceso = procesoPrintResult.value || legacyResult.value || '';
          const selectProcesoPrint = document.getElementById('selectProcesoPrint');

          if (!procesoPrintResult.value && legacyResult.value) {
            window.api.saveSettings('select.impresora.proceso', legacyResult.value)
              .then(() => window.api.unsetSettings('select.proceso.impresora'))
              .catch(err => console.error('Error al migrar configuración legacy:', err));
          }

          if (savedProceso && selectProcesoPrint) {
            if (window.jQuery) { $(selectProcesoPrint).val(savedProceso).trigger('change'); }
            else { selectProcesoPrint.value = savedProceso; selectProcesoPrint.dispatchEvent(new Event('change', { bubbles: true })); }

            window.api.findProcesoElectoral({ id: savedProceso })
              .then(function (response) {
                if (response && response.data && response.data.proceso) {
                  $("#proceso_electoral-impresona").text(response.data.proceso.name);
                  $("#proceso_electoral_descripcion_impresora").html(response.data.proceso.description);
                }
              })
              .catch(err => console.error('Error al obtener proceso electoral (impresora):', err));

            const selectOdpe = document.getElementById('selectOdpe');
            const selectVariableRfid = document.getElementById('selectVariableRfid');
            const selectOdpeFilters = document.getElementById('selectOdpeFilters');
            const selectVariableRfidFilters = document.getElementById('selectVariableRfidFilters');

            window.api.getSelects2({ idProceso: savedProceso, type: 'punto-control-impresora' })
              .then(function (response) {
                if (selectOdpeFilters) selectOdpeFilters.innerHTML = '<option value="">-- Seleccionar ODPE --</option>';
                if (selectVariableRfidFilters) selectVariableRfidFilters.innerHTML = '<option value="">-- Seleccionar variable RFID --</option>';
                if (selectOdpe) selectOdpe.innerHTML = '<option value="">-- Seleccionar ODPE --</option>';
                if (selectVariableRfid) selectVariableRfid.innerHTML = '<option value="">-- Seleccionar variable RFID --</option>';

                (response.odpe || []).forEach(p => {
                  const option = document.createElement('option');
                  option.value = p.id;
                  option.textContent = p.name;
                  if (selectOdpe) selectOdpe.appendChild(option);
                  if (selectOdpeFilters) selectOdpeFilters.appendChild(option.cloneNode(true));
                });

                (response.variables || []).forEach(p => {
                  const option = document.createElement('option');
                  option.value = p.id;
                  option.textContent = p.name;
                  if (selectVariableRfid) selectVariableRfid.appendChild(option);
                  if (selectVariableRfidFilters) selectVariableRfidFilters.appendChild(option.cloneNode(true));
                });

                return Promise.all([
                  window.api.getSettings('select.odpe'),
                  window.api.getSettings('select.variable')
                ]);
              })
              .then(function ([odpeResult, variableResult]) {
                const savedOdpe = odpeResult.value;
                const savedVariable = variableResult.value;

                if (savedOdpe && selectOdpe && selectOdpe.querySelector(`option[value="${savedOdpe}"]`)) {
                  if (window.jQuery) { $(selectOdpe).val(savedOdpe).trigger('change'); if (selectOdpeFilters) $(selectOdpeFilters).val(savedOdpe).trigger('change'); }
                  else { selectOdpe.value = savedOdpe; if (selectOdpeFilters) selectOdpeFilters.value = savedOdpe; selectOdpe.dispatchEvent(new Event('change', { bubbles: true })); }
                }

                if (savedVariable && selectVariableRfid && selectVariableRfid.querySelector(`option[value="${savedVariable}"]`)) {
                  if (window.jQuery) { $(selectVariableRfid).val(savedVariable).trigger('change'); if (selectVariableRfidFilters) $(selectVariableRfidFilters).val(savedVariable).trigger('change'); }
                  else { selectVariableRfid.value = savedVariable; if (selectVariableRfidFilters) selectVariableRfidFilters.value = savedVariable; selectVariableRfid.dispatchEvent(new Event('change', { bubbles: true })); }
                }

                if (selectOdpe && selectOdpe.value && selectVariableRfid && selectVariableRfid.value) {
                  f.views.getHomeData();
                }
              })
              .catch(err => console.error('Error al cargar selects impresora:', err));
          } else {
            if (!savedProceso) UIkit.modal('#modal-change-ponit-print').show();
          }
        }).catch(error => {
          console.error('Error al cargar datos impresora:', error);
        });
      },

      // Vista 3 Arco: proceso + variables (según proceso) + odpe (según proceso) + local (según odpe)
      loadDataArco: function() {
        Promise.all([
          window.api.getSettings('select.proceso.arco'),
          window.api.getSettings('select.variable.arco'),
          window.api.getSettings('select.odpe.arco'),
          window.api.getSettings('select.local.arco')
        ]).then(([procesoResult, variableResult, odpeResult, localResult]) => {
          const savedProceso = procesoResult.value || '';
          const savedVariable = variableResult.value || '';
          const savedOdpe = odpeResult.value || '';
          const savedLocal = localResult.value || '';
          const selectProcesoArco = document.getElementById('selectProcesoArco');
          const selectVariableArco = document.getElementById('selectVariableArco');
          const selectOdpeArco = document.getElementById('selectOdpeArco');

          if (savedProceso && selectProcesoArco) {
            if (window.jQuery) { $(selectProcesoArco).val(savedProceso).trigger('change'); }
            else { selectProcesoArco.value = savedProceso; selectProcesoArco.dispatchEvent(new Event('change', { bubbles: true })); }

            window.api.findProcesoElectoral({ id: savedProceso })
              .then(function (response) {
                if (response && response.data && response.data.proceso) {
                  $("#proceso_electoral-arco").text(response.data.proceso.name);
                  $("#proceso_electoral_descripcion_arco").html(response.data.proceso.description);
                }
              })
              .catch(err => console.error('Error al obtener proceso electoral (arco):', err));

            if (selectVariableArco) selectVariableArco.innerHTML = '<option value="">-- Seleccione variable --</option>';

            window.api.getSelects2({ idProceso: savedProceso, type: 'punto-control-arco' })
              .then(function (response) {
                (response.variables || []).forEach(v => {
                  const option = document.createElement('option');
                  option.value = v.id;
                  option.textContent = v.name;
                  if (selectVariableArco) selectVariableArco.appendChild(option);
                });

                if (selectOdpeArco) {
                  selectOdpeArco.innerHTML = '<option value="">-- Seleccionar ODPE --</option>';
                  (response.odpe || []).forEach(o => {
                    const option = document.createElement('option');
                    option.value = o.id;
                    option.textContent = o.name;
                    selectOdpeArco.appendChild(option);
                  });
                }

                if (savedVariable && selectVariableArco && selectVariableArco.querySelector(`option[value="${savedVariable}"]`)) {
                  if (window.jQuery) { $(selectVariableArco).val(savedVariable).trigger('change'); }
                  else { selectVariableArco.value = savedVariable; selectVariableArco.dispatchEvent(new Event('change', { bubbles: true })); }
                  try { $('#nombre-variable').text($(selectVariableArco).find('option:selected').text() || ''); } catch(e){}
                }

                if (savedOdpe && selectOdpeArco && selectOdpeArco.querySelector(`option[value="${savedOdpe}"]`)) {
                  if (window.jQuery) { $(selectOdpeArco).val(savedOdpe).trigger('change'); }
                  else { selectOdpeArco.value = savedOdpe; selectOdpeArco.dispatchEvent(new Event('change', { bubbles: true })); }
                  f.views.getLocales();
                  if (savedLocal) {
                    setTimeout(() => {
                      const selectLocal = document.getElementById('selectLocal');
                      if (selectLocal && selectLocal.querySelector(`option[value="${savedLocal}"]`)) {
                        if (window.jQuery) { $(selectLocal).val(savedLocal).trigger('change'); }
                        else { selectLocal.value = savedLocal; selectLocal.dispatchEvent(new Event('change', { bubbles: true })); }
                      }
                    }, 300);
                  }
                }
              })
              .catch(err => console.error('Error al cargar selects arco:', err));
          }

          if (!savedProceso || !savedVariable) {
            UIkit.modal('#modal-change-point-arco').show();
          }
        }).catch(error => {
          console.error('Error al cargar datos arco:', error);
        });
      },
        getSelects2() {
          window.api.getSettings('view.type')
          .then((result) => {
          const type = result.value || 'punto-control-rfid';
          const params = {
            idProceso: type === 'punto-control-arco' ? $("#selectProcesoArco").val() : $("#selectProcesoPrint").val(),
            type,
          };

          const selectOdpe = type === 'punto-control-impresora' ? document.getElementById('selectOdpe') : document.getElementById('selectOdpeArco');

          const selectVariableRfid = type === 'punto-control-arco' ? document.getElementById('selectVariableArco') : document.getElementById('selectVariableRfid');
          const selectOdpeFilters = document.getElementById('selectOdpeFilters');
          const selectVariableRfidFilters = document.getElementById('selectVariableRfidFilters');

          if (!params.idProceso) {
            if (selectOdpe) selectOdpe.innerHTML = '<option value="">-- Seleccionar ODPE --</option>';
            if (selectVariableRfid) selectVariableRfid.innerHTML = '<option value="">-- Seleccionar variable RFID --</option>';
            if (selectOdpeFilters) selectOdpeFilters.innerHTML = '<option value="">-- Seleccionar ODPE --</option>';
            if (selectVariableRfidFilters) selectVariableRfidFilters.innerHTML = '<option value="">-- Seleccionar variable RFID --</option>';
            return;
          }

          window.api.getSelects2(params)
          .then(function (response) {
            if(type === 'punto-control-arco'){
              if (selectVariableRfid) selectVariableRfid.innerHTML = '<option value="">-- Seleccionar variable RFID --</option>';
                (response.variables || []).forEach(p => {
                const option = document.createElement('option');
                option.value = p.id;
                option.textContent = p.name;
                if (selectVariableRfid) selectVariableRfid.appendChild(option);
              });

              if (selectOdpe) selectOdpe.innerHTML = '<option value="">-- Seleccionar ODPE --</option>';
              (response.odpe || []).forEach(p => {
                const option = document.createElement('option');
                option.value = p.id;
                option.textContent = p.name;
                selectOdpe.appendChild(option);
              });
            }else{
              //Limpiar selects de filtros
              if (selectOdpeFilters) selectOdpeFilters.innerHTML = '<option value="">-- Seleccionar ODPE --</option>';
              if (selectVariableRfidFilters) selectVariableRfidFilters.innerHTML = '<option value="">-- Seleccionar variable RFID --</option>';

              // limpiar por si se vuelve a cargar
              if (selectOdpe) selectOdpe.innerHTML = '<option value="">-- Seleccionar ODPE --</option>';
              if (selectVariableRfid) selectVariableRfid.innerHTML = '<option value="">-- Seleccionar variable RFID --</option>';

              // procesos
              (response.odpe || []).forEach(p => {
              const option = document.createElement('option');
              option.value = p.id;
              option.textContent = p.name;
              selectOdpe.appendChild(option);
              if (selectOdpeFilters) selectOdpeFilters.appendChild(option.cloneNode(true));
              });

              (response.variables || []).forEach(p => {
              const option = document.createElement('option');
              option.value = p.id;
              option.textContent = p.name;
              if (selectVariableRfid) selectVariableRfid.appendChild(option);
              if (selectVariableRfidFilters) selectVariableRfidFilters.appendChild(option.cloneNode(true));
              });
            }

            // Seleccionar claves guardadas según tipo
            const odpeKey = type === 'punto-control-arco' ? 'select.odpe.arco' : 'select.odpe';
            const variableKey = type === 'punto-control-arco' ? 'select.variable.arco' : 'select.variable';

            return Promise.all([
            window.api.getSettings(odpeKey),
            window.api.getSettings(variableKey)
            ]);
          })
          .then(function ([odpeResult, variableResult]) {
            if(type === 'punto-control-arco'){
              const savedVariableArco = variableResult.value;
              if (savedVariableArco && selectVariableRfid.querySelector(`option[value="${savedVariableArco}"]`)) {
                if (window.jQuery) { $(selectVariableRfid).val(savedVariableArco).trigger('change'); }
                else { selectVariableRfid.value = savedVariableArco; selectVariableRfid.dispatchEvent(new Event('change', { bubbles: true })); }
                try { $('#nombre-variable').text($(selectVariableRfid).find('option:selected').text() || ''); } catch(e){}
              }

              const savedOdpe = odpeResult.value;
              if (savedOdpe && selectOdpe.querySelector(`option[value="${savedOdpe}"]`)) {
                if (window.jQuery) { $(selectOdpe).val(savedOdpe).trigger('change'); }
                else { selectOdpe.value = savedOdpe; selectOdpe.dispatchEvent(new Event('change', { bubbles: true })); }
              }

              if (selectOdpe && selectOdpe.value) {
                f.views.getLocales();
              }
            }else{
              const savedOdpe = odpeResult.value;
              const savedVariable = variableResult.value;

              if (savedOdpe && selectOdpe.querySelector(`option[value="${savedOdpe}"]`)) {
              if (window.jQuery) { $(selectOdpe).val(savedOdpe).trigger('change'); if (selectOdpeFilters) $(selectOdpeFilters).val(savedOdpe).trigger('change'); }
              else { selectOdpe.value = savedOdpe; if (selectOdpeFilters) selectOdpeFilters.value = savedOdpe; selectOdpe.dispatchEvent(new Event('change', { bubbles: true })); }
              }

              if (savedVariable && selectVariableRfid && selectVariableRfid.querySelector(`option[value="${savedVariable}"]`)) {
              if (window.jQuery) { $(selectVariableRfid).val(savedVariable).trigger('change'); if (selectVariableRfidFilters) $(selectVariableRfidFilters).val(savedVariable).trigger('change'); }
              else { selectVariableRfid.value = savedVariable; if (selectVariableRfidFilters) selectVariableRfidFilters.value = savedVariable; selectVariableRfid.dispatchEvent(new Event('change', { bubbles: true })); }
              }

              if (selectOdpe && selectOdpe.value && selectVariableRfid && selectVariableRfid.value) {
                f.views.getHomeData();
              }
            }

          })
          .catch(error => {
            console.error('Error al obtener selects:', error);
          });
          })

      },
      getLocales(){
        const params = {
            idProceso: $("#selectProcesoArco").val() || $("#selectProcesoPrint").val(),
            idOdpe: $("#selectOdpeArco").val() || $("#selectOdpe").val(),
        }

        const selectLocal = document.getElementById('selectLocal');
        if (!params.idOdpe) {
          if (selectLocal) selectLocal.innerHTML = '<option value="">-- Seleccionar local --</option>';
          return;
        }

        window.api.getLocales(params)
          .then(function (response) {
            if (!response || response.success === false) {
              console.error('Error al obtener locales:', response && response.error ? response.error : response);
              return;
            }

            const locales = response.locales || [];
            if (!selectLocal) return;
            selectLocal.innerHTML = '<option value="">-- Seleccionar local --</option>';
            locales.forEach(p => {
              const option = document.createElement('option');
              option.value = p.id;
              option.textContent = p.name || p.nombre || (p.code || p.codigo) || p.id;
              selectLocal.appendChild(option);
            });
          })
          .catch(error => {
            console.error('Error al obtener locales:', error);
          });
      },
      getHomeData(page = 1) {
        const params = {
            idProcesoElectoral: $("#selectProcesoPrint").val(),
            idOdpe: $("#selectOdpe").val(),
            idVariable: $("#selectVariableRfid").val(),
            page,
        };

        if(!params.idOdpe || !params.idVariable){
            showAppAlert('Seleccione ODPE y variable para mostrar datos', 'warning');
            return;
        }

        // ...existing code...

        window.api.getHomeData(params)
          .then(function (response) {
            // ...existing code...
            renderMarcacionesPagination(
              response.data.marcaciones,
              response.data.marcaciones_pagination
            );

            $("#progress_rfid_text").text(response.data.progress_rfid_text);
            $("#progress_barcode_text").text(response.data.progress_barcode_text);

            $("#progress-bar-rfid").attr('value', response.data.rfid_porcentaje);
            $("#progress-bar-barcode").attr('value', response.data.barcode_porcentaje);
          })
          .catch(error => {
            // ...existing code...
          });

      },
      restart_game: function () {
        $(document).on("pointerup", ".uk-btn-restart-game", function (e) {
          $(".handle-close").trigger("pointerup");
        });
      },

      test_buttons: function () {
        $(document).on("pointerup", ".uk-button-test", function (e) {
          e.preventDefault();

          const idProcesoElectoral = $("#selectProceso").val();
          if (!idProcesoElectoral) {
            showAppAlert('Seleccione un proceso electoral', 'warning');
            return;
          }

          const idMaterial = $("#selectMaterial").val();
          if (!idMaterial) {
            showAppAlert('Seleccione un material', 'warning');
            return;
          }



          const data = {
            idProcesoElectoral,
            idMaterial,
            codigos: [
                "06459001",
                "06459002",
                "06459003",
                "06459004",

                "08551301",
                "08551302",
                "08551303",
                "08551304",

                "08551401",
                "08551402",
                "08551403",
                "08551404",
                


            ]
          }
          // var codes = f.views.identificarCategorias([
          //     'SU001RPRCO0434CSU0006',
          //     'C000132123D',
          //     'C000142123D',
          //     'A7D9F3KQ2M',
          //     'A7D9F3KQ2T',
          //     '000013INS',
          //     '000014INS',
          // ]);
          // console.log('Códigos identificados:', codes);

          // Cancelar cualquier timeout de mensaje anterior antes de enviar
          f.rfidBuffer.clearMessageTimeouts();

          // Remover animaciones previas inmediatamente
          $(".uk-card-message").removeClass('uk-animation-shake has-error');
          $(".uk-card-message").css('transform', '');

          // Enviar datos al backend de Node.js
          window.api.enviarCategorias(data)
            .then(function (response) {
              $(".uk-card-message").html(response.message);
              f.rfidBuffer.adjustMessageTypography();

              if (!response.isSuccess) {
                playError();
                $(".uk-card-message").addClass('has-error');

                // Animación de error (shake) por 10 segundos
                $(".uk-card-message").addClass('uk-animation-shake');
                f.rfidBuffer.messageTimeouts.shake = setTimeout(function() {
                  $(".uk-card-message").removeClass('uk-animation-shake');
                }, 10000);

                if(response.data.caja_traslado){
                    $("#n_caja_traslado").text(response.data.caja_traslado);
                }


                return;
              }

              if (response.data.hasError) {
                playError();
                $(".uk-card-message").addClass('has-error');

                // Animación de error (shake) por 10 segundos
                $(".uk-card-message").addClass('uk-animation-shake');
                f.rfidBuffer.messageTimeouts.shake = setTimeout(function() {
                  $(".uk-card-message").removeClass('uk-animation-shake');
                }, 10000);
              } else {
                playSuccess();
                $(".uk-card-message").removeClass('has-error');

                // Animación de éxito (scale pulse) por 2 segundos
                $(".uk-card-message").css({
                  'transform': 'scale(1.05)',
                  'transition': 'transform 0.3s ease'
                });
                f.rfidBuffer.messageTimeouts.scale = setTimeout(function() {
                  $(".uk-card-message").css('transform', 'scale(1)');
                }, 2000);
              }


              $("#n_caja_traslado").text(response.data.caja_traslado);
              //$("#odpe").text(response.data.odpe);
              //$("#local").text(response.data.local);

              f.views.renderMesas(response.data.mesas);

              $("#progress-bar").attr('max', response.data.porcentaje.total);
              $("#progress-bar").attr('value', response.data.porcentaje.count);

            })
            .catch(function (error) {
                console.log(error);
              playError();
              $(".uk-card-message").addClass('has-error');
              $(".uk-card-message").html('Error de conexión');
              f.rfidBuffer.adjustMessageTypography();

              // Animación de error (shake) por 10 segundos
              $(".uk-card-message").addClass('uk-animation-shake');
              f.rfidBuffer.messageTimeouts.shake = setTimeout(function() {
                $(".uk-card-message").removeClass('uk-animation-shake');
              }, 10000);
            });
        });

        $(document).on("pointerup", ".uk-button-test-impresion", function (e) {
          e.preventDefault();

          const idProcesoElectoral = $("#selectProcesoPrint").val();
          if (!idProcesoElectoral) {
            showAppAlert('Seleccione un proceso electoral', 'warning');
            return;
          }

          const idVariable = $("#selectVariableRfid").val();
          if (!idVariable) {
            showAppAlert('Seleccione una variable', 'warning');
            return;
          }



          const data = {
            idProcesoElectoral,
            idOdpe: $("#selectOdpe").val(),
            idVariable,
            type: 'rfid',
            codigos: [
                "08552601",
                "08552602",
                "08552603",
                "08552604",
                "08774201",
                "08774202",
                "08774302"
            ]
          }
          // Cancelar cualquier timeout de mensaje anterior antes de enviar
          f.rfidBuffer.clearMessageTimeouts();

          // Remover animaciones previas inmediatamente
          $(".uk-card-message").removeClass('uk-animation-shake has-error');
          $(".uk-card-message").css('transform', '');

          // Enviar datos al backend de Node.js
          window.api.validarRfid(data)
            .then(function (response) {
              if (!response.isSuccess) {
                showAppAlert(response.message || 'No se pudo validar RFID', 'danger');
                return;
              }

              showAppAlert(response?.message || 'Codigos validados correctamente', 'success', 2200);

               if(response.data.odpe_finish == 1){
                    let text = $("#selectOdpe option[value='" + response.data.odpe_id + "']").text();
                    $("#selectOdpe option[value='" + response.data.odpe_id + "']").text(text + " (Completado)");
                }

                f.views.getHomeData();

            })
            .catch(function (error) {
                console.log(error);
              playError();
              $(".uk-card-message").addClass('has-error');
              $(".uk-card-message").html('Error de conexión');
              f.rfidBuffer.adjustMessageTypography();

              // Animación de error (shake) por 10 segundos
              $(".uk-card-message").addClass('uk-animation-shake');
              f.rfidBuffer.messageTimeouts.shake = setTimeout(function() {
                $(".uk-card-message").removeClass('uk-animation-shake');
              }, 10000);
            });
        });

      },
      renderMesas(mesas) {
            let html = '';

            $.each(mesas, function (mesa, info) {

                const hasError = info.some(item => item.valor == "No identificado");
                const containerBg = hasError ? '#FF3131' : '#38b000';
                console.log('Mesa:', mesa, 'Info:', info);
                const odpe = info[0]?.odpe || 'No identificado';
                const local = info[0]?.local || 'No identificado';

                html += `
                <div class="uk-width-1-3@m">
                    <div class="uk-card uk-card-tag-container uk-card-primary uk-card-body hover-lift"  style="background:${containerBg}">
                        <div class="uk-child-width-1-1@m uk-grid-row-small uk-grid-small uk-grid-match" uk-grid>

                        <div class="uk-grid uk-grid-small uk-flex-middle">
                            <div class="uk-width-expand"><h5 style="margin: 0;color: #000;font-size:20px;font-weight:bold;">${odpe}</h5></div>
                            <div class="uk-width-auto" style="text-align:right;"><span style="background: ${info.length == 4 ? '#32d296' : '#C12A2A'};padding: 5px;border-radius: 5px;font-size: 13px;">${info.length == 4 ? 'Correcto' : 'Con error'}</span></div>
                        </div>

                        <div class="uk-grid uk-grid-small uk-flex-middle">
                            <div class="uk-width-expand"><h6 style="margin: 0;color:#000;font-size: 16px;font-weight: 500;">${local}</h6></div>
                            <div class="uk-width-auto" style="text-align:right;"><span style="font-size:20px;color:#000;font-weight:bold;">${info.length}/4</span></div>
                        </div>
                `;

                $.each(info, function (i, item) {
                    const itemValor = item.valor || 'No identificado';
                    const itemVariable = item.variable || 'Sin información';
                    
                    html += `
                        <div>
                            <div class="uk-card uk-card-tag uk-card-small uk-card-default uk-card-body">
                                <div class="uk-flex uk-flex-between@s uk-flex-middle">

                                    <div class="uk-card-tag-left uk-flex uk-flex-middle">
                                        <div class="uk-card-tag-icon" ${itemValor == "No identificado" ? 'style="background-color: #FF3131!important"' : ''}>
                                            <img src="public/icons/nfc.svg" alt="">
                                        </div>
                                        <div class="uk-card-tag-text uk-margin-small-left">
                                            <p class="uk-card-tag-title">${itemValor}</p>
                                            <span class="uk-card-tag-status">${itemVariable}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <span uk-icon="icon: clock"></span>
                                        ${new Date().toLocaleTimeString('es-PE', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>

                                </div>
                            </div>
                        </div>
                    `;
                });

                html += `
                        </div>
                    </div>
                </div>
                `;
            });

            $('#mesas-container').html(html);

            // 🔥 Importante: para que UIkit reactive el grid y los iconos
            UIkit.update('#mesas-container');
        },

            renderCurrentReading() {
              const currentTags = f.rfidBuffer.tags instanceof Set ? [...f.rfidBuffer.tags] : [];

              if (currentTags.length === 0) {
              return;
            }

            const currentTime = new Date().toLocaleTimeString('es-PE', {
              hour: '2-digit',
              minute: '2-digit'
            });

            const isArcoVisible = $('#punto-control-arco').is(':visible');

              const readingsMap = {};
              (f.rfidBuffer.readingsHistory || []).forEach((reading) => {
                if (!reading || !reading.epc) {
                  return;
                }

                const transformed = f.rfidBuffer.transformExampleData(reading.epc);
                if (!readingsMap[transformed]) {
                  readingsMap[transformed] = reading;
                }
              });

              let tagsHtml = '';
              currentTags.forEach((epc) => {
                const reading = readingsMap[epc] || {};
                const rssiValue = reading.rssi !== undefined && reading.rssi !== null ? reading.rssi : '--';

                if (isArcoVisible) {
                  tagsHtml += `
                    <div>
                      <div class="uk-card uk-card-tag uk-card-small uk-card-muted uk-card-body" style="padding:6px 8px; border-radius:8px;">
                        <div class="uk-flex uk-flex-between@s uk-flex-middle" style="gap:6px;">

                          <div class="uk-card-tag-left uk-flex uk-flex-middle" style="min-width:0;">
                            <div class="uk-card-tag-icon" style="width:20px;height:20px;min-width:20px;">
                              <img src="public/icons/nfc.svg" alt="" style="">
                            </div>
                            <div class="uk-card-tag-text uk-margin-small-left" style="min-width:0;">
                              <p class="uk-card-tag-title" style="margin:0;font-size:17px;line-height:1.2;word-break:break-all;">${epc}</p>
                              <span class="uk-card-tag-status" style="display:block;font-size:9px;line-height:1.15;">RSSI: ${rssiValue}</span>
                            </div>
                          </div>

                          <div  style="font-size:9px;line-height:1.1;white-space:nowrap;">
                            <span uk-icon="icon: clock; ratio: 0.55"></span>
                            ${currentTime}
                          </div>

                        </div>
                      </div>
                    </div>
                  `;
                } else {
                  tagsHtml += `
                    <div>
                      <div class="uk-card uk-card-tag uk-card-small uk-card-muted uk-card-body">
                        <div class="uk-flex uk-flex-between@s uk-flex-middle">

                          <div class="uk-card-tag-left uk-flex uk-flex-middle">
                            <div class="uk-card-tag-icon">
                              <img src="public/icons/nfc.svg" alt="">
                            </div>
                            <div class="uk-card-tag-text uk-margin-small-left">
                              <p class="uk-card-tag-title">${epc}</p>
                              <span class="uk-card-tag-status">Lectura actual · RSSI: ${rssiValue}</span>
                            </div>
                          </div>

                          <div>
                            <span uk-icon="icon: clock"></span>
                            ${currentTime}
                          </div>

                        </div>
                      </div>
                    </div>
                  `;
                }
              });

            const html = isArcoVisible
              ? `
                <div class="uk-card uk-card-tag-container uk-card-primary uk-card-body" style="padding:10px;">
                  <div class="uk-child-width-1-2 uk-child-width-1-5@s uk-child-width-1-6@m uk-grid-row-small uk-grid-small uk-grid-match" uk-grid>
                    ${tagsHtml}
                  </div>
                </div>
              `
              : `
                <div class="uk-width-1-1@m">
                  <div class="uk-card uk-card-tag-container uk-card-primary uk-card-body hover-lift">
                    <div class="uk-child-width-1-2@m uk-grid-row-small uk-grid-small uk-grid-match" uk-grid>
                      ${tagsHtml}
                    </div>
                  </div>
                </div>
              `;

            // Mostrar lecturas en tiempo real según vista activa.
            // - Arco: contenedor dedicado para no reemplazar tabs ni tablas de resultados
            // - Resto: contenedor #mesas-container
            if (isArcoVisible) {
              $('.uk-overflow-table-arco-result').hide();
              $('#arcos-live-readings').show();
              $('#arcos-live-readings-content').html(html);
              UIkit.update('#arcos-live-readings-content');
              // Auto-scroll al final del contenedor
              const liveContainer = document.getElementById('arcos-live-readings-content');
              if (liveContainer) liveContainer.scrollTop = liveContainer.scrollHeight;
              return;
            }

            $('#mesas-container').html(html);
            UIkit.update('#mesas-container');
          },

      identificarCategorias: function (codigos) {
        const patrones = [{
          key: "paquete_instalacion",
          // Patrón: 6 dígitos + INS
          regex: /^\d{6}INS$/i,
          prioridad: 1,
        },
        {
          key: "codigo_cedula",
          // Patrón: C + 6 dígitos (num_mesa) + dígitos (cantidad_electores) + letra (tipo_consulta)
          regex: /^C\d{6}\d+[A-Z]$/i,
          prioridad: 2,
        },
        {
          key: "caja_traslado",
          // Patrón: SU + dígitos + letras/números + CSU + dígitos
          regex: /^SU\d+[A-Z0-9]+CSU\d+$/i,
          prioridad: 3,
        },
        {
          key: "paquete_escrutinio",
          // Patrón: 10 caracteres alfanuméricos aleatorios (mayúsculas y números)
          regex: /^[A-Z0-9]{10}$/i,
          prioridad: 4,
        },
        ];

        const resultado = {
          paquete_instalacion: [],
          codigo_cedula: [],
          caja_traslado: [],
          paquete_escrutinio: [],
          desconocido: [],
        };

        codigos.forEach((codigo) => {
          let encontrado = false;

          for (const patron of patrones) {
            if (patron.regex.test(codigo)) {
              resultado[patron.key].push(codigo);
              encontrado = true;
              break;
            }
          }

          if (!encontrado) {
            resultado.desconocido.push(codigo);
          }
        });

        return resultado;
      },

      loadresources: function () {
        // window.api.getRopas().then((data) => {
        //   $cames_container = $("#all_games_list_containter");
        //   $cames_container.html("");
        // });
        f.views.welcome();
        f.views.quiz();
        f.views.inactividad_game();
      },
      inactividad_game: function () {
        var inactivityTime = function () {
          var time;

          window.onload = resetTimer;
          document.onmousemove = resetTimer;
          document.onkeypress = resetTimer;
          document.onpointerup = resetTimer;
          document.ontouchstart = resetTimer;
          document.ontouchend = resetTimer;
          document.ontouchmove = resetTimer;

          function logout() {
            // Verificar si hay algún modal abierto
            if ($(".uk-modal.uk-open").length > 0) {
              resetTimer(); // Reiniciar el timer si hay modal abierto
              return;
            }

            $(".uk-game-section").each(function () {
              if ($(this).css("display") === "block") {
                var current_section = $(this).data("section");
                if (current_section === "home") {
                  // En home, ir a mapa después de 15 segundos
                  // $(".uk-game-section").hide();
                  // $(".uk-game-section-mapa").fadeIn();
                  clearTimeout(time);
                  time = setTimeout(logout, 1000 * 60 * 2);
                } else if (current_section === "mapa") {
                  $(".uk-game-section").hide();
                  $(".uk-game-section-home").fadeIn();
                  clearTimeout(time);
                  time = setTimeout(logout, 1000 * 60 * 2);
                } else if (current_section === "info") {
                  $(".uk-game-section").hide();
                  $(".uk-game-section-mapa").fadeIn();
                  // Después de ir a mapa, iniciar timer de 15 segundos para ir a home
                  clearTimeout(time);
                  time = setTimeout(logout, 1000 * 60 * 2);
                }

                console.log(
                  "Sección actual antes de reiniciar:",
                  current_section
                );
              }
            });
          }

          function resetTimer() {
            clearTimeout(time);

            // Determinar el timeout según la sección actual
            var currentSection = null;
            $(".uk-game-section").each(function () {
              if ($(this).css("display") === "block") {
                currentSection = $(this).data("section");
                return false; // break
              }
            });

            var timeoutDuration = 1000 * 60 * 2; // default para mapa y home (15 segundos)
            if (currentSection === "info") {
              timeoutDuration = 10000; // 10 segundos para info
            }

            time = setTimeout(logout, timeoutDuration);
          }
        };
        inactivityTime();
      },
      welcome: function () {
        $('#arcos-tabs').on('click', 'li', function(e){
            e.preventDefault();
            var $li = $(this);
            $('#arcos-tabs li').removeClass('uk-active');
            $li.addClass('uk-active');
            var idx = $li.index();
            // find the closest switcher related to these tabs
            var $switcher = $('#arcos-tabs').closest('[uk-tab]').nextAll('.uk-switcher').first();
            if(!$switcher.length) $switcher = $('.uk-switcher').first();
            $switcher.children().removeClass('uk-active');
            $switcher.children().eq(idx).addClass('uk-active');
        });
        $(document).ready(function () {
          $("#preloader").fadeOut("slow", function () {
            $(this).remove();
          });
        });

        $(".uk-btn-welcome-start").on("pointerup", function (e) {
          $(".uk-game-section").hide();
          $(".uk-game-section-mapa").fadeIn();
          f.views.restartQuiz();

          e.preventDefault();
        });

        $(".uk-btn-region").on("pointerup", function (e) {
          $(".uk-game-section").hide();
          var region = $(this).data("region");
          if (region) {
            $(".uk-game-section-region-" + region).fadeIn();
          } else {
            $(".uk-game-section-region").fadeIn();
          }
          e.preventDefault();
        });

        $(".uk-btn-return").on("pointerup", function (e) {
          $(".uk-game-section").hide();
          var goto = $(this).data("goto");
          f.views.restartQuiz();

          if (goto) {
            $(".uk-game-section-" + goto).fadeIn();
          } else {
            $(".uk-game-section-region").fadeIn();
          }
          e.preventDefault();
        });

        $(".uk-toggle-video").on("pointerup", function () {
          $.each($("video"), function (i, e) {
            e.currentTime = 0;
            $(this).on("ended", function () {
              var modal = $(this).closest(".uk-modal");
              UIkit.modal(modal).hide();
            });
          });
        });

        $(document).on('change', '#selectProceso', function() {
          const idProcesoElectoral = $(this).val();
          const selectMaterial = document.getElementById('selectMaterial');
          if (!idProcesoElectoral) {
            selectMaterial.innerHTML = '<option value="">-- Seleccione material --</option>';
            return;
          }
          // Usar window.api para obtener materiales (siguiendo el patrón de otros handlers)
          window.api.getSelectsMateriales({ idProcesoElectoral })
            .then(function(response) {
              selectMaterial.innerHTML = '<option value="">-- Seleccione material --</option>';
              if (response && Array.isArray(response.materiales)) {
                response.materiales.forEach(m => {
                  const option = document.createElement('option');
                  option.value = m.id;
                  option.textContent = m.name;
                  selectMaterial.appendChild(option);
                });
              }
            })
            .catch(function(error) {
              selectMaterial.innerHTML = '<option value="">-- Seleccione material --</option>';
              console.error('Error al cargar materiales:', error);
            });
        });

        // Cuando cambia el proceso en el modal de ARCO, cargar las variables correspondientes
        $(document).on('change', '#selectProcesoArco', function() {
          const idProcesoElectoral = $(this).val();
          const selectVariableArco = document.getElementById('selectVariableArco');
          const selectOdpeArco = document.getElementById('selectOdpeArco');
          if (!idProcesoElectoral) {
            selectVariableArco.innerHTML = '<option value="">-- Seleccione variable --</option>';
            if (selectOdpeArco) selectOdpeArco.innerHTML = '<option value="">-- Seleccionar ODPE --</option>';
            return;
          }

          window.api.getSettings('view.type')
          .then((result) => {
            const type = result.value || 'punto-control-rfid';
            const params = {
                idProceso: $("#selectProcesoArco").val(),
                type,
            };

            // Usar getSelects2 para obtener variables filtradas por proceso
            window.api.getSelects2(params)
                .then(function(response) {
                selectVariableArco.innerHTML = '<option value="">-- Seleccione variable --</option>';
                if (selectOdpeArco) selectOdpeArco.innerHTML = '<option value="">-- Seleccionar ODPE --</option>';
                if (response) {
                  if (Array.isArray(response.variables)) {
                    response.variables.forEach(v => {
                      const option = document.createElement('option');
                      option.value = v.id;
                      option.textContent = v.name || v.variable || v.label || v.id;
                      selectVariableArco.appendChild(option);
                    });
                  }
                  if (Array.isArray(response.odpe) && selectOdpeArco) {
                    response.odpe.forEach(o => {
                      const option = document.createElement('option');
                      option.value = o.id;
                      option.textContent = o.name;
                      selectOdpeArco.appendChild(option);
                    });
                  }
                }
                // Aplicar variable ARCO guardada (si existe)
                window.api.getSettings('select.variable.arco')
                  .then(function(varRes) {
                    const savedVar = varRes && varRes.value ? varRes.value : '';
                    if (!savedVar) return;
                    const opt = selectVariableArco.querySelector(`option[value="${savedVar}"]`);
                    if (opt) {
                      if (window.jQuery) { $(selectVariableArco).val(savedVar).trigger('change'); }
                      else { selectVariableArco.value = savedVar; selectVariableArco.dispatchEvent(new Event('change', { bubbles: true })); }
                      try { $('#nombre-variable').text($(selectVariableArco).find('option:selected').text() || ''); } catch(e){}
                    } else {
                      // crear opción temporal y seleccionarla
                      const tmpOpt = document.createElement('option');
                      tmpOpt.value = savedVar;
                      tmpOpt.textContent = savedVar;
                      selectVariableArco.appendChild(tmpOpt);
                      if (window.jQuery) { $(selectVariableArco).val(savedVar).trigger('change'); }
                      else { selectVariableArco.value = savedVar; selectVariableArco.dispatchEvent(new Event('change', { bubbles: true })); }
                      try { $('#nombre-variable').text($(selectVariableArco).find('option:selected').text() || ''); } catch(e){}
                    }
                  })
                  .catch(function(err){ console.error('Error al leer select.variable.arco:', err); });
                // Actualizar título y descripción del proceso seleccionado para ARCO
                window.api.findProcesoElectoral({ id: idProcesoElectoral })
                  .then(function (resp) {
                    if (resp && resp.data && resp.data.proceso) {
                      $("#proceso_electoral-arco").text(resp.data.proceso.name);
                      $("#proceso_electoral_descripcion_arco").html(resp.data.proceso.description);
                    }
                  })
                  .catch(err => console.error('Error al obtener proceso electoral (arco) al cambiar proceso:', err));
                })
                .catch(function(error) {
                selectVariableArco.innerHTML = '<option value="">-- Seleccione variable --</option>';
                console.error('Error al cargar variables para arco:', error);
                });
            });
        });

        $(document).on('change', '#selectOdpe', () => {
            const selectVariableRfid = $("#selectVariableRfid").val();

            window.api.saveSettings('select.odpe', $("#selectOdpe").val())
              .catch(error => {
                console.error('Error al guardar ODPE seleccionada:', error);
              });

            // Cargar locales cada vez que cambia la ODPE
            f.views.getLocales();

            if(selectVariableRfid){
                f.views.getHomeData();
            }
        });

        // Guardar ODPE ARCO y cargar locales cuando cambia
        $(document).on('change', '#selectOdpeArco', function() {
            const val = $(this).val();
            window.api.saveSettings('select.odpe.arco', val)
              .catch(error => {
                console.error('Error al guardar ODPE ARCO seleccionada:', error);
              });

            // Cargar locales para ARCO
            f.views.getLocales();
        });

        // Guardar selectLocal de forma específica para ARCO o global dependiendo de la vista
        $(document).on('change', '#selectLocal', function() {
            const val = $(this).val();
            const isArcoView = $('#punto-control-arco').is(':visible') || ($('#selectOdpeArco').length && $('#selectOdpeArco').val());
            if (isArcoView) {
                window.api.saveSettings('select.local.arco', val).catch(error => {
                    console.error('Error al guardar local ARCO:', error);
                });
            } else {
                window.api.saveSettings('select.local', val).catch(error => {
                    console.error('Error al guardar local:', error);
                });
            }
        });

        $(document).on('change', '#selectVariableRfid', () => {
            window.api.saveSettings('select.variable', $("#selectVariableRfid").val())
              .catch(error => {
                console.error('Error al guardar variable RFID seleccionada:', error);
              });

            f.views.getHomeData();
        });

        //Configuración de Scanner
        onScan.attachTo(document, {
            suffixKeyCodes: [13], // Tecla Enter
            reactToPaste: false,
            minLength: 4,
            timeBeforeScanTest: 100,
            avgTimeByChar: 40,

            onScan: function (sCode) {
                let $inputs = $(".input-scan");
                let $target = $inputs.filter(function () {
                    return !$(this).val();
                }).first();

                if ($target.length === 0) {
                    // Todos llenos → sobrescribir el último
                    $target = $inputs.last();
                }

                $target.val(sCode).trigger("change");

                document.activeElement.blur();
                window.focus();
            }
        });

        $(document).on('input change', '.input-scan', function(){
          const value = ($(this).val() || '').trim();

          if (!value) {
            return;
          }

          if($("#antenna-automatic-checkbox").prop('checked')){
            f.views.validarCodigos([value], 'barcode');
          }
        });

        $("#antenna-automatic-checkbox").change(function(){
            if($(this).prop('checked')){
                $("#validar-barcode").addClass('uk-hidden');
            } else{
                $("#validar-barcode").removeClass('uk-hidden');
            }
        });

        $("#validar-barcode").click(function(){
          const codigos = $('.input-scan').map(function() {
            return ($(this).val() || '').trim();
          }).get().filter(Boolean);

          f.views.validarCodigos(codigos, 'barcode');
        });

        $("#selectOdpeArco").change(function() {
            if($(this).val()){
                f.views.getLocales();
            }
        });

        $("#validar-codigos-arcos").click(function(){
            const codigos = [
              '08552601',
              '08552602',//tab1
              '08552603',
              '08581301',
              '08581302',//tab1
              '08581303',
              '0058',
              '30782173917893128378VASDADADAD',
              '12345678',
            ];
            f.views.validarCodigosArco(codigos);
        });
      },

      validarCodigos: (codigos, type = 'rfid') => {
        const sanitizedCodigos = (codigos || []).map(c => (c || '').trim()).filter(Boolean);

        const data = {
            idProcesoElectoral: $("#selectProcesoPrint").val(),
            idOdpe: $("#selectOdpe").val(),
            idVariable: $("#selectVariableRfid").val(),
            type,
          codigos: sanitizedCodigos,
        }

        if(!data.idProcesoElectoral || !data.idOdpe || !data.idVariable){
          showAppAlert('Seleccione proceso, ODPE y variable para validar', 'warning');
          return Promise.reject(new Error('Faltan parámetros requeridos'));
        }

        if (data.codigos.length === 0) {
          showAppAlert('Ingrese al menos un codigo para validar', 'warning');
          return Promise.reject(new Error('No hay códigos para validar'));
        }

        return window.api.validarRfid(data)
        .then( (response) => {
          if (!response || response.success === false || response.isSuccess === false) {
            const errorMessage = response?.message || response?.error || 'No se pudo validar los codigos';
            showAppAlert(errorMessage, 'danger');
            return;
          }

          showAppAlert(response?.message || 'Codigos validados correctamente', 'success', 2200);


          if(response.data.odpe_finish == 1){
            let text = $("#selectOdpe option[value='" + response.data.id_odpe + "']").text();
            $("#selectOdpe option[value='" + response.data.id_odpe + "']").text(text + " (Completado)");
          }

          f.views.getHomeData();

        })
        .catch((error) => {
          console.error('Error al validar codigos:', error);
          showAppAlert('Error al validar codigos', 'danger');
        });
      },

    validarCodigosArco: (codigos = null) => {

      const sourceCodigos = Array.isArray(codigos)
        ? codigos
        : (Array.isArray(f.rfidBuffer.tags) ? f.rfidBuffer.tags : []);

      const sanitizedCodigos = sourceCodigos
        .map(c => (c || '').trim())
        .filter(Boolean);

        const data = {
            idProcesoElectoral: $("#selectProcesoArco").val(),
            idOdpe: $("#selectOdpeArco").val(),
            local: $("#selectLocal").val(),
            idVariable: $("#selectVariableArco").val(),
            codigos: sanitizedCodigos,
        }

        if(!data.idProcesoElectoral || !data.idOdpe){
          showAppAlert('Seleccione proceso y ODPE para validar', 'warning');
          return Promise.resolve(false);
        }

        if (data.codigos.length === 0) {
          showAppAlert('Ingrese al menos un codigo para validar', 'warning');
            return Promise.resolve(false);
        }

        return window.api.validarRfidArcos(data)
         .then( (response) => {

          let htmlTab1 = '';
          let htmlTab2 = '';

          (response.data.result || []).forEach(item => {
            if (item.tab == 1) {
              htmlTab1 += `
              <tr>
                <td>
                  <div>
                    <img src="public/icons/${item.estado == 'Correcto' ? 'td-success' : 'td-error'}.png" alt="" style="width:20px; margin-right:5px;">
                    <b>${item.codigo}</b>
                  </div>
                </td>
                <td>${item.odpe}</td>
                <td>${item.local}</td>
                <td>${item.created_at}</td>
                <td>${item.estado}</td>
              </tr>`;
            } else {
              htmlTab2 += `
              <tr style="background:#FFDADA">
                <td>
                    <div>
                        <img src="public/icons/td-error.png" alt="" style="width:20px; margin-right:5px;">
                        <b>${item.codigo}</b>
                    </div>
                </td>
                <td>${item.odpe}</td>
                <td>${item.local}</td>
                <td>${item.created_at}</td>
                <td>${item.estado}</td>
              </tr>`;
            }
          });

          if (!htmlTab1) {
            htmlTab1 = '<tr><td colspan="5" class="uk-text-center uk-text-muted">No hay marcaciones correctas</td></tr>';
          }
          if (!htmlTab2) {
            htmlTab2 = '<tr><td colspan="5" class="uk-text-center uk-text-muted">No hay códigos incorrectos</td></tr>';
          }

          $("#tabla-arcos-result tbody").html(htmlTab1);
          $("#tabla-arcos-incorrectos tbody").html(htmlTab2);

          // Al terminar el ciclo, ocultar panel temporal de escaneo en vivo.
          $('#arcos-live-readings-content').empty();
          $('#arcos-live-readings').hide();
          $('.uk-overflow-table-arco-result').show();

          $("#arco-correctos").text(response.data.totales.correctos + ' correctos');
          $("#arco-incorrectos").text(response.data.totales.incorrectos + ' incorrectos');
          $("#arco-tags").text(response.data.totales.total + ' tags');

          $("#progress_arco_text").text(response.data.proceso + '/' + response.data.total)
          $("#progress-bar-arco").attr('value', response.data.porcentaje);
         })
         .catch((error) => {
           console.error('Error al validar codigos en arcos:', error);
           showAppAlert('Error al validar codigos en arcos', 'danger');
           $('#arcos-live-readings-content').empty();
           $('#arcos-live-readings').hide();
           $('.uk-overflow-table-arco-result').show();
         });
    },

      quiz: function () {
        // Inicializar el sistema de quiz
        f.views.initializeQuiz();

        // Manejador para el botón de reinicio del quiz
        $(document).on("pointerup", ".uk-btn-restart-quiz", function (e) {
          e.preventDefault();
          f.views.restartQuiz();
        });

        // Código para la funcionalidad del quiz - comportamiento tipo radio button
        $(".uk-btn-answer").on("pointerup", function () {
          var btn = $(this);
          var btn_cont = btn.closest(".uk-grid-buttons-response");
          var allButtons = btn_cont.find(".uk-btn-answer");

          // Verificar si ya hay una respuesta seleccionada
          if (
            allButtons.hasClass("uk-btn-answer-selected") ||
            allButtons.prop("disabled")
          ) {
            return; // No permitir más selecciones
          }

          // Marcar el botón como seleccionado con animación
          btn.addClass("uk-btn-answer-selected");

          // Agregar animación de pulso al botón seleccionado
          btn.css("transform", "scale(1.1)");
          setTimeout(function () {
            btn.css("transform", "scale(1)");
          }, 200);

          var isCorrect = btn.data("correct");
          var answer = btn.data("answer");

          // Obtener información de la pregunta actual
          var currentQuestionElement = btn.closest(".uk-quiz-item");
          var questionText = currentQuestionElement.find("h1").text().trim();
          var helpText = currentQuestionElement.find("h1").data("help") || "";
          var questionNumber = f.quizData.currentQuestion;

          // Obtener todas las opciones disponibles para esta pregunta
          var allOptions = [];
          var correctAnswer = null;

          currentQuestionElement.find(".uk-btn-answer").each(function () {
            var optionText = $(this).text().trim();
            var optionValue = $(this).data("answer");
            var isOptionCorrect = $(this).data("correct");

            allOptions.push({
              text: optionText,
              value: optionValue,
              isCorrect: isOptionCorrect,
            });

            if (isOptionCorrect) {
              correctAnswer = optionValue;
            }
          });

          // Guardar la respuesta en el array
          var answerData = {
            questionNumber: questionNumber,
            question: questionText,
            selectedAnswer: answer,
            correctAnswer: correctAnswer,
            isCorrect: isCorrect,
            allOptions: allOptions,
            timestamp: new Date().toISOString(),
          };

          f.quizData.answers.push(answerData);

          // Después de un breve delay, mostrar el resultado
          setTimeout(function () {
            // Deshabilitar todos los botones
            allButtons.prop("disabled", true);

            if (isCorrect) {
              // Respuesta correcta
              btn
                .removeClass("uk-btn-answer-selected")
                .addClass("uk-btn-answer-success");

              // Animación de éxito
              btn.css("transform", "scale(1.1)");
              setTimeout(function () {
                btn.css("transform", "scale(1)");
              }, 300);
            } else {
              // Respuesta incorrecta
              btn
                .removeClass("uk-btn-answer-selected")
                .addClass("uk-btn-answer-error");

              // Animación de error (shake)
              btn.addClass("uk-animation-shake");
              setTimeout(function () {
                btn.removeClass("uk-animation-shake");
              }, 500);

              // Mostrar la respuesta correcta después del error
              setTimeout(function () {
                allButtons.each(function () {
                  if ($(this).data("correct") === true) {
                    $(this).addClass("uk-btn-answer-success");
                    $(this).css("transform", "scale(1.05)");
                    setTimeout(
                      function () {
                        $(this).css("transform", "scale(1)");
                      }.bind(this),
                      300
                    );
                  }
                });
              }, 800);
            }

            // Aplicar estilo deshabilitado a los botones no seleccionados
            allButtons.not(btn).addClass("uk-btn-answer-disabled");

            // Ir directo a la pantalla de gracias después de 2 segundos
            setTimeout(function () {
              f.views.finishQuiz(helpText);
            }, 2000);
          }, 500); // Delay antes de mostrar el resultado
        });

      },

      // Inicializar el sistema de quiz
      initializeQuiz: function () {
        // NO necesitamos barra de progreso para una sola pregunta

        // Obtener todas las preguntas disponibles (excluyendo el mensaje de agradecimiento)
        var allQuestions = $(".uk-quiz-item").not(".uk-quiz-thanks");

        // Seleccionar una pregunta aleatoria
        var randomIndex = Math.floor(Math.random() * allQuestions.length);
        var selectedQuestion = allQuestions.eq(randomIndex);

        // Ocultar todas las preguntas
        allQuestions.hide();

        // Mostrar solo la pregunta seleccionada
        selectedQuestion.show();

        f.quizData = {
          totalQuestions: 1, // Solo 1 pregunta
          currentQuestion: 1,
          timer: null,
          transitionTimer: null,
          answers: [], // Array para almacenar la respuesta
          selectedQuestion: selectedQuestion, // Guardar referencia a la pregunta seleccionada
        };
      },

      // Función para resetear el estado de una pregunta
      resetQuestion: function (questionElement) {
        var buttons = questionElement.find(".uk-btn-answer");
        buttons.removeClass(
          "uk-btn-answer-selected uk-btn-answer-success uk-btn-answer-error uk-btn-answer-disabled"
        );
        buttons.prop("disabled", false);
        buttons.css("transform", "");

        // Remover timer si existe
        questionElement.find(".uk-quiz-timer").remove();
      },

      // Función para finalizar el quiz
      finishQuiz: function (helpText) {
        console.log("Quiz finalizado - Mostrando mensaje de agradecimiento");

        // Mostrar el JSON con la respuesta
        console.log("=== RESULTADO DEL QUIZ ===");
        console.log("Respuesta del usuario:");
        console.log(JSON.stringify(f.quizData.answers, null, 2));

        // Obtener el resultado (solo hay 1 respuesta)
        var isCorrect =
          f.quizData.answers.length > 0 ?
            f.quizData.answers[0].isCorrect :
            false;

        console.log("=== RESULTADO ===");
        console.log("Respuesta:", isCorrect ? "CORRECTA" : "INCORRECTA");
        console.log("========================");

        // Actualizar el mensaje de agradecimiento según el resultado
        f.views.updateThanksStats(isCorrect, helpText);

        // Mostrar el mensaje de agradecimiento
        var currentQuestion = $(".uk-quiz-item:visible");
        var thanksMessage = $(".uk-quiz-thanks");

        if (thanksMessage.length > 0) {
          currentQuestion.fadeOut(300, function () {
            thanksMessage.fadeIn(500);
          });
        } else {
          // Si no hay mensaje de agradecimiento, reiniciar automáticamente
          f.views.restartQuiz();
        }
      },

      // Nueva función para actualizar el mensaje de agradecimiento según el resultado
      updateThanksStats: function (isCorrect, helpText) {
        // Actualizar el mensaje según si acertó o falló
        var resultElement = $("#quiz-result");
        var messageElement = $("#quiz-message");

        if (isCorrect) {
          resultElement.text("Correcto");
          resultElement.css("color", "#fff");
          // messageElement.text('¡Excelente! Has respondido correctamente.');
        } else {
          resultElement.text("Incorrecto");
          resultElement.css("color", "#fff");
          // messageElement.text('No te preocupes, sigue intentando.');
        }
        messageElement.text(helpText);
      },

      // Nueva función para reiniciar el quiz
      restartQuiz: function () {
        console.log("Reiniciando quiz...");

        // Detener cualquier animación y ocultar mensaje de agradecimiento y todas las preguntas
        $(".uk-quiz-item, .uk-quiz-thanks").stop(true, true).hide();

        // Resetear todas las preguntas
        $(".uk-quiz-item").each(function () {
          f.views.resetQuestion($(this));
        });

        // Resetear datos del quiz
        f.quizData.answers = []; // Limpiar respuestas anteriores

        // Seleccionar una nueva pregunta aleatoria
        var allQuestions = $(".uk-quiz-item").not(".uk-quiz-thanks");
        var randomIndex = Math.floor(Math.random() * allQuestions.length);
        var selectedQuestion = allQuestions.eq(randomIndex);

        // Mostrar la pregunta seleccionada
        selectedQuestion.fadeIn(300);

        // Actualizar referencia
        f.quizData.selectedQuestion = selectedQuestion;
      },
    },
    width: () => {
      return $(window).width();
    },
  };
  f.init({
    home: {
      nav: ".main-nav",
    },
  });
  $(f.onReady);

  // Limpiar listeners y timers al descargar la página para evitar fugas de memoria
  window.addEventListener('beforeunload', function() {
    if (window.api && window.api.removeRFIDListeners) {
      window.api.removeRFIDListeners();
    }
    if (f.rfidBuffer) {
      f.rfidBuffer.stopTimer();
      f.rfidBuffer.tags.clear();
      f.rfidBuffer.readingsHistory = [];
    }
  });
});
