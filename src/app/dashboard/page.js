'use client';

import { getUser, createUser, getAllWorkers, getData, saveShpenzim, deleteShpenzim, saveProdukt, deleteProdukt, saveTeArdhur, deleteTeArdhur, saveClient, deleteClient, saveAppointment, deleteAppointment, saveService, deleteService, saveServiceCategory, deleteServiceCategory, saveWorkerServices, getWorkerServices, saveWorkerAdditionalServices, getWorkerAdditionalServices, saveWorkerSettings, getWorkerSettings, getAdditionalServices, saveAdditionalService, deleteAdditionalService, getRecurringExpenses, saveRecurringExpense, deleteRecurringExpense, applyRecurringExpenses, generatePayroll, markPayrollPaid, deletePayrollEntry, saveSettings as saveSettingsAction, deleteUser, createSession, getSessionUser, destroySession, getSetting, setupAdmin, testPush, getAnyOwner, getWorkerSchedule, saveWorkerSchedule, getWorkingHours, saveWorkingHours, getWorkerUnavailability, saveWorkerUnavailability, deleteWorkerUnavailability } from "@/lib/actions";
import { translations } from "@/lib/dashboard-translations";
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Home, Wallet, TrendingUp, CalendarDays, MoreHorizontal,
  Plus, Trash2, Pencil, X, Package, Users, Scissors,
  BarChart3, Settings as SettingsIcon, Moon, Sun, Download, Upload, FileText,
  AlertTriangle, Phone, Clock, ChevronLeft, Search, Save,
  Check, CheckCircle2, XCircle, RotateCcw, HelpCircle, Circle,
  Loader2, GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Toaster, toast } from 'sonner';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts';
import { v4 as uuid } from 'uuid';
import jsPDF from 'jspdf';
import emailjs from '@emailjs/browser';

/* =====================================================================
   STORAGE & UTILITIES
===================================================================== */
const KEYS = { theme: "sparta_theme", user: "sparta_user", lang: "sparta_lang" };

const SESSION_DAYS = 30;

// ── Kosovo timezone helpers (Europe/Berlin = UTC+1 winter, UTC+2 summer) ──
const TZ = 'Europe/Berlin';

function nowKS() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const y = Number(parts.find(p => p.type === 'year').value);
  const m = Number(parts.find(p => p.type === 'month').value);
  const d = Number(parts.find(p => p.type === 'day').value);
  return new Date(y, m - 1, d);
}

const todayISO = () => {
  const d = nowKS();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const fmtMoney = (n) => { const v = Number(n || 0); return Number.isInteger(v) ? `${v} €` : `${v.toFixed(2)} €`; };
const cn = (...a) => a.filter(Boolean).join(' ');

const notifiedLowStock = new Set();

async function sha256Hex(str) {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return str;
  const buf = new TextEncoder().encode(str);
  const hash = await window.crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function Logo({ size = 24, className = '' }) {
  const px = typeof size === 'number' ? `${size}px` : size;
  return (
    <img
      src="/royale-logo.png"
      alt="Sparta Royale"
      width={size} height={size}
      className={cn('inline-block object-contain select-none', className)}
      style={{ width: px, height: px }}
      draggable={false}
    />
  );
}

function shiftPeriod(period, refDate, dir) {
  const d = refDate ? new Date(refDate) : nowKS();
  if (period === 'daily') d.setDate(d.getDate() + dir);
  else if (period === 'weekly') d.setDate(d.getDate() + 7 * dir);
  else if (period === 'monthly') d.setMonth(d.getMonth() + dir);
  else if (period === 'yearly') d.setFullYear(d.getFullYear() + dir);
  return d;
}
function inRange(dateStr, start, end) {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date >= start && date < end;
}

/* =====================================================================
   APP SHELL
===================================================================== */
const TABS = [
  { id: 'ballina', label: 'Ballina', icon: Home },
  { id: 'tearrdhurat', label: 'Të ardhurat', icon: TrendingUp },
  { id: 'shpenzimet', label: 'Shpenzimet', icon: Wallet },
  { id: 'takimet', label: 'Takimet', icon: CalendarDays },
  { id: 'me_shume', label: 'Më shumë', icon: MoreHorizontal },
];

function App() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState('ballina');
  const [subview, setSubview] = useState(null);
  const [theme, setTheme] = useState('light');
  const [lang, setLang] = useState('sq');

  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [needSetup, setNeedSetup] = useState(false);
  const locale = lang === 'sq' ? 'sq-AL' : 'en-US';

  const nowTime = () => {
    return new Intl.DateTimeFormat(locale, {
      timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date());
  };

  const fmtDate = (d) => {
    if (!d) return '';
    try {
      const [y, mo, day] = d.slice(0, 10).split('-').map(Number);
      return new Date(y, mo - 1, day).toLocaleDateString(locale, {
        day: '2-digit', month: '2-digit', year: 'numeric',
      });
    } catch { return d; }
  };

  function rangeFor(period, refDate) {
    const now = refDate ? new Date(refDate) : nowKS();
    let start, end, label;
    if (period === 'daily') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(start); end.setDate(end.getDate() + 1);
      label = start.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
    } else if (period === 'weekly') {
      const day = (now.getDay() + 6) % 7;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      end = new Date(start); end.setDate(end.getDate() + 7);
      const endLbl = new Date(end); endLbl.setDate(endLbl.getDate() - 1);
      label = `${start.getDate()}.${start.getMonth()+1} – ${endLbl.getDate()}.${endLbl.getMonth()+1}.${endLbl.getFullYear()}`;
    } else if (period === 'yearly') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
      label = String(now.getFullYear());
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      label = start.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    }
    return [start, end, label];
  }

  const [shpenzimet, setShpenzimet] = useState([]);
  const [produktet, setProduktet] = useState([]);
  const [teArdhurat, setTeArdhurat] = useState([]);
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const appointmentsRef = useRef([]);
  const userRef = useRef(null);
  const autoGenRef = useRef(false);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [workerServices, setWorkerServicesState] = useState([]);
  const [workerAdditionalServices, setWorkerAdditionalServicesState] = useState([]);
  const [additionalServices, setAdditionalServices] = useState([]);
  const [workerSettings, setWorkerSettingsState] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [settings, setSettings] = useState({
    salonName: 'Sparta Royale',
    lowStockThreshold: 5,
    currency: '€',
    lowStockNotif: false,
    appointmentNotif: false,
    appointmentMinutesBefore: 30,
    email: {
      enabled: false,
      serviceId: '',
      templateId: '',
      publicKey: '',
      recipientEmail: '',
      senderName: 'Sparta Royale',
      schedule: {
        frequency: 'weekly',
        weekDay: 1,
        monthDay: 1,
        yearMonth: 1,
        yearDay: 1,
        time: '08:00',
      },
    },
  });

  const [emailBusy, setEmailBusy] = useState(false);
  const [lastEmailAt, setLastEmailAt] = useState(null);

  const [notifPermission, setNotifPermission] = useState('default');
  const savingRef = useRef(0);

  const [confirmModal, setConfirmModal] = useState({ open: false, message: '', confirmLabel: 'Fshi', confirmTitle: 'Konfirmo', cancelLabel: 'Anulo' });
  const confirmRef = useRef(null);

  function confirmAsync(message, confirmLabel) {
    return new Promise(resolve => {
      confirmRef.current = resolve;
      setConfirmModal({ open: true, message, confirmLabel: confirmLabel || t('fshi'), confirmTitle: t('konfirmo') || 'Konfirmo', cancelLabel: t('anulo') });
    });
  }

  function handleConfirmClose(val) {
    confirmRef.current?.(val);
    confirmRef.current = null;
    setConfirmModal(s => ({ ...s, open: false }));
  }

  const toggleLang = async () => {
    const next = lang === 'sq' ? 'en' : 'sq';
    setLang(next);
    await saveSettingsAction(KEYS.lang, next);
  };
  const t = (key) => translations[lang]?.[key] || key;

  const filteredTabs = useMemo(() => {
    if (user?.role === 'worker') {
      return TABS.filter(t => t.id === 'ballina' || t.id === 'takimet').map(tabItem => ({ ...tabItem, label: t(tabItem.id) }));
    }
    return TABS.map(tabItem => ({ ...tabItem, label: t(tabItem.id) }));
  }, [user, lang]);

  useEffect(() => {
    async function init() {
      try {
        const savedTheme = await getSetting(KEYS.theme, 'light');
        const savedLang = await getSetting(KEYS.lang, 'sq');
        if (savedLang) setLang(savedLang);
        const t = savedTheme || 'light';
        setTheme(t);
        if (t === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
      } catch {}

      let sessionUser = null;
      try {
        sessionUser = await getSessionUser();
      } catch (err) {
        console.error('Session check failed:', err?.message || err);
      }

      if (sessionUser) {
        setUser(sessionUser);
        await refreshData(sessionUser);
        if (sessionUser.role === 'owner' && !autoGenRef.current) {
          autoGenRef.current = true;
          try {
            const d = nowKS();
            const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            await applyRecurringExpenses();
            await generatePayroll(period);
            await refreshData(sessionUser);
          } catch (err) {
            console.error('Auto-generate failed:', err?.message || err);
          }
        }
        setTimeout(() => requestNotifPermission(), 1500);
      } else {
        const existingOwner = await getAnyOwner();
        if (!existingOwner) setNeedSetup(true);
      }

      if (typeof window !== 'undefined' && 'Notification' in window) {
        setNotifPermission(getNotifPerm());
      }

      setMounted(true);
      setAuthChecked(true);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshData(currUser) {
    if (!currUser) return;
    try {
      const data = await getData(currUser.role, currUser.id);
      setShpenzimet(data.shpenzimet);
      setProduktet(data.produktet);
      setTeArdhurat(data.teArdhurat);
      setClients(data.clients);
      const appts = currUser.role === 'worker'
        ? data.appointments.filter(a => a.workerId === currUser.id)
        : data.appointments;
      setAppointments(appts); appointmentsRef.current = appts;
      setServices(data.services);
      setCategories(data.categories || []);
      setWorkerServicesState(data.workerServices || []);
      setWorkerAdditionalServicesState(data.workerAdditionalServices || []);
      setAdditionalServices(data.additionalServices || []);
      setWorkerSettingsState(data.workerSettings || []);
      setPayroll(data.payroll || []);
      setRecurringExpenses(data.recurringExpenses || []);
      if (Object.keys(data.settings).length > 0) {
        setSettings(prev => ({ ...prev, ...data.settings }));
      }
      if (currUser.role === 'owner') {
        const w = await getAllWorkers();
        setWorkers(w);
      }
    } catch (error) {
      console.error(error);
      toast.error(t('gabim_ngarkimin'));
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => { userRef.current = user; }, [user, lang]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    function handler(e) {
      if (e.data?.type === 'REFRESH_DATA' && userRef.current) {
        refreshData(userRef.current);
      }
    }
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;
    function onVisible() {
      if (document.visibilityState === 'visible') refreshData(user);
    }
    function onFocus() { refreshData(user); }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, lang]);

  function getNotifPerm() {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    return window.Notification.permission;
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    function sendHeartbeat() {
      if (getNotifPerm() !== 'granted') return;
      navigator.serviceWorker.ready.then(reg => {
        reg.active?.postMessage({ type: 'HEARTBEAT' });
      }).catch(() => {});
    }

    sendHeartbeat();
    const id = setInterval(sendHeartbeat, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  async function subscribeToPush(userId) {
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
      if (!vapidKey) {
        console.warn('Push notifications disabled: NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;

      // Detect VAPID key change — force full re-subscribe
      const storedKey = localStorage.getItem('sparta_vapid_key');
      if (storedKey && storedKey !== vapidKey) {
        const old = await reg.pushManager.getSubscription();
        if (old) await old.unsubscribe();
        // Clear all stale subscriptions from DB for this user
        try {
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });
        } catch {}
        localStorage.removeItem('sparta_vapid_key');
      }

      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: existingSub.toJSON(), userId }),
        });
        localStorage.setItem('sparta_vapid_key', vapidKey);
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), userId }),
      });
      localStorage.setItem('sparta_vapid_key', vapidKey);
    } catch (err) {
      console.error('subscribeToPush error:', err);
    }
  }

  // ── Optimistic helpers ───────────────────────────────────────────────────

  function withSave(promise, onError) {
    savingRef.current++;
    return promise
      .then(() => refreshData(user))
      .catch(() => { onError(); refreshData(user); })
      .finally(() => savingRef.current--);
  }

  const handleSaveShpenzim = (data) => {
    let isNewRecord = data._isNew !== undefined ? data._isNew : !data.id;
    const item = { ...data, id: data.id || uuid(), _isNew: isNewRecord, name: data.name || data.description || '' };
    if (isNewRecord) {
      const dup = shpenzimet.find(e => e.date === item.date && (e.name === item.name || (!e.name && !item.name)));
      if (dup) {
        item.id = dup.id;
        item._isNew = false;
        item.amount = Number(dup.amount) + Number(item.amount);
        isNewRecord = false;
      }
    }
    setShpenzimet(prev => isNewRecord ? [...prev, item] : prev.map(x => x.id === item.id ? item : x));
    return withSave(saveShpenzim(item), () => toast.error('Gabim në ruajtje'));
  };
  const handleDeleteShpenzim = (id) => {
    setShpenzimet(prev => prev.filter(x => x.id !== id));
    return withSave(deleteShpenzim(id), () => toast.error('Gabim në fshirje'));
  };

  const handleSaveProdukt = (data) => {
    const isNewRecord = data._isNew !== undefined ? data._isNew : !data.id;
    const item = { ...data, id: data.id || uuid(), _isNew: isNewRecord };
    setProduktet(prev => isNewRecord ? [...prev, item] : prev.map(x => x.id === data.id ? item : x));
    return withSave(saveProdukt(item), () => toast.error('Gabim në ruajtje'));
  };
  const handleDeleteProdukt = (id) => {
    setProduktet(prev => prev.filter(x => x.id !== id));
    return withSave(deleteProdukt(id), () => toast.error('Gabim në fshirje'));
  };

  const handleSaveTeArdhur = (data) => {
    if (user?.role === 'worker') data.workerId = user.id;
    const isNewRecord = data._isNew !== undefined ? data._isNew : !data.id;
    const item = { ...data, id: data.id || uuid(), _isNew: isNewRecord };
    setTeArdhurat(prev => isNewRecord ? [...prev, item] : prev.map(x => x.id === data.id ? item : x));
    return withSave(saveTeArdhur(item), () => toast.error('Gabim në ruajtje'));
  };
  const handleDeleteTeArdhur = (id) => {
    setTeArdhurat(prev => prev.filter(x => x.id !== id));
    return withSave(deleteTeArdhur(id), () => toast.error('Gabim në fshirje'));
  };

  const handleSaveClient = (data) => {
    const isNewRecord = data._isNew !== undefined ? data._isNew : !data.id;
    const item = { ...data, id: data.id || uuid(), _isNew: isNewRecord };
    setClients(prev => isNewRecord ? [...prev, item] : prev.map(x => x.id === data.id ? item : x));
    return withSave(saveClient(item), () => toast.error('Gabim në ruajtje'));
  };
  const handleDeleteClient = (id) => {
    setClients(prev => prev.filter(x => x.id !== id));
    return withSave(deleteClient(id), () => toast.error('Gabim në fshirje'));
  };

  const handleSaveAppointment = (data) => {
    const isNewRecord = data._isNew !== undefined ? data._isNew : !data.id;
    if (user?.role === 'worker' && !data.workerId) data.workerId = user.id;
    const item = { ...data, id: data.id || uuid(), _isNew: isNewRecord };

    if (isNewRecord) {
      setAppointments(prev => { const next = [...prev, item]; appointmentsRef.current = next; return next; });
      return withSave(saveAppointment(item), () => toast.error('Gabim në ruajtje'));
    } else {
      setAppointments(prevList => { const next = prevList.map(x => x.id === item.id ? item : x); appointmentsRef.current = next; return next; });
      return withSave(saveAppointment(item), () => toast.error('Gabim në ruajtje'));
    }
  };

  // FIX: remove linked income from local state; server-side cleanup is in deleteAppointment action
  const handleDeleteAppointment = (id) => {
    setAppointments(prev => prev.filter(x => x.id !== id));
    setTeArdhurat(prev => prev.filter(i => i.fromAppointmentId !== id));
    return withSave(deleteAppointment(id), () => toast.error('Gabim në fshirje'));
  };

  const completeAppointment = (a) => {
    savingRef.current++;
    setAppointments(prev => prev.map(x => x.id === a.id ? { ...x, status: 'completed' } : x));

    const alreadyRecorded = teArdhurat.some(t => t.fromAppointmentId === a.id);
    let incomeRecord = null;
    if (!alreadyRecorded) {
      let totalPrice = Number(a.price || 0);
      if (!totalPrice) {
        const mainSvc = services.find(s => s.id === a.serviceId)
          || services.find(s => s.name?.toLowerCase() === (a.serviceName || '').toLowerCase());
        const mainPrice = mainSvc ? Number(mainSvc.price || 0) : 0;
        const extrasTotal = (a.extras || []).reduce((s, e) => s + Number(e.price || 0), 0);
        totalPrice = mainPrice + extrasTotal;
      }
      incomeRecord = {
        id: uuid(),
        _isNew: true,
        // FIX: include clientId so KlientetView visitsCount + totals count this income
        clientId:          a.clientId    || null,
        clientName:        a.clientName  || null,
        serviceName:       a.serviceName || null,
        price:             totalPrice,
        date:              a.date,
        workerId:          a.workerId || user?.id || null,
        fromAppointmentId: a.id,
      };
      setTeArdhurat(prev => [...prev, incomeRecord]);
    }

    return saveAppointment({ ...a, status: 'completed' })
      .then(() => incomeRecord ? saveTeArdhur(incomeRecord) : Promise.resolve())
      .then(() => refreshData(user))
      .catch(() => { toast.error(t('gabim_ruajtje')); refreshData(user); })
      .finally(() => savingRef.current--);
  };

  // FIX: remove linked income when canceling a completed appointment
  const cancelAppointment = (a) => {
    setAppointments(prev => prev.map(x => x.id === a.id ? { ...x, status: 'canceled' } : x));
    const linkedIncome = teArdhurat.find(i => i.fromAppointmentId === a.id);
    if (linkedIncome) {
      setTeArdhurat(prev => prev.filter(i => i.fromAppointmentId !== a.id));
      deleteTeArdhur(linkedIncome.id).catch(() => {});
    }
    return withSave(saveAppointment({ ...a, status: 'canceled' }), () => toast.error('Gabim'));
  };

  const reopenAppointment = (a) => {
    setAppointments(prev => prev.map(x => x.id === a.id ? { ...x, status: 'pending' } : x));
    return withSave(saveAppointment({ ...a, status: 'pending' }), () => toast.error('Gabim'));
  };

  const handleSaveService = (data) => {
    const isNewRecord = data._isNew !== undefined ? data._isNew : !data.id;
    const item = { ...data, id: data.id || uuid(), _isNew: isNewRecord };
    setServices(prev => isNewRecord ? [...prev, item] : prev.map(x => x.id === data.id ? item : x));
    return withSave(saveService(item), () => toast.error('Gabim në ruajtje'));
  };
  const handleDeleteService = (id) => {
    const doomedAddons = additionalServices.filter(a => a.serviceId === id).map(a => a.id);
    setServices(prev => prev.filter(x => x.id !== id));
    setWorkerServicesState(prev => prev.filter(x => x.serviceId !== id));
    if (doomedAddons.length) {
      setAdditionalServices(prev => prev.filter(x => x.serviceId !== id));
      setWorkerAdditionalServicesState(prev => prev.filter(x => !doomedAddons.includes(x.additionalServiceId)));
    }
    return withSave(deleteService(id), () => toast.error('Gabim në fshirje'));
  };

  const handleSaveServiceCategory = (data) => {
    const isNewRecord = data._isNew !== undefined ? data._isNew : !data.id;
    const item = { ...data, id: data.id || uuid(), _isNew: isNewRecord };
    setCategories(prev => isNewRecord ? [...prev, item] : prev.map(x => x.id === data.id ? item : x));
    return withSave(saveServiceCategory(item), () => toast.error('Gabim në ruajtje'));
  };
  const handleDeleteServiceCategory = (id) => {
    setCategories(prev => prev.filter(x => x.id !== id));
    setServices(prev => prev.map(s => s.categoryId === id ? { ...s, categoryId: null } : s));
    setWorkerServicesState(prev => prev.filter(x => {
      const svc = services.find(s => s.id === x.serviceId);
      return svc?.categoryId !== id;
    }));
    return withSave(deleteServiceCategory(id), () => toast.error('Gabim në fshirje'));
  };

  const handleSaveAdditionalService = (data) => {
    const isNewRecord = data._isNew !== undefined ? data._isNew : !data.id;
    const item = { ...data, id: data.id || uuid(), _isNew: isNewRecord };
    setAdditionalServices(prev => isNewRecord ? [...prev, item] : prev.map(x => x.id === data.id ? item : x));
    return withSave(saveAdditionalService(item), () => toast.error('Gabim në ruajtje'));
  };
  const handleDeleteAdditionalService = (id) => {
    setAdditionalServices(prev => prev.filter(x => x.id !== id));
    setWorkerAdditionalServicesState(prev => prev.filter(x => x.additionalServiceId !== id));
    return withSave(deleteAdditionalService(id), () => toast.error('Gabim në fshirje'));
  };

  async function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    await saveSettingsAction(KEYS.theme, next);
    if (next === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }

  async function setupAdminPassword(name, pw) {
    const h = await sha256Hex(pw);
    const savedUser = await setupAdmin(name, h);
    await createSession(savedUser.id);
    setUser(savedUser);
    setNeedSetup(false);
    toast.success(t('llogaria_u_krijua'));
    await refreshData(savedUser);
  }
  async function loginUser(_unused, pw) {
    const h = await sha256Hex(pw);
    const allUsers = await getAllWorkers();
    let matched = null;
    for (const u of allUsers) {
      if (u.passwordHash === h) {
        if (u.status !== 'active') {
          toast.error(t('llogaria_ne_pritje'));
          return false;
        }
        matched = u;
        break;
      }
    }

    if (!matched) { toast.error(t('fjalëkalim_i_gabuar')); return false; }
    await createSession(matched.id);
    setUser(matched);
    setTab('ballina');
    setSubview(null);
    toast.success(t('mirë_se_erdhe') + (matched.name || matched.username));
    await refreshData(matched);
    setTimeout(() => requestNotifPermission(), 1500);
    return true;
  }
  async function logoutUser() {
    await destroySession();
    setUser(null);
    setTab('ballina');
    setSubview(null);
  }
  async function changeUserPassword(oldPw, newPw) {
    if (!user) return false;
    const oldH = await sha256Hex(oldPw);
    if (oldH !== user.passwordHash) { toast.error(t('fjalëkalimi_nuk_saktë')); return false; }
    toast.info(t('ndryshimi_incomplet'));
    return true;
  }

  async function requestNotifPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (getNotifPerm() === 'granted') {
      setNotifPermission('granted');
      subscribeToPush(userRef.current?.id);
      return;
    }
    if (getNotifPerm() === 'denied') {
      setNotifPermission('denied');
      return;
    }
    try {
      const result = await window.Notification.requestPermission();
      setNotifPermission(result);
      if (result === 'granted') {
        toast.success(t('njoftimet_u_aktivizuan'));
        subscribeToPush(userRef.current?.id);
      }
    } catch {}
  }

  async function enableLowStockNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error(t('shfletuesi_nuk_mbështet'));
      return false;
    }
    let perm = getNotifPerm();
    if (perm === 'default') {
      perm = await window.Notification.requestPermission();
    }
    setNotifPermission(perm);
    if (perm !== 'granted') {
      toast.error(t('lejoni_njoftimet'));
      setSettings(s => ({ ...s, lowStockNotif: false }));
      return false;
    }
    subscribeToPush(userRef.current?.id);
    setSettings(s => ({ ...s, lowStockNotif: true }));
    toast.success('Njoftimet u aktivizuan');
    try {
      new window.Notification(t('sparta_royale_title'), {
        body: t('njoftimet_active'),
        icon: '/icon-192.png',
        tag: 'sparta-welcome',
      });
    } catch {}
    return true;
  }
  function disableLowStockNotifications() {
    setSettings(s => ({ ...s, lowStockNotif: false }));
    toast.message(t('njoftimet_u_deaktivizuan'));
  }
  async function sendServerTestPush() {
    if (getNotifPerm() !== "granted") {
      toast.error("Aktivizoni më parë njoftimet");
      return;
    }
    try {
      toast.info("Po dërgohet push nga serveri...");
      await testPush(user?.id);
      toast.success("Push u dërgua! Kontrolloni pas pak.");
    } catch (e) {
      toast.error("Gabim: " + e.message);
    }
  }

  function sendTestNotification() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error(t('shfletuesi_nuk_mbështet'));
      return;
    }
    if (getNotifPerm() !== 'granted') {
      toast.error(t('aktivizoni_para'));
      return;
    }
    try {
      new window.Notification(t('sparta_royale_test'), {
        body: t('njoftimet_funksionojne'),
        icon: '/icon-192.png',
        tag: 'sparta-test',
      });
      toast.success(t('njoftimi_u_dërgua'));
    } catch (e) {
      toast.error(t('gabim_push') + e.message);
    }
  }

  function buildReport(frequency) {
    const now = nowKS();
    let start;
    switch (frequency) {
      case 'daily':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        start = new Date(now); start.setDate(now.getDate() - 7);
        start = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        break;
      case 'monthly':
        start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'yearly':
        start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default:
        start = new Date(now); start.setDate(now.getDate() - 7);
        start = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    }
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const inc = teArdhurat.filter(t => inRange(t.date, start, end));
    const exp = shpenzimet.filter(s => inRange(s.date, start, end));
    const apptsAll = appointments.filter(a => inRange(a.date, start, end));
    const completedAppts = apptsAll.filter(a => a.status === 'completed');

    const totalIncome = inc.reduce((s, t) => s + Number(t.price || 0), 0);
    const totalExpense = exp.reduce((s, t) => s + Number(t.amount || 0), 0);
    const profit = totalIncome - totalExpense;
    const completedCount = completedAppts.length;
    const canceledCount = apptsAll.filter(a => a.status === 'canceled').length;

    const src = completedAppts.length > 0 ? completedAppts : inc;
    const svcMap = {};
    src.forEach(t => {
      const k = t.serviceName || 'Tjetër';
      if (!svcMap[k]) svcMap[k] = { name: k, count: 0, revenue: 0 };
      svcMap[k].count += 1;
      svcMap[k].revenue += Number(t.price || 0);
    });
    const topSvc = Object.values(svcMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const cliMap = {};
    src.forEach(t => {
      const k = t.clientName || 'Pa emër';
      if (!cliMap[k]) cliMap[k] = { name: k, count: 0, revenue: 0 };
      cliMap[k].count += 1;
      cliMap[k].revenue += Number(t.price || 0);
    });
    const topCli = Object.values(cliMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const fmtD = (d) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
    const periodLabel = fmtD(start) + ' – ' + fmtD(now);
    return {
      period: periodLabel,
      totalIncome, totalExpense, profit,
      servicesCount: src.length,
      completedCount, canceledCount,
      topSvc, topCli,
    };
  }

  function reportTypeLabel(frequency) {
    const labels = { daily: 'RAPORT DITOR', weekly: 'RAPORT JAVOR', monthly: 'RAPORT MUJOR', yearly: 'RAPORT VJETOR' };
    return labels[frequency] || 'RAPORT';
  }

  function buildReportHTML(r, salonName, frequency) {
    const fmtRow = (l, v, color = '#333') =>
      `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${l}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;color:${color};font-weight:600;font-family:monospace">${v}</td></tr>`;
    const svcRows = r.topSvc.length
      ? r.topSvc.map((s, i) => `<tr><td style="padding:5px 12px;border-bottom:1px solid #f0f0f0">${i + 1}. ${s.name}</td><td style="padding:5px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#666">${s.count} herë</td><td style="padding:5px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#10b981;font-weight:600">${fmtMoney(s.revenue)}</td></tr>`).join('')
      : `<tr><td colspan="3" style="padding:8px 12px;color:#999;text-align:center">Asnjë e dhënë</td></tr>`;
    const cliRows = r.topCli.length
      ? r.topCli.map((c, i) => `<tr><td style="padding:5px 12px;border-bottom:1px solid #f0f0f0">${i + 1}. ${c.name}</td><td style="padding:5px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#666">${c.count} vizita</td><td style="padding:5px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#10b981;font-weight:600">${fmtMoney(c.revenue)}</td></tr>`).join('')
      : `<tr><td colspan="3" style="padding:8px 12px;color:#999;text-align:center">Asnjë e dhënë</td></tr>`;
    return `
<div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:24px;color:#333">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#471115,#7a1d28);padding:24px;color:#e8d0a0">
      <h1 style="margin:0;font-size:22px;letter-spacing:1px">${salonName.toUpperCase()}</h1>
      <p style="margin:6px 0 0;font-size:13px;opacity:.9">${reportTypeLabel(frequency)} — ${r.period}</p>
    </div>
    <div style="padding:20px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
        <tbody>
          ${fmtRow('Të ardhurat', fmtMoney(r.totalIncome), '#10b981')}
          ${fmtRow('Shpenzimet', fmtMoney(r.totalExpense), '#e11d48')}
          <tr><td style="padding:10px 12px;background:#fff8eb;font-weight:700">FITIMI</td><td style="padding:10px 12px;background:#fff8eb;text-align:right;font-weight:700;font-size:18px;color:${r.profit >= 0 ? '#10b981' : '#e11d48'};font-family:monospace">${fmtMoney(r.profit)}</td></tr>
        </tbody>
      </table>
      <p style="font-size:13px;color:#666;margin:0 0 16px">
        🛍️ ${r.servicesCount} shërbime &nbsp;·&nbsp; ✅ ${r.completedCount} përfunduar &nbsp;·&nbsp; ❌ ${r.canceledCount} anuluar
      </p>
      <h3 style="margin:18px 0 8px;color:#471115;font-size:15px">💅 Top shërbimet</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${svcRows}</tbody></table>
      <h3 style="margin:18px 0 8px;color:#471115;font-size:15px">👑 Top klientët</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${cliRows}</tbody></table>
    </div>
    <div style="background:#fafafa;padding:14px;text-align:center;font-size:11px;color:#999">
      ${salonName} · Raport automatik (${reportTypeLabel(frequency)}) · ${new Date().toLocaleString(locale, { timeZone: TZ })}
    </div>
  </div>
</div>`.trim();
  }

  async function sendEmailReport({ silent = false, frequency } = {}) {
    await saveSettingsAction('email', settings.email);
    const cfg = settings.email || {};
    if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey || !cfg.recipientEmail) {
      if (!silent) toast.error(t('konfiguro_email'));
      return false;
    }
    setEmailBusy(true);
    try {
      const freq = frequency || cfg.schedule?.frequency || 'weekly';
      const r = buildReport(freq);
      const html = buildReportHTML(r, settings.salonName || 'Sparta Royale', freq);
      const freqLbl = { daily: 'Ditor', weekly: 'Javor', monthly: 'Mujor', yearly: 'Vjetor' }[freq] || 'Javor';
      const params = {
        to_email: cfg.recipientEmail,
        from_name: cfg.senderName || 'Sparta Royale',
        salon_name: settings.salonName || 'Sparta Royale',
        subject: `Raport ${freqLbl} — ${settings.salonName || 'Sparta Royale'} (${r.period})`,
        report_period: r.period,
        report_html: html,
        total_income: fmtMoney(r.totalIncome),
        total_expense: fmtMoney(r.totalExpense),
        profit: fmtMoney(r.profit),
        profit_color: r.profit >= 0 ? '#16a34a' : '#dc2626',
        services_count: r.servicesCount,
        completed_count: r.completedCount,
        canceled_count: r.canceledCount,
        send_date: new Date().toLocaleString(locale, { timeZone: TZ }),
        top_services: r.topSvc.map((s, i) => `${i + 1}. ${s.name} — ${s.count}x — ${fmtMoney(s.revenue)}`).join('\n') || '—',
        top_clients: r.topCli.map((c, i) => `${i + 1}. ${c.name} — ${c.count}x — ${fmtMoney(c.revenue)}`).join('\n') || '—',
      };
      await emailjs.send(cfg.serviceId, cfg.templateId, params, { publicKey: cfg.publicKey });
      const at = new Date().toISOString();
      await saveSettingsAction('sparta_last_email_at', at);
      setLastEmailAt(at);
      if (!silent) toast.success(t('email_u_dërgua'));
      return true;
    } catch (e) {
      const msg = e?.text || e?.message || String(e);
      if (!silent) toast.error(t('dërgimi_dështoi') + msg);
      return false;
    } finally {
      setEmailBusy(false);
    }
  }

  useEffect(() => {
    if (!mounted) return;
    if (!settings.appointmentNotif) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (getNotifPerm() !== 'granted') return;

    async function checkUpcoming() {
      const minutesBefore = Number(settings.appointmentMinutesBefore || 30);
      const now = nowKS();
      const today = todayISO();

      let notified;
      try { notified = (await getSetting('sparta_appt_notified', {})) || {}; } catch { notified = {}; }
      Object.keys(notified).forEach(k => { if (k !== today) delete notified[k]; });
      notified[today] = notified[today] || [];

      const visible = user?.role === 'worker'
        ? appointments.filter(a => a.workerId === user.id)
        : appointments;

      let changed = false;
      visible.forEach(a => {
        if (a.date !== today) return;
        if ((a.status || 'pending') !== 'pending') return;
        if (!a.time) return;
        if (notified[today].includes(a.id)) return;

        const [h, m] = a.time.split(':').map(Number);
        const apptTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0, 0);
        const diffMin = (apptTime - now) / 60000;

        if (diffMin <= minutesBefore && diffMin >= -2) {
          try {
            let koha;
            if (diffMin <= 0) koha = t('takim_tani');
            else if (Math.round(diffMin) === 1) koha = t('takim_në_1_minutë');
            else koha = t('takim_në_minuta').replace('{}', Math.round(diffMin));

            new window.Notification(`${t('sherbimet')} ${koha}`, {
              body: `${a.clientName || t('pa_emër')} · ${a.serviceName || '—'} · ${t('ora')} ${a.time}`,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: `sparta-appt-${a.id}`,
              requireInteraction: diffMin <= 0,
            });
            notified[today].push(a.id);
            changed = true;
          } catch {}
        }
      });

      if (changed) {
        try { await saveSettingsAction('sparta_appt_notified', notified); } catch {}
      }
    }

    let interval;
    (async () => {
      await checkUpcoming();
      interval = setInterval(checkUpcoming, 60 * 1000);
    })();
    return () => clearInterval(interval);
  }, [mounted, settings.appointmentNotif, settings.appointmentMinutesBefore, appointments, user, lang]);

  useEffect(() => {
    if (!settings.lowStockNotif || getNotifPerm() !== 'granted' || !produktet.length) return;

    const threshold = Number(settings.lowStockThreshold) || 5;

    for (const p of produktet) {
      if (Number(p.quantity) > threshold) {
        notifiedLowStock.delete(p.id);
        continue;
      }
      if (notifiedLowStock.has(p.id)) continue;
      notifiedLowStock.add(p.id);

      try {
        new window.Notification('⚠️ Stoku i ulët', {
          body: `${p.name} ka vetëm ${p.quantity} mbetur.`,
          icon: '/icon-192.png',
          tag: `low-stock-page-${p.id}`,
        });
      } catch {}
    }
  }, [settings.lowStockNotif, produktet, settings.lowStockThreshold, notifPermission]);

  useEffect(() => {
    const cfg = settings.email;
    if (!cfg?.enabled || !cfg.serviceId || !cfg.templateId || !cfg.publicKey || !cfg.recipientEmail) return;
    const sched = cfg.schedule || {};
    const freq = sched.frequency || 'weekly';
    const [schH, schM] = (sched.time || '08:00').split(':').map(Number);

    async function checkSchedule() {
      const now = new Date();
      const kosovo = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
      const currentHour = kosovo.getHours();
      const currentMin = kosovo.getMinutes();
      const currentDay = kosovo.getDay();
      const currentDate = kosovo.getDate();
      const currentMonth = kosovo.getMonth() + 1;

      const isPastTime = currentHour > schH || (currentHour === schH && currentMin >= schM);
      if (!isPastTime) return;

      let shouldSend = false;
      if (freq === 'daily') {
        shouldSend = true;
      } else if (freq === 'weekly') {
        const targetDay = (sched.weekDay || 1) % 7;
        shouldSend = currentDay === targetDay;
      } else if (freq === 'monthly') {
        shouldSend = currentDate === (sched.monthDay || 1);
      } else if (freq === 'yearly') {
        shouldSend = currentMonth === (sched.yearMonth || 1) && currentDate === (sched.yearDay || 1);
      }

      if (!shouldSend) return;

      const lastAt = lastEmailAt ? new Date(lastEmailAt) : null;
      if (lastAt) {
        const lastLocal = new Date(lastAt.toLocaleString('en-US', { timeZone: TZ }));
        const sameDay = lastLocal.getDate() === currentDate && lastLocal.getMonth() === kosovo.getMonth() && lastLocal.getFullYear() === kosovo.getFullYear();
        if (sameDay) return;
      }

      await sendEmailReport({ silent: true, frequency: freq });
    }

    checkSchedule();
    const id = setInterval(checkSchedule, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.email?.enabled, settings.email?.serviceId, settings.email?.templateId, settings.email?.publicKey, settings.email?.recipientEmail, settings.email?.schedule?.frequency, settings.email?.schedule?.weekDay, settings.email?.schedule?.monthDay, settings.email?.schedule?.yearMonth, settings.email?.schedule?.yearDay, settings.email?.schedule?.time, lastEmailAt]);

  const lowStockCount = useMemo(
    () => produktet.filter(p => Number(p.quantity) <= Number(settings.lowStockThreshold || 5)).length,
    [produktet, settings.lowStockThreshold]
  );

  if (!mounted || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950">
        <div className="text-center">
          <Logo size={64} className="animate-pulse drop-shadow-lg" />
          <p className="mt-2 text-sm text-gold-300">Sparta Royale</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        needSetup={needSetup}
        onSetup={setupAdminPassword}
        onLogin={loginUser} t={t}
      />
    );
  }

  const headerTitle = (() => {
    if (tab === 'me_shume' && subview) return t(subview.id);
    return t(tab);
  })();

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-rose-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-black pb-24">
      <Toaster richColors position="top-center" offset={{ top: "calc(env(safe-area-inset-top) + 12px)" }} />

      <header className="sticky top-0 z-30 bg-gradient-to-b from-brand-700 to-brand-800 dark:from-brand-800 dark:to-brand-900 text-gold-100 shadow-lg border-b border-gold-300/20">
        <div className="max-w-screen-md mx-auto px-4 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2 min-w-0">
              {tab === 'me_shume' && subview ? (
                <button
                  onClick={() => setSubview(null)}
                  className="p-2 -ml-2 rounded-full hover:bg-white/10 active:bg-white/20"
                  aria-label="Kthehu"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              ) : (
                <Logo size={28} className="shrink-0 drop-shadow" />
              )}
              <div className="min-w-0">
                <p className="text-xs opacity-80 leading-none">Sparta Royale</p>
                <h1 className="text-lg font-semibold truncate">{headerTitle}</h1>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleLang}
                className="px-2 py-1 rounded-md hover:bg-white/10 active:bg-white/20 text-xs font-bold text-gold-200 border border-gold-300/30"
                aria-label={t('gjuha')}
              >
                {lang === 'sq' ? 'EN' : 'SQ'}
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-white/10 active:bg-white/20"
                aria-label={t('pamja')}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
          {lowStockCount > 0 && tab !== 'me_shume' && (
            <button
              onClick={() => { setTab('me_shume'); setSubview({ id: 'produktet', label: t('produktet') }); }}
              className="mb-2 w-full flex items-center gap-2 bg-amber-400/20 border border-amber-300/40 rounded-lg px-3 py-1.5 text-sm"
            >
              <AlertTriangle className="w-4 h-4 text-amber-200" />
              <span>{lowStockCount > 1 ? t('produkt_stok_ulët').replace('{}', lowStockCount).replace('{}', '') : t('produkt_stok_ulët_1')}</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-screen-md mx-auto px-4 pt-4">
        {tab === 'ballina' && (
          <DashboardView user={user}
            teArdhurat={teArdhurat} shpenzimet={shpenzimet} appointments={appointments}
            produktet={produktet} settings={settings}
            onComplete={completeAppointment} onCancel={cancelAppointment} onReopen={reopenAppointment}
            goTo={(t, sv) => { setTab(t); if (sv) setSubview(sv); else setSubview(null); }}
            t={t} lang={lang} fmtDate={fmtDate} rangeFor={rangeFor} confirmAsync={confirmAsync}
          />
        )}
        {tab === 'tearrdhurat' && (
          <TeArdhuratView
            items={teArdhurat} onSave={handleSaveTeArdhur} onDelete={handleDeleteTeArdhur}
            services={services} clients={clients} onSaveClient={handleSaveClient}
            settings={settings}
            t={t} fmtDate={fmtDate} rangeFor={rangeFor} confirmAsync={confirmAsync}
            additionalServices={additionalServices}
          />
        )}
        {tab === 'shpenzimet' && (
          <ShpenzimetView items={shpenzimet} onSave={handleSaveShpenzim} onDelete={handleDeleteShpenzim} t={t} fmtDate={fmtDate} confirmAsync={confirmAsync} />
        )}
        {tab === 'takimet' && (
          <TakimetView items={appointments} onSave={handleSaveAppointment} onDelete={handleDeleteAppointment} services={services} categories={categories} clients={clients} onSaveClient={handleSaveClient}
            onComplete={completeAppointment} onCancel={cancelAppointment} onReopen={reopenAppointment} workers={workers} currentUser={user} t={t} lang={lang} fmtDate={fmtDate} rangeFor={rangeFor} nowTime={nowTime} confirmAsync={confirmAsync} additionalServices={additionalServices} onSaveAdditionalService={handleSaveAdditionalService} />
        )}
        {tab === 'me_shume' && !subview && (
          <MoreMenu setSubview={setSubview} lowStockCount={lowStockCount} user={user} t={t} lang={lang} />
        )}
        {tab === 'me_shume' && subview?.id === 'produktet' && (
          <ProduktetView items={produktet} onSave={handleSaveProdukt} onDelete={handleDeleteProdukt} threshold={settings.lowStockThreshold} isOwner={user?.role === 'owner'} t={t} confirmAsync={confirmAsync} />
        )}
        {tab === 'me_shume' && subview?.id === 'klientet' && (
          <KlientetView clients={clients} onSaveClient={handleSaveClient} onDeleteClient={handleDeleteClient} teArdhurat={teArdhurat} t={t} fmtDate={fmtDate} confirmAsync={confirmAsync} />
        )}
        {tab === 'me_shume' && subview?.id === 'sherbimet' && (
          <SherbimetView items={services} categories={categories} onSave={handleSaveService} onDelete={handleDeleteService} onSaveCategory={handleSaveServiceCategory} onDeleteCategory={handleDeleteServiceCategory} t={t} confirmAsync={confirmAsync} additionalServices={additionalServices} onSaveAdditionalService={handleSaveAdditionalService} onDeleteAdditionalService={handleDeleteAdditionalService} />
        )}
        {tab === 'me_shume' && subview?.id === 'analitika' && (
          <AnalitikaView teArdhurat={teArdhurat} shpenzimet={shpenzimet} appointments={appointments} clients={clients} settings={settings} t={t} lang={lang} fmtDate={fmtDate} rangeFor={rangeFor} />
        )}
        {tab === 'me_shume' && subview?.id === 'cilesimet' && (
          <CilesimetView
            lang={lang} setLang={setLang} t={t}
            user={user} setUser={setUser} workers={workers} setWorkers={setWorkers}
            settings={settings} setSettings={setSettings}
            theme={theme} toggleTheme={toggleTheme}
            data={{ shpenzimet, produktet, teArdhurat, clients, appointments, services }}
            categories={categories}
            workerServices={workerServices}
            workerAdditionalServices={workerAdditionalServices}
            additionalServices={additionalServices}
            workerSettings={workerSettings}
            payroll={payroll}
            recurringExpenses={recurringExpenses}
            services={services}
            setCategories={setCategories}
            setWorkerServicesState={setWorkerServicesState}
            setWorkerAdditionalServicesState={setWorkerAdditionalServicesState}
            setAdditionalServices={setAdditionalServices}
            setWorkerSettingsState={setWorkerSettingsState}
            setPayroll={setPayroll}
            setRecurringExpenses={setRecurringExpenses}
            onLogout={logoutUser}
            onChangePassword={changeUserPassword}
            notifPermission={notifPermission}
            onEnableNotif={enableLowStockNotifications}
            onDisableNotif={disableLowStockNotifications}
            onTestNotif={sendTestNotification}
            onServerTestPush={sendServerTestPush}
            emailBusy={emailBusy}
            lastEmailAt={lastEmailAt}
            onSaveEmail={() => saveSettingsAction('email', settings.email)}
            onSendEmail={() => sendEmailReport({ silent: false, frequency: settings.email?.schedule?.frequency })}
            rangeFor={rangeFor}
            onRefresh={() => refreshData(user)}
            restore={(d) => {
              setShpenzimet(d.shpenzimet || []);
              setProduktet(d.produktet || []);
              setTeArdhurat(d.teArdhurat || []);
              setClients(d.clients || []);
              setAppointments(d.appointments || []);
              setServices(d.services || []);
              setCategories(d.categories || []);
              setWorkerServicesState(d.workerServices || []);
              setWorkerAdditionalServicesState(d.workerAdditionalServices || []);
              setAdditionalServices(d.additionalServices || []);
              setPayroll(d.payroll || []);
              setRecurringExpenses(d.recurringExpenses || []);
              if (d.settings) setSettings(d.settings);
              toast.success(t('të_dhënat_u_importuan'));
            }}
            confirmAsync={confirmAsync}
          />
        )}
      </main>

      {/* ── BOTTOM NAV ── */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-zinc-950/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className={cn(
          'max-w-screen-md mx-auto grid',
          user?.role === 'worker' ? 'grid-cols-3' : 'grid-cols-5'
        )}>
          {filteredTabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setSubview(null); }}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] transition-colors',
                  active ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'
                )}
              >
                {active && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-rose-600 dark:bg-rose-400" />}
                <Icon className={cn('w-5 h-5', active && 'scale-110')} />
                <span className="leading-tight">{t.label}</span>
              </button>
            );
          })}

          {user?.role === 'worker' && (
            <button
              onClick={async () => { if (await confirmAsync(t('confirm_logout'), t('dil'))) logoutUser(); }}
              className="relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] transition-colors text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 group"
            >
              <div className="p-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 group-hover:bg-rose-100 dark:group-hover:bg-rose-900/50 transition-colors">
                <X className="w-4 h-4 text-rose-500 dark:text-white" />
              </div>
              <span className="leading-tight text-rose-500 dark:text-white">{t('dil')}</span>
            </button>
          )}
        </div>
      </nav>
      <ConfirmDialog
        open={confirmModal.open}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        confirmTitle={confirmModal.confirmTitle}
        cancelLabel={confirmModal.cancelLabel}
        onClose={handleConfirmClose}
      />
    </div>
  );
}

/* =====================================================================
   DASHBOARD
===================================================================== */
function DashboardView({ user, teArdhurat, shpenzimet, appointments, produktet, settings, onComplete, onCancel, onReopen, goTo, t, lang, fmtDate, rangeFor, confirmAsync }) {
  const [period, setPeriod] = useState('daily');
  const [start, end] = rangeFor(period);
  const income = teArdhurat.filter(t => inRange(t.date, start, end))
    .reduce((s, t) => s + Number(t.price || 0), 0);
  const expense = shpenzimet.filter(t => inRange(t.date, start, end))
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const profit = income - expense;

  const today = todayISO();
  const [dashMonth, setDashMonth] = useState(() => today.slice(0, 7));

  const dashAppts = useMemo(() => {
    return appointments
      .filter(a => a.date?.startsWith(dashMonth) && (a.status || 'pending') === 'pending')
      .sort((a, b) => {
        const aDate = a.date || '';
        const bDate = b.date || '';
        const aKey = `${aDate}T${a.time || '00:00'}`;
        const bKey = `${bDate}T${b.time || '00:00'}`;
        const todayKey = `${today}T00:00`;
        const aIsFuture = aKey >= todayKey;
        const bIsFuture = bKey >= todayKey;
        if (aIsFuture && !bIsFuture) return -1;
        if (!aIsFuture && bIsFuture) return 1;
        if (aIsFuture && bIsFuture) return aKey.localeCompare(bKey);
        return bKey.localeCompare(aKey);
      });
  }, [appointments, dashMonth, today]);

  const lowStock = produktet.filter(p => Number(p.quantity) <= Number(settings.lowStockThreshold || 5));

  return (
    <div className="space-y-4">
      <div className="relative h-32 rounded-2xl overflow-hidden shadow-md">
        <img
          src="/sroyale-headerv2.JPG"
          alt="Sparta Royale"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-rose-900/85 via-rose-900/45 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
          <div className="flex items-center gap-1.5 text-gold-300 text-xs font-medium tracking-wider uppercase">
            <Logo size={14} />
          </div>
          <h2 className="text-xl font-bold leading-tight">{settings.salonName}</h2>
          <p className="text-xs opacity-90">{user.name || user.username}</p>
        </div>
      </div>

      {user?.role === 'owner' && (
      <Card className="border-rose-200 dark:border-rose-900/50 shadow-sm overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('fitimi')}</CardTitle>
            <Tabs value={period} onValueChange={setPeriod}>
              <TabsList className="h-8">
                <TabsTrigger className="text-xs px-2" value="daily">{t('ditore')}</TabsTrigger>
                <TabsTrigger className="text-xs px-2" value="weekly">{t('javor')}</TabsTrigger>
                <TabsTrigger className="text-xs px-2" value="monthly">{t('mujor')}</TabsTrigger>
                <TabsTrigger className="text-xs px-2" value="yearly">{t('vjetor')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className={cn(
            'text-3xl font-bold tabular-nums',
            profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          )}>
            {fmtMoney(profit)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2.5">
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">{t('te_ardhurat_label')}</p>
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">{fmtMoney(income)}</p>
            </div>
            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 p-2.5">
              <p className="text-[11px] text-rose-700 dark:text-rose-400 uppercase tracking-wide">{t('shpenzimet_label')}</p>
              <p className="text-lg font-semibold text-rose-700 dark:text-rose-300">{fmtMoney(expense)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-sm font-semibold">{t('takimet_e_sotme')}</p>
          <div className="flex items-center gap-2">
            <Input
              type="month"
              value={dashMonth}
              onChange={(e) => setDashMonth(e.target.value)}
              className="h-7 text-xs w-36 px-2"
            />
            <button
              onClick={() => goTo('takimet')}
              className="text-xs text-rose-400 font-medium whitespace-nowrap"
            >
              {t('shiko_te_gjitha')}
            </button>
          </div>
        </div>
        {dashAppts.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-6">{t('asnje_takim_sot')}</p>
        ) : (
          <ul className="space-y-2">
            {dashAppts.map(a => (
              <AppointmentRow key={a.id} t={t} a={a} onComplete={onComplete} onCancel={onCancel} onReopen={onReopen} compact confirmAsync={confirmAsync} />
            ))}
          </ul>
        )}
      </div>

      {lowStock.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> {t('stok_i_ulët')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {lowStock.slice(0, 4).map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>{p.name}</span>
                <Badge variant="outline" className="text-amber-600 border-amber-400">
                  {p.quantity} {t('njësi')}
                </Badge>
              </div>
            ))}
            {lowStock.length > 4 && (
              <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => goTo('me_shume', { id: 'produktet', label: 'Produktet' })}>
                {t('shiko_te_gjitha_stok')} ({lowStock.length})
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function QuickCard({ icon: Icon, label, onClick, tone = 'rose' }) {
  const tones = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50',
    rose: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50',
    violet: 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-900/50',
    amber: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50',
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 p-4 rounded-xl border text-left active:scale-[0.98] transition-transform',
        tones[tone]
      )}
    >
      <div className="p-2 rounded-lg bg-white/60 dark:bg-black/20">
        <Icon className="w-5 h-5" />
      </div>
      <span className="font-medium text-sm">{label}</span>
    </button>
  );
}

/* =====================================================================
   SHPENZIMET
===================================================================== */
function ShpenzimetView({ items, onSave, onDelete, t, fmtDate, confirmAsync }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterMonth, setFilterMonth] = useState(() => todayISO().slice(0, 7));

  const filtered = useMemo(() => {
    return items
      .filter(i => i.date?.startsWith(filterMonth))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [items, filterMonth]);

  const total = filtered.reduce((s, i) => s + Number(i.amount || 0), 0);

  async function handleLocalSave(form) {
    await onSave({ ...editing, ...form });
    setOpen(false); setEditing(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="h-10"
        />
        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{t('total')}</p>
          <p className="font-semibold text-rose-600">{fmtMoney(total)}</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Wallet} title={t('asnje_shpenzim')} desc={t('shtyp_por_te_shtosh')} />
      ) : (
        <ul className="space-y-2">
          {filtered.map(s => (
            <SwipeRow
              key={s.id}
              onEdit={() => { setEditing(s); setOpen(true); }}
              onDelete={() => { onDelete(s.id); toast.success(t('u_fshi')); }}
              t={t}
              confirmAsync={confirmAsync}
            >
              <div className="flex items-start justify-between p-3 bg-card rounded-xl border">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{s.name}</p>
                  {s.description && <p className="text-xs text-muted-foreground truncate">{s.description}</p>}
                  <p className="text-[11px] text-muted-foreground mt-0.5">{fmtDate(s.date)}</p>
                </div>
                <div className="text-right ml-3">
                  <p className="font-semibold text-rose-600 tabular-nums">{fmtMoney(s.amount)}</p>
                </div>
              </div>
            </SwipeRow>
          ))}
        </ul>
      )}

      <FAB t={t} onClick={() => { setEditing(null); setOpen(true); }} />

      <FormDialog t={t}
        open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        title={editing ? t('modifiko_shpenzimin') : t('shto_shpenzim')}
        initial={editing || { name: '', description: '', amount: '', date: todayISO() }}
        fields={[
          { name: 'name', label: t('emri'), type: 'text', required: true, placeholder: 'p.sh. Qira' },
          { name: 'description', label: t('pershkrimi'), type: 'textarea', placeholder: 'Opsional' },
          { name: 'amount', label: t('shuma'), type: 'number', required: true, step: '0.01' },
          { name: 'date', label: t('data'), type: 'date', required: true },
        ]}
        onSave={handleLocalSave}
      />
    </div>
  );
}

/* =====================================================================
   TË ARDHURAT
===================================================================== */
function TeArdhuratView({ items, onSave, onDelete, services, clients, onSaveClient, settings, t, fmtDate, rangeFor, confirmAsync, additionalServices }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [period, setPeriod] = useState('monthly');
  const [refDate, setRefDate] = useState(() => new Date());
  const [form, setForm] = useState({
    clientId: '', clientName: '', serviceId: '', serviceName: '',
    price: '', date: todayISO(), extras: [], notes: '',
  });

  function parseExtras(v) {
    if (v == null) return [];
    if (Array.isArray(v)) return v;
    try { return JSON.parse(v); } catch { return []; }
  }

  function openNew() {
    setEditing(null);
    setForm({ clientId: '', clientName: '', serviceId: '', serviceName: '', price: '', date: todayISO(), extras: [], notes: '' });
    setOpen(true);
  }
  function openEdit(it) {
    setEditing(it);
    setForm({
      clientId: it.clientId || '', clientName: it.clientName || '',
      serviceId: it.serviceId || '', serviceName: it.serviceName || '',
      price: it.price ?? '', date: it.date || todayISO(),
      extras: parseExtras(it.extras), notes: it.notes || '',
    });
    setOpen(true);
  }

  const availExtras = (additionalServices || []).filter(x => x.active !== false);

  function toggleExtra(id) {
    setForm(f => {
      const on = (f.extras || []).some(e => e.id === id);
      const svc = availExtras.find(x => x.id === id);
      if (on) return { ...f, extras: (f.extras || []).filter(e => e.id !== id) };
      if (!svc) return f;
      return { ...f, extras: [...(f.extras || []), { id: svc.id, name: svc.name, price: Number(svc.price) }] };
    });
  }

  function selectService(id) {
    const s = services.find(x => x.id === id);
    setForm(f => ({ ...f, serviceId: id, serviceName: s?.name || '', price: s?.price ?? f.price }));
  }

  function save() {
    if (!form.serviceName || form.price === '' || form.price === null) {
      toast.error(t('plotesoni_sherbimin')); return;
    }
    let clientId = form.clientId;
    if (!clientId && form.clientName?.trim()) {
      const existing = clients.find(c => c.name.toLowerCase() === form.clientName.trim().toLowerCase());
      if (existing) clientId = existing.id;
      else {
        const nc = { id: uuid(), name: form.clientName.trim(), phone: '', createdAt: todayISO(), _isNew: true };
        onSaveClient(nc);
        clientId = nc.id;
      }
    }
    const payload = { ...form, clientId, price: Number(form.price) };
    onSave({ ...editing, ...payload });
    setOpen(false);
  }
  const [start, end, periodLabel] = rangeFor(period, refDate);
  const filtered = useMemo(
    () => items.filter(i => inRange(i.date, start, end))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [items, start, end]
  );
  const total = filtered.reduce((s, i) => s + Number(i.price || 0), 0);

  function exportInvoice(it) { generateInvoicePDF(it, settings, fmtDate); }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0"
            onClick={() => setRefDate(d => shiftPeriod(period, d, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 text-center">
            <p className="text-xs font-medium text-muted-foreground">{periodLabel}</p>
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0"
            onClick={() => setRefDate(d => shiftPeriod(period, d, +1))}>
            <ChevronLeft className="w-4 h-4 rotate-180" />
          </Button>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{t('total')}</p>
            <p className="font-semibold text-emerald-600">{fmtMoney(total)}</p>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={TrendingUp} title={t('asnje_e_ardhur')} desc={t('nuk_ka_te_ardhura')} />
      ) : (
        <ul className="space-y-2">
          {filtered.map(s => (
            <SwipeRow
              key={s.id}
              onEdit={() => openEdit(s)}
              onDelete={() => { onDelete(s.id); toast.success(t('u_fshi')); }}
              t={t}
              confirmAsync={confirmAsync}
              extraAction={{ icon: FileText, label: t('faturë'), onClick: () => exportInvoice(s) }}
            >
              <div className="flex items-start justify-between p-3 bg-card rounded-xl border">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{s.serviceName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.clientName || t('pa_klient')} · {fmtDate(s.date)}
                  </p>
                  {parseExtras(s.extras).length > 0 && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {t('sherbime_shtese')}: {parseExtras(s.extras).map(e => e.name).join(', ')}
                    </p>
                  )}
                </div>
                <p className="font-semibold text-emerald-600 tabular-nums ml-3">{fmtMoney(s.price)}</p>
              </div>
            </SwipeRow>
          ))}
        </ul>
      )}

      <FAB t={t} onClick={openNew} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t('modifiko_te_ardhurat') : t('shto_te_ardhura')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('sherbimi_required')}</Label>
              {services.length > 0 ? (
                <>
                  <Select value={form.serviceId} onValueChange={selectService}>
                    <SelectTrigger className="h-11"><SelectValue placeholder={t('zgjidh_sherbim')} /></SelectTrigger>
                    <SelectContent>
                      {services.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name} — {fmtMoney(s.price)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-10 mt-2 text-sm" placeholder={t('orse_shkruaj_manualisht')}
                    value={form.serviceName}
                    onChange={(e) => setForm(f => ({ ...f, serviceName: e.target.value, serviceId: '' }))}
                  />
                </>
              ) : (
                <Input
                  className="h-11" placeholder="Emri i shërbimit"
                  value={form.serviceName}
                  onChange={(e) => setForm(f => ({ ...f, serviceName: e.target.value }))}
                />
              )}
            </div>
            <div>
              <Label className="text-xs">{t('klienti_opsional')}</Label>
              <Input
                list="clients-list" className="h-11" placeholder={t('emri_klientit')}
                value={form.clientName}
                onChange={(e) => {
                  const v = e.target.value;
                  const existing = clients.find(c => c.name === v);
                  setForm(f => ({ ...f, clientName: v, clientId: existing?.id || '' }));
                }}
              />
              <datalist id="clients-list">
                {clients.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{t('cmimi')} *</Label>
                <Input
                  className="h-11" type="number" step="0.01" inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">{t('data')} *</Label>
                <Input className="h-11" type="date" value={form.date}
                  onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            {availExtras.length > 0 && (
              <div>
                <Label className="text-xs">{t('sherbime_shtese')}</Label>
                <div className="space-y-1.5 mt-1.5 max-h-40 overflow-y-auto rounded-lg border p-2">
                  {availExtras.map(x => {
                    const on = (form.extras || []).some(e => e.id === x.id);
                    return (
                      <button key={x.id} type="button" onClick={() => toggleExtra(x.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-sm border transition-all ${on ? 'border-rose-300 bg-rose-50 dark:bg-rose-950/30' : 'border-transparent hover:bg-muted'}`}>
                        <span className="flex items-center gap-2">
                          {on ? <CheckCircle2 className="w-4 h-4 text-rose-600" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                          {x.name}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">+{fmtMoney(x.price)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs">{t('arsye_opsionale')}</Label>
              <Textarea className="mt-1" rows={2} placeholder={t('arsye_opsionale')}
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('anulo')}</Button>
            <Button onClick={save} className="bg-rose-600 hover:bg-rose-700 text-white"><Save className="w-4 h-4 mr-2" /> {t('ruaj')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =====================================================================
   TAKIMET
===================================================================== */
function TakimetView({ items, onSave, onDelete, services, categories = [], clients, onSaveClient, onComplete, onCancel, onReopen, workers, currentUser, t, lang, fmtDate, rangeFor, nowTime, confirmAsync, additionalServices = [], onSaveAdditionalService }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [period] = useState('monthly');
  const [refDate, setRefDate] = useState(() => nowKS());
  const [form, setForm] = useState({
    clientName: '', phone: '', serviceId: '', serviceName: '', categoryId: '',
    date: todayISO(), time: nowTime(), extras: [],
    workerId: '', workerName: '',
  });
  const [quickAddName, setQuickAddName] = useState('');

  function openNew() {
    setEditing(null);
    const preWorker = currentUser?.role === 'worker'
      ? { workerId: currentUser.id, workerName: currentUser.name || currentUser.username }
      : { workerId: '', workerName: '' };
    setForm({
      clientName: '', phone: '', serviceId: '', serviceName: '', categoryId: '',
      date: selectedDate, time: nowTime(), extras: [],
      ...preWorker,
    });
    setOpen(true);
  }
  function openEdit(it) {
    setEditing(it);
    const svc = services.find(x => x.id === it.serviceId);
    setForm({
      clientId: it.clientId || "", clientName: it.clientName || '', phone: it.clientPhone || '', serviceId: it.serviceId || '',
      serviceName: it.serviceName || '', categoryId: svc?.categoryId || '', date: it.date, time: it.time,
      extras: Array.isArray(it.extras) ? it.extras : [],
      workerId: it.workerId || '', workerName: it.workerName || '',
    });
    setOpen(true);
  }
  function selectService(id) {
    const s = services.find(x => x.id === id);
    setForm(f => ({ ...f, serviceId: id, serviceName: s?.name || '', categoryId: s?.categoryId || f.categoryId, extras: [] }));
  }
  function selectCategory(id) {
    setForm(f => ({ ...f, categoryId: id, serviceId: '', serviceName: '', extras: [] }));
  }

  function addExtra() {
    setForm(f => ({ ...f, extras: [...(f.extras || []), { id: uuid(), name: '', price: '' }] }));
  }
  function updateExtra(id, patch) {
    setForm(f => ({ ...f, extras: (f.extras || []).map(e => e.id === id ? { ...e, ...patch } : e) }));
  }
  function removeExtra(id) {
    setForm(f => ({ ...f, extras: (f.extras || []).filter(e => e.id !== id) }));
  }
  function toggleAddon(a) {
    setForm(f => {
      const on = (f.extras || []).some(e => e.id === a.id);
      if (on) return { ...f, extras: (f.extras || []).filter(e => e.id !== a.id) };
      return { ...f, extras: [...(f.extras || []), { id: a.id, name: a.name, price: Number(a.price || 0) }] };
    });
  }
  async function quickAddAddon(name) {
    const clean = (name || '').trim();
    if (!clean) { toast.error(t('vendos_emrin_e_sherbimit')); return; }
    const newItem = { id: uuid(), name: clean, price: 0, active: true, serviceId: form.serviceId || null, _isNew: true };
    if (onSaveAdditionalService) await onSaveAdditionalService(newItem);
    setForm(f => ({ ...f, extras: [...(f.extras || []), { id: newItem.id, name: newItem.name, price: 0 }] }));
  }

  const mainPrice = useMemo(() => {
    const svc = services.find(s => s.id === form.serviceId)
      || services.find(s => s.name?.toLowerCase() === (form.serviceName || '').toLowerCase());
    return svc ? Number(svc.price || 0) : 0;
  }, [form.serviceId, form.serviceName, services]);
  const extrasTotal = (form.extras || []).reduce((s, e) => s + Number(e.price || 0), 0);
  const totalPrice = mainPrice + extrasTotal;

  function save() {
    if (!form.clientName?.trim() || !form.serviceName?.trim() || !form.date || !form.time) {
      toast.error(t('poleteso_4_fushat')); return;
    }
    const conflict = items.find(a =>
      a.date === form.date && a.time === form.time && a.id !== editing?.id
    );
    if (conflict) {
      toast.error(`${t('ka_takim_tjeter')} ${form.time}: ${conflict.clientName}`);
      return;
    }

    const trimmedName = form.clientName.trim();
    let clientId = form.clientId || '';
    const existing = clients?.find(c => c.name.toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      clientId = existing.id;
    } else if (onSaveClient) {
      const nc = { id: uuid(), name: trimmedName, phone: form.phone || '', createdAt: todayISO(), _isNew: true };
      onSaveClient(nc);
      clientId = nc.id;
    }

    const cleanExtras = (form.extras || [])
      .map(e => ({ id: e.id || uuid(), name: (e.name || '').trim(), price: Number(e.price || 0) }))
      .filter(e => e.name && e.price >= 0);

    const payload = {
      ...(editing?.id ? { id: editing.id } : {}),
      ...form,
      clientId,
      clientName: trimmedName,
      extras: cleanExtras,
      price: totalPrice,
      status: editing?.status || 'pending',
    };
    onSave(payload);
    setOpen(false);
  }

  const [startRange, endRange, periodLabel] = rangeFor(period, refDate);

  const weekDays = useMemo(() => {
    const d = new Date(selectedDate);
    const day = (d.getDay() + 6) % 7;
    const monday = new Date(d); monday.setDate(d.getDate() - day);
    return Array.from({ length: 7 }).map((_, i) => {
      const dd = new Date(monday); dd.setDate(monday.getDate() + i);
      const y = dd.getFullYear();
      const m = String(dd.getMonth()+1).padStart(2,'0');
      const dv = String(dd.getDate()).padStart(2,'0');
      return `${y}-${m}-${dv}`;
    });
  }, [selectedDate]);
  const dayNames = [t('hë'), t('ma'), t('më'), t('en'), t('pr'), t('sh'), t('di')];

  const apptsPerDay = useMemo(() => {
    const m = {};
    items.forEach(a => { m[a.date] = (m[a.date] || 0) + 1; });
    return m;
  }, [items]);

  const today = todayISO();
  const filteredItems = useMemo(() => {
    const base = items.filter(a => inRange(a.date, startRange, endRange));
    return base.sort((a, b) => {
      const aKey = `${a.date}T${a.time || '00:00'}`;
      const bKey = `${b.date}T${b.time || '00:00'}`;
      const todayKey = `${today}T00:00`;
      const aOpen = (a.status || 'pending') === 'pending';
      const bOpen = (b.status || 'pending') === 'pending';
      const aFuture = aKey >= todayKey;
      const bFuture = bKey >= todayKey;
      if (aOpen && aFuture && !(bOpen && bFuture)) return -1;
      if (!(aOpen && aFuture) && bOpen && bFuture) return 1;
      if (aOpen && !aFuture && !(bOpen && !bFuture)) return -1;
      if (!(aOpen && !aFuture) && bOpen && !bFuture) return 1;
      if (aOpen && aFuture && bOpen && bFuture) return aKey.localeCompare(bKey);
      return bKey.localeCompare(aKey);
    });
  }, [items, startRange, endRange, today]);

  return (
    <div className="space-y-3">
      {false && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">{fmtDate(selectedDate)}</p>
              <Input type="date" value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8 w-auto text-xs" />
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((d, i) => {
                const isSelected = d === selectedDate;
                const isToday = d === todayISO();
                const count = apptsPerDay[d] || 0;
                const [,, dd] = d.split('-');
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDate(d)}
                    className={cn(
                      'flex flex-col items-center py-2 rounded-lg text-xs relative',
                      isSelected ? 'bg-rose-600 text-white' :
                        isToday ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300' :
                        'hover:bg-muted'
                    )}
                  >
                    <span className="text-[10px] opacity-70">{dayNames[i]}</span>
                    <span className="font-semibold">{Number(dd)}</span>
                    {count > 0 && (
                      <span className={cn(
                        'absolute bottom-1 w-1 h-1 rounded-full',
                        isSelected ? 'bg-white' : 'bg-rose-600'
                      )} />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0"
            onClick={() => setRefDate(d => shiftPeriod(period, d, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Input
            type="month"
            value={(() => { const d = refDate instanceof Date ? refDate : new Date(refDate); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })()}
            onChange={(e) => { if (e.target.value) setRefDate(new Date(e.target.value + '-01')); }}
            className="flex-1 h-8 text-xs text-center"
          />
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0"
            onClick={() => setRefDate(d => shiftPeriod(period, d, +1))}>
            <ChevronLeft className="w-4 h-4 rotate-180" />
          </Button>
        </div>

      {filteredItems.length === 0 ? (
        <EmptyState icon={CalendarDays} title={t('asnje_takim')} desc={t('nuk_ka_takime')} />
      ) : (
        <ul className="space-y-2">
          {filteredItems.map(a => (
            <AppointmentRow t={t}
              key={a.id}
              a={a}
              onEdit={() => openEdit(a)}
              onDelete={() => { onDelete(a.id); toast.success(t('u_fshi')); }}
              onComplete={onComplete}
              onCancel={onCancel}
              onReopen={onReopen}
              confirmAsync={confirmAsync}
            />
          ))}
        </ul>
      )}

      <FAB t={t} onClick={openNew} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-rose-600" />
              {editing ? t('modifiko_takimin') : t('shto_takim')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('emri_label')}</Label>
              <ClientCombobox t={t}
                value={form.clientName}
                onChange={(v) => { const existing = clients?.find(c => c.name.toLowerCase() === (v || "").toLowerCase().trim()); setForm(f => ({ ...f, clientName: v, phone: existing?.phone || f.phone })); }}
                clients={clients}
              />
            </div>
            <div>
              <Label className="text-xs">{t("telefoni") || "Telefoni"}</Label>
              <Input className="h-11" placeholder="04X XXX XXX"
                value={form.phone || ""}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">{t('kategoria')}</Label>
              {categories.length > 0 ? (
                <Select value={form.categoryId || '__all__'} onValueChange={(v) => selectCategory(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="h-11"><SelectValue placeholder={t('zgjidh')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t('te_gjitha_ketu')}</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input className="h-11" disabled placeholder="—" value="" />
              )}
            </div>
            <div>
              <Label className="text-xs">{t('sherbimi_label')}</Label>
              {services.length > 0 ? (
                <>
                  <Select value={form.serviceId} onValueChange={selectService}>
                    <SelectTrigger className="h-11"><SelectValue placeholder={t('zgjidh_sherbim')} /></SelectTrigger>
                    <SelectContent>
                      {services.filter(s => !form.categoryId || s.categoryId === form.categoryId).map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input className="h-10 mt-2 text-sm" placeholder={t('orse_shkruaj_manualisht')}
                    value={form.serviceName}
                    onChange={(e) => setForm(f => ({ ...f, serviceName: e.target.value, serviceId: '' }))} />
                </>
              ) : (
                <Input className="h-11" placeholder="p.sh. Manikyr"
                  value={form.serviceName}
                  onChange={(e) => setForm(f => ({ ...f, serviceName: e.target.value }))} />
              )}
            </div>
            <div>
              <Label className="text-xs">{t('data_label')}</Label>
              <Input className="h-11 w-full" type="date" value={form.date}
                onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>

            <div>
              <Label className="text-xs">{t('ora_label')}</Label>
              <Input className="h-11 w-full" type="time" value={form.time}
                onChange={(e) => setForm(f => ({ ...f, time: e.target.value }))} />
            </div>

            {currentUser?.role === 'owner' && workers && workers.length > 0 && (
              <div>
                <Label className="text-xs">{t('punetori_opsional')}</Label>
                <Select
                  value={form.workerId || '__none__'}
                  onValueChange={(v) => {
                    if (v === '__none__') {
                      setForm(f => ({ ...f, workerId: '', workerName: '' }));
                    } else {
                      const w = workers.find(x => x.id === v);
                      setForm(f => ({ ...f, workerId: v, workerName: w?.name || w?.username || '' }));
                    }
                  }}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder={t('pa_punetor')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('pa_punetor')}</SelectItem>
                    {workers.filter(w => {
                      const wn = (w.name || w.username || '').toLowerCase();
                      return wn !== 'vanesa' && wn !== 'sparta';
                    }).map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name || w.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="border-t pt-3 mt-1">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">{t('sherbime_shtesë')}</Label>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-rose-600" onClick={addExtra}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> {t('shto')}
                </Button>
              </div>
              {form.serviceId && additionalServices.filter(a => a.active !== false && a.serviceId === form.serviceId).length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {additionalServices.filter(a => a.active !== false && a.serviceId === form.serviceId).map(a => {
                    const on = (form.extras || []).some(e => e.id === a.id);
                    return (
                      <button key={a.id} type="button"
                        onClick={() => toggleAddon(a)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] transition-all ${
                          on ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-border text-muted-foreground'
                        }`}>
                        <span className="truncate">{a.name}</span>
                        <span className="tabular-nums opacity-70">{fmtMoney(a.price)}</span>
                        {on && <Check className="w-3 h-3 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2 mb-2">
                <Input
                  className="h-9 flex-1 text-sm"
                  placeholder={t('shto_sherbim_shtese_quick')}
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); quickAddAddon(quickAddName); setQuickAddName(''); } }}
                />
                <Button type="button" size="sm" variant="outline" className="h-9 shrink-0" onClick={() => { quickAddAddon(quickAddName); setQuickAddName(''); }}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> {t('shto')}
                </Button>
              </div>
              {(form.extras || []).length === 0 && (
                <p className="text-xs text-muted-foreground">{t('asnje_sherbim_shtesë')}</p>
              )}
              <div className="space-y-2">
                {(form.extras || []).map(ex => (
                  <div key={ex.id} className="flex gap-2">
                    <Input
                      className="h-10 flex-1 text-sm"
                      placeholder={t('emri_extra')}
                      value={ex.name}
                      onChange={(e) => updateExtra(ex.id, { name: e.target.value })}
                    />
                    <Input
                      className="h-10 w-20 text-sm"
                      type="number" step="0.01" inputMode="decimal"
                      placeholder="€"
                      value={ex.price}
                      onChange={(e) => updateExtra(ex.id, { price: e.target.value })}
                    />
                    <Button type="button" size="icon" variant="ghost" className="h-10 w-10 text-rose-600 shrink-0"
                      onClick={() => removeExtra(ex.id)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              {(mainPrice > 0 || extrasTotal > 0) && (
                <div className="mt-2 flex items-center justify-between bg-muted/60 rounded-md px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    {fmtMoney(mainPrice)}
                    {extrasTotal > 0 && ` + ${fmtMoney(extrasTotal)}`}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {t('total_label')} {fmtMoney(totalPrice)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('anulo')}</Button>
            <Button onClick={save} className="bg-rose-600 hover:bg-rose-700 text-white"><Save className="w-4 h-4 mr-2" /> {t('ruaj')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =====================================================================
   MORE MENU
===================================================================== */
function MoreMenu({ setSubview, lowStockCount, user, t, lang }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const items = [
    { id: 'produktet', label: t('produktet'), icon: Package, desc: t('produktet_desc'), badge: lowStockCount },
    { id: 'klientet', label: t('klientet'), icon: Users, desc: t('klientet_desc') },
    { id: 'sherbimet', label: t('sherbimet'), icon: Scissors, desc: t('sherbimet_desc') },
    { id: 'analitika', label: t('analitika'), icon: BarChart3, desc: t('analitika_desc') },
    { id: 'cilesimet', label: t('cilesimet'), icon: SettingsIcon, desc: t('cilesimet_desc') },
  ];
  return (
    <div className="space-y-2">
      {items.map(i => {
        const Icon = i.icon;
        return (
          <button
            key={i.id}
            onClick={() => setSubview({ id: i.id, label: i.label })}
            className="w-full flex items-center gap-3 p-4 bg-card border rounded-xl hover:bg-muted active:scale-[0.99] transition-transform text-left"
          >
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300">
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{i.label}</p>
              <p className="text-xs text-muted-foreground">{i.desc}</p>
            </div>
            {i.badge ? (
              <Badge className="bg-amber-500 hover:bg-amber-500">{i.badge}</Badge>
            ) : null}
            <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180" />
          </button>
        );
      })}

      <button
        onClick={() => setHelpOpen(true)}
        className="w-full flex items-center gap-3 p-4 bg-card border border-dashed border-gold-300/50 rounded-xl hover:bg-gold-50 dark:hover:bg-gold-950/20 active:scale-[0.99] transition-transform text-left"
      >
        <div className="p-2 rounded-lg bg-gold-100 dark:bg-gold-950/30 text-gold-600 dark:text-gold-400">
          <HelpCircle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium">{t('ndihma')}</p>
          <p className="text-xs text-muted-foreground">{lang === 'sq' ? 'Udhëzime hap pas hapi' : 'Step-by-step instructions'}</p>
        </div>
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gold-500/20 text-gold-600 dark:text-gold-400 text-xs font-bold">?</span>
      </button>

      <HelpModal open={helpOpen} onOpenChange={setHelpOpen} lang={lang} t={t} />

      <p className="text-center text-xs text-muted-foreground pt-3">
        Sparta Royale · v1.0
      </p>
    </div>
  );
}

/* =====================================================================
   PRODUKTET
===================================================================== */
function ProduktetView({ items, onSave, onDelete, threshold, isOwner, t, confirmAsync }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => items.filter(p => p.name?.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );

  async function handleLocalSave(form) {
    const payload = {
      ...form,
      quantity: Number(form.quantity || 0),
      price: Number(form.price || 0),
      usagePerAppointment: Number(form.usagePerAppointment || 0),
    };
    await onSave({ ...editing, ...payload });
    setOpen(false); setEditing(null);
  }

  function adjustStock(p, delta) {
    onSave({ ...p, quantity: Math.max(0, Number(p.quantity || 0) + delta) });
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9 h-10" placeholder={t('kerko_produkt')} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Package} title={t('asnje_produkt')} desc={t('shtyp_por_produktin')} />
      ) : (
        <ul className="space-y-2">
          {filtered.map(p => {
            const low = Number(p.quantity) <= Number(threshold || 5);
            return (
              <li key={p.id} className={cn(
                'p-3 bg-card rounded-xl border flex items-center gap-2',
                low && 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20'
              )}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{p.name}</p>
                    {low && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{fmtMoney(p.price)} / {t('njësi')}</p>
                  {Number(p.usagePerAppointment) > 0 && (
                    <p className="text-[11px] text-blue-600 dark:text-blue-400">
                      −1 njësi / çdo {p.usagePerAppointment} takime të kryera
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => adjustStock(p, -1)}>−</Button>
                  <span className={cn('w-7 text-center font-semibold tabular-nums text-sm', low && 'text-amber-600')}>{p.quantity}</span>
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => adjustStock(p, +1)}>+</Button>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(p); setOpen(true); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600"
                  onClick={async () => { if (await confirmAsync(t('fshi_produktin'))) { onDelete(p.id); toast.success(t('u_fshi')); } }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <FAB t={t} onClick={() => { setEditing(null); setOpen(true); }} />

      <FormDialog t={t}
        open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        title={editing ? t('modifiko_produktin') : t('shto_produkt')}
        initial={editing || { name: '', quantity: '', price: '', usagePerAppointment: '' }}
        fields={[
          { name: 'name', label: 'Emri', type: 'text', required: true },
          { name: 'quantity', label: 'Sasia', type: 'number', required: true },
          { name: 'price', label: 'Çmimi për njësi (€)', type: 'number', step: '0.01', required: true },
          ...(isOwner ? [{
            name: 'usagePerAppointment',
            label: 'Zbrit 1 njësi çdo X takime të kryera (0 = jo automatik)',
            type: 'number',
            placeholder: '0 = nuk zbritet automatikisht',
            step: '1',
          }] : []),
        ]}
        onSave={handleLocalSave}
      />
    </div>
  );
}

/* =====================================================================
   KLIENTËT
===================================================================== */
function KlientetView({ clients, onSaveClient, onDeleteClient, teArdhurat, t, fmtDate, confirmAsync }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);

  // Total spent per client — keyed by clientId
  const totals = useMemo(() => Object.fromEntries(clients.map(c => [c.id, Number(c.totalSpent || 0)])), [clients]);

  // Visit count per client — keyed by clientId
  const visitsCount = useMemo(() => Object.fromEntries(clients.map(c => [c.id, Number(c.visits || 0)])), [clients]);

  const filtered = useMemo(
    () => clients
      .filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
      .sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0)),
    [clients, search, totals]
  );

  async function handleLocalSave(form) {
    await onSaveClient({ ...editing, ...form });
    setOpen(false); setEditing(null);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9 h-10" placeholder={t('kerko_klient')} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title={t('asnje_klient')} desc={t('klientet_shtohen')} />
      ) : (
        <ul className="space-y-2">
          {filtered.map(c => (
            <li key={c.id}
              className="p-3 bg-card rounded-xl border flex items-center gap-3 active:scale-[0.99] cursor-pointer"
              onClick={() => setDetail(c)}
            >
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-300 font-semibold shrink-0">
                {c.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{c.name}</p>
                {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />{c.phone}
                </p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{visitsCount[c.id] || 0} {t('vizita')}</p>
                <p className="font-semibold text-emerald-600 text-sm">{fmtMoney(totals[c.id])}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FAB t={t} onClick={() => { setEditing(null); setOpen(true); }} />

      <FormDialog t={t}
        open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        title={editing ? t('modifiko_klientin') : t('shto_klient')}
        initial={editing || { name: '', phone: '' }}
        fields={[
          { name: 'name', label: 'Emri', type: 'text', required: true },
          { name: 'phone', label: 'Telefoni (opsional)', type: 'tel' },
        ]}
        onSave={handleLocalSave}
      />

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
            {detail?.phone && (
              <DialogDescription className="flex items-center gap-1">
                <Phone className="w-3 h-3" />{detail.phone}
              </DialogDescription>
            )}
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Card><CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{fmtMoney(totals[detail.id])}</p>
                  <p className="text-[11px] text-muted-foreground uppercase">Total</p>
                </CardContent></Card>
                <Card><CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold">{visitsCount[detail.id] || 0}</p>
                  <p className="text-[11px] text-muted-foreground uppercase">Vizita</p>
                </CardContent></Card>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">{t('historiku')}</p>
                <div className="max-h-64 overflow-auto space-y-1.5">
                  {(() => {
                    const history = teArdhurat
                      .filter(item =>
                        (item.clientId && item.clientId === detail.id) ||
                        (!item.clientId && item.clientName && detail.name &&
                          item.clientName.toLowerCase() === detail.name.toLowerCase())
                      )
                      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                    if (history.length === 0) return (
                      <p className="text-sm text-muted-foreground text-center py-4">{t('asnje_vizite')}</p>
                    );
                    return history.map(item => (
                      <div key={item.id} className="flex justify-between p-2 bg-muted rounded-md text-sm">
                        <span className="min-w-0 mr-2">
                          <span className="font-medium">{item.serviceName || '—'}</span>
                          <span className="text-xs text-muted-foreground block">{fmtDate(item.date)}</span>
                        </span>
                        <span className="font-medium text-emerald-600 shrink-0">{fmtMoney(item.price)}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setEditing(detail); setOpen(true); setDetail(null); }}>
                  <Pencil className="w-4 h-4 mr-1" />{t('modifiko')}
                </Button>
                <Button variant="outline" className="flex-1 text-rose-600"
                  onClick={async () => {
                    if (!(await confirmAsync(t('fshi_klientin')))) return;
                    onDeleteClient(detail.id);
                    setDetail(null);
                    toast.success(t('klienti_u_fshi'));
                  }}>
                  <Trash2 className="w-4 h-4 mr-1" />{t('fshi')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =====================================================================
   SHËRBIMET
===================================================================== */
function SherbimetView({ items, categories = [], onSave, onDelete, onSaveCategory, onDeleteCategory, t, confirmAsync, additionalServices = [], onSaveAdditionalService, onDeleteAdditionalService }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [catOpen, setCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [addonOpen, setAddonOpen] = useState(false);
  const [addonEditing, setAddonEditing] = useState(null);
  const [addonFilter, setAddonFilter] = useState('');
  const [quickAdd, setQuickAdd] = useState({});

  async function quickAddAddon(serviceId) {
    const clean = (quickAdd[serviceId] || '').trim();
    if (!clean) { toast.error(t('vendos_emrin_e_sherbimit')); return; }
    await onSaveAdditionalService({ id: uuid(), name: clean, price: 0, active: true, serviceId: serviceId || null, _isNew: true });
    toast.success(t('u_shtua'));
    setQuickAdd(prev => ({ ...prev, [serviceId]: '' }));
  }

  async function handleLocalSave(form) {
    const payload = {
      ...form,
      price: Number(form.price || 0),
      duration: Number(form.duration || 0),
      categoryId: form.categoryId || null,
      position: form.position != null ? Number(form.position) : 0,
    };
    await onSave({ ...editing, ...payload });
    setOpen(false); setEditing(null);
  }

  // Drag-and-drop ordering: a local display order so the move is instant,
  // persisted back to the DB via onSave (same mechanism as the arrows).
  const [dragId, setDragId] = useState(null);
  const [order, setOrder] = useState(null);
  const orderKeyRef = useRef(null);
  useEffect(() => {
    const key = items.map(s => s.id).join('|');
    if (key !== orderKeyRef.current) {
      orderKeyRef.current = key;
      setOrder(null);
    }
  }, [items]);
  const visible = order && order.length === items.length ? order : items;

  function reorderByDrag(targetId) {
    const from = visible.findIndex(s => s.id === dragId);
    const to = visible.findIndex(s => s.id === targetId);
    if (from < 0 || to < 0 || from === to) { setDragId(null); return; }
    const next = [...visible];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    setDragId(null);
    persistOrder(next);
  }

  // Touch (mobile) drag-and-drop: HTML5 drag events don't fire on iOS,
  // so reorder live from touchmove and finish on touchend.
  const touchDragRef = useRef(false);
  function touchMoveTo(targetId) {
    if (!touchDragRef.current || !dragId || !targetId || targetId === dragId) return;
    const from = visible.findIndex(s => s.id === dragId);
    const to = visible.findIndex(s => s.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...visible];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    persistOrder(next);
  }
  function persistOrder(next) {
    next.forEach((s, i) => {
      if (s.position !== i) {
        onSave({ ...s, position: i, _isNew: false, categoryId: s.categoryId || null });
      }
    });
  }

  const catName = (id) => categories.find(c => c.id === id)?.name;

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <EmptyState icon={Scissors} title={t('asnje_sherbim')} desc={t('shto_sherbime')} />
      ) : (
        <ul className="space-y-2">
          {visible.map((s) => (
            <li
              key={s.id}
              draggable
              onDragStart={(e) => { setDragId(s.id); e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(e) => { if (dragId && dragId !== s.id) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
              onDrop={(e) => { e.preventDefault(); reorderByDrag(s.id); }}
              onDragEnd={() => setDragId(null)}
              onTouchStart={(e) => {
                if (e.target.closest('[data-drag-handle]')) {
                  setDragId(s.id);
                  touchDragRef.current = true;
                  e.preventDefault();
                }
              }}
              onTouchMove={(e) => {
                if (!touchDragRef.current) return;
                e.preventDefault();
                const touch = e.touches[0];
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                const targetLi = el?.closest('[data-svc-id]');
                if (targetLi) touchMoveTo(targetLi.getAttribute('data-svc-id'));
              }}
              onTouchEnd={() => { touchDragRef.current = false; setDragId(null); }}
              data-svc-id={s.id}
              className={`p-3 bg-card rounded-xl border flex items-center gap-3 cursor-grab active:cursor-grabbing ${dragId === s.id ? 'opacity-50 border-brand-400' : ''}`}
            >
              <span data-drag-handle className="touch-none">
                <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />
              </span>
              <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-300 shrink-0">
                <Scissors className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtMoney(s.price)}{s.duration ? ` · ${s.duration} min` : ''}
                  {s.categoryId && catName(s.categoryId) ? ` · ${catName(s.categoryId)}` : ''}
                </p>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(s); setOpen(true); }}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600"
                onClick={async () => { if (await confirmAsync(t('fshi_sherbimin'))) { onDelete(s.id); toast.success(t('u_fshi')); } }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Card className="border-dashed">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t('kategorite_sherbimeve')}</p>
            <Button size="sm" variant="outline" onClick={() => { setEditingCat(null); setCatOpen(true); }}>
              <Plus className="w-3.5 h-3.5 mr-1" /> {t('shto_kategori')}
            </Button>
          </div>
          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('asnje_kategori')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
                <span key={c.id} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 border text-xs">
                  {c.name}
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => { setEditingCat(c); setCatOpen(true); }}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5 text-rose-600" onClick={async () => {
                    if (await confirmAsync(t('fshi_kategorine'))) { onDeleteCategory(c.id); toast.success(t('u_fshi')); }
                  }}>
                    <X className="w-3 h-3" />
                  </Button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t('sherbimet_shtese_katalogu')}</p>
            <Button size="sm" variant="outline" onClick={() => { setAddonEditing(null); setAddonOpen(true); }}>
              <Plus className="w-3.5 h-3.5 mr-1" /> {t('shto_sherbim_shtese')}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">{t('sherbimet_shtese_desc')}</p>
          <Input
            className="h-9 text-sm"
            placeholder={t('kerko_sherbim_shtese')}
            value={addonFilter}
            onChange={(e) => setAddonFilter(e.target.value)}
          />
          {additionalServices.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">{t('asnje_sherbim_shtese')}</p>
          ) : (
            <div className="space-y-2">
              {items.map(svc => {
                const addons = additionalServices.filter(a => a.serviceId === svc.id && (!addonFilter || (a.name || '').toLowerCase().includes(addonFilter.toLowerCase())));
                if (addons.length === 0 && addonFilter) return null;
                return (
                  <div key={svc.id}>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex-1 truncate">{svc.name}</p>
                      <div className="flex gap-1">
                        <Input
                          className="h-6 w-36 text-[11px] py-0"
                          placeholder={t('shto_sherbim_shtese_quick')}
                          value={quickAdd[svc.id] || ''}
                          onChange={(e) => setQuickAdd(prev => ({ ...prev, [svc.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); quickAddAddon(svc.id); } }}
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" title={t('shto_sherbim_shtese')} onClick={() => quickAddAddon(svc.id)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    {addons.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">{t('asnje_sherbim_shtese')}</p>
                    ) : (
                      <div className="space-y-1">
                        {addons.map(a => (
                          <div key={a.id} className="flex items-center justify-between p-2 rounded-lg border text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${a.active !== false ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                              <span className={a.active === false ? 'line-through text-muted-foreground' : ''}>{a.name}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">{fmtMoney(a.price)}</span>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setAddonEditing(a); setAddonOpen(true); }}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" onClick={async () => {
                                if (await confirmAsync(t('fshi_sherbimin_shtese'))) { onDeleteAdditionalService(a.id); toast.success(t('u_fshi')); }
                              }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {(() => {
                const uncat = additionalServices.filter(a => a.serviceId === null && (!addonFilter || (a.name || '').toLowerCase().includes(addonFilter.toLowerCase())));
                if (uncat.length === 0 && addonFilter) return null;
                if (uncat.length === 0) return null;
                return (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex-1">{t('pa_kategori')}</p>
                      <div className="flex gap-1">
                        <Input
                          className="h-6 w-36 text-[11px] py-0"
                          placeholder={t('shto_sherbim_shtese_quick')}
                          value={quickAdd.null || ''}
                          onChange={(e) => setQuickAdd(prev => ({ ...prev, null: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); quickAddAddon(null); } }}
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" title={t('shto_sherbim_shtese')} onClick={() => quickAddAddon(null)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {uncat.map(a => (
                        <div key={a.id} className="flex items-center justify-between p-2 rounded-lg border text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${a.active !== false ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            <span className={a.active === false ? 'line-through text-muted-foreground' : ''}>{a.name}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">{fmtMoney(a.price)}</span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setAddonEditing(a); setAddonOpen(true); }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" onClick={async () => {
                              if (await confirmAsync(t('fshi_sherbimin_shtese'))) { onDeleteAdditionalService(a.id); toast.success(t('u_fshi')); }
                            }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      <FAB t={t} onClick={() => { setEditing(null); setOpen(true); }} />

      <FormDialog t={t}
        open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        title={editing ? t('modifiko_sherbimin') : t('shto_sherbim')}
        initial={editing || { name: '', price: '', duration: '' }}
        fields={[
          { name: 'name', label: t('emri'), type: 'text', required: true, placeholder: t('manikyr_placeholder') },
          { name: 'price', label: t('cmimi'), type: 'number', step: '0.01', required: true },
          { name: 'duration', label: t('kohëzgjatja'), type: 'number' },
          {
            name: 'categoryId', label: t('kategoria'), type: 'select', required: false,
            options: categories.map(c => ({ value: c.id, label: c.name })),
          },
        ]}
        onSave={handleLocalSave}
      />

      <FormDialog t={t}
        open={addonOpen} onOpenChange={(v) => { setAddonOpen(v); if (!v) setAddonEditing(null); }}
        title={addonEditing ? t('modifiko_sherbimin_shtese') : t('shto_sherbim_shtese')}
        initial={addonEditing || { name: '', price: '', serviceId: '', active: true }}
        fields={[
          ...(!addonEditing ? [{
            name: 'template', label: t('zgjidh_nga_ekzistuesit'), type: 'select', required: false,
            options: [
              { value: '', label: '—' },
              ...additionalServices.map(a => ({ value: a.id, label: `${a.name} — ${fmtMoney(a.price)}` })),
            ],
            onValueChange: (val, next, setForm) => {
              if (!val) return;
              const tpl = additionalServices.find(a => a.id === val);
              if (tpl) {
                setForm({ ...next, name: tpl.name, price: String(tpl.price ?? ''), serviceId: tpl.serviceId || '', active: tpl.active === false ? 'false' : 'true' });
              }
            },
          }] : []),
          { name: 'name', label: t('emri'), type: 'text', required: true },
          { name: 'price', label: t('cmimi'), type: 'number', step: '0.01', required: true },
          {
            name: 'serviceId', label: t('sherbimi'), type: 'select', required: false,
            options: [
              { value: '', label: t('pa_kategori') },
              ...items.map(s => ({ value: s.id, label: s.name })),
            ],
          },
          {
            name: 'active', label: t('aktive'), type: 'select', required: false,
            options: [
              { value: 'true', label: t('po') },
              { value: 'false', label: t('jo') },
            ],
          },
        ]}
        onSave={async (form) => {
          const { template, ...rest } = form;
          await onSaveAdditionalService({
            ...addonEditing,
            ...rest,
            price: Number(rest.price || 0),
            serviceId: rest.serviceId || null,
            active: rest.active !== 'false' && rest.active !== false,
          });
          setAddonOpen(false); setAddonEditing(null);
        }}
      />

      <FormDialog t={t}
        open={catOpen} onOpenChange={(v) => { setCatOpen(v); if (!v) setEditingCat(null); }}
        title={editingCat ? t('modifiko_kategorine') : t('shto_kategori')}
        initial={editingCat || { name: '' }}
        fields={[{ name: 'name', label: t('emri_kategorise'), type: 'text', required: true }]}
        onSave={async (form) => { await onSaveCategory({ ...editingCat, ...form }); setCatOpen(false); setEditingCat(null); }}
      />
    </div>
  );
}

/* =====================================================================
   ANALITIKA
===================================================================== */
function AnalitikaView({ teArdhurat, shpenzimet, appointments = [], clients = [], settings = {}, t, lang, fmtDate, rangeFor }) {
  const [period, setPeriod] = useState('monthly');
  const [refDate, setRefDate] = useState(() => new Date());
  const [start, end, label] = rangeFor(period, refDate);
  const settingsLocal = settings;

  function downloadReport() {
    generatePeriodReportPDF({
      period, refDate, start, end, label,
      teArdhurat, shpenzimet, appointments, clients,
      settings: settingsLocal,
    });
  }

  const incomeIn = useMemo(() => teArdhurat.filter(t => inRange(t.date, start, end)), [teArdhurat, start, end]);
  const expenseIn = useMemo(() => shpenzimet.filter(s => inRange(s.date, start, end)), [shpenzimet, start, end]);
  const apptsIn = useMemo(() => appointments.filter(a => inRange(a.date, start, end)), [appointments, start, end]);

  const totalIncome = incomeIn.reduce((s, t) => s + Number(t.price || 0), 0);
  const totalExpense = expenseIn.reduce((s, t) => s + Number(t.amount || 0), 0);
  const profit = totalIncome - totalExpense;

  const completedAppts = apptsIn.filter(a => a.status === 'completed').length;
  const canceledAppts = apptsIn.filter(a => a.status === 'canceled').length;

  const topServices = useMemo(() => {
    const m = {};
    incomeIn.forEach(t => {
      const key = t.serviceName || 'Tjetër';
      if (!m[key]) m[key] = { name: key, count: 0, revenue: 0 };
      m[key].count += 1;
      m[key].revenue += Number(t.price || 0);
    });
    return Object.values(m).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [incomeIn]);

  const topClients = useMemo(() => {
    const m = {};
    incomeIn.forEach(t => {
      const key = t.clientName || 'Pa emër';
      if (!m[key]) m[key] = { name: key, count: 0, revenue: 0 };
      m[key].count += 1;
      m[key].revenue += Number(t.price || 0);
    });
    return Object.values(m).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [incomeIn]);

  const chartData = useMemo(() => {
    const arr = [];
    if (period === 'daily') {
      for (let h = 8; h <= 22; h++) {
        const hourAppts = apptsIn.filter(a => a.status === 'completed' && parseInt((a.time||'').split(':')[0], 10) === h);
        const inc = hourAppts.reduce((s, a) => {
          const link = teArdhurat.find(t => t.fromAppointmentId === a.id);
          return s + Number(link?.price || 0);
        }, 0);
        arr.push({ x: `${h}h`, ardhura: Math.round(inc), shpenzime: 0 });
      }
    } else if (period === 'weekly') {
      const dayLabels = [t('hë'), t('ma'), t('më'), t('en'), t('pr'), t('sh'), t('di')];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const key = d.toISOString().split('T')[0];
        const inc = incomeIn.filter(t => t.date === key).reduce((s, t) => s + Number(t.price || 0), 0);
        const exp = expenseIn.filter(t => t.date === key).reduce((s, t) => s + Number(t.amount || 0), 0);
        arr.push({ x: dayLabels[i], ardhura: Math.round(inc), shpenzime: Math.round(exp) });
      }
    } else if (period === 'monthly') {
      const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), i);
        const key = d.toISOString().split('T')[0];
        const inc = incomeIn.filter(t => t.date === key).reduce((s, t) => s + Number(t.price || 0), 0);
        const exp = expenseIn.filter(t => t.date === key).reduce((s, t) => s + Number(t.amount || 0), 0);
        arr.push({ x: String(i), ardhura: Math.round(inc), shpenzime: Math.round(exp) });
      }
    } else {
      const monthLabels = [t('jan'), t('shk'), t('mar'), t('pri'), t('maj_short'), t('qer'), t('kor'), t('gus'), t('sht'), t('tet'), t('nën'), t('dhj')];
      for (let i = 0; i < 12; i++) {
        const ms = new Date(start.getFullYear(), i, 1);
        const me = new Date(start.getFullYear(), i + 1, 1);
        const inc = incomeIn.filter(t => inRange(t.date, ms, me)).reduce((s, t) => s + Number(t.price || 0), 0);
        const exp = expenseIn.filter(t => inRange(t.date, ms, me)).reduce((s, t) => s + Number(t.amount || 0), 0);
        arr.push({ x: monthLabels[i], ardhura: Math.round(inc), shpenzime: Math.round(exp) });
      }
    }
    return arr;
  }, [period, start, incomeIn, expenseIn, apptsIn, teArdhurat]);

  const bestDay = useMemo(() => {
    const m = {};
    incomeIn.forEach(t => { if (t.date) m[t.date] = (m[t.date] || 0) + Number(t.price || 0); });
    const arr = Object.entries(m).map(([date, total]) => ({ date, total }));
    arr.sort((a, b) => b.total - a.total);
    return arr[0] || null;
  }, [incomeIn]);

  const COLORS = ['#e11d48', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 space-y-2">
          <Tabs value={period} onValueChange={(v) => { setPeriod(v); setRefDate(new Date()); }}>
            <TabsList className="grid grid-cols-4 w-full h-9">
              <TabsTrigger value="daily" className="text-xs">{t('ditore')}</TabsTrigger>
              <TabsTrigger value="weekly" className="text-xs">{t('javor')}</TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs">{t('mujor')}</TabsTrigger>
              <TabsTrigger value="yearly" className="text-xs">{t('vjetor')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setRefDate(d => shiftPeriod(period, d, -1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 text-center text-sm font-medium">{label}</div>
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setRefDate(d => shiftPeriod(period, d, +1))}>
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setRefDate(new Date())}>
              {t('sot')}
            </Button>
          </div>
          <Button onClick={downloadReport} className="w-full bg-brand-700 hover:bg-brand-800 text-gold-100">
            <FileText className="w-4 h-4 mr-2" /> {t('shkarko_raportin')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className={cn(
            'text-center',
            profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          )}>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t('fitimi')}</p>
            <p className="text-3xl font-bold tabular-nums">{fmtMoney(profit)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2.5">
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 uppercase">{t('te_ardhurat_label')}</p>
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">{fmtMoney(totalIncome)}</p>
            </div>
            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 p-2.5">
              <p className="text-[11px] text-rose-700 dark:text-rose-400 uppercase">{t('shpenzimet_label')}</p>
              <p className="text-lg font-semibold text-rose-700 dark:text-rose-300 tabular-nums">{fmtMoney(totalExpense)}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="text-center">
              <p className="text-lg font-semibold tabular-nums">{incomeIn.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase">{t('sherbimet')}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-emerald-600 tabular-nums">{completedAppts}</p>
              <p className="text-[10px] text-muted-foreground uppercase">{t('perfunduar')}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-rose-600 tabular-nums">{canceledAppts}</p>
              <p className="text-[10px] text-muted-foreground uppercase">{t('anuluar')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {period === 'daily' && t('sipas_orës')}
            {period === 'weekly' && t('sipas_ditës')}
            {period === 'monthly' && t('sipas_datës')}
            {period === 'yearly' && t('sipas_muajit')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="x" fontSize={10} interval={period === 'monthly' ? 2 : 0} />
              <YAxis fontSize={10} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtMoney(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ardhura" name={t('te_ardhura')} fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="shpenzime" name={t('shpenzime')} fill="#e11d48" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t('sherbime_te_kerkuara')}</CardTitle></CardHeader>
        <CardContent>
          {topServices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t('asnje_e_dhene_periudhe')}</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={topServices} dataKey="count" nameKey="name"
                    cx="50%" cy="50%" outerRadius={58} innerRadius={26}
                    label={(e) => e.name?.split(' ')[0]} labelLine={false}>
                    {topServices.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n, p) => [`${v} herë · ${fmtMoney(p.payload.revenue)}`, p.payload.name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {topServices.map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="truncate">{s.name}</span>
                    </span>
                    <span className="text-muted-foreground shrink-0 ml-2">{s.count} · {fmtMoney(s.revenue)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t('klientet_me_te_mire')}</CardTitle></CardHeader>
        <CardContent>
          {topClients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t('asnje_e_dhene')}</p>
          ) : (
            <ul className="space-y-1.5">
              {topClients.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="shrink-0">#{i + 1}</Badge>
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span className="text-emerald-600 font-semibold shrink-0 ml-2">{fmtMoney(c.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {bestDay && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t('dita_me_e_mire')}</CardTitle></CardHeader>
          <CardContent className="text-center py-2">
            <p className="text-2xl font-bold text-emerald-600 tabular-nums">{fmtMoney(bestDay.total)}</p>
            <p className="text-sm text-muted-foreground">{fmtDate(bestDay.date)}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* =====================================================================
   CILËSIMET
===================================================================== */
function WorkerManagement({ workers, setWorkers, services = [], categories = [], additionalServices = [], workerServices = [], workerAdditionalServices = [], workerSettings = [], setWorkerServicesState, setWorkerAdditionalServicesState, setWorkerSettingsState, confirmAsync, t }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const [settingsWorker, setSettingsWorker] = useState(null);
  const [settingsTab, setSettingsTab] = useState('services');
  const [salaryForm, setSalaryForm] = useState({});
  const [serviceSel, setServiceSel] = useState({});
  const [addonSel, setAddonSel] = useState({});

  async function handleSave(formData) {
    const isNew = !current?.id;
    const userData = {
      username: formData.username,
      role: formData.role || 'worker',
      name: formData.name,
      status: formData.status || 'active',
    };
    if (isNew) {
      userData.passwordHash = await sha256Hex(formData.password);
    } else {
      userData.id = current.id;
      if (formData.password) {
        userData.passwordHash = await sha256Hex(formData.password);
      } else {
        userData.passwordHash = current.passwordHash;
      }
    }
    const saved = await createUser(userData);
    if (isNew) setWorkers([...workers, saved]);
    else setWorkers(workers.map(w => w.id === saved.id ? saved : w));
    setOpen(false);
    toast.success(t('punëtori_u_ruajt'));
  }

  function openSettings(w) {
    const ws = workerSettings.find(x => x.workerId === w.id);
    setSalaryForm(prev => ({ ...prev, [w.id]: ws?.salaryPercent ?? '' }));
    setServiceSel(prev => ({ ...prev, [w.id]: new Set(services.map(s => s.id)) }));
    setAddonSel(prev => ({ ...prev, [w.id]: new Set(additionalServices.filter(a => a.active !== false).map(a => a.id)) }));
    setSettingsTab('services');
    setSettingsWorker(w);
  }

  function toggleAllService(w, ids, on) {
    setServiceSel(prev => {
      const set = new Set(prev[w.id] || []);
      ids.forEach(id => { if (on) set.add(id); else set.delete(id); });
      return { ...prev, [w.id]: set };
    });
  }

  function toggleAllAddon(w, ids, on) {
    setAddonSel(prev => {
      const set = new Set(prev[w.id] || []);
      ids.forEach(id => { if (on) set.add(id); else set.delete(id); });
      return { ...prev, [w.id]: set };
    });
  }

  async function saveWorkerServicesFor(w) {
    const ids = [...(serviceSel[w.id] || [])];
    await saveWorkerServices(w.id, ids);
    setWorkerServicesState?.(prev => [
      ...prev.filter(x => x.workerId !== w.id),
      ...ids.map(sid => ({ workerId: w.id, serviceId: sid })),
    ]);
    toast.success(t('shërbimet_u_ruajtën'));
  }

  async function saveWorkerAdditionalServicesFor(w) {
    const ids = [...(addonSel[w.id] || [])];
    await saveWorkerAdditionalServices(w.id, ids);
    setWorkerAdditionalServicesState?.(prev => [
      ...prev.filter(x => x.workerId !== w.id),
      ...ids.map(aid => ({ workerId: w.id, additionalServiceId: aid })),
    ]);
    toast.success(t('shërbimet_u_ruajtën'));
  }

  async function saveSalaryFor(w) {
    const val = Number(salaryForm[w.id]);
    if (Number.isNaN(val) || val < 0) { toast.error(t('perqindja_valid')); return; }
    await saveWorkerSettings(w.id, { salaryPercent: val });
    setWorkerSettingsState?.(prev => {
      const rest = prev.filter(x => x.workerId !== w.id);
      if (val > 0) return [...rest, { workerId: w.id, salaryPercent: val }];
      return rest;
    });
    toast.success(t('paga_u_ruajt'));
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" /> {t('menaxhimi_punetoreve')}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => { setCurrent({ role: 'worker' }); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> {t('shto_punetor')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {workers.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">{t('asnje_punetor')}</p>
        ) : (
          <ul className="space-y-2">
            {workers.map(w => (
              <li key={w.id} className="p-2 border rounded-lg text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{w.name || w.username}</p>
                      {w.status === 'pending' && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 bg-amber-50 text-amber-700 border-amber-200">{t('pritje')}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">@{w.username}</p>
                  </div>
                  <div className="flex gap-1">
                    {w.status === 'pending' && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={async () => {
                        const updated = { ...w, status: 'active' };
                        await createUser(updated);
                        setWorkers(workers.map(x => x.id === w.id ? updated : x));
                        toast.success(t('perdoruesi_u_miratua'));
                      }}>
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8" title={t('cilësimet_punetorit')} onClick={() => openSettings(w)}>
                      <SettingsIcon className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setCurrent(w); setOpen(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600" onClick={async () => {
                      if (await confirmAsync(t('fshi_punetorin'))) {
                        try {
                          await deleteUser(w.id);
                          setWorkers(workers.filter(x => x.id !== w.id));
                          toast.success(t('u_fshi'));
                        } catch (e) {
                          console.error('deleteUser failed', e);
                          toast.error(`${t('dështoi')}${e?.message || ''}`);
                        }
                      }
                    }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <FormDialog t={t}
        open={open}
        onOpenChange={setOpen}
        title={current?.id ? t('modifiko_punetorin') : t('shto_punetor_label')}
        fields={[
          { name: 'name', label: t('emri_plote'), required: true, placeholder: 'Filan Fisteku' },
          { name: 'username', label: t('emri_perdoruesit'), required: false, placeholder: t('opsionale_gjenerohet') },
          {
            name: 'role',
            label: t('roli'),
            type: 'select',
            required: true,
            options: [
              { value: 'worker', label: t('punetor') },
              { value: 'owner', label: t('pronar') },
            ],
          },
          {
            name: 'password',
            label: current?.id ? t('fjalëkalimi_ny') : t('fjalëkalimi'),
            required: !current?.id,
            type: 'password'
          }
        ]}
        initial={current}
        onSave={handleSave}
      />

      <Dialog open={!!settingsWorker} onOpenChange={(v) => { if (!v) setSettingsWorker(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" /> {t('cilësimet_punetorit')}
            </DialogTitle>
            <DialogDescription>{settingsWorker?.name || settingsWorker?.username} — {t('cilësimet_punetorit_desc')}</DialogDescription>
          </DialogHeader>

          {settingsWorker && (
            <Tabs value={settingsTab} onValueChange={setSettingsTab}>
              <TabsList className="grid grid-cols-3 w-full h-9">
                <TabsTrigger className="text-xs px-1" value="services">{t('sherbimet')}</TabsTrigger>
                <TabsTrigger className="text-xs px-1" value="addons">{t('sherbime_shtese')}</TabsTrigger>
                <TabsTrigger className="text-xs px-1" value="salary">{t('paga')}</TabsTrigger>
              </TabsList>

              <TabsContent value="services" className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">{t('sherbimet_e_punetorit')}</p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleAllService(settingsWorker, services.map(s => s.id), true)}>
                      <Check className="w-3 h-3 mr-1" /> {t('zgjidh_te_gjitha')}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleAllService(settingsWorker, services.map(s => s.id), false)}>
                      <X className="w-3 h-3 mr-1" /> {t('zgjidh_asnje')}
                    </Button>
                  </div>
                </div>
                {services.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">{t('asnje_sherbim')}</p>
                ) : (
                  <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                    {categories.map(cat => {
                      const catServices = services.filter(s => s.categoryId === cat.id);
                      if (catServices.length === 0) return null;
                      const allOn = catServices.every(s => serviceSel[settingsWorker.id]?.has(s.id));
                      return (
                        <div key={cat.id}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{cat.name}</span>
                            <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={() => toggleAllService(settingsWorker, catServices.map(s => s.id), !allOn)}>
                              {allOn ? t('zgjidh_asnje') : t('zgjidh_te_gjitha')}
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 mt-1">
                            {catServices.map(s => {
                              const on = serviceSel[settingsWorker.id]?.has(s.id);
                              return (
                                <button key={s.id} type="button"
                                  onClick={() => setServiceSel(prev => {
                                    const set = new Set(prev[settingsWorker.id] || []);
                                    if (set.has(s.id)) set.delete(s.id); else set.add(s.id);
                                    return { ...prev, [settingsWorker.id]: set };
                                  })}
                                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] transition-all ${
                                    on ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-border text-muted-foreground'
                                  }`}>
                                  <span className="truncate">{s.name}</span>
                                  {on && <Check className="w-3 h-3 shrink-0 ml-1" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {(() => {
                      const uncat = services.filter(s => !s.categoryId);
                      if (uncat.length === 0) return null;
                      const allOn = uncat.every(s => serviceSel[settingsWorker.id]?.has(s.id));
                      return (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('pa_kategori')}</span>
                            <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={() => toggleAllService(settingsWorker, uncat.map(s => s.id), !allOn)}>
                              {allOn ? t('zgjidh_asnje') : t('zgjidh_te_gjitha')}
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 mt-1">
                            {uncat.map(s => {
                              const on = serviceSel[settingsWorker.id]?.has(s.id);
                              return (
                                <button key={s.id} type="button"
                                  onClick={() => setServiceSel(prev => {
                                    const set = new Set(prev[settingsWorker.id] || []);
                                    if (set.has(s.id)) set.delete(s.id); else set.add(s.id);
                                    return { ...prev, [settingsWorker.id]: set };
                                  })}
                                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] transition-all ${
                                    on ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-border text-muted-foreground'
                                  }`}>
                                  <span className="truncate">{s.name}</span>
                                  {on && <Check className="w-3 h-3 shrink-0 ml-1" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
                <Button size="sm" variant="outline" className="w-full h-9 text-xs" onClick={() => saveWorkerServicesFor(settingsWorker)}>
                  <Save className="w-3.5 h-3.5 mr-1" /> {t('ruaj_sherbimet')}
                </Button>
              </TabsContent>

              <TabsContent value="addons" className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">{t('sherbimet_shtese_te_punetorit')}</p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleAllAddon(settingsWorker, additionalServices.filter(a => a.active !== false).map(a => a.id), true)}>
                      <Check className="w-3 h-3 mr-1" /> {t('zgjidh_te_gjitha')}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleAllAddon(settingsWorker, additionalServices.filter(a => a.active !== false).map(a => a.id), false)}>
                      <X className="w-3 h-3 mr-1" /> {t('zgjidh_asnje')}
                    </Button>
                  </div>
                </div>
                {additionalServices.filter(a => a.active !== false).length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">{t('asnje_sherbim_shtese')}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 max-h-[45vh] overflow-y-auto pr-1">
                    {additionalServices.filter(a => a.active !== false).map(a => {
                      const on = addonSel[settingsWorker.id]?.has(a.id);
                      return (
                        <button key={a.id} type="button"
                          onClick={() => setAddonSel(prev => {
                            const set = new Set(prev[settingsWorker.id] || []);
                            if (set.has(a.id)) set.delete(a.id); else set.add(a.id);
                            return { ...prev, [settingsWorker.id]: set };
                          })}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] transition-all ${
                            on ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-border text-muted-foreground'
                          }`}>
                          <span className="truncate">{a.name}</span>
                          {on && <Check className="w-3 h-3 shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                )}
                <Button size="sm" variant="outline" className="w-full h-9 text-xs" onClick={() => saveWorkerAdditionalServicesFor(settingsWorker)}>
                  <Save className="w-3.5 h-3.5 mr-1" /> {t('ruaj_sherbimet')}
                </Button>
              </TabsContent>

              <TabsContent value="salary" className="mt-4">
                <div className="flex items-center gap-2">
                  <Label className="text-xs shrink-0">{t('perqindja_e_pages')}</Label>
                  <Input type="number" min="0" max="100" className="h-9 w-24 text-center text-sm"
                    value={salaryForm[settingsWorker.id] ?? ''}
                    placeholder="%"
                    onChange={(e) => setSalaryForm(prev => ({ ...prev, [settingsWorker.id]: e.target.value }))} />
                  <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => saveSalaryFor(settingsWorker)}>
                    <Save className="w-3.5 h-3.5 mr-1" /> {t('ruaj')}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* =====================================================================
   WORKING DAYS  (Mon → Sun toggle pills)
===================================================================== */
const DAY_KEYS = ['0', '1', '2', '3', '4', '5', '6'];
const DAY_RENDER_ORDER = [1, 2, 3, 4, 5, 6, 0];

function WorkingDaysCard({ settings, setSettings, t, toast }) {
  const [hours, setHours] = useState(() => {
    return settings?.sparta_working_hours || {
      "0": null, "1": { open: "09:00", close: "20:00" },
      "2": { open: "09:00", close: "20:00" }, "3": { open: "09:00", close: "20:00" },
      "4": { open: "09:00", close: "20:00" }, "5": { open: "09:00", close: "21:00" },
      "6": { open: "09:00", close: "18:00" },
    };
  });

  const dayLabelsMap = {
    1: t('hena'), 2: t('marta'), 3: t('merkura'),
    4: t('enjta'), 5: t('premte'), 6: t('shtuna'), 0: t('e_diele'),
  };

  function toggleDay(key) {
    setHours(prev => {
      const next = { ...prev };
      next[key] = next[key] === null || next[key] === undefined
        ? { open: '09:00', close: '18:00' }
        : null;
      return next;
    });
  }

  function isActive(key) {
    return hours[key] !== null && hours[key] !== undefined;
  }

  async function handleSave() {
    await saveWorkingHours(hours);
    setSettings(s => ({ ...s, sparta_working_hours: hours }));
    toast.success(t('ruaj_orarin'));
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="w-4 h-4" /> {t('ditet_e_punes')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[11px] text-muted-foreground">{t('zgjidh_ditet_punes')}</p>
        <div className="flex gap-1.5 flex-wrap">
          {DAY_RENDER_ORDER.map(dayNum => {
            const key = String(dayNum);
            const active = isActive(key);
            return (
              <button
                key={key}
                onClick={() => toggleDay(key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                  active
                    ? 'bg-rose-100 border-rose-300 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
                    : 'bg-muted border-transparent text-muted-foreground'
                )}
              >
                {dayLabelsMap[dayNum]}
              </button>
            );
          })}
        </div>
        <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white" size="sm" onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" /> {t('ruaj_ditet')}
        </Button>
      </CardContent>
    </Card>
  );
}

/* =====================================================================
   WORKING HOURS  (single open / close time for all active days)
===================================================================== */
function WorkingHoursCard({ settings, setSettings, t, toast }) {
  const allHours = settings?.sparta_working_hours || {};

  const activeDays = DAY_RENDER_ORDER.filter(d => {
    const key = String(d);
    return allHours[key] !== null && allHours[key] !== undefined;
  });

  const firstActive = activeDays.length > 0 ? allHours[String(activeDays[0])] : null;
  const [prevFirstActive, setPrevFirstActive] = useState(firstActive);
  const [openTime, setOpenTime] = useState(firstActive?.open || '09:00');
  const [closeTime, setCloseTime] = useState(firstActive?.close || '20:00');

  // Keep the inputs in sync with the saved settings whenever they change
  // (initial render, refreshData, or edits from another device) — otherwise
  // the card would still show the very first values loaded.
  if (firstActive !== prevFirstActive) {
    setPrevFirstActive(firstActive);
    if (firstActive?.open) setOpenTime(firstActive.open);
    if (firstActive?.close) setCloseTime(firstActive.close);
  }

  async function handleSave() {
    const next = { ...allHours };
    for (const key of Object.keys(next)) {
      if (next[key] !== null && next[key] !== undefined) {
        next[key] = { open: openTime, close: closeTime };
      }
    }
    await saveWorkingHours(next);
    setSettings(s => ({ ...s, sparta_working_hours: next }));
    toast.success(t('ruaj_orarin'));
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4" /> {t('orari_i_sallonit')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[11px] text-muted-foreground">{t('konfiguro_orarin')}</p>
        {activeDays.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">{t('zgjidh_ditet_punes')}</p>
        ) : (
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground shrink-0">{t('ora_fillimit')}</Label>
            <Input
              type="time"
              className="h-8 w-[90px] text-xs text-center"
              value={openTime}
              onChange={(e) => setOpenTime(e.target.value)}
            />
            <span className="text-[10px] text-muted-foreground">–</span>
            <Label className="text-[10px] text-muted-foreground shrink-0">{t('ora_perfundimit')}</Label>
            <Input
              type="time"
              className="h-8 w-[90px] text-xs text-center"
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
            />
          </div>
        )}
        <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white mt-2" size="sm" onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" /> {t('ruaj_orarin')}
        </Button>
      </CardContent>
    </Card>
  );
}

/* =====================================================================
   WORKER SCHEDULES
===================================================================== */
function WorkerScheduleCard({ workers, settings, setSettings, t, toast }) {
  const activeWorkers = workers.filter(w => w.status === 'active' || !w.status);
  const salonHours = settings?.sparta_working_hours || {};
  const [schedule, setSchedule] = useState(() => {
    return settings?.sparta_worker_schedule || {};
  });

  const dayLabelsMap = {
    1: t('hena'), 2: t('marta'), 3: t('merkura'),
    4: t('enjta'), 5: t('premte'), 6: t('shtuna'), 0: t('e_diele'),
  };

  function isOpenDay(dayNum) {
    const key = String(dayNum);
    return salonHours[key] !== null && salonHours[key] !== undefined;
  }

  function getWorkerDays(wid) {
    return schedule[wid]?.days || [1, 2, 3, 4, 5, 6];
  }
  function getWorkerStart(wid) {
    return schedule[wid]?.start || '09:00';
  }
  function getWorkerEnd(wid) {
    return schedule[wid]?.end || '20:00';
  }
  function isBookable(wid) {
    return schedule[wid]?.bookable !== false;
  }

  function toggleWorkerDay(wid, dayIdx) {
    setSchedule(prev => {
      const current = { ...(prev[wid] || {}), days: getWorkerDays(wid) };
      const has = current.days.includes(dayIdx);
      current.days = has ? current.days.filter(d => d !== dayIdx) : [...current.days, dayIdx].sort();
      return { ...prev, [wid]: current };
    });
  }

  function updateWorkerTime(wid, field, val) {
    setSchedule(prev => {
      const current = { ...(prev[wid] || {}), days: getWorkerDays(wid) };
      current[field] = val;
      return { ...prev, [wid]: current };
    });
  }

  function toggleBookable(wid) {
    setSchedule(prev => {
      const current = { ...(prev[wid] || {}), days: getWorkerDays(wid) };
      current.bookable = current.bookable === false ? true : false;
      return { ...prev, [wid]: current };
    });
  }

  async function handleSave() {
    await saveWorkerSchedule(schedule);
    setSettings(s => ({ ...s, sparta_worker_schedule: schedule }));
    toast.success(t('ruaj_orarin'));
  }

  if (activeWorkers.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4" /> {t('orari_i_punetoreve')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-[11px] text-muted-foreground">{t('konfiguro_orarin')}</p>
        {activeWorkers.map(w => (
          <div key={w.id} className="p-3 border rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{w.name || w.username}</p>
                <Badge variant={isBookable(w.id) ? 'default' : 'secondary'} className="text-[10px] h-4">
                  {isBookable(w.id) ? t('i_bookueshem') : t('nuk_punon')}
                </Badge>
              </div>
              <Switch checked={isBookable(w.id)} onCheckedChange={() => toggleBookable(w.id)} />
            </div>
            <div className="flex gap-1 flex-wrap">
              {DAY_RENDER_ORDER.map(dayNum => {
                if (!isOpenDay(dayNum)) return null;
                const active = getWorkerDays(w.id).includes(dayNum);
                return (
                  <button
                    key={dayNum}
                    onClick={() => toggleWorkerDay(w.id, dayNum)}
                    className={cn(
                      'px-2 py-1 rounded-lg text-[10px] font-medium transition-colors border',
                      active
                        ? 'bg-rose-100 border-rose-300 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
                        : 'bg-muted border-transparent text-muted-foreground'
                    )}
                  >
                    {dayLabelsMap[dayNum]}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-muted-foreground shrink-0">{t('ora_fillimit')}</Label>
              <Input
                type="time"
                className="h-8 w-[90px] text-xs text-center"
                value={getWorkerStart(w.id)}
                onChange={(e) => updateWorkerTime(w.id, 'start', e.target.value)}
              />
              <Label className="text-[10px] text-muted-foreground shrink-0">{t('ora_perfundimit')}</Label>
              <Input
                type="time"
                className="h-8 w-[90px] text-xs text-center"
                value={getWorkerEnd(w.id)}
                onChange={(e) => updateWorkerTime(w.id, 'end', e.target.value)}
              />
            </div>
          </div>
        ))}
        <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white" size="sm" onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" /> {t('ruaj_orarin')}
        </Button>
      </CardContent>
    </Card>
  );
}

/* =====================================================================
   WORKER UNAVAILABILITY
===================================================================== */
function WorkerUnavailabilityCard({ workers, settings, setSettings, t, toast }) {
  const activeWorkers = workers.filter(w => w.status === 'active' || !w.status);
  const [entries, setEntries] = useState(() => settings?.sparta_worker_unavailability || []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ workerId: '', date: '', endDate: '', allDay: true, startTime: '09:00', endTime: '18:00', reason: '' });

  const today = todayISO();

  function resetForm() {
    setForm({ workerId: '', date: '', endDate: '', allDay: true, startTime: '09:00', endTime: '18:00', reason: '' });
    setAdding(false);
  }

  async function handleAdd() {
    if (!form.workerId || !form.date) {
      toast.error(t('poleteso_4_fushat'));
      return;
    }
    if (form.endDate && form.endDate < form.date) {
      toast.error(t('data_e_perfundimit_valid'));
      return;
    }
    const entry = {
      workerId: form.workerId,
      date: form.date,
      endDate: form.endDate || null,
      startTime: form.allDay ? null : form.startTime,
      endTime: form.allDay ? null : form.endTime,
      reason: form.reason || null,
    };
    const saved = await saveWorkerUnavailability(entry);
    const next = [...entries.filter(e => e.id !== saved.id), saved].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    setEntries(next);
    setSettings(s => ({ ...s, sparta_worker_unavailability: next }));
    toast.success(t('mosdisponueshmeria_u_ruajt'));
    resetForm();
  }

  async function handleDelete(id) {
    await deleteWorkerUnavailability(id);
    const next = entries.filter(e => e.id !== id);
    setEntries(next);
    setSettings(s => ({ ...s, sparta_worker_unavailability: next }));
    toast.success(t('mosdisponueshmeria_u_fshi'));
  }

  function workerName(wid) {
    const w = workers.find(x => x.id === wid);
    return w?.name || w?.username || '—';
  }

  const upcoming = entries.filter(e => (e.endDate || e.date) >= today).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const past = entries.filter(e => (e.endDate || e.date) < today).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> {t('padisponueshmeria')}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setAdding(!adding)}>
            <Plus className="w-4 h-4 mr-1" /> {t('shto_mosdisponueshmeri')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="p-3 border rounded-xl space-y-3 bg-muted/20">
            <div>
              <Label className="text-xs">{t('zgjidh_punetorin')}</Label>
              <Select value={form.workerId} onValueChange={(v) => setForm({ ...form, workerId: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder={t('zgjidh_punetorin')} /></SelectTrigger>
                <SelectContent>
                  {activeWorkers.map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name || w.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('zgjidh_daten')}</Label>
              <Input type="date" className="h-9" value={form.date}
                min={today}
                onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{t('deri_më')}</Label>
              <Input type="date" className="h-9" value={form.endDate}
                min={form.date || today}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={form.allDay} onCheckedChange={(v) => setForm({ ...form, allDay: v })} />
                <Label className="text-xs">{t('dite_e_tere')}</Label>
              </div>
            </div>
            {!form.allDay && (
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground">{t('nga_ora')}</Label>
                <Input type="time" className="h-8 w-[90px] text-xs text-center" value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                <Label className="text-[10px] text-muted-foreground">{t('deri_ora')}</Label>
                <Input type="time" className="h-8 w-[90px] text-xs text-center" value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            )}
            <div>
              <Label className="text-xs">{t('arsye_opsionale')}</Label>
              <Input className="h-9" value={form.reason}
                placeholder={t('arsye_opsionale')}
                onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 bg-rose-600 hover:bg-rose-700 text-white" onClick={handleAdd}>
                <Save className="w-3.5 h-3.5 mr-1" /> {t('ruaj')}
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={resetForm}>{t('anulo')}</Button>
            </div>
          </div>
        )}

        {entries.length === 0 && !adding && (
          <p className="text-xs text-muted-foreground text-center py-4">{t('asnje_mosdisponueshmeri')}</p>
        )}

        {upcoming.length > 0 && (
          <div className="space-y-1.5">
            {upcoming.map(e => (
              <div key={e.id} className="flex items-center justify-between p-2 rounded-lg border bg-card text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs">{workerName(e.workerId)}</span>
                    <span className="text-[10px] text-muted-foreground">{e.date}{e.endDate ? ` → ${e.endDate}` : ''}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {e.startTime && e.endTime
                      ? `${t('nga_ora')} ${e.startTime} – ${t('deri_ora')} ${e.endTime}`
                      : t('dite_e_tere')}
                    {e.reason ? ` · ${e.reason}` : ''}
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 shrink-0"
                  onClick={() => handleDelete(e.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {past.length > 0 && (
          <details className="group">
            <summary className="text-[10px] text-muted-foreground cursor-pointer select-none">
              {t('anuluar')} ({past.length})
            </summary>
            <div className="space-y-1 mt-1.5 opacity-60">
              {past.map(e => (
                <div key={e.id} className="flex items-center justify-between p-2 rounded-lg border text-xs">
                  <span>{workerName(e.workerId)} — {e.date}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDelete(e.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

/* =====================================================================
   RECURRING EXPENSES
===================================================================== */
function RecurringExpensesCard({ items, onSave, onDelete, onApply, t, confirmAsync }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [applying, setApplying] = useState(false);

  async function handleApply() {
    setApplying(true);
    try {
      const res = await onApply();
      toast.success(t('shpenzimet_u_gjeneruan').replace('{}', res?.created ?? 0));
    } finally {
      setApplying(false);
    }
  }

  const freqLabel = (f) =>
    f === 'weekly' ? t('javore') : f === 'yearly' ? t('vjetore') : t('mujore');

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> {t('shpenzimet_periodike')}
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleApply} disabled={applying}>
              {applying ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1" />}
              {t('gjenero_tani')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> {t('shto')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground">{t('shpenzimet_periodike_desc')}</p>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">{t('asnje_shpenzim_periodik')}</p>
        ) : (
          items.map(r => (
            <div key={r.id} className="flex items-center justify-between p-2 rounded-lg border text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{r.name} <span className="text-xs text-muted-foreground tabular-nums">{fmtMoney(r.amount)}</span></p>
                <p className="text-[10px] text-muted-foreground">
                  {freqLabel(r.frequency)}{r.nextDueDate ? ` · ${t('next_due')}: ${r.nextDueDate}` : ''}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(r); setOpen(true); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" onClick={async () => {
                  if (await confirmAsync(t('fshi_shpenzimin_periodik'))) { onDelete(r.id); toast.success(t('u_fshi')); }
                }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <FormDialog t={t}
        open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        title={editing ? t('modifiko_shpenzimin_periodik') : t('shto_shpenzim_periodik')}
        initial={editing || { name: '', amount: '', frequency: 'monthly', dayOfMonth: 1 }}
        fields={[
          { name: 'name', label: t('emri'), type: 'text', required: true },
          { name: 'amount', label: t('shuma'), type: 'number', step: '0.01', required: true },
          {
            name: 'frequency', label: t('frekenca'), type: 'select', required: true,
            options: [
              { value: 'monthly', label: t('mujore') },
              { value: 'weekly', label: t('javore') },
              { value: 'yearly', label: t('vjetore') },
            ],
          },
          { name: 'dayOfMonth', label: t('dita_e_muajit'), type: 'number' },
        ]}
        onSave={async (form) => {
          await onSave({ ...editing, ...form, amount: Number(form.amount || 0) });
          setOpen(false); setEditing(null);
        }}
      />
    </Card>
  );
}

/* =====================================================================
   PAYROLL
===================================================================== */
function PayrollCard({ payroll = [], onGenerate, onMarkPaid, onDelete, onRefresh, confirmAsync, t }) {
  const [period, setPeriod] = useState(() => {
    const d = nowKS();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [generating, setGenerating] = useState(false);

  const rows = payroll.filter(p => p.period === period).sort((a, b) => (a.workerName || '').localeCompare(b.workerName || ''));
  const totalPay = rows.reduce((s, r) => s + Number(r.salaryAmount || 0), 0);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await onGenerate(period);
      if (res) toast.success(t('lista_ruajtur'));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="w-4 h-4" /> {t('listapagat')}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Input type="month" className="h-8 w-36 text-xs" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} />
            <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1" />}
              {t('gjenero')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground">{t('listapagat_desc')}</p>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">{t('asnje_listepaqe')}</p>
        ) : (
          <>
            {rows.map(p => (
              <div key={p.id} className="p-2 rounded-lg border text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{p.workerName || '—'}</p>
                  <div className="flex gap-1 shrink-0">
                    {p.status !== 'paid' && (
                      <Button size="sm" variant="outline" className="h-7 text-[11px] text-emerald-700" onClick={async () => {
                        if (await confirmAsync(t('paguaj_listen'), t('paguaj'))) {
                          const res = await onMarkPaid(p.id);
                          if (res) { toast.success(`${t('paguar')}: ${fmtMoney(res.amount)}`); onRefresh?.(); }
                        }
                      }}>
                        <Check className="w-3 h-3 mr-1" /> {t('paguaj')}
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" onClick={async () => {
                      if (await confirmAsync(t('fshi_listen'))) { onDelete(p.id); toast.success(t('u_fshi')); }
                    }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span>{t('sherbimet')}: {fmtMoney(p.serviceRevenue)}</span>
                  <span>{t('shtese')}: {fmtMoney(p.extraRevenue)}</span>
                  <span>{t('total_label')}: {fmtMoney(p.totalRevenue)}</span>
                  {p.salaryPercent != null && <span>% {p.salaryPercent}</span>}
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${p.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {fmtMoney(p.salaryAmount)} {p.status === 'paid' ? `· ${t('paguar')}` : `· ${t('draft')}`}
                  </span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1 text-sm border-t">
              <span className="text-muted-foreground">{t('total_paga')}</span>
              <span className="font-bold tabular-nums">{fmtMoney(totalPay)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CilesimetView({ user, setUser, workers, setWorkers, settings, setSettings, theme, toggleTheme, data, categories, workerServices, workerAdditionalServices, additionalServices, workerSettings, payroll, recurringExpenses, services, setCategories, setWorkerServicesState, setWorkerAdditionalServicesState, setAdditionalServices, setWorkerSettingsState, setPayroll, setRecurringExpenses, onRefresh, restore, onLogout, onChangePassword, notifPermission, onEnableNotif, onDisableNotif, onTestNotif, onServerTestPush, emailBusy, lastEmailAt, onSaveEmail, onSendEmail, lang, setLang, t, rangeFor, confirmAsync }) {
  const locale = lang === 'sq' ? 'sq-AL' : 'en-US';
  const [pwOpen, setPwOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ old: '', neu: '', confirm: '' });
  const fileRef = useRef(null);

  const isOwner = user?.role === 'owner';

  async function updateSettings(newSettings) {
    setSettings(newSettings);
    for (const key in newSettings) {
      await saveSettingsAction(key, newSettings[key]);
    }
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sparta-royal-backup-${todayISO()}.json`;
    a.click();
  }
  function exportCSV() {
    let csv = 'Data,Emri,Shuma,Tipi\n';
    data.teArdhurat.forEach(t => { csv += `${t.date},${t.serviceName},${t.price},Income\n`; });
    data.shpenzimet.forEach(s => { csv += `${s.date},${s.description},${s.amount},Expense\n`; });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'data.csv'; a.click();
  }
  function exportFullPDF() {
    toast.info(t('gjenerimi_pdf'));
    const [s, e, l] = rangeFor('monthly');
    generatePeriodReportPDF({ period: 'monthly', start: s, end: e, label: l, ...data, settings });
  }
  function importJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target.result);
        restore(d);
      } catch { toast.error(t('format_pasaktë')); }
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-4">
      {isOwner && <WorkerManagement workers={workers} setWorkers={setWorkers} services={services} categories={categories} additionalServices={additionalServices} workerServices={workerServices} workerAdditionalServices={workerAdditionalServices} workerSettings={workerSettings} setWorkerServicesState={setWorkerServicesState} setWorkerAdditionalServicesState={setWorkerAdditionalServicesState} setWorkerSettingsState={setWorkerSettingsState} confirmAsync={confirmAsync} t={t} />}

      {isOwner && (
        <WorkingDaysCard settings={settings} setSettings={setSettings} t={t} toast={toast} />
      )}

      {isOwner && (
        <WorkingHoursCard settings={settings} setSettings={setSettings} t={t} toast={toast} />
      )}

      {isOwner && (
        <WorkerScheduleCard workers={workers} settings={settings} setSettings={setSettings} t={t} toast={toast} />
      )}

      {isOwner && (
        <WorkerUnavailabilityCard workers={workers} settings={settings} setSettings={setSettings} t={t} toast={toast} />
      )}

      {isOwner && (
        <RecurringExpensesCard items={recurringExpenses} onSave={(d) => {
          const isNew = !d.id;
          const item = { ...d, id: d.id || uuid(), _isNew: isNew };
          setRecurringExpenses(prev => isNew ? [...prev, item] : prev.map(x => x.id === item.id ? item : x));
          return saveRecurringExpense(item).catch(() => toast.error('Gabim në ruajtje'));
        }} onDelete={(id) => {
          setRecurringExpenses(prev => prev.filter(x => x.id !== id));
          return deleteRecurringExpense(id).catch(() => toast.error('Gabim në fshirje'));
        }} onApply={async () => {
          const res = await applyRecurringExpenses();
          onRefresh?.();
          return res;
        }} t={t} confirmAsync={confirmAsync} />
      )}

      {isOwner && (
        <PayrollCard payroll={payroll}
          onGenerate={async (period) => {
            const res = await generatePayroll(period);
            onRefresh?.();
            return res;
          }}
          onMarkPaid={async (id) => { const res = await markPayrollPaid(id); onRefresh?.(); return res; }}
          onDelete={async (id) => { await deletePayrollEntry(id); setPayroll(prev => prev.filter(x => x.id !== id)); }}
          onRefresh={onRefresh}
          confirmAsync={confirmAsync}
          t={t} />
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t('preferencat')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">{t('language_select')}</Label>
            <Select value={lang} onValueChange={async (v) => { setLang(v); await saveSettingsAction(KEYS.lang, v); }}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder={t('language_select')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sq">Shqip (SQ)</SelectItem>
                <SelectItem value="en">English (EN)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{t('dark_mode')}</p>
              <p className="text-[11px] text-muted-foreground text-balance">{t('dark_mode_desc')}</p>
            </div>
            <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">🔔 {t('njoftimet')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {notifPermission !== 'granted' && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">{t('njoftimet_jane_bllokuar')}</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">{t('lejo_njoftimet')}</p>
              </div>
              <Button size="sm" variant="outline" className="shrink-0 text-amber-700 border-amber-400 text-xs h-8"
                onClick={onEnableNotif}>
                {t('lejo')}
              </Button>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t('njoftimet_e_takimeve')}</p>
                <p className="text-[11px] text-muted-foreground">
                  {user?.role === 'worker'
                    ? t('lajmeroju_takimet_tua')
                    : t('lajmeroju_te_gjitha_takimet')}
                </p>
              </div>
              <Switch
                checked={!!settings.appointmentNotif}
                onCheckedChange={async (v) => {
                  if (v) {
                    if (notifPermission !== 'granted') {
                      const ok = await onEnableNotif?.();
                      if (!ok) return;
                    }
                    const next = { ...settings, appointmentNotif: true };
                    setSettings(next);
                    await saveSettingsAction('appointmentNotif', true);
                  } else {
                    const next = { ...settings, appointmentNotif: false };
                    setSettings(next);
                    await saveSettingsAction('appointmentNotif', false);
                  }
                }}
              />
            </div>

            {settings.appointmentNotif && (
              <div className={cn(
                'rounded-lg border p-3 space-y-2',
                isOwner ? 'bg-muted/40' : 'bg-muted/20'
              )}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{t('minuta_para_takimit')}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {isOwner
                        ? t('sa_minuta_para')
                        : `${t('njoftim_min_para')} ${settings.appointmentMinutesBefore || 30} ${t('min_para_takimit')}`}
                    </p>
                  </div>
                  {isOwner ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Input
                        type="number"
                        min="1"
                        max="120"
                        className="h-9 w-20 text-center font-semibold text-sm"
                        value={settings.appointmentMinutesBefore ?? 30}
                        onChange={(e) => {
                          const val = Math.max(1, Math.min(120, Number(e.target.value) || 30));
                          setSettings(s => ({ ...s, appointmentMinutesBefore: val }));
                        }}
                        onBlur={async (e) => {
                          const val = Math.max(1, Math.min(120, Number(e.target.value) || 30));
                          await saveSettingsAction('appointmentMinutesBefore', val);
                          toast.success(`${t('njoftim_min_para_takimit').replace('{}', val)}`);
                        }}
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                    </div>
                  ) : (
                    <Badge variant="outline" className="shrink-0 font-semibold">
                      {settings.appointmentMinutesBefore || 30} min
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          {isOwner && (
            <div className="flex items-center justify-between border-t pt-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t('stok_i_ulët_label')}</p>
                <p className="text-[11px] text-muted-foreground">{t('lajmero_kur_produktet')}</p>
              </div>
              <Switch
                checked={!!settings.lowStockNotif}
                onCheckedChange={async (v) => {
                  if (v) {
                    if (notifPermission !== 'granted') {
                      const ok = await onEnableNotif?.();
                      if (!ok) return;
                    }
                    setSettings(s => ({ ...s, lowStockNotif: true }));
                    await saveSettingsAction('lowStockNotif', true);
                  } else {
                    onDisableNotif?.();
                    await saveSettingsAction('lowStockNotif', false);
                  }
                }}
              />
            </div>
          )}

          {notifPermission === 'granted' && (
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={onTestNotif}>
                {t('dërgo_njoftim_testues_browser')}
              </Button>
              <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={onServerTestPush}>
                {t('dërgo_njoftim_testues_server')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t('saloni')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">{t('emri_sallonit')}</Label>
              <Input className="h-10" value={settings.salonName}
                onChange={(e) => setSettings({ ...settings, salonName: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{t('limit_stokut')}</Label>
              <Input className="h-10" type="number" value={settings.lowStockThreshold}
                onChange={(e) => setSettings({ ...settings, lowStockThreshold: Number(e.target.value) || 0 })} />
            </div>
            <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white" size="sm" onClick={() => updateSettings(settings)}>
              <Save className="w-4 h-4 mr-2" /> {t('ruaj_ndryshimet')}
            </Button>
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" /> {t('email_raport')}
              </CardTitle>
              <Switch
                checked={!!settings.email?.enabled}
                onCheckedChange={(v) => setSettings(s => ({ ...s, email: { ...(s.email || {}), enabled: v } }))}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <div>
                <Label className="text-xs">Service ID</Label>
                <Input className="h-10 text-sm" value={settings.email?.serviceId || ''}
                  onChange={(e) => setSettings(s => ({ ...s, email: { ...(s.email || {}), serviceId: e.target.value } }))} />
              </div>
              <div>
                <Label className="text-xs">Template ID</Label>
                <Input className="h-10 text-sm" value={settings.email?.templateId || ''}
                  onChange={(e) => setSettings(s => ({ ...s, email: { ...(s.email || {}), templateId: e.target.value } }))} />
              </div>
              <div>
                <Label className="text-xs">Public Key</Label>
                <Input className="h-10 text-sm" value={settings.email?.publicKey || ''}
                  onChange={(e) => setSettings(s => ({ ...s, email: { ...(s.email || {}), publicKey: e.target.value } }))} />
              </div>
              <div>
                <Label className="text-xs">{t('recipient_email')}</Label>
                <Input className="h-10 text-sm" value={settings.email?.recipientEmail || ''}
                  onChange={(e) => setSettings(s => ({ ...s, email: { ...(s.email || {}), recipientEmail: e.target.value } }))} />
              </div>
              <div>
                <Label className="text-xs">Sender Name</Label>
                <Input className="h-10 text-sm" value={settings.email?.senderName || ''}
                  onChange={(e) => setSettings(s => ({ ...s, email: { ...(s.email || {}), senderName: e.target.value } }))} />
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <p className="text-xs font-medium">{t('orari_dërgimit')}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{t('frekuenca')}</Label>
                  <Select
                    value={settings.email?.schedule?.frequency || 'weekly'}
                    onValueChange={(v) => setSettings(s => ({ ...s, email: { ...(s.email || {}), schedule: { ...(s.email?.schedule || {}), frequency: v } } }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{t('daily')}</SelectItem>
                      <SelectItem value="weekly">{t('weekly')}</SelectItem>
                      <SelectItem value="monthly">{t('monthly')}</SelectItem>
                      <SelectItem value="yearly">{t('yearly')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{t('ora')}</Label>
                  <Input className="h-10 text-sm" type="time" value={settings.email?.schedule?.time || '08:00'}
                    onChange={(e) => setSettings(s => ({ ...s, email: { ...(s.email || {}), schedule: { ...(s.email?.schedule || {}), time: e.target.value } } }))} />
                </div>
              </div>
              {(settings.email?.schedule?.frequency || 'weekly') === 'weekly' && (
                <div>
                  <Label className="text-xs">{t('dita_javes')}</Label>
                  <Select
                    value={String(settings.email?.schedule?.weekDay ?? 1)}
                    onValueChange={(v) => setSettings(s => ({ ...s, email: { ...(s.email || {}), schedule: { ...(s.email?.schedule || {}), weekDay: Number(v) } } }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">{t('e_hene')}</SelectItem>
                      <SelectItem value="2">{t('e_marte')}</SelectItem>
                      <SelectItem value="3">{t('e_merkure')}</SelectItem>
                      <SelectItem value="4">{t('e_enjte')}</SelectItem>
                      <SelectItem value="5">{t('e_premte')}</SelectItem>
                      <SelectItem value="6">{t('e_shtune')}</SelectItem>
                      <SelectItem value="7">{t('e_diele')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {settings.email?.schedule?.frequency === 'monthly' && (
                <div>
                  <Label className="text-xs">{t('dita_muajit')}</Label>
                  <Input className="h-10 text-sm" type="number" min="1" max="31"
                    value={settings.email?.schedule?.monthDay || 1}
                    onChange={(e) => setSettings(s => ({ ...s, email: { ...(s.email || {}), schedule: { ...(s.email?.schedule || {}), monthDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) } } }))} />
                </div>
              )}
              {settings.email?.schedule?.frequency === 'yearly' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">{t('muaji')}</Label>
                    <Select
                      value={String(settings.email?.schedule?.yearMonth ?? 1)}
                      onValueChange={(v) => setSettings(s => ({ ...s, email: { ...(s.email || {}), schedule: { ...(s.email?.schedule || {}), yearMonth: Number(v) } } }))}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">{t('janar')}</SelectItem>
                        <SelectItem value="2">{t('shkurt')}</SelectItem>
                        <SelectItem value="3">{t('mars')}</SelectItem>
                        <SelectItem value="4">{t('prill')}</SelectItem>
                        <SelectItem value="5">{t('maj')}</SelectItem>
                        <SelectItem value="6">{t('qershor')}</SelectItem>
                        <SelectItem value="7">{t('korrik')}</SelectItem>
                        <SelectItem value="8">{t('gusht')}</SelectItem>
                        <SelectItem value="9">{t('shtator')}</SelectItem>
                        <SelectItem value="10">{t('tetor')}</SelectItem>
                        <SelectItem value="11">{t('nentor')}</SelectItem>
                        <SelectItem value="12">{t('dhjetor')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{t('dita_muajit')}</Label>
                    <Input className="h-10 text-sm" type="number" min="1" max="31"
                      value={settings.email?.schedule?.yearDay || 1}
                      onChange={(e) => setSettings(s => ({ ...s, email: { ...(s.email || {}), schedule: { ...(s.email?.schedule || {}), yearDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) } } }))} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" size="sm" onClick={() => { onSaveEmail?.(); toast.success('Email config u ruajt'); }}>
                <Save className="w-4 h-4 mr-1" /> {t('ruaj')}
              </Button>
              <Button className="flex-1" size="sm" disabled={emailBusy} onClick={onSendEmail}>
                <FileText className="w-4 h-4 mr-1" /> {t('dërgo_raportin_tani')}
              </Button>
            </div>
            {lastEmailAt && (
              <p className="text-[11px] text-muted-foreground text-center">
                {t('derguar_me')}: {new Date(lastEmailAt).toLocaleString(locale, { timeZone: TZ })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t('llogaria')}</CardTitle>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditProfileOpen(true)}>
            <Pencil className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-col gap-1 mb-2">
            <p className="text-sm font-medium">{user?.name || user?.username}</p>
            <p className="text-xs text-muted-foreground uppercase">{user?.role}</p>
          </div>
          <Button variant="outline" className="w-full justify-start text-rose-600 border-rose-300 dark:text-white" onClick={async () => { if (await confirmAsync(t('confirm_logout'), t('dil'))) onLogout?.(); }}>
            <X className="w-4 h-4 mr-2" /> {t('logout')}
          </Button>
        </CardContent>

        <FormDialog t={t}
          open={editProfileOpen}
          onOpenChange={setEditProfileOpen}
          title={t('modifiko_profilin')}
          initial={user}
          fields={[
            { name: 'name', label: t('emri_plote'), required: true },
          ]}
          onSave={async (formData) => {
            const updated = await createUser({ ...user, name: formData.name });
            setUser(updated);
            setEditProfileOpen(false);
            toast.success(t('profili_u_përditësua'));
          }}
        />
      </Card>
    </div>
  );
}

const manualContent = {
  en: [
    { icon: '📖', title: 'Introduction', items: [
      'Sparta Royale is a web-based salon management app.',
      'Install it on your phone/computer as a PWA (Add to Home Screen).',
      'Features: Appointments, Income/Expenses, Products, Clients, Services, Analytics, Email reports, Notifications, Worker accounts.',
    ]},
    { icon: '🔐', title: 'Login & Setup', items: [
      'Open sroyale.vercel.app and enter the password, then tap Login.',
      'First time: Create the admin account with your name and password.',
      'iPhone PWA: Share → Add to Home Screen → Add.',
      'Android PWA: Menu → Install App → Install.',
      'Workers register at /register, owner approves in Settings.',
    ]},
    { icon: '🏠', title: 'Dashboard', items: [
      'Shows profit for Daily/Weekly/Monthly/Yearly periods.',
      'Today\'s appointments section with View All link.',
      'Low stock products alert with View All link to Products.',
    ]},
    { icon: '👛', title: 'Expenses', items: [
      'Tap + to add an expense (Name, Amount, Date required).',
      'Same name + same date = auto-merge (amounts add up).',
      'Swipe left on an item to Edit (pencil) or Delete (trash).',
    ]},
    { icon: '📈', title: 'Income', items: [
      'Tap + to add income (Service, Price, Date required).',
      'Client name is optional — new clients are auto-created.',
      'Swipe left → Invoice to generate a PDF receipt.',
    ]},
    { icon: '📅', title: 'Appointments', items: [
      'Tap + to book (Name, Service, Date, Time required).',
      'Optional: Worker assignment, Extra services rows.',
      'Pending → tap ✅ to complete, ❌ to cancel.',
      'Tap a row to expand details: extras, total, status.',
    ]},
    { icon: '📦', title: 'Products', items: [
      'Add products with name, price, and stock quantity.',
      'Set auto-deduction: 1 unit per X completed appointments.',
      'Use +/- buttons to adjust stock (creates Supply expense).',
      'Same product + same day = auto-merge expenses.',
    ]},
    { icon: '👥', title: 'Clients', items: [
      'View client list with total spent and visit count.',
      'Tap a client to see their full history.',
      'Search bar to find clients quickly.',
    ]},
    { icon: '✂️', title: 'Services', items: [
      'Manage service menu with prices and durations.',
      'Organize services into categories and reorder them with ↑/↓ arrows.',
      'Assign which services each worker can perform (empty = any service).',
      'Services appear in Appointment and Income forms.',
    ]},
    { icon: '🕘', title: 'Work Schedules & Unavailability', items: [
      'Working Hours: one open/close time applies to all active days.',
      'Worker Schedule: set per-weekday working hours for each worker.',
      'Unavailability: block a worker on a specific day or a date range.',
      'The booking page only shows slots where shop, worker, and service are available.',
    ]},
    { icon: '✨', title: 'Additional Services', items: [
      'Build a catalog of add-ons (masks, pedicure…) with prices.',
      'Add them to appointments or manual income records.',
      'Disable an add-on instead of deleting it to keep history intact.',
    ]},
    { icon: '💸', title: 'Recurring Expenses', items: [
      'Set up rent, electricity, internet… that repeat automatically.',
      'Choose frequency (monthly / weekly / yearly) and the due day.',
      'Tap "Generate now" or let the daily cron add them automatically.',
    ]},
    { icon: '🧾', title: 'Payroll', items: [
      'Set a salary % per worker in the worker list.',
      'Pick a month and tap Generate to compute service + extra revenue per worker.',
      'Review drafts, then Pay to create a salary expense and mark it paid.',
    ]},
    { icon: '📊', title: 'Analytics', items: [
      'Charts: Bar (income vs expenses), Pie (top services).',
      'Best clients ranked by revenue, best day highlight.',
      'Tap Download PDF Report for a detailed financial report.',
    ]},
    { icon: '⚙️', title: 'Settings', items: [
      'Workers: Approve, edit, or delete worker accounts.',
      'Preferences: Switch language (SQ/EN), toggle Dark Mode.',
      'Notifications: Enable appointment alerts (set minutes before) and low stock alerts.',
      'Salon: Set salon name and low stock threshold.',
      'Email: Configure EmailJS for automatic report delivery.',
      'Account: Edit profile name or logout.',
    ]},
  ],
  sq: [
    { icon: '📖', title: 'Hyrje', items: [
      'Sparta Royale është aplikacion për menaxhimin e salloneve.',
      'Instalohet në telefon/kompjuter si PWA (Shto në Ekranin Bazë).',
      'Funksionet: Takimet, të Ardhurat/Shpenzimet, Produktet, Klientët, Shërbimet, Analitika, Raporte email, Njoftime, Llogari punëtorësh.',
    ]},
    { icon: '🔐', title: 'Hyrja dhe Konfigurimi', items: [
      'Hapni sroyale.vercel.app dhe shkruani fjalëkalimin, pastaj prekni Hyr.',
      'Hera e parë: Krijoni llogarinë e admin-it me emrin dhe fjalëkalimin tuaj.',
      'iPhone PWA: Share → Add to Home Screen → Add.',
      'Android PWA: Menu → Install App → Install.',
      'Punëtorët regjistrohen te /register, pronari i miraton te Cilësimet.',
    ]},
    { icon: '🏠', title: 'Ballina', items: [
      'Tregon fitimin për periudha Ditor/Javor/Mujor/Vjetor.',
      'Seksioni i takimeve të sotme me lidhjen Shiko të gjitha.',
      'Alarmet për stokun e ulët me lidhjen te Produktet.',
    ]},
    { icon: '👛', title: 'Shpenzimet', items: [
      'Prek + për të shtuar një shpenzim (Emri, Shuma, Data).',
      'I njëjti emër + e njëjta datë = bashkim automatik.',
      'Rrëshqit majtas për Modifiko (laps) ose Fshi (kosh).',
    ]},
    { icon: '📈', title: 'Të Ardhurat', items: [
      'Prek + për të shtuar të ardhura (Shërbimi, Çmimi, Data).',
      'Emri i klientit është opsional — krijohet automatikisht.',
      'Rrëshqit majtas → Faturë për PDF të faturës.',
    ]},
    { icon: '📅', title: 'Takimet', items: [
      'Prek + për të regjistruar (Emri, Shërbimi, Data, Ora).',
      'Opsionale: Punëtori, Shërbime shtesë.',
      'Në pritje → ✅ përfundo, ❌ anulo.',
      'Prek një rresht për detaje: shërbimet shtesë, totali, statusi.',
    ]},
    { icon: '📦', title: 'Produktet', items: [
      'Shtoni produkte me emër, çmim dhe sasi stoku.',
      'Zbritja automatike: 1 njësi për çdo X takime të kryera.',
      'Përdorni +/− për të rregulluar stokun (krijon shpenzim Furnizim).',
      'I njëjti produkt + e njëjta ditë = bashkim automatik i shpenzimeve.',
    ]},
    { icon: '👥', title: 'Klientët', items: [
      'Shihni listën e klientëve me totalin e shpenzuar dhe vizitat.',
      'Prekni një klient për të parë historikun e plotë.',
      'Shiriti i kërkimit për të gjetur klientët shpejt.',
    ]},
    { icon: '✂️', title: 'Shërbimet', items: [
      'Menaxhoni menynë e shërbimeve me çmime dhe kohëzgjatje.',
      'Organizoni shërbimet në kategori dhe renditini me shigjetat ↑/↓.',
      'Caktoni se cilat shërbime mund të kryejë çdo punëtor (bosh = çdo shërbim).',
      'Shërbimet shfaqen te Takimet dhe të Ardhurat.',
    ]},
    { icon: '🕘', title: 'Orari i Punës dhe Mosdisponueshmëria', items: [
      'Orari i punës: një orë hapje/mbyllje vlen për të gjitha ditët aktive.',
      'Orari i punëtorëve: vendosni orarin e punës për çdo ditë të javës.',
      'Mosdisponueshmëria: bllokoni një punëtor në një datë ose periudhë.',
      'Faqja e rezervimeve tregon vetëm oraret ku saloni, punëtori dhe shërbimi janë të lirë.',
    ]},
    { icon: '✨', title: 'Shërbime Shtesë', items: [
      'Krijoni një katalog shtesash (maska, pedikyri…) me çmime.',
      'Shtojini te takimet ose te të ardhurat manuale.',
      'Çaktivizoni një shtesë në vend që ta fshini, për të ruajtur historikun.',
    ]},
    { icon: '💸', title: 'Shpenzime Periodike', items: [
      'Vendosni qiranë, rrymën, internetin… që përsëriten vetë.',
      'Zgjidhni frekuencën (mujore / javore / vjetore) dhe ditën e pagesës.',
      'Prekni "Gjenero tani" ose cron-i i përditshëm i shton automatikisht.',
    ]},
    { icon: '🧾', title: 'Listapagat', items: [
      'Vendosni përqindjen e pagës për çdo punëtor në listën e punëtorëve.',
      'Zgjidhni muajin dhe prekni Gjenero për të llogaritur të ardhurat nga shërbimet + shtesat për çdo punëtor.',
      'Rishikoni draftet, pastaj Paguaj për të krijuar shpenzimin e pagës.',
    ]},
    { icon: '📊', title: 'Analitika', items: [
      'Grafikët: Shirit (të ardhurat vs shpenzimet), Byqek (top shërbimet).',
      'Klientët më të mirë të renditur sipas xhiros, dita më e mirë.',
      'Prek Shkarko Raportin për një raport të detajuar financiar.',
    ]},
    { icon: '⚙️', title: 'Cilësimet', items: [
      'Punëtorët: Miratoni, modifikoni ose fshini llogaritë.',
      'Preferencat: Ndryshoni gjuhën (SQ/EN), aktivizoni Dark Mode.',
      'Njoftimet: Aktivizoni alarmet e takimeve dhe stokut të ulët.',
      'Saloni: Vendosni emrin e sallonit dhe kufirin e stokut.',
      'Email: Konfiguroni EmailJS për dërgim automatik të raporteve.',
      'Llogaria: Ndryshoni profilin ose dilni.',
    ]},
  ],
};

function ConfirmDialog({ open, onClose, message, confirmLabel, confirmTitle, cancelLabel }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(false); }}>
      <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-base">{confirmTitle}</DialogTitle>
          <DialogDescription className="pt-1">{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onClose(false)}>{cancelLabel}</Button>
          <Button variant="destructive" onClick={() => onClose(true)}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HelpModal({ open, onOpenChange, lang, t }) {
  const [section, setSection] = useState(0);
  const data = manualContent[lang === 'sq' ? 'sq' : 'en'];
  const cur = data[section];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-700 to-brand-800 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gold-500/20 text-gold-300 text-lg font-bold">?</span>
            <div>
              <h2 className="text-base font-bold text-gold-300">{t('ndihma')}</h2>
              <p className="text-[11px] text-white/50">{lang === 'sq' ? 'Zgjidhni një temë' : 'Select a topic'}</p>
            </div>
          </div>
          <button onClick={() => onOpenChange(false)} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center transition-colors text-sm">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Sidebar */}
          <div className="w-48 shrink-0 bg-muted/30 overflow-y-auto border-r p-2 space-y-1">
            {data.map((s, i) => (
              <button key={i} onClick={() => setSection(i)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                  i === section
                    ? 'bg-brand-700 text-gold-300 shadow-sm'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <span className="shrink-0">{s.icon}</span>
                <span className="truncate">{s.title}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {cur && (
              <div className="animate-in fade-in slide-in-from-right-2 duration-200">
                <h3 className="text-lg font-bold text-brand-700 dark:text-gold-300 mb-1 flex items-center gap-2">
                  <span>{cur.icon}</span>
                  <span>{cur.title}</span>
                </h3>
                {lang === 'sq' ? (
                  <p className="text-xs text-muted-foreground mb-4">Udhëzime hap pas hapi për këtë seksion.</p>
                ) : (
                  <p className="text-xs text-muted-foreground mb-4">Step-by-step instructions for this section.</p>
                )}
                <ul className="space-y-3">
                  {cur.items.map((item, j) => (
                    <li key={j} className="flex gap-3 text-sm leading-relaxed">
                      <span className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-gold-400 shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5">{j + 1}</span>
                      <span className="text-foreground/90">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t px-6 py-3 flex items-center justify-between bg-muted/20">
          <span className="text-[11px] text-muted-foreground">Sparta Royale v1.0</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSection(s => Math.max(0, s - 1))} disabled={section === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-700 text-gold-300 hover:bg-brand-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              {lang === 'sq' ? 'Para' : 'Prev'}
            </button>
            <span className="text-[11px] text-muted-foreground min-w-[4ch] text-center">
              {section + 1}/{data.length}
            </span>
            <button onClick={() => setSection(s => Math.min(data.length - 1, s + 1))} disabled={section >= data.length - 1}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-700 text-gold-300 hover:bg-brand-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              {lang === 'sq' ? 'Pas' : 'Next'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* =====================================================================
   LOGIN SCREEN
===================================================================== */
function LoginScreen({ needSetup, onSetup, onLogin, t }) {
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!pw) return;
    if (needSetup && !name.trim()) { toast.error(t('vendosni_emrin')); return; }
    if (needSetup && pw !== pw2) { toast.error(t('fjalëkalimet_nuk_përputhen')); return; }
    setBusy(true);
    try {
      if (needSetup) await onSetup(name, pw);
      else await onLogin(null, pw);
    } catch (e) {
      toast.error(t('dështoi') + e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex w-24 h-24 rounded-3xl bg-black/20 items-center justify-center shadow-2xl ring-2 ring-gold-300/30 mb-4">
            <Logo size={64} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Sparta Royale</h1>
          <p className="text-xs uppercase tracking-widest text-gold-400 mt-1">Beauty Salon</p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-2xl ring-1 ring-white/10">
          <h2 className="text-lg font-semibold text-white mb-1">
            {needSetup ? '👑 ' + t('konfiguro_administratorin') : '🔐 ' + t('hyrje')}
          </h2>
          <p className="text-xs text-white/50 mb-5">
            {needSetup ? t('hera_e_parë') : t('vendos_fjalëkalimin')}
          </p>

          <div className="space-y-3">
            {needSetup && (
              <div>
                <label className="text-xs font-medium text-gold-300 block mb-1">{t('emri_plote')}</label>
                <input
                  className="w-full h-12 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 text-base"
                  type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Filan Fisteku"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gold-300 block mb-1">{t('fjalëkalimi')}</label>
              <div className="relative">
                <input
                  className="w-full h-12 px-4 pr-11 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 text-base"
                  type={showPw ? 'text' : 'password'} value={pw} autoFocus
                  onChange={(e) => setPw(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !needSetup) submit(); }}
                  placeholder="••••••••"
                />
                <button type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                  onClick={() => setShowPw(s => !s)}>
                  {showPw ? <XCircle className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {needSetup && (
              <div>
                <label className="text-xs font-medium text-gold-300 block mb-1">{t('fjalëkalimi')} (confirm)</label>
                <input
                  className="w-full h-12 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 text-base"
                  type={showPw ? 'text' : 'password'} value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                  placeholder="••••••••"
                />
              </div>
            )}

            <button
              className="w-full h-12 rounded-xl font-bold text-base mt-1 flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-gold-500 to-gold-400 hover:from-gold-400 hover:to-gold-300 text-brand-900 disabled:opacity-60"
              onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Logo size={20} />}
              {needSetup ? t('krijo_hyr') : t('hyr')}
            </button>

            {!needSetup && (
              <div className="text-center space-y-2 pt-1">
                <Link href="/dashboard/register" className="block text-[11px] text-gold-400/70 hover:text-gold-400 transition-colors">
                  {t('regjistrohu')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   SHARED COMPONENTS
===================================================================== */
function ClientCombobox({ value, onChange, clients, t, placeholder }) {
  const [focus, setFocus] = useState(false);
  const blurTimer = useRef(null);

  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);

  function handleBlur() { blurTimer.current = setTimeout(() => setFocus(false), 180); }
  function handleFocus() { if (blurTimer.current) clearTimeout(blurTimer.current); setFocus(true); }
  function pick(name) { if (blurTimer.current) clearTimeout(blurTimer.current); onChange(name); setFocus(false); }

  const q = (value || '').toLowerCase().trim();
  const list = clients || [];
  const filtered = q ? list.filter(c => c.name?.toLowerCase().includes(q)).slice(0, 8) : list.slice(0, 8);
  const showNewHint = q && !list.some(c => c.name?.toLowerCase() === q);

  return (
    <div className="relative">
      <Input
        className="h-11"
        placeholder={placeholder || t('emri_klientit')}
        value={value || ''}
        onChange={(e) => { onChange(e.target.value); setFocus(true); }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoComplete="off"
      />
      {focus && (filtered.length > 0 || showNewHint) && (
        <div className="absolute z-50 mt-1 w-full bg-popover text-popover-foreground border rounded-md shadow-lg max-h-56 overflow-auto">
          {filtered.map(c => (
            <button key={c.id} type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(c.name); }}
              className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-300 text-xs font-semibold shrink-0">
                {c.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <span className="flex-1 truncate">{c.name}</span>
              {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
            </button>
          ))}
          {showNewHint && (
            <div className="px-3 py-2 text-xs text-muted-foreground border-t flex items-center gap-1.5">
              <Plus className="w-3 h-3" /> {t('klient_i_ri')}: <strong className="text-foreground">{value}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AppointmentRow({ a, onEdit, onDelete, onComplete, onCancel, onReopen, compact, t, confirmAsync }) {
  const status = a.status || 'pending';
  const [open, setOpen] = useState(false);
  const stop = (e, fn) => { e.stopPropagation(); fn?.(); };
  const extrasTotal = (a.extras || []).reduce((sum, ex) => sum + Number(ex.price || 0), 0);
  const mainPrice = Number(a.price || 0) - extrasTotal;

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const cardBg = isDark
    ? (status === 'completed' ? '#0a1f14' : status === 'canceled' ? '#111318' : '#0d1525')
    : (status === 'completed' ? '#f0fdf4' : status === 'canceled' ? '#f4f4f5' : '#eff6ff');
  const cardBorder = isDark
    ? (status === 'completed' ? '#1a3a24' : status === 'canceled' ? '#1e2028' : '#1a2540')
    : (status === 'completed' ? '#bbf7d0' : status === 'canceled' ? '#e4e4e7' : '#bfdbfe');
  const timeColor = status === 'completed' ? '#16a34a' : status === 'canceled' ? '#9ca3af' : '#e05a4e';
  const labelColor = isDark ? '#6a7a8a' : '#6b7280';
  const nameColor = isDark ? '#fff' : '#111827';
  const priceColor = isDark ? '#fff' : '#111827';

  return (
    <li style={{ opacity: status === 'canceled' ? 0.6 : 1 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ background: cardBg, borderRadius: 14, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', border: `1px solid ${cardBorder}` }}
      >
        {(() => {
          const months = [t('jan'), t('shk'), t('mar'), t('pri'), t('maj_short'), t('qer'), t('kor'), t('gus'), t('sht'), t('tet'), t('nën'), t('dhj')];
          const dateLabel = a.date ? (() => { const [,m,d] = a.date.split('-'); return `${Number(d)} ${months[Number(m)-1]}`; })() : '';
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 54, flexShrink: 0 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: timeColor, textTransform: 'uppercase', letterSpacing: '0.3px', lineHeight: 1.2 }}>{dateLabel}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: timeColor, letterSpacing: '0.5px', lineHeight: 1.1, textDecoration: status === 'canceled' ? 'line-through' : 'none' }}>{a.time}</span>
              <span style={{ fontSize: 9, color: labelColor, textAlign: 'center', lineHeight: 1.2 }}>{a.workerName || t('pa_punetor')}</span>
            </div>
          );
        })()}

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, padding: '0 2px' }}>
          <span style={{ fontSize: 9, color: labelColor, lineHeight: 1.2 }}>{a.clientName}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: nameColor, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: status === 'canceled' ? 'line-through' : 'none' }}>
            {a.serviceName} <span style={{ fontWeight: 400 }}>{fmtMoney(mainPrice)}</span>
          </span>
          {Array.isArray(a.extras) && a.extras.map(ex => (
            <span key={ex.id} style={{ fontSize: 8, color: labelColor, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ex.name} <span style={{ color: nameColor }}>{fmtMoney(ex.price)}</span>
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: priceColor }}>{fmtMoney(a.price)}</span>

          {a.clientPhone && (
            <button onClick={e => stop(e, () => window.location.href = `tel:${a.clientPhone}`)}
              style={{ width: 30, height: 30, borderRadius: 7, border: '1.5px solid #2a6fd4', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <Phone style={{ width: 12, height: 12, color: '#2a6fd4' }} />
            </button>
          )}

          {status === 'pending' && (<>
            <button onClick={e => stop(e, () => onComplete?.(a))}
              style={{ width: 30, height: 30, borderRadius: 7, border: '1.5px solid #2db87a', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <Check style={{ width: 12, height: 12, color: '#2db87a' }} />
            </button>
            <button onClick={e => stop(e, () => onCancel?.(a))}
              style={{ width: 30, height: 30, borderRadius: 7, border: '1.5px solid #e05a4e', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <X style={{ width: 12, height: 12, color: '#e05a4e' }} />
            </button>
          </>)}

          {status === 'completed' && (
            <div style={{ height: 30, display: 'flex', alignItems: 'center', padding: '0 8px', borderRadius: 7, background: 'rgba(45,184,122,0.1)', border: '1.5px solid rgba(45,184,122,0.3)', gap: 4, flexShrink: 0 }}>
              <CheckCircle2 style={{ width: 10, height: 10, color: '#2db87a' }} />
              <span style={{ fontSize: 8, fontWeight: 700, color: '#2db87a', textTransform: 'uppercase' }}>{t('perfunduar')}</span>
            </div>
          )}
          {status === 'canceled' && (
            <div style={{ height: 30, display: 'flex', alignItems: 'center', padding: '0 8px', borderRadius: 7, background: 'rgba(100,100,100,0.1)', border: '1.5px solid #2a2a3a', gap: 4, flexShrink: 0 }}>
              <XCircle style={{ width: 10, height: 10, color: '#4a5568' }} />
              <span style={{ fontSize: 8, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase' }}>{t('anuluar')}</span>
            </div>
          )}
        </div>
      </div>
      {open && !compact && (
        <div className="mt-2 p-4 bg-zinc-950 rounded-2xl border border-zinc-800 border-dashed space-y-4 animate-in fade-in slide-in-from-top-1">
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] text-zinc-500 font-black px-1 uppercase tracking-widest">
              <span>{t("detajet")}</span>
              <span>{t("shuma")}</span>
            </div>
            {a.date && (
              <div className="flex items-center gap-1.5 px-1 text-[11px] text-zinc-400">
                <CalendarDays style={{ width: 11, height: 11 }} />
                <span>{a.date}</span>
                {a.time && <><span className="opacity-40">·</span><Clock style={{ width: 11, height: 11 }} /><span>{a.time}</span></>}
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm px-1 text-zinc-300">
                <span>{a.serviceName}</span>
                <span className="font-bold tabular-nums">{fmtMoney(mainPrice)}</span>
              </div>
              {Array.isArray(a.extras) && a.extras.map(ex => (
                <div key={ex.id} className="flex justify-between text-sm px-1 text-rose-400">
                  <span>+ {ex.name}</span>
                  <span className="font-bold tabular-nums">{fmtMoney(ex.price)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-base font-black border-t border-zinc-800 pt-3 mt-2 px-1 text-white">
              <span>{t("total_label")}</span>
              <span className="tabular-nums">{fmtMoney(a.price)}</span>
            </div>
          </div>

          {a.notes && (
            <div className="text-xs px-3 py-2.5 bg-zinc-900 text-zinc-400 rounded-xl border border-zinc-800 italic">
              {a.notes}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            {status !== "pending" && (
              <Button size="sm" variant="outline" className="h-9 text-xs border-zinc-700 bg-zinc-900 text-zinc-300" onClick={() => { onReopen?.(a); setOpen(false); }}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />{t("rikthe")}
              </Button>
            )}
            {onEdit && (
              <Button size="sm" variant="outline" className="h-9 text-xs border-zinc-700 bg-zinc-900 text-zinc-300" onClick={() => { onEdit(); setOpen(false); }}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" />{t("modifiko")}
              </Button>
            )}
            {onDelete && (
              <Button size="sm" variant="outline" className="h-9 text-xs border-rose-900/50 bg-rose-950/20 text-rose-500 hover:bg-rose-950/40"
                onClick={async () => { if (await confirmAsync(t("fshi_takimin"))) { onDelete(); setOpen(false); } }}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />{t("fshi")}
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function FAB({ onClick, t }) {
  return (
    <button
      onClick={onClick}
      className="fixed right-5 bottom-24 z-20 h-14 w-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      aria-label={t('shto')}
    >
      <Plus className="w-7 h-7" />
    </button>
  );
}

function EmptyState({ icon: Icon, title, desc }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-10 flex flex-col items-center text-center">
        <div className="p-3 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 mb-3">
          <Icon className="w-7 h-7" />
        </div>
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">{desc}</p>
      </CardContent>
    </Card>
  );
}

function SwipeRow({ children, onEdit, onDelete, extraAction, t, confirmAsync }) {
  const [open, setOpen] = useState(false);
  const ActionIcon = extraAction?.icon;
  return (
    <li className="relative">
      <div onClick={() => setOpen(o => !o)} className="cursor-pointer">{children}</div>
      {open && (
        <div className="mt-1 flex gap-1.5 justify-end flex-wrap">
          {extraAction && (
            <Button size="sm" variant="outline" onClick={() => { extraAction.onClick(); setOpen(false); }}>
              <ActionIcon className="w-3.5 h-3.5 mr-1" />{t(extraAction.label)}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => { onEdit(); setOpen(false); }}>
            <Pencil className="w-3.5 h-3.5 mr-1" />{t('modifiko')}
          </Button>
          <Button size="sm" variant="outline" className="text-rose-600 border-rose-300"
            onClick={async () => { if (await confirmAsync(t('fshi'))) { onDelete(); setOpen(false); } }}>
            <Trash2 className="w-3.5 h-3.5 mr-1" />{t('fshi')}
          </Button>
        </div>
      )}
    </li>
  );
}

function FormDialog({ open, onOpenChange, title, fields, initial, onSave, t }) {
  const [form, setForm] = useState(initial || {});
  useEffect(() => { setForm(initial || {}); }, [initial, open]);

  function submit() {
    for (const f of fields) {
      if (f.required && (form[f.name] === undefined || form[f.name] === '' || form[f.name] === null)) {
        toast.error(t('emri_detyrushem').replace('{}', f.label)); return;
      }
    }
    onSave(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {fields.map(f => (
            <div key={f.name}>
              <Label className="text-xs">{f.label}{f.required && ' *'}</Label>
              {f.type === 'textarea' ? (
                <Textarea
                  value={form[f.name] ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const next = { ...form, [f.name]: val };
                    if (f.name === 'name' && !form.id && fields.some(fld => fld.name === 'username')) {
                      next.username = val.toLowerCase().replace(/\s+/g, '');
                    }
                    setForm(next);
                  }}
                  placeholder={f.placeholder}
                  rows={2}
                />
              ) : f.type === 'select' ? (
                <Select value={form[f.name] ?? ''} onValueChange={(val) => {
                  const next = { ...form, [f.name]: val };
                  setForm(next);
                  f.onValueChange?.(val, next, setForm);
                }}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder={f.placeholder || t('zgjidh')} />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options?.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-11"
                  type={f.type || 'text'}
                  step={f.step}
                  inputMode={f.type === 'number' ? 'decimal' : undefined}
                  value={form[f.name] ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const next = { ...form, [f.name]: val };
                    if (f.name === 'name' && !form.id && fields.some(fld => fld.name === 'username')) {
                      next.username = val.toLowerCase().replace(/\s+/g, '');
                    }
                    setForm(next);
                  }}
                  placeholder={f.placeholder}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('anulo')}</Button>
          <Button onClick={submit} className="bg-rose-600 hover:bg-rose-700 text-white">
            <Save className="w-4 h-4 mr-2" /> {t('ruaj')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =====================================================================
   PDF REPORT & INVOICE  (unchanged from original)
===================================================================== */
async function loadImageAsDataURL(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function generatePeriodReportPDF(opts) {
  const { period, refDate, start, end, label, teArdhurat, shpenzimet, appointments, clients, settings } = opts;
  const t = (key) => translations[settings?.sparta_lang || settings?.lang || 'sq']?.[key] || key;
  const salonName = settings?.salonName || 'Sparta Royale';
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();

  const BURG = [71, 17, 21];
  const BURG_DEEP = [56, 12, 16];
  const CREAM = [232, 208, 160];
  const CREAM_BG = [243, 225, 188];
  const CREAM_LIGHT = [250, 241, 222];
  const GOLD_DARK = [165, 132, 76];
  const TEXT_DARK = [56, 12, 16];

  const logoDataURL = await loadImageAsDataURL('/royale-logo.png');

  const inc = teArdhurat.filter(t => inRange(t.date, start, end));
  const exp = shpenzimet.filter(s => inRange(s.date, start, end));
  const apptsAll = appointments.filter(a => inRange(a.date, start, end));
  const totalIncome = inc.reduce((s, t) => s + Number(t.price || 0), 0);
  const totalExpense = exp.reduce((s, t) => s + Number(t.amount || 0), 0);
  const profit = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;
  const completedCount = apptsAll.filter(a => a.status === 'completed').length;
  const canceledCount = apptsAll.filter(a => a.status === 'canceled').length;

  const svcMap = {};
  inc.forEach(t => {
    const k = (t.serviceName || 'Të tjera').split(' + ')[0];
    if (!svcMap[k]) svcMap[k] = { name: k, count: 0, revenue: 0 };
    svcMap[k].count += 1;
    svcMap[k].revenue += Number(t.price || 0);
  });
  const services = Object.values(svcMap).sort((a, b) => b.revenue - a.revenue);
  const extrasIncome = inc.reduce((s, t) => {
    const ex = Array.isArray(t.extras) ? t.extras : [];
    return s + ex.reduce((ss, e) => ss + Number(e.price || 0), 0);
  }, 0);

  const expMap = {};
  exp.forEach(s => {
    const k = s.name || 'Tjetër';
    if (!expMap[k]) expMap[k] = { name: k, count: 0, total: 0 };
    expMap[k].count += 1;
    expMap[k].total += Number(s.amount || 0);
  });
  const expenseGroups = Object.values(expMap).sort((a, b) => b.total - a.total);

  function paintBackground() {
    doc.setFillColor(...BURG);
    doc.rect(0, 0, PW, PH, 'F');
    doc.setDrawColor(...CREAM);
    doc.setLineWidth(0.4);
    doc.line(8, 12, 22, 12); doc.line(8, 12, 8, 26);
    doc.line(PW - 22, 12, PW - 8, 12); doc.line(PW - 8, 12, PW - 8, 26);
    doc.line(8, PH - 26, 8, PH - 12); doc.line(8, PH - 12, 22, PH - 12);
    doc.line(PW - 22, PH - 12, PW - 8, PH - 12); doc.line(PW - 8, PH - 26, PW - 8, PH - 12);
  }

  function drawHelmet(centerX, topY, sizeMm = 18) {
    if (logoDataURL) {
      try { doc.addImage(logoDataURL, 'PNG', centerX - sizeMm / 2, topY, sizeMm, sizeMm); return; } catch {}
    }
    doc.setFillColor(...CREAM);
    doc.triangle(centerX - sizeMm / 2, topY + sizeMm * 0.7, centerX, topY, centerX + sizeMm / 2, topY + sizeMm * 0.7, 'F');
  }

  function pageFooter(pageIdx, total) {
    doc.setTextColor(...CREAM);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${t('dokumenti_gjeneruar')} ${todayISO()}`, 14, PH - 6);
    doc.text(`${t('faqe')} ${pageIdx} ${t('nga')} ${total}`, PW - 14, PH - 6, { align: 'right' });
  }

  function panel(x, y, w, h, fill = CREAM_BG) {
    doc.setFillColor(...fill);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, 'F');
  }

  function sectionHeader(x, y, w, num, title) {
    doc.setFillColor(...CREAM_LIGHT);
    doc.roundedRect(x, y, w, 9, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BURG);
    doc.text(`${num}. ${title.toUpperCase()}`, x + 4, y + 6);
  }

  function fmtMoneyShort(v) {
    return `€ ${Math.round(Number(v || 0) * 100) / 100}`;
  }

  paintBackground();
  drawHelmet(PW / 2, 14, 18);

  doc.setTextColor(...CREAM);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  const titleMap = { daily: t('përmbledhje_financiare_ditore'), weekly: t('përmbledhje_financiare_javore'), monthly: t('përmbledhje_financiare_mujore'), yearly: t('përmbledhje_financiare_vjetore') };
  doc.text(titleMap[period] || 'PËRMBLEDHJE FINANCIARE', PW / 2, 42, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`PERIUDHA: ${label.toUpperCase()}`, PW / 2, 50, { align: 'center' });

  let y = 60;
  const cw = PW - 28;
  const cx = 14;
  const incSectionRows = services.length + (extrasIncome > 0 ? 1 : 0) + 2;
  const incH = 14 + incSectionRows * 6 + 8;
  panel(cx, y, cw, incH);
  sectionHeader(cx, y, cw, '1', t('të_ardhurat'));

  let ry = y + 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_DARK);
  doc.text(t('të_ardhura_nga_sherbimi'), cx + 4, ry);
  doc.text(fmtMoneyShort(totalIncome - extrasIncome), cx + cw - 4, ry, { align: 'right' });
  ry += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (services.length === 0) {
    doc.setTextColor(120, 120, 120);
    doc.text('—  Asnjë e dhënë', cx + 8, ry);
    ry += 6;
    doc.setTextColor(...TEXT_DARK);
  } else {
    services.forEach(s => {
      doc.text(`- ${s.name}:`, cx + 8, ry);
      doc.text(fmtMoneyShort(s.revenue), cx + cw - 4, ry, { align: 'right' });
      ry += 6;
    });
  }
  if (extrasIncome > 0) {
    ry += 1;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(t('shitje_produkteve'), cx + 4, ry);
    doc.text(fmtMoneyShort(extrasIncome), cx + cw - 4, ry, { align: 'right' });
    ry += 6;
  }
  ry += 1;
  doc.setDrawColor(...BURG);
  doc.setLineWidth(0.4);
  doc.line(cx + 4, ry, cx + cw - 4, ry);
  ry += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTALI TË ARDHURAVE:', cx + 4, ry);
  doc.text(fmtMoneyShort(totalIncome), cx + cw - 4, ry, { align: 'right' });

  y = y + incH + 6;
  const expRows = expenseGroups.length + 2;
  const expH = 14 + expRows * 6 + 8;
  panel(cx, y, cw, expH);
  sectionHeader(cx, y, cw, '2', t('shpenzimet_label_pdf'));
  ry = y + 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_DARK);
  doc.text(t('shpenzime_sipas_zerit'), cx + 4, ry);
  doc.text(fmtMoneyShort(totalExpense), cx + cw - 4, ry, { align: 'right' });
  ry += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (expenseGroups.length === 0) {
    doc.setTextColor(120, 120, 120);
    doc.text('—  Asnjë e dhënë', cx + 8, ry);
    ry += 6;
    doc.setTextColor(...TEXT_DARK);
  } else {
    expenseGroups.forEach(eg => {
      const nm = eg.name.length > 38 ? eg.name.slice(0, 37) + '…' : eg.name;
      doc.text(`- ${nm}:`, cx + 8, ry);
      doc.text(fmtMoneyShort(eg.total), cx + cw - 4, ry, { align: 'right' });
      ry += 6;
    });
  }
  ry += 1;
  doc.setDrawColor(...BURG);
  doc.line(cx + 4, ry, cx + cw - 4, ry);
  ry += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTALI SHPENZIMEVE:', cx + 4, ry);
  doc.text(fmtMoneyShort(totalExpense), cx + cw - 4, ry, { align: 'right' });

  y = y + expH + 6;
  const profitH = 38;
  panel(cx, y, cw, profitH);
  sectionHeader(cx, y, cw, '3', t('fitimi_neto'));
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BURG);
  doc.setFontSize(11);
  doc.text(t('fitimi_neto_label'), PW / 2, y + 18, { align: 'center' });
  doc.setFontSize(20);
  doc.setTextColor(...(profit >= 0 ? BURG_DEEP : [185, 28, 28]));
  doc.text(fmtMoneyShort(profit), PW / 2, y + 28, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_DARK);
  if (totalIncome > 0) {
    const sign = margin >= 0 ? '+' : '';
    doc.text(`${t('marzhi_neto')} ${sign}${margin.toFixed(1)}%`, PW / 2, y + 34, { align: 'center' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...CREAM);
  doc.text(`${t('sherbime_label')} ${inc.length}    ${t('perfunduar_label')} ${completedCount}    ${t('anuluar_label')} ${canceledCount}`, PW / 2, PH - 18, { align: 'center' });

  const rows = [];
  inc.forEach(t => {
    rows.push({ date: t.date, desc: t.serviceName + (t.clientName ? ` (${t.clientName})` : ''), income: Number(t.price || 0), expense: 0 });
  });
  exp.forEach(s => {
    rows.push({ date: s.date, desc: (s.name || '') + (s.description ? ` - ${s.description}` : ''), income: 0, expense: Number(s.amount || 0) });
  });
  rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  function dateLabel(d) {
    if (!d) return '';
    const dt = new Date(d);
    const months = [t('jan'), t('shk'), t('mar'), t('pri'), t('maj_short'), t('qer'), t('kor'), t('gus'), t('sht'), t('tet'), t('nën'), t('dhj')];
    if (period === 'yearly') return `${String(dt.getDate()).padStart(2,'0')} ${months[dt.getMonth()]} ${String(dt.getFullYear()).slice(-2)}`;
    return `${String(dt.getDate()).padStart(2,'0')} ${months[dt.getMonth()]}`;
  }

  function newDetailPage() {
    doc.addPage();
    paintBackground();
    drawHelmet(PW / 2, 14, 18);
    doc.setTextColor(...CREAM);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(titleMap[period] || 'PËRMBLEDHJE FINANCIARE', PW / 2, 42, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`ANALIZE DITORE E DETAJUAR (${label.toUpperCase()})`, PW / 2, 50, { align: 'center' });
  }

  newDetailPage();
  let ty = 60;
  const tCols = [
    { x: 16, w: 26, label: t('data_label_pdf'), align: 'left' },
    { x: 42, w: 88, label: t('përshkrimi_label'), align: 'left' },
    { x: 130, w: 30, label: t('te_ardhurat_col'), align: 'right' },
    { x: 160, w: 32, label: t('shpenzimet_col'), align: 'right' },
  ];
  doc.setFillColor(...CREAM_LIGHT);
  doc.rect(14, ty, PW - 28, 9, 'F');
  doc.setTextColor(...BURG);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  tCols.forEach(c => {
    const xPos = c.align === 'right' ? c.x + c.w - 2 : c.x + 2;
    doc.text(c.label, xPos, ty + 6, { align: c.align });
  });
  ty += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK);
  rows.forEach((r, i) => {
    if (ty > PH - 40) {
      pageFooter(doc.internal.getNumberOfPages(), 0);
      newDetailPage();
      ty = 60;
      doc.setFillColor(...CREAM_LIGHT);
      doc.rect(14, ty, PW - 28, 9, 'F');
      doc.setTextColor(...BURG);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      tCols.forEach(c => {
        const xPos = c.align === 'right' ? c.x + c.w - 2 : c.x + 2;
        doc.text(c.label, xPos, ty + 6, { align: c.align });
      });
      ty += 9;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...TEXT_DARK);
    }
    doc.setFillColor(...(i % 2 === 0 ? CREAM_BG : CREAM_LIGHT));
    doc.rect(14, ty, PW - 28, 7, 'F');
    doc.text(dateLabel(r.date), 18, ty + 5);
    const maxDesc = r.desc.length > 42 ? r.desc.slice(0, 41) + '…' : r.desc;
    doc.text(maxDesc, 44, ty + 5);
    if (r.income > 0) {
      doc.setTextColor(20, 100, 60);
      doc.text(`+${fmtMoneyShort(r.income)}`, 158, ty + 5, { align: 'right' });
      doc.setTextColor(...TEXT_DARK);
    } else {
      doc.setTextColor(140, 140, 140);
      doc.text('—', 158, ty + 5, { align: 'right' });
      doc.setTextColor(...TEXT_DARK);
    }
    if (r.expense > 0) {
      doc.setTextColor(...BURG);
      doc.setFont('helvetica', 'bold');
      doc.text(`-${fmtMoneyShort(r.expense)}`, 190, ty + 5, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT_DARK);
    } else {
      doc.setTextColor(140, 140, 140);
      doc.text('—', 190, ty + 5, { align: 'right' });
      doc.setTextColor(...TEXT_DARK);
    }
    ty += 7;
  });

  if (rows.length === 0) {
    doc.setFillColor(...CREAM_BG);
    doc.rect(14, ty, PW - 28, 14, 'F');
    doc.setTextColor(120, 120, 120);
    doc.text(t('asnje_transaksion'), PW / 2, ty + 9, { align: 'center' });
    ty += 14;
  }

  ty += 4;
  doc.setFillColor(...CREAM);
  doc.rect(14, ty, PW - 28, 9, 'F');
  doc.setTextColor(...BURG);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(t('totali_të_ardhurave'), 16, ty + 6);
  doc.text(fmtMoneyShort(totalIncome), PW - 16, ty + 6, { align: 'right' });
  ty += 9;
  doc.setFillColor(...CREAM);
  doc.rect(14, ty, PW - 28, 9, 'F');
  doc.text(t('totali_shpenzimeve'), 16, ty + 6);
  doc.text(fmtMoneyShort(totalExpense), PW - 16, ty + 6, { align: 'right' });
  ty += 9;
  doc.setFillColor(...CREAM);
  doc.rect(14, ty, PW - 28, 9, 'F');
  doc.setTextColor(...(profit >= 0 ? BURG_DEEP : [160, 20, 20]));
  doc.text(t('fitimi_neto_label'), 16, ty + 6);
  doc.text(fmtMoneyShort(profit), PW - 16, ty + 6, { align: 'right' });

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    pageFooter(i, totalPages);
  }

  const safeLabel = String(label).replace(/[^a-zA-Z0-9-_]/g, '_');
  doc.save(`sparta-royal-${period}-${safeLabel}.pdf`);
  toast.success(t('raporti_u_shkarkua'));
}

function generateInvoicePDF(item, settings, fmtDate) {
  const t = (key) => translations[settings?.sparta_lang || settings?.lang || 'sq']?.[key] || key;
  const doc = new jsPDF();
  const salonName = settings.salonName || 'Sparta Royale';

  doc.setFillColor(71, 17, 21);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(232, 208, 160);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(salonName.toUpperCase(), 14, 15);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(t('fature_invoice'), 14, 23);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text(`${t('nr_fature')} INV-${String(item.id).slice(0, 8).toUpperCase()}`, 14, 45);
  doc.text(`${t('data_label_pdf')}: ${fmtDate(item.date)}`, 14, 52);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(t('klienti'), 14, 68);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(item.clientName || t('pa_emer'), 35, 68);

  doc.setFillColor(245, 245, 245);
  doc.rect(14, 80, 182, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(t('pershkrim'), 16, 87);
  doc.text(t('shuma'), 180, 87, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  let lineY = 100;
  const extras = Array.isArray(item.extras) ? item.extras : [];
  let mainOnlyName = item.serviceName || '-';
  let mainPrice = Number(item.price || 0);
  if (extras.length > 0) {
    const firstPart = mainOnlyName.split(' + ')[0];
    mainOnlyName = firstPart;
    const extrasSum = extras.reduce((s, e) => s + Number(e.price || 0), 0);
    mainPrice = Math.max(0, Number(item.price || 0) - extrasSum);
  }
  doc.text(mainOnlyName, 16, lineY);
  doc.text(fmtMoney(mainPrice), 180, lineY, { align: 'right' });
  lineY += 8;
  extras.forEach(ex => {
    doc.text(`+ ${ex.name}`, 18, lineY);
    doc.text(fmtMoney(ex.price), 180, lineY, { align: 'right' });
    lineY += 7;
  });

  doc.setDrawColor(71, 17, 21);
  doc.setLineWidth(0.5);
  const totY = Math.max(lineY + 5, 115);
  doc.line(14, totY, 196, totY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('TOTAL', 14, totY + 10);
  doc.setTextColor(71, 17, 21);
  doc.text(fmtMoney(item.price), 180, totY + 10, { align: 'right' });

  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${t('faleminderit')} ${salonName}!`, 105, 280, { align: 'center' });

  doc.save(`fatura-${String(item.id).slice(0, 8)}.pdf`);
  toast.success(t('factura_u_shkarkua'));
}

export default App;
