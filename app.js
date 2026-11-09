// ===== CONFIGURACIÓN: reemplazá estos dos valores =====
const SUPABASE_URL = 'https://github.com/gimenezduarte777-hub/lavadero-autos.git';
const SUPABASE_KEY = 'sb_publishable_P24C0qEfK0OlHQ5yNlIInw_9sht7J2k';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const form = document.getElementById('form-turno');
const selectServicio = document.getElementById('servicio');
const lista = document.getElementById('lista');
const errorBox = document.getElementById('error');
const tituloForm = document.getElementById('titulo-form');
const btnGuardar = document.getElementById('btn-guardar');
const btnCancelar = document.getElementById('btn-cancelar');
const camposVehiculo = ['patente', 'marca', 'cliente'];
let editandoId = null;

// Evita que el texto de la base se interprete como HTML
function esc(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

function mostrarError(msg) {
  errorBox.textContent = msg;
  btnGuardar.disabled = false;
}

function resetearForm() {
  form.reset();
  editandoId = null;
  camposVehiculo.forEach(c => (document.getElementById(c).disabled = false));
  tituloForm.textContent = 'Nuevo turno';
  btnGuardar.textContent = 'Guardar turno';
  btnGuardar.disabled = false;
  btnCancelar.style.display = 'none';
  errorBox.textContent = '';
}

// ===== SERVICIOS =====
async function cargarServicios() {
  const { data, error } = await db.from('servicios').select('*').order('nombre');
  if (error) return mostrarError('No se pudieron cargar los servicios: ' + error.message);
  selectServicio.innerHTML =
    '<option value="">Elegí un servicio</option>' +
    data.map(s => `<option value="${s.id}">${esc(s.nombre)} (Gs. ${s.precio})</option>`).join('');
}

// ===== LISTAR TURNOS =====
async function cargarTurnos() {
  const { data, error } = await db
    .from('turnos')
    .select('id, fecha_hora, estado, vehiculos(patente, marca, cliente), servicios(nombre)')
    .order('fecha_hora');
  if (error) return mostrarError('No se pudieron cargar los turnos: ' + error.message);
  if (data.length === 0) {
    lista.innerHTML = '<p>Todavía no hay turnos cargados.</p>';
    return;
  }
  lista.innerHTML = data.map(t => `
    <div class="turno">
      <strong>${esc(t.vehiculos.patente)}</strong> · ${esc(t.vehiculos.marca)} · ${esc(t.vehiculos.cliente)}<br>
      ${esc(t.servicios.nombre)} · ${new Date(t.fecha_hora).toLocaleString('es-PY')}<br>
      Estado: <span class="estado">${esc(t.estado.replace('_', ' '))}</span><br>
      <button class="secundario" onclick="cambiarEstado(${t.id}, 'en_proceso')">En proceso</button>
      <button class="ok" onclick="cambiarEstado(${t.id}, 'terminado')">Terminado</button>
      <button onclick="editarTurno(${t.id})">Editar</button>
      <button class="peligro" onclick="eliminarTurno(${t.id})">Eliminar</button>
    </div>`).join('');
}

// ===== AGREGAR / EDITAR =====
async function buscarOCrearVehiculo(patente, marca, cliente) {
  const { data: existente, error: errBusqueda } = await db
    .from('vehiculos').select('id').eq('patente', patente).maybeSingle();
  if (errBusqueda) throw errBusqueda;
  if (existente) return existente.id;

  const { data: nuevo, error } = await db
    .from('vehiculos').insert({ patente, marca, cliente }).select('id').single();
  if (error) throw error;
  return nuevo.id;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.textContent = '';

  const patente = document.getElementById('patente').value.trim().toUpperCase();
  const marca = document.getElementById('marca').value.trim();
  const cliente = document.getElementById('cliente').value.trim();
  const servicioId = selectServicio.value;
  const fecha = document.getElementById('fecha').value;

  if (!patente || !marca || !cliente || !servicioId || !fecha) {
    return mostrarError('Completá todos los campos obligatorios (*).');
  }

  btnGuardar.disabled = true;
  const fechaISO = new Date(fecha).toISOString();

  try {
    if (editandoId) {
      const { error } = await db.from('turnos')
        .update({ servicio_id: servicioId, fecha_hora: fechaISO })
        .eq('id', editandoId);
      if (error) throw error;
    } else {
      const vehiculoId = await buscarOCrearVehiculo(patente, marca, cliente);
      const { error } = await db.from('turnos')
        .insert({ vehiculo_id: vehiculoId, servicio_id: servicioId, fecha_hora: fechaISO });
      if (error) throw error;
    }
    resetearForm();
    cargarTurnos();
  } catch (err) {
    mostrarError('No se pudo guardar: ' + err.message);
  }
});

async function editarTurno(id) {
  const { data, error } = await db
    .from('turnos')
    .select('servicio_id, fecha_hora, vehiculos(*)')
    .eq('id', id)
    .single();
  if (error) return mostrarError('No se pudo abrir el turno: ' + error.message);

  editandoId = id;
  document.getElementById('patente').value = data.vehiculos.patente;
  document.getElementById('marca').value = data.vehiculos.marca;
  document.getElementById('cliente').value = data.vehiculos.cliente;
  selectServicio.value = data.servicio_id;

  const d = new Date(data.fecha_hora);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  document.getElementById('fecha').value = d.toISOString().slice(0, 16);

  camposVehiculo.forEach(c => (document.getElementById(c).disabled = true));
  tituloForm.textContent = 'Editar turno';
  btnGuardar.textContent = 'Guardar cambios';
  btnCancelar.style.display = 'inline-block';
  window.location.hash = 'nuevo';
}

btnCancelar.addEventListener('click', resetearForm);

// ===== CAMBIAR ESTADO =====
async function cambiarEstado(id, estado) {
  const { error } = await db.from('turnos').update({ estado }).eq('id', id);
  if (error) return mostrarError('No se pudo cambiar el estado: ' + error.message);
  cargarTurnos();
}

// ===== ELIMINAR =====
async function eliminarTurno(id) {
  if (!confirm('¿Eliminar este turno?')) return;
  const { error } = await db.from('turnos').delete().eq('id', id);
  if (error) return mostrarError('No se pudo eliminar: ' + error.message);
  if (editandoId === id) resetearForm();
  cargarTurnos();
}

// ===== INICIO =====
cargarServicios();
cargarTurnos();
