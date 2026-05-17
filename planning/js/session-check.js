// Verificar sesión del hub y arrancar Planning sin mostrar su login propio

document.addEventListener('DOMContentLoaded', () => {
    if (typeof auth === 'undefined' || !auth.sesion) {
        window.location.href = 'index.html';
        return;
    }

    const s = auth.sesion;

    // Ocultar login propio de Planning, mostrar app
    const loginScreen = document.getElementById('loginScreen');
    const appScreen   = document.getElementById('appScreen');
    if (loginScreen) loginScreen.style.display = 'none';
    if (appScreen)   appScreen.style.display   = 'block';

    // Sincronizar nombre del auxiliar con script.js
    window.currentAuxiliar = s.nombre;
    localStorage.setItem('geria_auxiliar_v2', s.nombre);

    // Rellenar header que doLogin() normalmente rellena
    const displayDate = document.getElementById('displayDate');
    const headerAux   = document.getElementById('headerAuxiliar');
    const dateFull    = new Date().toLocaleDateString('es-ES', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
    if (displayDate) displayDate.innerText = dateFull.toUpperCase();
    if (headerAux)   headerAux.innerText   = s.nombre;

    // Ocultar bloques de gestión y backup si es auxiliar
    if (s.rol !== 'admin') {
        const adminBlock  = document.querySelector('.collapsible-box');
        const backupBlock = document.querySelector('.backup-box');
        if (adminBlock)  adminBlock.style.display  = 'none';
        if (backupBlock) backupBlock.style.display = 'none';
    }

    // Renombrar etiqueta de gestión
    document.querySelectorAll('.collapsible-header span').forEach(span => {
        if (span.innerText.includes('GESTIONAR LISTA PERMANENTE')) {
            span.innerText = '⚙️ Gestión de usuarios';
        }
    });

    // Barra de sesión
    const info = document.getElementById('planSesionInfo');
    if (info) {
        const rolColor = s.rol === 'admin'
            ? 'background:#fef3e2;color:#7a4a00'
            : 'background:#e6f4f6;color:#0a5a68';
        info.innerHTML = `
            <span style="font-size:12px;font-weight:500;color:white;">${s.nombre}</span>
            <span style="${rolColor};font-size:10px;padding:2px 8px;border-radius:20px;font-weight:600;margin-left:6px;">${s.rol === 'admin' ? 'Admin' : 'Auxiliar'}</span>
            <button onclick="auth.cerrarSesion('index.html')"
                style="font-size:11px;margin-left:8px;
                       background:rgba(255,255,255,0.2);
                       border:1px solid rgba(255,255,255,0.4);
                       color:white;border-radius:20px;
                       padding:3px 10px;cursor:pointer;
                       font-family:inherit;">Salir</button>`;
    }

    // Llamar render() de script.js
    if (typeof render === 'function') render();

    // ── NOTIFICACIÓN DE RECORDATORIO A LAS 21:40 ─────────────────────────────
    solicitarPermisoNotificacion();
    programarRecordatorio();
});

// ── PERMISO DE NOTIFICACIONES ─────────────────────────────────────────────────
function solicitarPermisoNotificacion() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// ── PROGRAMAR RECORDATORIO A LAS 21:40 ───────────────────────────────────────
function programarRecordatorio() {
    const ahora   = new Date();
    const disparo = new Date();
    disparo.setHours(21, 40, 0, 0);

    // Si ya pasaron las 21:40 hoy, no programar
    if (ahora >= disparo) return;

    const msHasta = disparo - ahora;

    setTimeout(() => {
        verificarYNotificar();
    }, msHasta);
}

// ── VERIFICAR PENDIENTES Y DISPARAR NOTIFICACIÓN ──────────────────────────────
function verificarYNotificar() {
    // Leer datos de Planning
    const data = JSON.parse(localStorage.getItem('geria_p_v2') || '{}');
    const asignaciones = JSON.parse(localStorage.getItem('sgp_plan_asignaciones') || '{}');
    const sesion = JSON.parse(localStorage.getItem('sgp_sesion') || 'null');

    if (!sesion) return;

    // Determinar el plan del auxiliar activo
    // Buscar turno activo (Noche = turno de 21:40)
    const turno = 'Noche';
    const planAuxiliar = asignaciones[turno] && asignaciones[turno][sesion.nombre];
    const planActivo   = planAuxiliar || 'A'; // fallback al plan A

    const residentes = data[planActivo] || [];
    const pendientes = residentes.filter(r => !r.done);

    if (pendientes.length === 0) return; // todos atendidos, no molestar

    // ── Notificación del sistema con sonido ───────────────────────────────────
    if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification('⚠️ Residentes pendientes — Planning', {
            body: `Tienes ${pendientes.length} residente${pendientes.length > 1 ? 's' : ''} sin marcar en el Plan ${planActivo}:\n${pendientes.slice(0, 3).map(r => r.nombre).join(', ')}${pendientes.length > 3 ? '...' : ''}`,
            icon: 'img/Logo-SGP-blanc.png',
            badge: 'img/Logo-SGP-blanc.png',
            tag: 'planning-recordatorio',
            renotify: true,
            requireInteraction: true  // no se cierra sola
        });

        // Sonido mediante AudioContext (funciona sin archivo de audio externo)
        reproducirSonidoAlerta();

        // Al pulsar la notificación, enfocar la ventana
        notif.onclick = () => {
            window.focus();
            notif.close();
        };
    }

    // ── Alerta visual dentro de la app como respaldo ──────────────────────────
    mostrarAlertaVisual(pendientes.length, planActivo);
}

// ── SONIDO DE ALERTA CON WEB AUDIO API ───────────────────────────────────────
function reproducirSonidoAlerta() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Tres tonos ascendentes
        [0, 0.3, 0.6].forEach((delay, i) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type      = 'sine';
            osc.frequency.value = 440 + (i * 110); // 440, 550, 660 Hz

            gain.gain.setValueAtTime(0, ctx.currentTime + delay);
            gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + delay + 0.05);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + 0.3);

            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + 0.35);
        });
    } catch(e) {
        console.warn('Web Audio no disponible:', e);
    }
}

// ── ALERTA VISUAL DENTRO DE LA APP ───────────────────────────────────────────
function mostrarAlertaVisual(numPendientes, plan) {
    // Evitar duplicados
    const existente = document.getElementById('alertaRecordatorio');
    if (existente) existente.remove();

    const alerta = document.createElement('div');
    alerta.id = 'alertaRecordatorio';
    alerta.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0;
        background: #c0392b;
        color: white;
        padding: 14px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        z-index: 999;
        font-family: 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 2px 12px rgba(0,0,0,0.3);
    `;
    alerta.innerHTML = `
        <span>⚠️ ${numPendientes} residente${numPendientes > 1 ? 's' : ''} pendiente${numPendientes > 1 ? 's' : ''} en Plan ${plan}</span>
        <button onclick="document.getElementById('alertaRecordatorio').remove()"
            style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);
                   color:white;border-radius:20px;padding:4px 12px;cursor:pointer;
                   font-family:inherit;font-size:12px;">
            Cerrar
        </button>
    `;
    document.body.prepend(alerta);
}