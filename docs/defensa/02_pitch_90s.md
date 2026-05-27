# Elevator Pitch — 90 segundos

> **Plantilla:** U2 slides 42-45.
> **Audiencia:** jurado del curso DS3022.
> **Tiempo objetivo:** 90 s. Si llegás a 95-100, está bien. Si pasás 110, cortar.

---

## Versión final (memorizable)

```
[GANCHO · ~10s]

Cualquiera que haya alquilado en Lima conoce esta escena:
un agente te dice "ese es el precio del mercado",
vos no tenés cómo contrastarlo,
y al final firmás un contrato que pesa el 30 % de tu sueldo
basado en la palabra de alguien que cobra comisión.

[PROBLEMA · ~15s]

El 41 % del mercado de alquileres de Lima está concentrado en 2 distritos.
En el otro 59 %, la información es opaca:
no hay forma honesta de saber si te están inflando el precio.

[SOLUCIÓN · ~25s]

ubIcA cruza 3,348 listings reales con cuatro fuentes públicas:
INEI para nivel socioeconómico,
MININTER para denuncias del distrito,
CENACOM para comisarías,
y OpenStreetMap para 11,100 puntos de interés.

Un modelo XGBoost de 95 features estima el precio de referencia,
y un modelo de cuantiles te muestra el rango probable —
no un número falsamente preciso, un intervalo honesto.

[PROPUESTA DE VALOR · ~15s]

MAPE 15,7 %, R cuadrado 0.86 sobre el test.
Y cuando la zona tiene poca data — La Planicie, Casuarinas —
no inventamos.
Aparece un banner amarillo:
"cobertura baja, tomá esto como referencia, no como precio".
Mentir cuesta más que callar.

[CTA · ~15s]

El producto está vivo:
arrastrás un pin, ves el rango y el contexto en menos de 1 segundo,
con contrafactuales para entender qué cambia si tu depto tuviera
1 baño más o 10 años menos.
Tres pantallas, sesenta y tres tests, cero APIs pagas.
```

---

## Versión más corta (60 s, si te pasás)

```
El 41 % del mercado de alquileres de Lima está en 2 distritos.
En el resto, la info es opaca.

ubIcA cruza 3,348 listings con INEI, MININTER, CENACOM y OpenStreetMap.
XGBoost con 95 features predice el precio,
y un modelo de cuantiles te muestra el rango — no un número solo.

MAPE 15,7 %, R cuadrado 0.86.
Cuando hay poca data, banner amarillo: "cobertura baja, referencia, no precio".
Mentir cuesta más que callar.

Es un prototipo funcional: pin en el mapa, rango, contexto, en menos de 1 s.
Tres pantallas, sesenta y tres tests, cero APIs pagas.
```

---

## Tips de delivery

- **Tono:** firme, no apologético. No "espero que les guste" — "es lo que construimos".
- **Pausa después del gancho.** El jurado tiene que registrar la escena del agente antes que sigas.
- **Énfasis en los números:** "tres mil trescientos cuarenta y ocho listings" — leerlo separado, no "3-3-4-8".
- **No leerlo del papel.** Saberlo de memoria pero hablarlo como si lo estuvieras pensando.
- **Si te bloqueás en "MAPE 15,7"** — el reemplazo natural es "error medio del 15 % aproximadamente".
- **Final:** "menos de un segundo" es un dato verificable que cierra fuerte. No agregar nada después.

---

## Variantes si el jurado interrumpe

**Si te preguntan a mitad ("¿y qué hacés con la baja cobertura?"):**
> "Justo lo que iba a mostrar — confidence baja dispara un banner amarillo, y los contrafactuales se ajustan al P50 del modelo de cuantiles. Te lo demuestro con un pin en La Planicie en 20 segundos."

**Si te interrumpen ("¿por qué XGBoost?"):**
> "Cerramos un Gate de selección comparando 5 modelos. XGBoost ganó por MAPE en 5 de 6 rangos de precio. Lo tengo documentado en `gate6_resultado.md`."

**Si el jurado parece bored:**
> Cortás el pitch, decís "permítanme mostrarles en vivo" y vas directo a la demo. El producto vende mejor que las palabras.

---

## Métricas memorizadas (no fallar)

| Métrica | Valor |
|---------|-------|
| Listings | 3,348 |
| Distritos cubiertos | 40 |
| Features del modelo | 95 |
| MAPE | 15,7 % |
| R² | 0,86 |
| MAE | $158 |
| Concentración Miraflores + San Isidro | 41 % |
| POIs OSM | 11,100 |
| Tests pytest | 63 |
| Latencia /predict | <1 s |

**Si confundís uno, no corrijás en medio.** Decí el dato como salió y seguí. Solo si el jurado te corrige, asentís y aclarás.
