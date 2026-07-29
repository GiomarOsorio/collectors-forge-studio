"""
Reconciliación del stock de filamento por bobinas (issue #214).

Modelo mental del usuario: el stock de un filamento es **N bobinas sin abrir
+ 1 bobina abierta con ~R gramos**. Eso se guarda en tres campos del
`InventoryItem`:

    sealed_spools     int      — bobinas sin abrir (selladas)
    open_remaining_g  numeric  — gramos de la bobina abierta (NULL = ninguna)
    min_spools        int      — mínimo de stock, en bobinas

Estos campos son la **fuente de verdad**. Los campos históricos en gramos
(`quantity`, `min_quantity`) se mantienen **derivados** para no romper la
deducción automática, `low_stock` ni la calculadora:

    quantity     = sealed_spools * weight_per_roll + (open_remaining_g or 0)
    min_quantity = min_spools    * weight_per_roll

Todo esto aplica SOLO a ítems de categoría Filamento con `weight_per_roll`
definido (> 0). Para el resto, las funciones son no-op y el stock sigue
comportándose como gramos/unidades sueltas de siempre.

Precedencia con bobinas detalladas (`Spool`, issue #134): si el ítem usa
tracking por-bobina, ESE sistema manda para el stock mostrado; estos campos
simples quedan como respaldo. Ver docstring de `Spool`.
"""

from decimal import Decimal
from math import ceil
from typing import Optional


def _weight(item) -> Optional[Decimal]:
    """Peso por bobina como Decimal, o None si el ítem no usa modelo de bobinas."""
    w = getattr(item, "weight_per_roll", None)
    if w is None:
        return None
    w = Decimal(str(w))
    return w if w > 0 else None


def _dec(value) -> Decimal:
    return Decimal("0") if value is None else Decimal(str(value))


def normalize_from_counts(item) -> None:
    """Los conteos son la verdad → deriva `quantity`/`min_quantity`.

    Clampea `open_remaining_g` a `[0, weight]`, cargando el sobrante a
    `sealed_spools` (ej. si alguien pone open = 1200 con bobina de 1000,
    queda +1 sellada y open = 200). Deja `open_remaining_g = None` cuando la
    bobina abierta queda en 0.
    """
    w = _weight(item)
    if w is None:
        return

    sealed = int(item.sealed_spools or 0)
    open_g = _dec(item.open_remaining_g)

    if open_g < 0:
        open_g = Decimal("0")
    while open_g > w:
        open_g -= w
        sealed += 1
    if sealed < 0:
        sealed = 0

    item.sealed_spools = sealed
    item.open_remaining_g = None if open_g == 0 else open_g
    item.quantity = sealed * w + open_g
    item.min_quantity = int(item.min_spools or 0) * w


def derive_counts_from_grams(item) -> None:
    """`quantity`/`min_quantity` (gramos, legacy) son la verdad → deriva conteos.

    Usado en caminos que mueven gramos directamente (import, ajuste manual,
    ítems creados por el frontend viejo). Reparte los gramos en bobinas
    llenas + resto en la abierta.
    """
    w = _weight(item)
    if w is None:
        return

    q = _dec(item.quantity)
    if q < 0:
        q = Decimal("0")
    sealed = int(q // w)
    open_g = q - sealed * w

    item.sealed_spools = sealed
    item.open_remaining_g = None if open_g == 0 else open_g

    mq = _dec(item.min_quantity)
    item.min_spools = int(ceil(mq / w)) if mq > 0 else 0


def available_grams(item) -> Decimal:
    """Gramos totales disponibles (== `quantity`, que se mantiene en sync)."""
    return _dec(item.quantity)


def deduct_grams(item, grams) -> Decimal:
    """Consume `grams` del filamento con modelo de bobinas.

    Vacía primero la bobina abierta; al agotarse, abre una sellada
    (rollover). Recalcula `quantity`. Devuelve el sobrante NO cubierto
    (Decimal, 0 si alcanzó) — el caller decide si eso es error de stock.

    Para ítems sin modelo de bobinas (weight_per_roll None), resta de
    `quantity` directo, como antes.
    """
    grams = _dec(grams)
    w = _weight(item)
    if w is None:
        item.quantity = _dec(item.quantity) - grams
        return Decimal("0")

    # Salvaguarda: ítem con gramos pero sin conteos inicializados (datos
    # pre-backfill o creados por un flujo viejo) — reconstruye conteos antes
    # de consumir, si no vaciaríamos la bobina abierta que "no existe".
    if int(item.sealed_spools or 0) == 0 and item.open_remaining_g is None and _dec(item.quantity) > 0:
        derive_counts_from_grams(item)

    remaining = grams
    open_g = _dec(item.open_remaining_g)
    sealed = int(item.sealed_spools or 0)

    while remaining > 0:
        if open_g <= 0:
            if sealed > 0:
                sealed -= 1
                open_g = w
            else:
                break  # sin stock: cortamos, el resto es shortfall
        take = min(open_g, remaining)
        open_g -= take
        remaining -= take

    item.sealed_spools = sealed
    item.open_remaining_g = None if open_g == 0 else open_g
    item.quantity = sealed * w + open_g
    return remaining


def add_sealed_spools(item, count: int) -> None:
    """Suma `count` bobinas selladas al stock (llegada de compra) y re-deriva gramos."""
    w = _weight(item)
    if w is None:
        return
    item.sealed_spools = int(item.sealed_spools or 0) + int(count)
    normalize_from_counts(item)
