# Sparta Royale — Manual i Përdorimit / User Manual

> **Version:** 1.0
> **Platform:** Web (PWA – instalohet në telefon/desktop)

---

## Përmbajtja / Table of Contents

1. [Hyrje / Introduction](#1-hyrje--introduction)
2. [Fillimi / Getting Started](#2-fillimi--getting-started)
3. [Ballina / Dashboard](#3-ballina--dashboard)
4. [Shpenzimet / Expenses](#4-shpenzimet--expenses)
5. [Të Ardhurat / Income](#5-të-ardhurat--income)
6. [Takimet / Appointments](#6-takimet--appointments)
7. [Produktet / Products](#7-produktet--products)
8. [Klientët / Clients](#8-klientët--clients)
9. [Shërbimet / Services](#9-shërbimet--services)
10. [Analitika / Analytics](#10-analitika--analytics)
11. [Cilësimet / Settings](#11-cilësimet--settings)
12. [Raportet PDF / PDF Reports](#12-raportet-pdf--pdf-reports)
13. [Raportet Email / Email Reports](#13-raportet-email--email-reports)
14. [Njoftimet / Notifications](#14-njoftimet--notifications)
15. [Këshilla / Tips & Troubleshooting](#15-këshilla--tips--troubleshooting)

---

## 1. Hyrje / Introduction

Sparta Royale është një aplikacion web për menaxhimin e salloneve të bukurisë. Mund të instaloni në telefon ose kompjuter si PWA (Progressive Web App).

**Funksionalitetet kryesore:**
- Menaxhimi i takimeve (appointments)
- Gjurmimi i të ardhurave dhe shpenzimeve
- Inventari i produkteve me stok
- Menaxhimi i klientëve dhe shërbimeve
- Analitika dhe raporte PDF
- Dërgimi i raporteve automatikisht me email (EmailJS)
- Njoftime në shfletues (browser notifications)
- Përkrahje për punëtorë (worker accounts)

**[insert screenshot: app landing page / PWA install prompt]**

---

## 2. Fillimi / Getting Started

### 2.1 Hera e parë / First-time Setup

Kur hapni aplikacionin për herë të parë, do të shihni ekranin **"Konfiguro Administratorin"**:

1. Shkruani **Emrin e plotë** (p.sh. "Valmir Maloku")
2. Shkruani **Fjalëkalimin** dhe **Konfirmoni fjalëkalimin**
3. Shtypni **"Krijo & Hyr"**

Kjo krijon llogarinë e parë me rol **Owner** (pronar).

**[insert screenshot: first-time setup screen]**

### 2.2 Hyrja / Login

Nëse ka një llogari admin:

1. Shkruani fjalëkalimin
2. Shtypni **"Hyr"**

**[insert screenshot: login screen]**

### 2.3 Regjistrimi i punëtorit / Worker Registration

Punëtorët regjistrohen në `/register`:
1. Shkruani emrin dhe fjalëkalimin
2. Shtypni **"Regjistrohu"**
3. Llogaria mbetet **"Në pritje"** derisa pronari ta miratojë

**[insert screenshot: registration page]**

### 2.4 Instalimi si aplikacion / Install as PWA

- **Chrome:** klikoni ikonën e instalimit në shiritin e adresës
- **Safari (iOS):** Share → Add to Home Screen
- **Edge:** klikoni "... → Apps → Install"

---

## 3. Ballina / Dashboard

Paneli kryesor tregon një përmbledhje të shpejtë të biznesit.

**[insert screenshot: full dashboard view]**

### 3.1 Fitimi / Profit Card

- Zgjedhni periudhën: **Ditor / Javor / Mujor / Vjetor**
- Shfaqen **të ardhurat**, **shpenzimet** dhe **fitimi** për atë periudhë

### 3.2 Takimet e sotme / Today's Appointments

- Liston takimet për muajin e zgjedhur
- Klikoni **"Shiko të gjitha"** për të shkuar te tab-i i takimeve
- Klikoni një takim për ta zgjeruar dhe parë detajet

### 3.3 Stok i ulët / Low Stock

- Shfaq produktet me sasi nën limit
- Klikoni **"Shiko të gjitha"** për të shkuar te produktet

**[insert screenshot: low stock alert card]**

---

## 4. Shpenzimet / Expenses

Menaxhoni të gjitha shpenzimet e biznesit.

**[insert screenshot: expenses list view]**

### 4.1 Filtrimi / Filter

- Përdorni filtrin e muajit për të parë shpenzimet e një periudhe të caktuar
- Totali i muajit shfaqet sipër listës

### 4.2 Shtimi i shpenzimit / Add Expense

1. Shtypni butonin **+** (poshtë djathtas)
2. Plotësoni fushat:
   - **Emri** (i detyrueshëm) — p.sh. "Qira", "Drita", "Furnizim"
   - **Përshkrimi** (opsional)
   - **Shuma (€)** (i detyrueshëm)
   - **Data** (i detyrueshëm)
3. Shtypni **"Ruaj"**

> **Tip:** Nëse shtoni një shpenzim me të njëjtin **emër** dhe **datë**, ai do të bashkohet me atë ekzistues (shuma mblidhet). Kjo është e dobishme për furnizime të përsëritura.

**[insert screenshot: add expense dialog]**

### 4.3 Modifikimi / Edit

- Rrëshqitni majtas mbi një shpenzim
- Shtypni **"Modifiko"** (lapsi)
- Ndryshoni të dhënat dhe shtypni **"Ruaj"**

### 4.4 Fshirja / Delete

- Rrëshqitni majtas
- Shtypni **"Fshi"** (koshi)

---

## 5. Të Ardhurat / Income

Gjurmoni të ardhurat nga shërbimet.

**[insert screenshot: income list view]**

### 5.1 Shtimi i të ardhurave / Add Income

1. Shtypni **+** (poshtë djathtas)
2. Plotësoni:
   - **Shërbimi** — zgjidhni nga lista ose shkruani manualisht
   - **Klienti** (opsional) — shkruani emrin dhe do të krijohet automatikisht nëse nuk ekziston
   - **Çmimi (€)** (i detyrueshëm)
   - **Data** (i detyrueshëm)
3. Shtypni **"Ruaj"**

**[insert screenshot: add income dialog]**

### 5.2 Fatura / Invoice

- Rrëshqitni majtas → shtypni **"Faturë"**
- Gjeneron një PDF me të dhënat e transaksionit

### 5.3 Modifikimi / Fshirja

- Rrëshqitni majtas për **Modifiko** ose **Fshi**

---

## 6. Takimet / Appointments

Menaxhoni takimet e klientëve.

**[insert screenshot: appointments list view]**

### 6.1 Shtimi i takimit / Add Appointment

1. Shtypni **+** (poshtë djathtas)
2. Plotësoni:
   - **Emri** — shkruani emrin e klientit (autocomplete nga lista e klientëve)
   - **Telefoni** — opsional
   - **Shërbimi** — zgjidhni nga lista ose shkruani manualisht
   - **Data** — data e takimit
   - **Ora** — koha e takimit
   - **Punëtori** (opsional) — zgjidhni nga lista
   - **Shërbime shtesë** (opsionale) — shtoni rreshta me emër + çmim
3. Shtypni **"Ruaj"**

> **Shënim:** Nëse ora e takimit përputhet me një takim tjetër, do të shfaqet paralajmërim.

**[insert screenshot: add appointment dialog]**

### 6.2 Statuset / Statuses

| Status | Veprimi |
|---|---|
| **Në pritje** | ✅ Përfundo / ❌ Anulo |
| **Përfunduar** | Badge jeshil, nuk mund të ndryshohet pa rikthim |
| **Anuluar** | Badge gri, tekst i vijëzuar |

### 6.3 Detajet / Details

Klikoni një takim për ta zgjeruar dhe parë:
- Shërbimi dhe çmimi
- Shërbimet shtesë
- Totali
- Butonat: **Rikthe** (për të hapur sërish), **Modifiko**, **Fshi**

### 6.4 Telefonata / Call

Nëse klienti ka numër telefoni, shfaqet butoni i telefonit për të thirrur direkt.

---

## 7. Produktet / Products

Menaxhoni inventarin dhe stokun.

**[insert screenshot: products list view]**

### 7.1 Shtimi i produktit / Add Product

1. Shkoni te **Më shumë → Produktet**
2. Shtypni **+**
3. Plotësoni:
   - **Emri** (i detyrueshëm)
   - **Sasia** — sasia fillestare në stok
   - **Çmimi për njësi (€)** (i detyrueshëm)
   - **Zbritje automatike** — sa takime të kryera duhen për të zbritur 1 njësi (0 = jo automatik)
4. Shtypni **"Ruaj"**

**[insert screenshot: add product dialog]**

### 7.2 Rregullimi i stokut / Stock Adjust

- Shtypni **+** ose **−** pranë sasisë për të shtuar/pakësuar stokun
- Kur shtoni stok, krijohet automatikisht një shpenzim i kategorisë **"Furnizim"**
- **E rëndësishme:** Nëse shtoni stok të të njëjtit produkt gjatë të njëjtës ditë, shpenzimet bashkohen në një rresht të vetëm (sasia dhe shuma mblidhen)

**[insert screenshot: product with +/- buttons]**

### 7.3 Njoftimi për stok të ulët

- Produktet me sasi nën limitin e caktuar shënohen me kufi portokalli dhe ikonë paralajmëruese
- Njoftimi shfaqet në Ballinë dhe si njoftim në shfletues (nëse lejohet)

---

## 8. Klientët / Clients

Lista e klientëve me historik.

**[insert screenshot: clients list view]**

### 8.1 Shtimi i klientit / Add Client

1. Shkoni te **Më shumë → Klientët**
2. Shtypni **+**
3. Shkruani **Emrin** dhe **Telefonin** (opsional)
4. Shtypni **"Ruaj"**

### 8.2 Detajet e klientit / Client Details

Klikoni një klient për të parë:
- Totali i shpenzuar
- Numri i vizitave
- Historiku i të ardhurave (shërbimet e kryera)

### 8.3 Kërkimi / Search

Përdorni search bar-in për të gjetur klientët shpejt.

---

## 9. Shërbimet / Services

Lista e shërbimeve me çmime dhe kohëzgjatje.

**[insert screenshot: services list view]**

### 9.1 Shtimi i shërbimit / Add Service

1. Shkoni te **Më shumë → Shërbimet**
2. Shtypni **+**
3. Plotësoni:
   - **Emri** (i detyrueshëm) — p.sh. "Manikyr klasik"
   - **Çmimi (€)** (i detyrueshëm)
   - **Kohëzgjatja (minuta)** (opsional)
4. Shtypni **"Ruaj"**

---

## 10. Analitika / Analytics

Grafikë dhe statistika për biznesin tuaj.

**[insert screenshot: analytics full view]**

### 10.1 Periudha / Period

- Zgjidhni: **Ditor / Javor / Mujor / Vjetor**
- Përdorni shigjetat për të kaluar në periudhën paraardhëse/pasonjëse
- Shtypni **"Sot"** për t'u kthyer te periudha aktuale

### 10.2 Grafikët / Charts

| Grafiku | Përshkrimi |
|---|---|
| **Shiritat** | Krahason të ardhurat (jeshile) dhe shpenzimet (trëndafil) |
| **Pie chart** | Shërbimet më të kërkuara |
| **Top klientët** | Lista e klientëve më të mirë (sipas xhiros) |
| **Dita më e mirë** | Dita me xhiron më të lartë |

### 10.3 Shkarkimi i raportit PDF / Download PDF Report

Shtypni **"Shkarko Raportin"** për të gjeneruar një PDF të plotë me:
- Të ardhurat dhe shpenzimet
- Fitimin neto
- Transaksionet e detajuara

**[insert screenshot: download PDF button]**

---

## 11. Cilësimet / Settings

Shkoni te **Më shumë → Cilësimet** për të konfiguruar aplikacionin.

**[insert screenshot: settings overview]**

### 11.1 Menaxhimi i punëtorëve (vetëm owner)

- Lista e punëtorëve me status (aktiv / në pritje)
- **Mirato** — aktivizon llogarinë e punëtorit
- **Modifiko** — ndryshon emrin, username-in, rolin ose fjalëkalimin
- **Fshi** — largon punëtorin

**[insert screenshot: worker management]**

### 11.2 Preferencat

| Opsioni | Përshkrimi |
|---|---|
| **Gjuha** | Shqip / English |
| **Dark Mode** | Ndryshon pamjen në errësirë |

### 11.3 Njoftimet

Lejon/Pengon njoftimet në shfletues për:
- **Takimet** — njofto para takimit (X minuta para)
- **Stokun e ulët** — njofto kur produktet janë nën limit
- **Test** — dërgon një njoftim testues

### 11.4 Saloni (vetëm owner)

| Fusha | Përshkrimi |
|---|---|
| **Emri i sallonit** | Shfaqet në Ballinë dhe në raporte |
| **Limit i stokut të ulët** | Numri minimal i sasisë për njoftim |

### 11.5 Email Raport (EmailJS) (vetëm owner)

Konfiguroni dërgimin automatik të raporteve me email:

1. **Aktivizoni** Email Raport
2. Plotësoni:
   - **Service ID** — nga EmailJS
   - **Template ID** — nga EmailJS
   - **Public Key** — nga EmailJS
   - **Recipient Email** — ku të dërgohet raporti
   - **Sender Name** — emri i dërguesit
3. **Orari i dërgimit:**
   - **Frekuenca:** Ditor / Javor / Mujor / Vjetor
   - **Ora:** Kur të dërgohet
   - **Dita e javës:** (për javor)
   - **Dita e muajit:** (për mujor)
   - **Muaji + Dita:** (për vjetor)
4. Shtypni **"Ruaj"**
5. Testoni me **"Dërgo Raportin Tani"**

**[insert screenshot: email settings config]**

**Variablat e template-it EmailJS:**

| Variabël | Përshkrimi |
|---|---|
| `{{subject}}` | Titulli i email-it |
| `{{to_email}}` | Email-i i marrësit |
| `{{from_name}}` | Emri i dërguesit |
| `{{salon_name}}` | Emri i sallonit |
| `{{report_period}}` | Periudha e raportit |
| `{{total_income}}` | Të ardhurat totale |
| `{{total_expense}}` | Shpenzimet totale |
| `{{profit}}` | Fitimi |
| `{{profit_color}}` | Ngjyra e fitimit (#16a34a ose #dc2626) |
| `{{services_count}}` | Numri i shërbimeve |
| `{{completed_count}}` | Të përfunduara |
| `{{canceled_count}}` | Të anuluara |
| `{{top_services}}` | Lista e shërbimeve më të mira (tekst) |
| `{{top_clients}}` | Lista e klientëve më të mirë (tekst) |
| `{{send_date}}` | Data e dërgimit |
| `{{report_html}}` | HTML i plotë i raportit |

### 11.6 Llogaria

- Ndryshoni emrin tuaj
- Dilni nga llogaria

---

## 12. Raportet PDF / PDF Reports

Aplikacioni gjeneron dy lloje PDF:

### 12.1 Raporti i periudhës / Period Report

- Nga **Analitika → Shkarko Raportin**
- Përmban: të ardhura, shpenzime, fitim, transaksione të detajuara
- Kolorit: burgundy/krem, logo, helmetë

### 12.2 Fatura / Invoice

- Nga **Të ardhurat** → Rrëshqit → **Faturë**
- Përmban: emri i sallonit, numri faturës, data, klienti, shërbimet, totali

**[insert screenshot: sample PDF report]**

---

## 13. Raportet Email / Email Reports

### 13.1 Dërgimi automatik / Auto-send

Pasi të keni konfiguruar EmailJS te Cilësimet:
- Raporti dërgohet automatikisht në orarin e caktuar
- Frekuencat: Ditor, Javor, Mujor, Vjetor
- Përdor kosovare kohore (Europe/Berlin)

### 13.2 Dërgimi manual / Send Now

- Shtypni **"Dërgo Raportin Tani"** për të dërguar menjëherë

### 13.3 Template-i EmailJS / EmailJS Template

Për të krijuar template-in në [EmailJS](https://www.emailjs.com):

**Subject:**
```
{{subject}}
```

**Content (HTML):** Përdorni template-in responsive të dhënë më poshtë. Sigurohuni që të përdorni vetëm variabla të thjeshta `{{variable}}` (pa `{{#each}}`).

**[insert screenshot: EmailJS template editor]**

---

## 14. Njoftimet / Notifications

### 14.1 Njoftimet në shfletues / Browser Notifications

Aplikacioni dërgon njoftime për:
- **Takimet:** X minuta para takimit (konfigurohet te Cilësimet)
- **Stokun e ulët:** Kur produktet janë nën limit

**Si të lejoni njoftimet:**
1. Shkoni te **Cilësimet → Njoftimet**
2. Shtypni **"Lejo"** nëse shfletuesi kërkon leje
3. Aktivizoni **"Njoftimet e takimeve"** dhe/ose **"Stoku i ulët"**

**[insert screenshot: notification permission prompt]**

### 14.2 Njoftimet në server / Web Push (Cron)

Për përdorim më të avancuar, mund të konfiguroni cron për të dërguar njoftime push:
- Endpoint: `/api/cron/reminders`
- Kërkon `CRON_SECRET` në header-in e autorizimit
- Kontrollon takimet dhe stokun e ulët

---

## 15. Këshilla / Tips & Troubleshooting

### 15.1 Problemet e zakonshme / Common Issues

| Problemi | Zgjidhja |
|---|---|
| **Njoftimet nuk funksionojnë** | Lejo njoftimet në cilësimet e shfletuesit |
| **Email nuk dërgohet** | Verifiko Service ID, Template ID, Public Key te Cilësimet |
| **Template-i EmailJS jep gabim** | Përdor vetëm `{{variable}}`, jo `{{#each}}` |
| **Nuk shoh të dhënat** | Sigurohu që je kyçur si pronar (owner) |
| **Takimi nuk ruhet** | Plotëso të 4 fushat e detyrueshme (emri, shërbimi, data, ora) |
| **Stoku nuk zbritet automatikisht** | Cakto "Zbrit 1 njësi çdo X takime" në produkt |

### 15.2 Këshilla / Tips

- **Përdorni funksionin e bashkimit të shpenzimeve:** Nëse shtoni të njëjtin shpenzim disa herë në të njëjtën ditë, ai bashkohet automatikisht
- **Shtoni shërbime fillimisht:** Para se të krijoni takime, sigurohuni që shërbimet janë të listuara
- **Instaloni si aplikacion:** Për përvojë më të mirë në telefon, instaloni PWA
- **Eksportoni rregullisht:** Përdorni butonin e PDF për të ruajtur raporte

### 15.3 Kontakt / Support

Për ndihmë shtesë, kontaktoni zhvilluesin e aplikacionit.

---

© Sparta Royale 2026
