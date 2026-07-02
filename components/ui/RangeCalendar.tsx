"use client";

import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useMemo, useState } from "react";

export type DateRange = { checkIn: Date | null; checkOut: Date | null };

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
// timeZone: "UTC" é necessário porque a grade de dias é construída inteira
// em UTC (Date.UTC) — sem isso, o rótulo do mês usa o fuso local do
// navegador e pode mostrar o mês errado para qualquer fuso negativo (ex:
// Brasil, UTC-3): meia-noite UTC do dia 1 cai no fim do dia anterior, no
// fuso local.
const MONTH_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function toKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function buildMonthGrid(monthStart: Date): (Date | null)[] {
  const firstWeekday = monthStart.getUTCDay();
  const daysInMonth = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
  ).getUTCDate();

  const cells: (Date | null)[] = Array.from(
    { length: firstWeekday },
    () => null,
  );
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(
      new Date(
        Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day),
      ),
    );
  }
  return cells;
}

// Calendário com seleção de intervalo (design-ui-ux.md, seção 3.3): dias
// ocupados em cinza com texto tachado; intervalo selecionado em "pílula
// contínua" (arredondado só nas extremidades).
export function RangeCalendar({
  occupiedRanges,
  value,
  onChange,
}: {
  occupiedRanges: { checkIn: string; checkOut: string }[];
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date()),
  );

  const occupiedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const range of occupiedRanges) {
      const cursor = new Date(range.checkIn);
      const end = new Date(range.checkOut);
      while (cursor < end) {
        keys.add(toKey(cursor));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }
    return keys;
  }, [occupiedRanges]);

  const today = startOfMonth(new Date());
  const cells = buildMonthGrid(visibleMonth);

  function isOccupied(date: Date) {
    return occupiedKeys.has(toKey(date));
  }

  function isPast(date: Date) {
    return toKey(date) < toKey(new Date());
  }

  function handleClick(date: Date) {
    if (isOccupied(date) || isPast(date)) return;

    if (!value.checkIn || (value.checkIn && value.checkOut)) {
      onChange({ checkIn: date, checkOut: null });
      return;
    }

    if (date <= value.checkIn) {
      onChange({ checkIn: date, checkOut: null });
      return;
    }

    onChange({ checkIn: value.checkIn, checkOut: date });
  }

  function cellState(date: Date) {
    const isCheckIn = value.checkIn && toKey(date) === toKey(value.checkIn);
    const isCheckOut = value.checkOut && toKey(date) === toKey(value.checkOut);
    const isInRange =
      value.checkIn &&
      value.checkOut &&
      date > value.checkIn &&
      date < value.checkOut;

    if (!isCheckIn && !isCheckOut && !isInRange) return "none";
    if (isCheckIn && isCheckOut) return "single";
    if (isCheckIn) return "start";
    if (isCheckOut) return "end";
    return "middle";
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() =>
            setVisibleMonth(
              (current) =>
                new Date(
                  Date.UTC(
                    current.getUTCFullYear(),
                    current.getUTCMonth() - 1,
                    1,
                  ),
                ),
            )
          }
          disabled={
            visibleMonth.getUTCFullYear() === today.getUTCFullYear() &&
            visibleMonth.getUTCMonth() === today.getUTCMonth()
          }
          className="rounded-pill p-1.5 text-text-secondary disabled:opacity-30"
        >
          <IconChevronLeft size={18} />
        </button>
        <span className="text-card-title font-semibold text-text-primary">
          {/* só a primeira letra maiúscula — "capitalize" do Tailwind deixaria "Maio De 2026" */}
          {MONTH_FORMATTER.format(visibleMonth).replace(/^./, (char) =>
            char.toUpperCase(),
          )}
        </span>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={() =>
            setVisibleMonth(
              (current) =>
                new Date(
                  Date.UTC(
                    current.getUTCFullYear(),
                    current.getUTCMonth() + 1,
                    1,
                  ),
                ),
            )
          }
          className="rounded-pill p-1.5 text-text-secondary"
        >
          <IconChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-caption text-text-secondary">
        {WEEKDAY_LABELS.map((label, index) => (
          <div key={index} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((date, index) => {
          if (!date) return <div key={index} />;

          const occupied = isOccupied(date);
          const past = isPast(date);
          const state = cellState(date);

          return (
            <button
              key={index}
              type="button"
              disabled={occupied || past}
              onClick={() => handleClick(date)}
              className={[
                "py-2 text-body",
                state === "none" ? "" : "bg-accent text-accent-text",
                state === "single" ? "rounded-full" : "",
                state === "start" ? "rounded-l-full" : "",
                state === "end" ? "rounded-r-full" : "",
                occupied
                  ? "bg-border text-text-secondary line-through"
                  : past
                    ? "text-text-secondary opacity-40"
                    : state === "none"
                      ? "text-text-primary"
                      : "",
              ].join(" ")}
            >
              {date.getUTCDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
