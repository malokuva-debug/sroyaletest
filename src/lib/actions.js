'use server';

import { supabase, toSnake, toCamel, toCamelArray } from './supabase';
import { v4 as uuid } from 'uuid';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { sendPushToAll } from './dashboard-webpush';
import { translations } from './dashboard-translations';

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function getT() {
  const lang = await getSetting('sparta_lang', 'sq');
  return (key) => translations[lang]?.[key] || key;
}

function getTodayKS() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Belgrade', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${d}`;
}

// Adjusts a client's `visits` / `total_spent` counters. Supabase's query
// builder can't express `SET x = coalesce(x,0) + n` server-side, so this
// reads the current row and writes the computed result back.
async function bumpClient(clientId, { visitsDelta = 0, spentDelta = 0, clamp = false } = {}) {
  if (!clientId) return;
  const { data } = await supabase.from('clients').select('visits, total_spent').eq('id', clientId);
  const cur = data?.[0] || {};
  let visits = Number(cur.visits ?? 0) + visitsDelta;
  let totalSpent = Number(cur.total_spent ?? 0) + spentDelta;
  if (clamp) {
    visits = Math.max(0, visits);
    totalSpent = Math.max(0, totalSpent);
  }
  const update = {};
  if (visitsDelta !== 0) update.visits = visits;
  if (spentDelta !== 0) update.total_spent = totalSpent;
  if (Object.keys(update).length === 0) return;
  await supabase.from('clients').update(update).eq('id', clientId);
}

/**
 * Idempotent upsert of the income row linked to an appointment. Revenue is
 * derived from the appointment (never edited standalone), so we sync rather
 * than blindly insert — combined with the partial unique index on
 * te_ardhurat(from_appointment_id) this prevents the duplicate-income bug
 * where re-saving a completed appointment created a second record.
 */
async function upsertAppointmentIncome(appt) {
  if (!appt || !appt.id) return;
  const extras = Array.isArray(appt.extras) ? appt.extras : [];
  const extrasSum = extras.reduce((s, e) => s + Number(e?.price || 0), 0);
  const extrasJson = extras.length ? JSON.stringify(extras) : null;
  const row = {
    id:                   uuid(),
    clientId:             appt.clientId     || null,
    clientName:           appt.clientName   || null,
    serviceName:          appt.serviceName  || null,
    price:                Number(appt.price || 0),
    extras:               extrasJson,
    date:                 appt.date,
    workerId:             appt.workerId     || null,
    fromAppointmentId:    appt.id,
    source:               'appointment',
    notes:                appt.notes        || null,
  };
  try {
    const { data: existing } = await supabase
      .from('te_ardhurat')
      .select('id')
      .eq('from_appointment_id', appt.id);
    if (existing && existing.length > 0) {
      const { id: _drop, ...updates } = row;
      await supabase.from('te_ardhurat').update(toSnake(updates)).eq('id', existing[0].id);
    } else {
      await supabase.from('te_ardhurat').insert(toSnake(row));
    }
  } catch (err) {
    // Pre-migration safety: retry without the newly-added columns.
    if (String(err).includes('column') || String(err).includes('no such column')) {
      const base = {
        id:                row.id,
        clientName:        row.clientName,
        serviceName:       row.serviceName,
        price:             row.price,
        date:              row.date,
        workerId:          row.workerId,
        fromAppointmentId: row.fromAppointmentId,
      };
      const { data: existing } = await supabase
        .from('te_ardhurat')
        .select('id')
        .eq('from_appointment_id', appt.id);
      if (existing && existing.length > 0) {
        const { id: _drop, fromAppointmentId: _a, ...updates } = base;
        await supabase.from('te_ardhurat').update(toSnake(updates)).eq('id', existing[0].id);
      } else {
        await supabase.from('te_ardhurat').insert(toSnake(base));
      }
    } else {
      throw err;
    }
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function getUser(username) {
  try {
    const { data, error } = await supabase.from('users').select('*').eq('username', username);
    if (error) throw error;
    return data?.[0] ? toCamel(data[0]) : null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

export async function setupAdmin(name, passwordHash) {
  const id = uuid();
  const username = (name || 'Admin').toLowerCase().replace(/\s+/g, '');
  const row = {
    id,
    username,
    passwordHash,
    role: 'owner',
    name: name || 'Admin',
    status: 'active',
  };
  await supabase.from('users').insert(toSnake(row));
  return row;
}

export async function createUser(userData) {
  try {
    const data = { ...userData };
    if (!data.username && data.name) {
      data.username = data.name.toLowerCase().replace(/\s+/g, '');
    }
    if (!data.status) {
      data.status = 'active';
    }

    if (data.id) {
      await supabase.from('users').update(toSnake(data)).eq('id', data.id);
    } else {
      const id = uuid();
      const newUser = { ...data, id };
      await supabase.from('users').insert(toSnake(newUser));
      data.id = id;
    }
    revalidatePath('/dashboard');
    return data;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

export async function deleteUser(id) {
  // Clean up per-worker data before removing the user. Each step is guarded
  // so the delete still works on databases that haven't run the migration.
  const guarded = (q) => {
    try {
      const p = q();
      return (p && typeof p.then === 'function') ? p.catch(() => {}) : Promise.resolve();
    } catch {
      return Promise.resolve();
    }
  };
  const cleanup = [
    () => supabase.from('worker_services').delete().eq('worker_id', id),
    () => supabase.from('worker_additional_services').delete().eq('worker_id', id),
    () => supabase.from('worker_settings').delete().eq('worker_id', id),
    () => supabase.from('appointments').update({ worker_id: null }).eq('worker_id', id),
    () => supabase.from('te_ardhurat').update({ worker_id: null }).eq('worker_id', id),
    () => supabase.from('sessions').delete().eq('user_id', id),
    () => supabase.from('push_subscriptions').delete().eq('user_id', id),
  ];
  await Promise.all(cleanup.map(guarded));

  try {
    const sched = { ...(await getSetting('sparta_worker_schedule', {})) };
    if (id in sched) {
      delete sched[id];
      await saveSettings('sparta_worker_schedule', sched);
    }
  } catch {}

  try {
    const unav = (await getSetting('sparta_worker_unavailability', [])).filter(e => e.workerId !== id);
    await saveSettings('sparta_worker_unavailability', unav);
  } catch {}

  const result = await supabase.from('users').delete().eq('id', id);
  if (result.error) {
    console.error('[deleteUser]', result.error);
    throw new Error(result.error.message || result.error.details || 'delete failed');
  }
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function createSession(userId) {
  const sessionId = uuid();
  const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
  await supabase.from('sessions').insert({ id: sessionId, user_id: userId, expires_at: expiresAt });
  (await cookies()).set('sparta_session', sessionId, {
    expires: new Date(expiresAt * 1000),
    httpOnly: true,
  });
  return sessionId;
}

export async function getSessionUser() {
  const sessionId = (await cookies()).get('sparta_session')?.value;
  if (!sessionId) return null;
  try {
    const { data: sessionRows, error: sessionErr } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('id', sessionId);
    if (sessionErr) throw sessionErr;
    const userId = sessionRows?.[0]?.user_id;
    if (!userId) return null;

    const { data: userRows, error: userErr } = await supabase.from('users').select('*').eq('id', userId);
    if (userErr) throw userErr;
    return userRows?.[0] ? toCamel(userRows[0]) : null;
  } catch (error) {
    // Tables may not exist yet on first boot — treat as unauthenticated
    console.warn('getSessionUser: DB not ready yet, returning null', error);
    return null;
  }
}

export async function destroySession() {
  const sessionId = (await cookies()).get('sparta_session')?.value;
  if (sessionId) await supabase.from('sessions').delete().eq('id', sessionId);
  (await cookies()).delete('sparta_session');
}

export async function getAllWorkers() {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return toCamelArray(data);
  } catch (error) {
    console.error('Error fetching workers:', error);
    return [];
  }
}

export async function getAnyOwner() {
  try {
    const { data, error } = await supabase.from('users').select('*').eq('role', 'owner');
    if (error) throw error;
    return data?.[0] ? toCamel(data[0]) : null;
  } catch (error) {
    console.error('Error fetching owner:', error);
    return null;
  }
}

// ─── Data fetch ──────────────────────────────────────────────────────────────

// Fetch a table that may not exist yet (pre-migration) without breaking the
// whole dashboard — the page just sees an empty list.
async function safeSelect(table, columns, build) {
  try {
    let q = supabase.from(table).select(columns);
    if (build) q = build(q);
    const { data, error } = await q;
    if (error) throw error;
    return toCamelArray(data ?? []);
  } catch (error) {
    return [];
  }
}

export async function getData(role, userId) {
  try {
    const [
      shpenzimetRes,
      produktetRes,
      teArdhuratRes,
      clientsRes,
      appointmentsRes,
      servicesRes,
      settingsRes,
      usersRes,
      categories,
      workerServices,
      workerAdditionalServices,
      additionalServices,
      workerSettings,
      payroll,
      recurringExpenses,
    ] = await Promise.all([
      role === 'owner' ? supabase.from('shpenzimet').select('*') : Promise.resolve({ data: [] }),
      supabase.from('produktet').select('*'),
      role === 'owner'
        ? supabase.from('te_ardhurat').select('*')
        : supabase.from('te_ardhurat').select('*').eq('worker_id', userId),
      supabase.from('clients').select('*'),
      role === 'owner'
        ? supabase.from('appointments').select('*')
        : supabase.from('appointments').select('*').eq('worker_id', userId),
      supabase.from('services').select('*'),
      supabase.from('settings').select('*'),
      supabase.from('users').select('*'),
      safeSelect('service_categories', '*'),
      safeSelect('worker_services', '*'),
      safeSelect('worker_additional_services', '*'),
      safeSelect('additional_services', '*'),
      safeSelect('worker_settings', '*'),
      role === 'owner' ? safeSelect('payroll', '*') : Promise.resolve([]),
      role === 'owner' ? safeSelect('recurring_expenses', '*') : Promise.resolve([]),
    ]);

    for (const res of [shpenzimetRes, produktetRes, teArdhuratRes, clientsRes, appointmentsRes, servicesRes, settingsRes, usersRes]) {
      if (res.error) throw res.error;
    }

    const shpenzimetData = toCamelArray(shpenzimetRes.data);
    const produktetData = toCamelArray(produktetRes.data);
    const teArdhuratData = toCamelArray(teArdhuratRes.data);
    const clientsData = toCamelArray(clientsRes.data);
    const appointmentsData = toCamelArray(appointmentsRes.data);
    const servicesData = toCamelArray(servicesRes.data);
    const settingsData = toCamelArray(settingsRes.data);
    const usersData = toCamelArray(usersRes.data);

    const workerMap = Object.fromEntries(usersData.map(u => [u.id, u.name || u.username]));
    const clientPhoneMap = Object.fromEntries(clientsData.map(c => [c.id, c.phone]));

    // Map DB column "description" back to "name" so the frontend ShpenzimetView works
    const mappedShpenzimet = shpenzimetData.map(s => ({
      ...s,
      name: s.description,
    }));

    // Parse extraServices JSON back to array so the frontend gets `extras`
    // And inject workerName, clientPhone
    const mappedAppointments = appointmentsData.map(a => ({
      ...a,
      workerName: a.workerId ? workerMap[a.workerId] : null,
      clientPhone: a.clientId ? clientPhoneMap[a.clientId] : null,
      extras: a.extraServices
        ? (() => { try { return JSON.parse(a.extraServices); } catch { return []; } })()
        : [],
    }));

    return {
      shpenzimet: mappedShpenzimet,
      produktet: produktetData,
      teArdhurat: teArdhuratData,
      clients: clientsData,
      appointments: mappedAppointments,
      services: servicesData,
      categories,
      workerServices,
      workerAdditionalServices,
      additionalServices,
      workerSettings,
      payroll,
      recurringExpenses,
      settings: Object.fromEntries(
        settingsData.map(s => {
          try { return [s.key, JSON.parse(s.value)]; }
          catch { return [s.key, s.value]; }
        })
      ),
    };
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}

// ─── Shpenzimet ───────────────────────────────────────────────────────────────
// DB schema: id, description (NOT NULL), amount (NOT NULL), date (NOT NULL), category
// Frontend sends: name, description, amount, date → map name → description

export async function saveShpenzim(data) {
  const row = {
    id:          data.id || uuid(),
    description: (data.name || data.description || '').trim(),
    amount:      Number(data.amount),
    date:        data.date,
    category:    data.category || null,
    type:        data.type || null,
  };
  const isNew = data._isNew !== undefined ? data._isNew : !data.id;
  try {
    if (!isNew) {
      await supabase.from('shpenzimet').update(toSnake(row)).eq('id', data.id);
    } else {
      await supabase.from('shpenzimet').insert(toSnake(row));
    }
  } catch (err) {
    // Pre-migration safety: `type` column may not exist yet.
    if (String(err).includes('column') || String(err).includes('no such column')) {
      const base = { id: row.id, description: row.description, amount: row.amount, date: row.date, category: row.category };
      if (!isNew) {
        await supabase.from('shpenzimet').update(toSnake(base)).eq('id', data.id);
      } else {
        await supabase.from('shpenzimet').insert(toSnake(base));
      }
    } else {
      throw err;
    }
  }
  revalidatePath('/dashboard');
  return { ...row, name: row.description };
}

export async function deleteShpenzim(id) {
  await supabase.from('shpenzimet').delete().eq('id', id);
  revalidatePath('/dashboard');
}

// ─── Produktet ────────────────────────────────────────────────────────────────
// DB schema: id, name (NOT NULL), quantity (NOT NULL), minQuantity, price

export async function saveProdukt(data) {
  const t = await getT();
  const row = {
    id:                   data.id || uuid(),
    name:                 data.name,
    quantity:             Number(data.quantity ?? 0),
    minQuantity:          data.minQuantity != null ? Number(data.minQuantity) : null,
    price:                data.price != null ? Number(data.price) : null,
    usagePerAppointment:  data.usagePerAppointment != null ? Number(data.usagePerAppointment) : 0,
  };
  const isNewP = data._isNew !== undefined ? data._isNew : !data.id;

  let diff = 0;
  if (!isNewP) {
    const { data: old } = await supabase.from('produktet').select('quantity').eq('id', row.id);
    if (old && old.length > 0) {
      diff = row.quantity - Number(old[0].quantity || 0);
    }
  } else {
    diff = row.quantity;
  }

  if (diff > 0) {
    const today = getTodayKS();
    const { data: existing } = await supabase
      .from('shpenzimet')
      .select('*')
      .eq('date', today)
      .eq('category', 'Furnizim');
    const parts = t('shtim_stoku').split('{}');
    const prefix = (parts[0] || '') + row.name + (parts[1] || ' ');
    const match = (existing || []).find(e => e.description?.startsWith(prefix));
    if (match) {
      const price = row.price || 0;
      const oldQty = price > 0 ? Math.round(Number(match.amount) / price) : 0;
      const totalQty = oldQty + diff;
      await supabase.from('shpenzimet').update({
        description: t('shtim_stoku').replace('{}', row.name).replace('{}', String(totalQty)),
        amount: Number(match.amount) + diff * price,
      }).eq('id', match.id);
    } else {
      await supabase.from('shpenzimet').insert({
        id:          uuid(),
        description: t('shtim_stoku').replace('{}', row.name).replace('{}', String(diff)),
        amount:      diff * (row.price || 0),
        date:        today,
        category:    'Furnizim',
      });
    }
  }

  if (!isNewP) {
    await supabase.from('produktet').update(toSnake(row)).eq('id', row.id);
  } else {
    await supabase.from('produktet').insert(toSnake(row));
  }
  revalidatePath('/dashboard');
  return row;
}

export async function deleteProdukt(id) {
  await supabase.from('produktet').delete().eq('id', id);
  revalidatePath('/dashboard');
}

// ─── Të ardhurat ─────────────────────────────────────────────────────────────
// DB schema: id, clientName, serviceName, price (NOT NULL), date (NOT NULL), workerId
// Frontend also sends: clientId, serviceId, extras, fromAppointmentId → NOT in schema, drop them

export async function saveTeArdhur(data) {
  const row = {
    id:                data.id || uuid(),
    clientName:        data.clientName        || null,
    serviceName:       data.serviceName       || null,
    price:             Number(data.price),
    date:              data.date,
    workerId:          data.workerId          || null,
    clientId:          data.clientId          || null,
    extras:            Array.isArray(data.extras) ? JSON.stringify(data.extras) : null,
    notes:             data.notes             || null,
    source:            data.source            || null,
    fromAppointmentId: data.fromAppointmentId || null,
  };
  const rowBase = {
    id:          row.id,
    clientName:  row.clientName,
    serviceName: row.serviceName,
    price:       row.price,
    date:        row.date,
    workerId:    row.workerId,
  };
  const isNewT = data._isNew !== undefined ? data._isNew : !data.id;
  try {
    if (!isNewT) {
      const { error } = await supabase.from('te_ardhurat').update(toSnake(row)).eq('id', data.id);
      if (error) throw error;
    } else {
      // If this record is linked to an appointment, check for an existing record
      // to avoid creating a duplicate when saveAppointment already inserted one.
      if (row.fromAppointmentId) {
        const { data: existing } = await supabase
          .from('te_ardhurat')
          .select('id')
          .eq('from_appointment_id', row.fromAppointmentId);
        if (existing && existing.length > 0) {
          revalidatePath('/dashboard');
          return data;
        }
      }
      const { error } = await supabase.from('te_ardhurat').insert(toSnake(row));
      if (error) throw error;
    }
  } catch (err) {
    if (String(err).includes('from_appointment_id') || String(err).includes('no such column')) {
      if (!isNewT) {
        await supabase.from('te_ardhurat').update(toSnake(rowBase)).eq('id', data.id);
      } else {
        await supabase.from('te_ardhurat').insert(toSnake(rowBase));
      }
    } else {
      throw err;
    }
  }
  revalidatePath('/dashboard');
  return data;
}

export async function deleteTeArdhur(id) {
  await supabase.from('te_ardhurat').delete().eq('id', id);
  revalidatePath('/dashboard');
}

// ─── Clients ──────────────────────────────────────────────────────────────────
// DB schema: id, name (NOT NULL), phone, email, notes
// Frontend also sends: createdAt → NOT in schema, drop it

export async function saveClient(data) {
  const row = {
    id:         data.id || uuid(),
    name:       data.name,
    phone:      data.phone || null,
    email:      data.email || null,
    notes:      data.notes || null,
    visits:     data.visits != null ? Number(data.visits) : 0,
    totalSpent: data.totalSpent != null ? Number(data.totalSpent) : 0,
  };
  const isNewC = data._isNew !== undefined ? data._isNew : !data.id;
  if (!isNewC) {
    await supabase.from('clients').update(toSnake(row)).eq('id', data.id);
  } else {
    await supabase.from('clients').insert(toSnake(row));
  }
  revalidatePath('/dashboard');
  return data;
}

export async function deleteClient(id) {
  await supabase.from('clients').delete().eq('id', id);
  revalidatePath('/dashboard');
}

// ─── Appointments ─────────────────────────────────────────────────────────────
// DB schema: id, clientId, clientName, serviceId, serviceName, workerId,
//            date (NOT NULL), time (NOT NULL), duration, status, notes, extraServices
// Frontend sends: extras (array) → serialise to extraServices (JSON string)
// Frontend also sends: price, workerName → NOT in schema, drop them

export async function saveAppointment(data) {
  const isNew = data._isNew !== undefined ? data._isNew : !data.id;

  let { clientId, clientName, phone } = data;
  if (!clientId && clientName) {
    const trimmed = clientName.trim();
    const { data: existing } = await supabase
      .from('clients')
      .select('id, phone')
      .ilike('name', trimmed);
    if (existing && existing.length > 0) {
      clientId = existing[0].id;
      if (phone && !existing[0].phone) {
        await supabase.from('clients').update({ phone }).eq('id', clientId);
      }
    } else {
      clientId = uuid();
      await supabase.from('clients').insert({
        id: clientId,
        name: trimmed,
        phone: phone || null,
      });
    }
  }

  const row = {
    id:            data.id || uuid(),
    clientId,
    clientName:    data.clientName  || null,
    serviceId:     data.serviceId   || null,
    serviceName:   data.serviceName || null,
    workerId:      data.workerId    || null,
    date:          data.date,
    time:          data.time,
    duration:      data.duration    || null,
    status:        data.status      || 'pending',
    notes:         data.notes       || null,
    price:         data.price != null ? Number(data.price) : null,
    extraServices: Array.isArray(data.extras)
      ? JSON.stringify(data.extras)
      : (data.extraServices ?? null),
  };

  // Pre-fetch translation + previous state in parallel
  const tPromise = getT();
  const prevPromise = isNew
    ? Promise.resolve(null)
    : supabase.from('appointments').select('*').eq('id', row.id).then(r => (r.data?.[0] ? toCamel(r.data[0]) : null));

  if (isNew) {
    await supabase.from('appointments').insert(toSnake(row));
    const t = await tPromise;
    const pushResult = await sendPushToAll(
      t('takim_i_ri'),
      `${row.clientName || t('klient')} — ${row.serviceName || t('sherbim')}\n${row.date} ${t('në')} ${row.time}`,
      `new-appt-${row.id}`,
      { appointmentId: row.id, type: 'new' },
      row.workerId || []
    ).catch(err => { console.error('[saveAppointment] Push FAILED:', err.message, err.stack); return { sent: 0, error: err.message }; });
    console.log(`[saveAppointment] New appt push result:`, JSON.stringify(pushResult));
    // If created already completed, update client stats and create income record
    if (row.status === 'completed' && row.clientId) {
      const price = Number(row.price || 0);
      await bumpClient(row.clientId, { visitsDelta: 1, spentDelta: price });
      await upsertAppointmentIncome(row);
    }
  } else {
    const [t, prevAppt] = await Promise.all([tPromise, prevPromise]);
    const wasCompleted = prevAppt?.status === 'completed';
    const isNowCompleted = row.status === 'completed';
    const dateOrTimeChanged = prevAppt && (prevAppt.date !== row.date || prevAppt.time !== row.time);

    const updateRow = { ...toSnake(row) };
    if (dateOrTimeChanged) updateRow.reminder_sent_at = null;
    try {
      await supabase.from('appointments').update(updateRow).eq('id', row.id);
    } catch (err) {
      // Pre-migration safety: reminder_sent_at column may not exist yet.
      await supabase.from('appointments').update(toSnake(row)).eq('id', row.id);
    }

    if (dateOrTimeChanged) {
      // Reset reminder-fired state whenever the date/time actually changes,
      // independent of status. Otherwise a stale "already fired" flag from
      // before the edit (e.g. from the old time, or from before the
      // appointment was un-cancelled) can permanently suppress the
      // reminder for the new time — the cron route only checks this flag,
      // it has no way to tell the appointment was edited since.
      try {
        const raw = await getSetting('sparta_appt_notified', '{}');
        const notified = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
        const reminderKey = `r:${row.id}`;
        let changed = false;
        for (const [dateKey, keys] of Object.entries(notified)) {
          const arr = keys;
          const idx = arr.indexOf(reminderKey);
          if (idx !== -1) {
            arr.splice(idx, 1);
            changed = true;
            if (arr.length === 0) delete notified[dateKey];
          }
        }
        if (changed) {
          await supabase.from('settings').update({ value: JSON.stringify(notified) }).eq('key', 'sparta_appt_notified');
        }
      } catch {}
    }

    if (!wasCompleted && dateOrTimeChanged && row.status === 'pending') {
      await sendPushToAll(
        t('takimi_u_ndryshua'),
        `${prevAppt.clientName || t('klient')} — ${prevAppt.serviceName || t('sherbim')}\n` +
        `${t('nga_lowercase')}: ${prevAppt.date} ${prevAppt.time}\n${t('në_lowercase')}: ${row.date} ${row.time}`,
        `reschedule-${row.id}`,
        { appointmentId: row.id, type: 'reschedule' },
        row.workerId || []
      ).catch(err => ({ sent: 0, error: err.message }));
    }

    if (!wasCompleted && isNowCompleted) {
      // ── pending/canceled → completed ──────────────────────────────────────
      const price = Number(row.price || 0);

      // Update client stats
      if (row.clientId) {
        await bumpClient(row.clientId, { visitsDelta: 1, spentDelta: price });
      }

      // Create linked income record
      await upsertAppointmentIncome(row);

      // Stock deduction (interval-based) — use a count-only query instead of fetching all rows
      const { count } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed');
      const completedCount = Number(count ?? 0);
      const { data: allProducts } = await supabase.from('produktet').select('*');
      const updates = (allProducts || [])
        .filter(p => {
          const interval = Number(p.usage_per_appointment || 0);
          return interval > 0 && completedCount % interval === 0;
        })
        .map(p => supabase.from('produktet')
          .update({ quantity: Math.max(0, Number(p.quantity) - 1) })
          .eq('id', p.id));
      if (updates.length) await Promise.all(updates);

    } else if (wasCompleted && !isNowCompleted) {
      // ── completed → canceled/pending ──────────────────────────────────────
      const prevPrice = Number(prevAppt.price || 0);
      const prevClientId = prevAppt.clientId;

      // Revert client stats
      if (prevClientId) {
        await bumpClient(prevClientId, { visitsDelta: -1, spentDelta: -prevPrice, clamp: true });
      }

      // Delete the linked income record
      await supabase.from('te_ardhurat').delete().eq('from_appointment_id', row.id);

    } else if (wasCompleted && isNowCompleted) {
      // ── stayed completed — handle client or price changes ─────────────────
      const prevClientId = prevAppt.clientId;
      const prevPrice    = Number(prevAppt.price || 0);
      const newClientId  = row.clientId;
      const newPrice     = Number(row.price || 0);
      const clientChanged = prevClientId !== newClientId;
      const priceChanged  = prevPrice !== newPrice;

      if (clientChanged) {
        // Decrement old client
        if (prevClientId) {
          await bumpClient(prevClientId, { visitsDelta: -1, spentDelta: -prevPrice, clamp: true });
        }
        // Increment new client
        if (newClientId) {
          await bumpClient(newClientId, { visitsDelta: 1, spentDelta: newPrice });
        }
      } else if (priceChanged && newClientId) {
        // Same client, different price
        const priceDelta = newPrice - prevPrice;
        await bumpClient(newClientId, { spentDelta: priceDelta });
      }

      // Sync the linked income record (client, price, worker, date or extras)
      const workerChanged = prevAppt.workerId !== row.workerId;
      const dateChanged = prevAppt.date !== row.date;
      if (clientChanged || priceChanged || workerChanged || dateChanged) {
        await upsertAppointmentIncome(row);
      }
    }
  }
  revalidatePath('/dashboard');
  return data;
}

export async function deleteAppointment(id) {
  // If appointment was completed, revert client stats before deleting
  const { data: apptRows } = await supabase.from('appointments').select('*').eq('id', id);
  const appt = apptRows?.[0] ? toCamel(apptRows[0]) : null;
  if (appt && appt.status === 'completed' && appt.clientId) {
    const price = Number(appt.price || 0);
    await bumpClient(appt.clientId, { visitsDelta: -1, spentDelta: -price, clamp: true });
  }
  // Remove any income record that was created when this appointment was completed
  await supabase.from('te_ardhurat').delete().eq('from_appointment_id', id);
  await supabase.from('appointments').delete().eq('id', id);
  revalidatePath('/dashboard');
}

// ─── Services ─────────────────────────────────────────────────────────────────
// DB schema: id, name (NOT NULL), price (NOT NULL), duration, category_id, position

export async function saveService(data) {
  const row = {
    id:         data.id || uuid(),
    name:       data.name,
    price:      Number(data.price),
    duration:   data.duration || null,
    categoryId: data.categoryId || null,
    position:   data.position != null ? Number(data.position) : 0,
  };
  const base = {
    id:       row.id,
    name:     row.name,
    price:    row.price,
    duration: row.duration,
  };
  const isNewS = data._isNew !== undefined ? data._isNew : !data.id;
  try {
    if (!isNewS) {
      await supabase.from('services').update(toSnake(row)).eq('id', data.id);
    } else {
      await supabase.from('services').insert(toSnake(row));
    }
  } catch (err) {
    // Pre-migration safety: category_id / position columns may not exist yet.
    if (String(err).includes('column') || String(err).includes('no such column')) {
      if (!isNewS) {
        await supabase.from('services').update(base).eq('id', data.id);
      } else {
        await supabase.from('services').insert(base);
      }
    } else {
      throw err;
    }
  }
  revalidatePath('/dashboard');
  return data;
}

export async function deleteService(id) {
  // Remove the service plus its add-ons and every worker↔add-on link
  // belonging to those add-ons.
  const addonRows = await supabase.from('additional_services').select('id').eq('service_id', id).catch(() => ({ data: [] }));
  const addonIds = (addonRows.data || []).map(r => r.id);
  await Promise.all([
    supabase.from('services').delete().eq('id', id).catch(() => {}),
    supabase.from('worker_services').delete().eq('service_id', id).catch(() => {}),
    ...(addonIds.length ? [
      supabase.from('worker_additional_services').delete().in('additional_service_id', addonIds).catch(() => {}),
      supabase.from('additional_services').delete().in('id', addonIds).catch(() => {}),
    ] : []),
  ]);
  revalidatePath('/dashboard');
}

export async function saveServiceCategory(data) {
  const row = {
    id:       data.id || uuid(),
    name:     data.name,
    position: data.position != null ? Number(data.position) : 0,
  };
  const isNew = data._isNew !== undefined ? data._isNew : !data.id;
  if (!isNew) {
    await supabase.from('service_categories').update(row).eq('id', row.id);
  } else {
    await supabase.from('service_categories').insert(row);
  }
  revalidatePath('/dashboard');
  return data;
}

export async function deleteServiceCategory(id) {
  try {
    const { data: svcRows } = await supabase
      .from('services')
      .select('id')
      .eq('category_id', id);
    const serviceIds = (svcRows || []).map(r => r.id);
    await supabase.from('services').update({ category_id: null }).eq('category_id', id);
    if (serviceIds.length) {
      await supabase.from('worker_services').delete().in('service_id', serviceIds);
    }
  } catch {}
  await supabase.from('service_categories').delete().eq('id', id);
  revalidatePath('/dashboard');
}

export async function getServiceCategories() {
  try {
    const { data, error } = await supabase
      .from('service_categories')
      .select('*')
      .order('position');
    if (error) throw error;
    return toCamelArray(data);
  } catch (error) {
    console.error('Error fetching service categories:', error);
    return [];
  }
}

// ─── Worker ↔ Service assignments ───────────────────────────────────────────

export async function getWorkerServices() {
  try {
    const { data, error } = await supabase.from('worker_services').select('*');
    if (error) throw error;
    return toCamelArray(data);
  } catch (error) {
    console.error('Error fetching worker services:', error);
    return [];
  }
}

export async function saveWorkerServices(workerId, serviceIds) {
  try {
    await supabase.from('worker_services').delete().eq('worker_id', workerId);
    const rows = (serviceIds || []).map(sid => ({ worker_id: workerId, service_id: sid }));
    if (rows.length) await supabase.from('worker_services').insert(rows);
  } catch (error) {
    console.error('Error saving worker services:', error);
    throw error;
  }
  revalidatePath('/dashboard');
}

export async function getWorkerAdditionalServices() {
  try {
    const { data, error } = await supabase.from('worker_additional_services').select('*');
    if (error) throw error;
    return toCamelArray(data);
  } catch (error) {
    console.error('Error fetching worker additional services:', error);
    return [];
  }
}

export async function saveWorkerAdditionalServices(workerId, additionalServiceIds) {
  try {
    await supabase.from('worker_additional_services').delete().eq('worker_id', workerId);
    const rows = (additionalServiceIds || []).map(id => ({ worker_id: workerId, additional_service_id: id }));
    if (rows.length) await supabase.from('worker_additional_services').insert(rows);
  } catch (error) {
    console.error('Error saving worker additional services:', error);
    throw error;
  }
  revalidatePath('/dashboard');
}

// ─── Worker settings (salary %, notes) ──────────────────────────────────────

export async function getWorkerSettings() {
  try {
    const { data, error } = await supabase.from('worker_settings').select('*');
    if (error) throw error;
    return toCamelArray(data);
  } catch (error) {
    console.error('Error fetching worker settings:', error);
    return [];
  }
}

export async function saveWorkerSettings(workerId, settings) {
  const row = {
    worker_id:          workerId,
    salary_percent:     settings.salaryPercent != null ? Number(settings.salaryPercent) : null,
    notes:              settings.notes || null,
    payroll_active:     settings.payrollActive !== undefined ? !!settings.payrollActive : undefined,
    payroll_frequency:  settings.payrollFrequency || null,
    payroll_day:        settings.payrollDay != null ? Number(settings.payrollDay) : null,
    payroll_month:      settings.payrollMonth != null ? Number(settings.payrollMonth) : null,
    payroll_start_date: settings.payrollStartDate || null,
    next_payroll_date:  settings.nextPayrollDate || null,
  };
  // Skip unset keys so a partial save (e.g. just toggling salary %) can't
  // wipe payroll settings the client didn't send.
  for (const k of Object.keys(row)) {
    if (row[k] === undefined) delete row[k];
  }

  const { data: existing } = await supabase
    .from('worker_settings')
    .select('worker_id, next_payroll_date')
    .eq('worker_id', workerId);
  const storedNext = existing?.[0]?.next_payroll_date;

  // Only compute a next-pay date when activating a worker that has none yet;
  // otherwise preserve the stored schedule untouched.
  if (row.payroll_active && !row.next_payroll_date && !storedNext) {
    const initial = computeInitialPayrollDate({
      payrollFrequency: row.payroll_frequency,
      payrollDay: row.payroll_day,
      payrollMonth: row.payroll_month,
      payrollStartDate: row.payroll_start_date || undefined,
    }, getTodayKS());
    if (initial) row.next_payroll_date = initial;
  } else if (row.next_payroll_date == null) {
    delete row.next_payroll_date;
  }

  if (existing && existing.length > 0) {
    await supabase.from('worker_settings').update(row).eq('worker_id', workerId);
  } else {
    await supabase.from('worker_settings').insert(row);
  }
  revalidatePath('/dashboard');
}

// ─── Additional services catalog ────────────────────────────────────────────

export async function getAdditionalServices() {
  try {
    const { data, error } = await supabase
      .from('additional_services')
      .select('*')
      .order('position');
    if (error) throw error;
    return toCamelArray(data);
  } catch (error) {
    console.error('Error fetching additional services:', error);
    return [];
  }
}

export async function saveAdditionalService(data) {
  const row = {
    id:        data.id || uuid(),
    name:      data.name,
    price:     Number(data.price || 0),
    active:    data.active !== false,
    position:  data.position != null ? Number(data.position) : 0,
    service_id: data.serviceId || null,
  };
  const isNew = data._isNew !== undefined ? data._isNew : !data.id;
  if (!isNew) {
    await supabase.from('additional_services').update(row).eq('id', row.id);
  } else {
    await supabase.from('additional_services').insert(row);
  }
  revalidatePath('/dashboard');
  return data;
}

export async function deleteAdditionalService(id) {
  await supabase.from('worker_additional_services').delete().eq('additional_service_id', id);
  await supabase.from('additional_services').delete().eq('id', id);
  revalidatePath('/dashboard');
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function saveSettings(key, value) {
  const valueStr = JSON.stringify(value);
  const { data: existing } = await supabase.from('settings').select('key').eq('key', key);
  if (existing && existing.length > 0) {
    await supabase.from('settings').update({ value: valueStr }).eq('key', key);
  } else {
    await supabase.from('settings').insert({ key, value: valueStr });
  }
  revalidatePath('/dashboard');
}

export async function getSetting(key, fallback) {
  try {
    const { data, error } = await supabase.from('settings').select('value').eq('key', key);
    if (error) throw error;
    if (!data || data.length === 0) return fallback;
    try {
      return JSON.parse(data[0].value);
    } catch {
      return fallback;
    }
  } catch (error) {
    // Table may not exist yet on first boot — return fallback
    console.warn('getSetting: DB not ready yet, returning fallback', error);
    return fallback;
  }
}

// ─── Worker Schedule & Shop Hours ───────────────────────────────────────────

export async function getWorkerSchedule() {
  return getSetting('sparta_worker_schedule', {});
}

export async function saveWorkerSchedule(schedule) {
  await saveSettings('sparta_worker_schedule', schedule);
}

export async function getWorkingHours() {
  return getSetting('sparta_working_hours', {
    "0": null,
    "1": { open: "09:00", close: "20:00" },
    "2": { open: "09:00", close: "20:00" },
    "3": { open: "09:00", close: "20:00" },
    "4": { open: "09:00", close: "20:00" },
    "5": { open: "09:00", close: "21:00" },
    "6": { open: "09:00", close: "18:00" },
  });
}

export async function saveWorkingHours(hours) {
  await saveSettings('sparta_working_hours', hours);
}

// ─── Worker Unavailability ──────────────────────────────────────────────────

export async function getWorkerUnavailability() {
  return getSetting('sparta_worker_unavailability', []);
}

export async function saveWorkerUnavailability(entry) {
  const list = await getWorkerUnavailability();
  const id = entry.id || uuid();
  const newEntry = { ...entry, id };
  const idx = list.findIndex(e => e.id === id);
  if (idx >= 0) {
    list[idx] = newEntry;
  } else {
    list.push(newEntry);
  }
  await saveSettings('sparta_worker_unavailability', list);
  return newEntry;
}

export async function deleteWorkerUnavailability(id) {
  const list = await getWorkerUnavailability();
  const filtered = list.filter(e => e.id !== id);
  await saveSettings('sparta_worker_unavailability', filtered);
}

// ─── Recurring expenses ──────────────────────────────────────────────────────

export async function getRecurringExpenses() {
  try {
    const { data, error } = await supabase.from('recurring_expenses').select('*');
    if (error) throw error;
    return toCamelArray(data);
  } catch (error) {
    console.error('Error fetching recurring expenses:', error);
    return [];
  }
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function addMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d || 1, lastDay);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(day)}`;
}

function computeFirstDue(entry, todayIso) {
  const today = new Date(`${todayIso}T00:00:00Z`);
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth() + 1;
  if (entry.frequency === 'weekly') {
    const targetDow = entry.weekday != null ? Number(entry.weekday) : 1;
    const dow = today.getUTCDay();
    let diff = (targetDow - dow + 7) % 7;
    if (diff === 0) diff = 7;
    const d = new Date(Date.UTC(y, m - 1, today.getUTCDate() + diff));
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  const day = entry.dayOfMonth != null ? Number(entry.dayOfMonth) : 1;
  if (entry.frequency === 'yearly') {
    const month = entry.month != null ? Number(entry.month) : 1;
    let cand = `${y}-${pad2(month)}-${pad2(Math.min(day, new Date(Date.UTC(y, month, 0)).getUTCDate()))}`;
    if (cand <= todayIso) cand = `${y + 1}-${pad2(month)}-${pad2(Math.min(day, new Date(Date.UTC(y + 1, month, 0)).getUTCDate()))}`;
    return cand;
  }
  let cand = `${y}-${pad2(m)}-${pad2(Math.min(day, new Date(Date.UTC(y, m, 0)).getUTCDate()))}`;
  if (cand <= todayIso) {
    const next = new Date(Date.UTC(y, m, 1));
    const ny = next.getUTCFullYear();
    const nm = next.getUTCMonth() + 1;
    cand = `${ny}-${pad2(nm)}-${pad2(Math.min(day, new Date(Date.UTC(ny, nm, 0)).getUTCDate()))}`;
  }
  return cand;
}

function computeNextDue(entry, fromIso) {
  if (entry.frequency === 'weekly') {
    const d = new Date(`${fromIso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  if (entry.frequency === 'yearly') return addMonths(fromIso, 12);
  return addMonths(fromIso, 1);
}

/**
 * Insert a shpenzimet row unless one with the same source_id already exists.
 * source_id links auto-generated transactions to their origin
 * (`recurring:<id>:<date>` or `payroll:<workerId>:<periodStart>`) so re-runs
 * (cron + dashboard boot) never create duplicates, even if a previous run
 * crashed between the insert and the schedule advance.
 */
async function insertExpenseOnce({ sourceId, ...row }) {
  if (sourceId) {
    const { data: existing } = await supabase
      .from('shpenzimet')
      .select('id')
      .eq('source_id', sourceId);
    if (existing && existing.length > 0) return false;
  }
  const payload = { id: uuid(), ...row, sourceId: sourceId || null };
  try {
    await supabase.from('shpenzimet').insert(toSnake(payload));
    return true;
  } catch (err) {
    // Pre-migration safety: strip columns that don't exist yet.
    if (String(err).includes('column') || String(err).includes('no such column')) {
      const base = { id: payload.id, description: payload.description, amount: payload.amount, date: payload.date };
      if (payload.category) base.category = payload.category;
      await supabase.from('shpenzimet').insert(toSnake(base));
      return true;
    }
    throw err;
  }
}

/**
 * Materialises every due recurring expense into shpenzimet, honouring the
 * start_date / end_date scheduling window and catching up any missed
 * occurrences since the last run. Returns the number of rows created.
 */
export async function applyRecurringExpenses() {
  const t = await getT();
  const todayIso = getTodayKS();
  const { data: rows } = await supabase.from('recurring_expenses').select('*');
  const expenses = toCamelArray(rows ?? []);
  let created = 0;

  for (const e of expenses) {
    if (e.active === false) continue;

    let nextDue = e.nextDueDate || computeFirstDue(e, todayIso);
    if (e.startDate && nextDue < e.startDate) nextDue = e.startDate;
    if (e.endDate && nextDue > e.endDate) continue;

    let occurrences = 0;
    while (nextDue <= todayIso && (!e.endDate || nextDue <= e.endDate)) {
      const inserted = await insertExpenseOnce({
        sourceId: `recurring:${e.id}:${nextDue}`,
        description: `${e.name}${e.description ? ` — ${e.description}` : ''}`,
        amount: Number(e.amount || 0),
        date: nextDue,
        category: e.category || t('shpenzime_tjera'),
        type: 'recurring',
      });
      if (inserted) created += 1;
      occurrences += 1;
      nextDue = computeNextDue(e, nextDue);
    }

    if (occurrences > 0) {
      await supabase.from('recurring_expenses').update({
        next_due_date: nextDue,
        last_generated_at: todayIso,
      }).eq('id', e.id);
    } else if (!e.nextDueDate) {
      // First run: persist the computed first due date even if it's in the future.
      await supabase.from('recurring_expenses').update({ next_due_date: nextDue }).eq('id', e.id);
    }
  }
  revalidatePath('/dashboard');
  return { created };
}

export async function saveRecurringExpense(data) {
  const row = {
    id:              data.id || uuid(),
    name:            data.name,
    description:     data.description || null,
    amount:          Number(data.amount || 0),
    category:        data.category || null,
    frequency:       data.frequency || 'monthly',
    dayOfMonth:      data.dayOfMonth != null ? Number(data.dayOfMonth) : null,
    month:           data.month != null ? Number(data.month) : null,
    weekday:         data.weekday != null ? Number(data.weekday) : null,
    nextDueDate:     data.nextDueDate || null,
    startDate:       data.startDate || null,
    endDate:         data.endDate || null,
    active:          data.active !== false,
    lastGeneratedAt: data.lastGeneratedAt || null,
  };
  const isNew = data._isNew !== undefined ? data._isNew : !data.id;
  if (!isNew) {
    await supabase.from('recurring_expenses').update(toSnake(row)).eq('id', row.id);
  } else {
    await supabase.from('recurring_expenses').insert(toSnake(row));
  }
  revalidatePath('/dashboard');
  return data;
}

export async function deleteRecurringExpense(id) {
  await supabase.from('recurring_expenses').delete().eq('id', id);
  revalidatePath('/dashboard');
}

// ─── Automatic payroll ───────────────────────────────────────────────────────

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function computeInitialPayrollDate(worker, todayIso) {
  if (worker.payrollStartDate) return worker.payrollStartDate;
  const freq = worker.payrollFrequency || 'monthly';
  const day = worker.payrollDay != null ? Number(worker.payrollDay) : 1;
  const today = new Date(`${todayIso}T00:00:00Z`);
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth() + 1;
  if (freq === 'weekly') {
    const targetDow = ((day % 7) + 7) % 7;
    const dow = today.getUTCDay();
    let diff = (targetDow - dow + 7) % 7;
    if (diff === 0) diff = 7;
    return addDays(todayIso, diff);
  }
  if (freq === 'yearly') {
    const month = worker.payrollMonth != null ? Number(worker.payrollMonth) : 1;
    let cand = `${y}-${pad2(month)}-${pad2(Math.min(day, new Date(Date.UTC(y, month, 0)).getUTCDate()))}`;
    if (cand <= todayIso) cand = `${y + 1}-${pad2(month)}-${pad2(Math.min(day, new Date(Date.UTC(y + 1, month, 0)).getUTCDate()))}`;
    return cand;
  }
  let cand = `${y}-${pad2(m)}-${pad2(Math.min(day, new Date(Date.UTC(y, m, 0)).getUTCDate()))}`;
  if (cand <= todayIso) {
    const next = new Date(Date.UTC(y, m, 1));
    const ny = next.getUTCFullYear();
    const nm = next.getUTCMonth() + 1;
    cand = `${ny}-${pad2(nm)}-${pad2(Math.min(day, new Date(Date.UTC(ny, nm, 0)).getUTCDate()))}`;
  }
  return cand;
}

function computePayrollWindow(worker, payDate) {
  const freq = worker.payrollFrequency || 'monthly';
  let start;
  if (freq === 'weekly') start = addDays(payDate, -6);
  else if (freq === 'yearly') start = addMonths(payDate, -12);
  else start = addMonths(payDate, -1);
  if (worker.lastPayrollPeriodEnd && start <= worker.lastPayrollPeriodEnd) {
    start = addDays(worker.lastPayrollPeriodEnd, 1);
  }
  if (start > payDate) start = payDate;
  return { start, end: payDate };
}

function computeNextPayrollDate(worker, payDate) {
  const freq = worker.payrollFrequency || 'monthly';
  if (freq === 'weekly') return addDays(payDate, 7);
  if (freq === 'yearly') return addMonths(payDate, 12);
  return addMonths(payDate, 1);
}

/**
 * Generates due payroll for every worker with payroll_active = true and posts
 * the salary as an expense. Idempotent: each (worker, period_start, period_end)
 * window is processed exactly once thanks to the partial unique index
 * payroll_worker_period_unique and the payroll:source_id on shpenzimet.
 */
export async function processDuePayroll() {
  const t = await getT();
  const todayIso = getTodayKS();

  const settingsList = await getWorkerSettings();
  const { data: usersRes } = await supabase.from('users').select('*');
  const users = toCamelArray(usersRes ?? []);
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  let created = 0;
  let totalAmount = 0;

  for (const ws of settingsList) {
    if (!ws.payrollActive) continue;
    const worker = userMap[ws.workerId];
    if (!worker) continue;

    let nextPay = ws.nextPayrollDate;
    if (!nextPay) {
      nextPay = computeInitialPayrollDate({ ...ws, ...worker }, todayIso);
      if (!nextPay) continue;
      await supabase.from('worker_settings')
        .update({ next_payroll_date: nextPay })
        .eq('worker_id', ws.workerId);
    }
    if (nextPay > todayIso) continue;

    const { start, end } = computePayrollWindow(ws, nextPay);

    const { data: revRows } = await supabase
      .from('te_ardhurat')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .eq('worker_id', ws.workerId);

    let service = 0;
    let extra = 0;
    for (const r of toCamelArray(revRows ?? [])) {
      let extrasSum = 0;
      if (r.extras) {
        try { extrasSum = (JSON.parse(r.extras) || []).reduce((s, e) => s + Number(e?.price || 0), 0); } catch {}
      }
      extra += extrasSum;
      service += Number(r.price || 0) - extrasSum;
    }
    const totalRevenue = Math.round((service + extra) * 100) / 100;
    const salaryPercent = ws.salaryPercent != null ? Number(ws.salaryPercent) : 0;
    const salaryAmount = Math.round(totalRevenue * salaryPercent / 100 * 100) / 100;

    let inserted = false;
    {
      const payrollRow = {
        id:                uuid(),
        period:            start.slice(0, 7),
        periodStart:       start,
        periodEnd:         end,
        workerId:          ws.workerId,
        workerName:        worker.name || worker.username,
        serviceRevenue:    service,
        extraRevenue:      extra,
        totalRevenue,
        salaryPercent:     salaryPercent != null ? salaryPercent : null,
        salaryAmount,
        appointmentCount:  revRows?.length || 0,
        status:            'paid',
        paidAt:            new Date().toISOString(),
      };
      try {
        await supabase.from('payroll').insert(toSnake(payrollRow));
        inserted = true;
      } catch (err) {
        // Unique race (payroll_worker_period_unique) → window already done.
        if (!(String(err).includes('duplicate') || String(err).includes('unique'))) throw err;
      }
    }

    if (salaryAmount > 0) {
      await insertExpenseOnce({
        sourceId: `payroll:${ws.workerId}:${start}`,
        description: `${t('paga')}: ${worker.name || worker.username} (${start} → ${end})`,
        amount: salaryAmount,
        date: end,
        category: t('paga'),
        type: 'salary',
        workerId: ws.workerId,
      });
    }

    if (inserted) {
      created += 1;
      totalAmount += salaryAmount;
    }

    const advanced = computeNextPayrollDate(ws, nextPay);
    await supabase.from('worker_settings').update({
      next_payroll_date: advanced,
      last_payroll_period_end: end,
    }).eq('worker_id', ws.workerId);
  }

  revalidatePath('/dashboard');
  return { created, amount: Math.round(totalAmount * 100) / 100 };
}

/**
 * Single entry point for the daily automation sweep: recurring expenses first,
 * then worker payroll. Used by the reminders cron and the dashboard boot.
 */
export async function processDueTransactions() {
  const recurring = await applyRecurringExpenses();
  const payroll = await processDuePayroll();
  return {
    recurringCreated: recurring.created,
    payrollCreated: payroll.created,
    payrollAmount: payroll.amount,
  };
}

// ─── Payroll ─────────────────────────────────────────────────────────────────

async function periodRange(period) {
  const [y, m] = period.split('-').map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  return {
    start: `${period}-01`,
    end: next.toISOString().slice(0, 10),
  };
}

/**
 * Computes each worker's service/extra revenue for a period (YYYY-MM) and
 * stores draft payroll rows. Existing rows for the same worker+period are
 * refreshed, so re-running is safe.
 */
export async function generatePayroll(period, workerId) {
  const t = await getT();
  const { start, end } = await periodRange(period);

  let q = supabase
    .from('te_ardhurat')
    .select('*')
    .gte('date', start)
    .lt('date', end);
  if (workerId) q = q.eq('worker_id', workerId);
  const { data, error } = await q;
  if (error) throw error;
  const rows = toCamelArray(data ?? []);

  const { data: userRows } = await supabase.from('users').select('*');
  const users = toCamelArray(userRows ?? []);
  const settingsList = await getWorkerSettings();
  const settingsMap = Object.fromEntries(settingsList.map(s => [s.workerId, s]));

  const byWorker = new Map();
  for (const r of rows) {
    const wid = r.workerId || 'unassigned';
    const acc = byWorker.get(wid) || { service: 0, extra: 0 };
    let extrasSum = 0;
    if (r.extras) {
      try {
        extrasSum = (JSON.parse(r.extras) || []).reduce((s, e) => s + Number(e?.price || 0), 0);
      } catch {}
    }
    acc.extra += extrasSum;
    acc.service += Number(r.price || 0) - extrasSum;
    byWorker.set(wid, acc);
  }

  const targets = workerId
    ? users.filter(u => u.id === workerId)
    : users.filter(u => u.role !== 'owner');

  const results = [];
  for (const u of targets) {
    const totals = byWorker.get(u.id) || { service: 0, extra: 0 };
    const totalRevenue = totals.service + totals.extra;
    const salaryPercent = settingsMap[u.id]?.salaryPercent ?? 0;
    const salaryAmount = Math.round(totalRevenue * Number(salaryPercent) / 100 * 100) / 100;
    const payrollRow = {
      id:             uuid(),
      period,
      workerId:       u.id,
      workerName:     u.name || u.username,
      serviceRevenue: totals.service,
      extraRevenue:   totals.extra,
      totalRevenue,
      salaryPercent:  salaryPercent != null ? Number(salaryPercent) : null,
      salaryAmount,
      status:         'draft',
    };
    const { data: existing } = await supabase
      .from('payroll')
      .select('id, status')
      .eq('period', period)
      .eq('worker_id', u.id);
    if (existing && existing.length > 0) {
      if (existing[0].status === 'draft') {
        await supabase.from('payroll').update(toSnake(payrollRow)).eq('id', existing[0].id);
        results.push({ ...payrollRow, id: existing[0].id });
      }
    } else {
      await supabase.from('payroll').insert(toSnake(payrollRow));
      results.push(payrollRow);
    }
  }
  revalidatePath('/dashboard');
  return { period, created: results };
}

export async function markPayrollPaid(id) {
  const t = await getT();
  const { data: rows } = await supabase.from('payroll').select('*').eq('id', id);
  const p = rows?.[0];
  if (!p) return { success: false };
  const amount = Number(p.salary_amount || 0);
  await supabase.from('shpenzimet').insert({
    id:          uuid(),
    description: `${t('paga')}: ${p.worker_name || p.worker_id} (${p.period})`,
    amount,
    date:        getTodayKS(),
    category:    t('paga'),
    type:        'salary',
  });
  await supabase.from('payroll').update({
    status: 'paid',
    paid_at: new Date().toISOString(),
  }).eq('id', id);
  revalidatePath('/dashboard');
  return { success: true, amount };
}

export async function deletePayrollEntry(id) {
  await supabase.from('payroll').delete().eq('id', id);
  revalidatePath('/dashboard');
}

// ─── Push Test ──────────────────────────────────────────────────────────────

export async function testPush(userId) {
  const t = await getT();
  await sendPushToAll(
    t('test_push'),
    t('test_push_body'),
    'test-push',
    { type: 'test' },
    userId ? [userId] : []
  );
  return { success: true };
}
