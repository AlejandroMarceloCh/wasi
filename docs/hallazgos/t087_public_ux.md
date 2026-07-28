# T087 — Public: UX (onboarding, claridad del primer paso)

**TARGET:** `app/screens-public.jsx` + `app/app.jsx`  
**LENTE:** ux  
**Fecha:** 2026-07-06

---

## Resumen

El embudo splash → registro → home por rol funciona (`computeRoleHome` en `app.jsx`). El primer paso post-auth no se anticipa en copy, los requisitos de contraseña llegan tarde, y el splash enfatiza solo alquiler pese a venta ya soportada.

---

## Hallazgos

### [MEDIO] · Post-registro: destino distinto por rol sin aviso · `app.jsx:45-50,176` — inquilino → Explorar; propietario → Mis publicaciones. · Usuario nuevo no entiende por qué aterriza en un sitio u otro tras “Crear cuenta”. · Pantalla intermedia o línea en registro: “Como propietario irás a publicar tu primer aviso”.

### [MEDIO] · Requisitos de contraseña solo tras error del servidor · `screens-public.jsx:148,157-159` — placeholder genérico `••••••••`. · Fricción en primer intento (422 password corto). · Hint bajo campo: “Mínimo 8 caracteres”.

### [MEDIO] · Splash y auth centrados en alquiler · `screens-public.jsx:12-14,113-115` — “próximo alquiler”, “precio de referencia” sin mencionar venta/publicar. · Propietarios o compradores no ven su caso en el primer contacto. · Subcopy dual: “alquiler o venta en Lima”.

### [BAJO] · Selector de rol sin descripción · `screens-public.jsx:149-155` — Inquilino / Propietario / Agente sin tooltip. · Elección incorrecta → nav incorrecta hasta editar perfil. · Una línea por opción en el dropdown o cards de rol.

### [BAJO] · “Comenzar gratis” vs “Ya tengo cuenta” compiten en splash · `screens-public.jsx:17-20` — jerarquía clara pero sin indicar que ambos llevan a auth. · Usuarios buscan explorar sin cuenta (catálogo público no expuesto en splash). · Tercer CTA “Explorar sin cuenta” si el catálogo es público.

### [BAJO] · Panel lateral auth largo en móvil antes del form · `screens-public.jsx:110-129` + `styles.css:2154-2155` — `auth-side` sigue visible arriba del form en 1 columna. · Mucho scroll hasta email/contraseña; abandono en onboarding móvil. · Colapsar quote en móvil o form primero.

### [INFO] · Splash visual oculto ≤980px · `styles.css:2153`. · Form más accesible; pierde demo del gauge.

---

## Veredicto

Onboarding funcional pero opaco en **qué pasa después del registro** y **qué rol elegir**. Copy y hints de password son mejoras M de bajo esfuerzo con menos abandono en el primer minuto.
