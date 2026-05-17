/* ============================================================
   ATENCIÓN FOCAL v2 — Lógica principal
   ============================================================ */

/* ── ESTADO GLOBAL ────────────────────────────────────────── */
let currentPlan     = 'A';
let viewAllMode     = false;
let currentAuxiliar = '';

let data   = JSON.parse(localStorage.getItem('geria_p_v2')) || { A: [], B: [], C: [], D: [] };
let matrix = JSON.parse(localStorage.getItem('geria_m_v2')) || [];

const dateKey  = new Date().toLocaleDateString();
const dateFull = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
});

/* ── REINICIO DIARIO ──────────────────────────────────────── */
if (localStorage.getItem('geria_reset_v2') !== dateKey) {
    for (let p in data) {
        data[p].forEach(u => { u.done = false; u.time = null; u.incidencia = ''; });
    }
    localStorage.setItem('geria_reset_v2', dateKey);
    sync();
}

/* ── PERSISTENCIA ─────────────────────────────────────────── */
function sync() {
    localStorage.setItem('geria_p_v2', JSON.stringify(data));
    localStorage.setItem('geria_m_v2', JSON.stringify(matrix));
}

/* ── LOGIN ────────────────────────────────────────────────── */
(function initLogin() {
    const saved = localStorage.getItem('geria_auxiliar_v2');
    if (saved) {
        document.getElementById('loginSavedHint').style.display = 'block';
        document.getElementById('loginSavedName').innerText = saved;
    }
})();

function useSavedName() {
    document.getElementById('loginNombre').value = localStorage.getItem('geria_auxiliar_v2') || '';
}

function doLogin() {
    const nombre = document.getElementById('loginNombre').value.trim();
    if (!nombre) {
        document.getElementById('loginNombre').style.borderColor = 'var(--danger)';
        document.getElementById('loginNombre').placeholder = '⚠️ Introduce tu nombre para continuar';
        return;
    }
    currentAuxiliar = nombre;
    localStorage.setItem('geria_auxiliar_v2', nombre);

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appScreen').style.display   = 'block';
    document.getElementById('displayDate').innerText     = dateFull.toUpperCase();
    document.getElementById('headerAuxiliar').innerText  = nombre;

    render();
}

function changeUser() {
    if (confirm('¿Cambiar de auxiliar? Se cerrará la sesión actual.')) {
        document.getElementById('appScreen').style.display   = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('loginNombre').value = '';
        currentAuxiliar = '';
    }
}

/* ── HELPERS UI ───────────────────────────────────────────── */
function toggleBox(id) {
    const el    = document.getElementById(id);
    const arrow = document.getElementById(id + '-arrow');
    if (!el) return;
    el.classList.toggle('open');
    if (arrow) arrow.innerText = el.classList.contains('open') ? '▲' : '▼';
}

function setPlan(p) {
    currentPlan = p;
    document.getElementById('planLabelTop').innerText = p;
    document.querySelectorAll('.tab-btn').forEach(b =>
        b.classList.toggle('active', b.innerText === p));
    render();
}

/* ── BACKUP / RESTORE ─────────────────────────────────────── */
function exportBackup() {
    const payload = {
        version:    2,
        exportDate: new Date().toISOString(),
        auxiliar:   currentAuxiliar,
        data,
        matrix
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `atencion_focal_backup_${dateKey.replace(/\//g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    document.getElementById('backupStatus').innerText = '✅ Backup exportado correctamente.';
}

function importBackup(evt) {
    const file = evt.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const payload = JSON.parse(e.target.result);
            if (!payload.data || !payload.matrix) throw new Error('Formato incorrecto');
            const fechaExport = payload.exportDate
                ? new Date(payload.exportDate).toLocaleDateString('es-ES')
                : 'desconocida';
            if (!confirm(`¿Restaurar backup del ${fechaExport}?\nEsto sobreescribirá los datos actuales.`)) return;
            data   = payload.data;
            matrix = payload.matrix;
            sync();
            render();
            document.getElementById('backupStatus').innerText = '✅ Datos restaurados correctamente.';
        } catch (err) {
            alert('❌ Error al leer el backup: ' + err.message);
        }
    };
    reader.readAsText(file);
    evt.target.value = ''; // reset input para poder importar el mismo archivo dos veces
}

/* ── CHECKLIST ACTIONS ────────────────────────────────────── */
function toggleCheck(id) {
    const u = data[currentPlan].find(u => u.id == id);
    u.done = !u.done;
    u.time = u.done
        ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : null;
    if (u.done) {
        matrix.push({
            t:   u.time,
            p:   currentPlan,
            n:   u.nombre,
            h:   u.hab,
            uid: u.id,
            d:   dateKey,
            inc: u.incidencia || '',
            obs: u.obs || '',
            aux: currentAuxiliar
        });
    } else {
        matrix = matrix.filter(m => !(m.uid === u.id && m.d === dateKey));
    }
    sync();
    render();
}

function addIncidencia(id) {
    const u    = data[currentPlan].find(u => u.id == id);
    const nota = prompt('Incidencia para ' + u.nombre + ':', u.incidencia || '');
    if (nota === null) return;
    u.incidencia = nota;
    const mIdx = matrix.findIndex(m => m.uid === id && m.d === dateKey);
    if (mIdx !== -1) matrix[mIdx].inc = nota;
    sync();
    render();
}

/* ── CRUD USUARIOS ────────────────────────────────────────── */
function saveUser() {
    const id   = document.getElementById('editId').value;
    const user = {
        nombre:    document.getElementById('nombre').value.trim(),
        hab:       document.getElementById('hab').value.trim(),
        pañal:     document.getElementById('pañal').value,
        obs:       document.getElementById('obs').value.trim(),
        riesgo:       document.getElementById('riesgo').checked,
        observacion:  document.getElementById('observacion') ? document.getElementById('observacion').checked : false,
        encamado:     document.getElementById('encamado').checked,
        done:      false,
        time:      null,
        incidencia: ''
    };
    if (!user.nombre) return alert('Indica el nombre del residente.');
    if (id) {
        const i = data[currentPlan].findIndex(u => u.id == id);
        user.done       = data[currentPlan][i].done;
        user.time       = data[currentPlan][i].time;
        user.incidencia = data[currentPlan][i].incidencia;
        user.id         = Number(id);
        data[currentPlan][i] = user;
    } else {
        user.id = Date.now();
        data[currentPlan].push(user);
    }
    resetForm();
    sync();
    render();
    if (document.getElementById('adminBox').classList.contains('open')) toggleBox('adminBox');
}

function startEdit(id) {
    const u = data[currentPlan].find(u => u.id == id);
    document.getElementById('editId').value     = u.id;
    document.getElementById('nombre').value     = u.nombre;
    document.getElementById('hab').value        = u.hab;
    document.getElementById('pañal').value      = u.pañal;
    document.getElementById('obs').value        = u.obs;
    document.getElementById('riesgo').checked   = u.riesgo;
    if (document.getElementById('observacion')) document.getElementById('observacion').checked = u.observacion || false;
    document.getElementById('encamado').checked = u.encamado;
    window.scrollTo(0, 0);
    if (!document.getElementById('adminBox').classList.contains('open')) toggleBox('adminBox');
}

function deleteUser(id) {
    if (confirm('¿Eliminar este residente de la lista permanente?')) {
        data[currentPlan] = data[currentPlan].filter(u => u.id != id);
        sync();
        render();
    }
}

function resetForm() {
    document.getElementById('editId').value = '';
    ['nombre', 'hab', 'obs'].forEach(f => document.getElementById(f).value = '');
    document.getElementById('pañal').value      = '-';
    document.getElementById('riesgo').checked   = false;
    if (document.getElementById('observacion')) document.getElementById('observacion').checked = false;
    document.getElementById('encamado').checked = false;
}

/* ── HISTORIAL ────────────────────────────────────────────── */
function toggleMatrixView() {
    viewAllMode = !viewAllMode;
    document.getElementById('btnToggleMatrix').innerText =
        viewAllMode ? 'Ver solo Plan ' + currentPlan : 'Ver Todos los Planes';
    render();
}

/* ── REPORTE DE IMPRESIÓN ─────────────────────────────────── */
function prepararImpresion() {
    const auxiliar    = currentAuxiliar || 'No identificado';
    const todayMatrix = matrix.filter(m => m.d === dateKey);

    if (todayMatrix.length === 0) {
        alert('No hay tareas completadas hoy para incluir en el reporte.');
        return;
    }

    // Solo tareas completadas, ordenadas por hora
    const completadas = todayMatrix.slice().sort((a, b) => a.t.localeCompare(b.t));

    const planes = ['A', 'B', 'C', 'D'];
    let tableRows        = '';
    let totalIncidencias = 0;

    planes.forEach(plan => {
        const planRows = completadas.filter(m => m.p === plan);
        if (planRows.length === 0) return;

        tableRows += `<tr style="background:#e8f4f6;">
            <td colspan="5" style="font-weight:bold; font-size:9pt; letter-spacing:0.5px; padding:6px 9px;">
                PLAN ${plan}
            </td>
        </tr>`;

        planRows.forEach(m => {
            const obs = m.obs
                ? `<br><span style="color:#555; font-size:9pt;">📋 ${m.obs}</span>`
                : '';
            const inc = m.inc
                ? `<br><span style="color:#c0392b; font-weight:bold; font-size:9pt;">⚠️ ${m.inc}</span>`
                : '';
            if (m.inc) totalIncidencias++;
            tableRows += `<tr>
                <td>${m.t}</td>
                <td>${m.h}</td>
                <td>${m.n}${obs}${inc}</td>
                <td style="text-align:center; font-size:1.1em; color:#2e7d5e;">✓</td>
                <td>${m.aux || auxiliar}</td>
            </tr>`;
        });
    });

    const totalAtendidos  = completadas.length;
    const totalResidentes = Object.values(data).reduce((acc, p) => acc + p.length, 0);
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const incBadge = totalIncidencias > 0
        ? `&nbsp;|&nbsp; <span style="color:#c0392b;"><strong>⚠️ Incidencias: ${totalIncidencias}</strong></span>`
        : '';

    document.getElementById('printArea').innerHTML = `
        <div class="report-header">
            <h2>REPORTE DE ATENCIÓN — ATENCIÓN FOCAL</h2>
            <p><strong>Fecha:</strong> ${dateFull.toUpperCase()}</p>
            <p><strong>Auxiliar responsable:</strong> ${auxiliar}</p>
            <p>
                <strong>Hora de generación:</strong> ${now}
                &nbsp;|&nbsp;
                <strong>Atendidos:</strong> ${totalAtendidos} de ${totalResidentes} residentes
                ${incBadge}
            </p>
        </div>

        <table class="report-table">
            <thead>
                <tr>
                    <th style="width:60px">Hora</th>
                    <th style="width:70px">Hab.</th>
                    <th>Residente / Observaciones / Incidencias</th>
                    <th style="width:36px; text-align:center;">✓</th>
                    <th style="width:130px">Auxiliar</th>
                </tr>
            </thead>
            <tbody>${tableRows}</tbody>
        </table>

        <div class="sign-block">
            <span>Firma del auxiliar: _________________________________</span>
            <span>Hora de cierre de turno: _____________</span>
        </div>`;

    window.print();
}

/* ── RENDER PRINCIPAL ─────────────────────────────────────── */
function render() {
    renderChecklist();
    renderEditList();
    renderHistorial();
}

function prioridad(u) {
    if (u.riesgo)      return 0;
    if (u.observacion) return 1;
    if (u.encamado)    return 2;
    return 3;
}

function renderChecklist() {
    const checkDiv   = document.getElementById('checklist');
    checkDiv.innerHTML = '';
    const pendientes  = data[currentPlan].filter(u => !u.done).sort((a,b) => prioridad(a) - prioridad(b));
    const completados = data[currentPlan].filter(u => u.done).sort((a,b) => prioridad(a) - prioridad(b));

    if (pendientes.length === 0 && completados.length === 0) {
        checkDiv.innerHTML = `<div class="empty-state">
            Sin residentes en el Plan ${currentPlan}.<br>
            Añade desde ⚙️ Gestionar Lista.
        </div>`;
        return;
    }

    pendientes.forEach(u => checkDiv.appendChild(createCard(u)));

    if (completados.length > 0) {
        const divider = document.createElement('div');
        divider.className = 'section-divider';
        divider.innerText = `✓ Atendidos (${completados.length})`;
        checkDiv.appendChild(divider);
        completados.forEach(u => checkDiv.appendChild(createCard(u)));
    }
}

function renderEditList() {
    const editDiv = document.getElementById('editList');
    editDiv.innerHTML = `<div style="padding:12px 18px; font-weight:700; color:var(--muted); font-size:0.78em; text-transform:uppercase; letter-spacing:0.3px;">
        Residentes en Plan ${currentPlan}
    </div>`;

    if (!data[currentPlan].length) {
        editDiv.innerHTML += `<div style="padding:14px 18px; color:var(--muted); font-size:0.85em;">
            Sin residentes en este plan.
        </div>`;
        return;
    }

    data[currentPlan].forEach(u => {
        const riesgoTag = u.riesgo
            ? '<span style="color:var(--danger); font-size:0.8em;"> ⚠️</span>'
            : '';
        editDiv.innerHTML += `
            <div class="edit-item">
                <span>
                    ${u.nombre}
                    <small style="color:var(--muted)"> · Hab ${u.hab}</small>
                    ${riesgoTag}
                </span>
                <div>
                    <button onclick="startEdit(${u.id})"
                        style="background:var(--primary-lt);color:var(--primary-dk);border:none;padding:8px 10px;border-radius:7px;cursor:pointer;font-size:0.9em;">
                        ✏️
                    </button>
                    <button onclick="deleteUser(${u.id})"
                        style="background:var(--danger-lt);color:var(--danger);border:none;padding:8px 10px;border-radius:7px;cursor:pointer;font-size:0.9em;margin-left:6px;">
                        🗑️
                    </button>
                </div>
            </div>`;
    });
}

function renderHistorial() {
    const tbody      = document.querySelector('#matrixTable tbody');
    const todayMatrix = matrix.filter(m => m.d === dateKey);
    const filtered   = todayMatrix
        .filter(m => viewAllMode ? true : m.p === currentPlan)
        .slice()
        .reverse();

    if (!filtered.length) {
        tbody.innerHTML = `<tr>
            <td colspan="3" style="text-align:center; color:var(--muted); padding:18px;">
                Sin registros hoy.
            </td>
        </tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(m => {
        const planCol = viewAllMode
            ? `<b>${m.p}</b> — ${m.h}`
            : m.h;
        const incTag = m.inc
            ? `<br><small style="color:var(--danger)">⚠️ ${m.inc}</small>`
            : '';
        return `<tr>
            <td>${m.t}</td>
            <td>${planCol}</td>
            <td>${m.n}${incTag}</td>
        </tr>`;
    }).join('');
}

/* ── CREAR TARJETA ────────────────────────────────────────── */
function createCard(u) {
    const card = document.createElement('div');
    card.className = `user-card ${u.riesgo ? 'is-risk' : u.observacion ? 'is-obs' : ''} ${u.done ? 'checked' : ''}`;

    let badges = '';
    if (u.riesgo)                    badges += `<span class="badge badge-risk">⚠️ RIESGO</span>`;
    if (u.observacion)               badges += `<span class="badge badge-obs">🔵 Observación</span>`;
    if (u.encamado)                  badges += `<span class="badge badge-cama">🛏️ Encamado</span>`;
    if (u.pañal && u.pañal !== '-') badges += `<span class="badge badge-pañal">🩺 Pañal ${u.pañal}</span>`;
    if (u.done && u.time)            badges += `<span class="badge badge-done">✓ ${u.time}</span>`;

    const obsHtml = u.obs
        ? `<small>${u.obs}</small>`
        : '';
    const incHtml = u.incidencia
        ? `<div class="incidencia-txt">⚠️ <b>Incidencia:</b> ${u.incidencia}</div>`
        : '';
    const badgesHtml = badges
        ? `<div style="margin-top:5px;">${badges}</div>`
        : '';

    card.innerHTML = `
        <input type="checkbox" class="check-round" ${u.done ? 'checked' : ''} onclick="toggleCheck(${u.id})">
        <div class="user-info">
            <strong>
                ${u.nombre}
                <span style="font-weight:500; color:var(--muted); font-size:0.88rem;"> · Hab ${u.hab}</span>
            </strong>
            ${obsHtml}
            ${badgesHtml}
            ${incHtml}
        </div>
        <button class="btn-nota" onclick="addIncidencia(${u.id})" title="Añadir/editar incidencia">📝</button>`;

    return card;
}

/* ── SERVICE WORKER ───────────────────────────────────────── */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('Atención Focal: Offline Ready ✅'))
            .catch(err => console.warn('SW no activo (normal en local):', err));
    });
}
