// O documento não especifica fuso horário — assumido America/Sao_Paulo, já
// que todo o produto (textos, feriados nacionais, Airbnb) é para o mercado
// brasileiro. Sem DST desde 2019, então o offset é estável (UTC-3).
export const TIMEZONE = "America/Sao_Paulo";

export function getZonedParts(date: Date, timeZone: string = TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: get("year"),
    month: get("month") - 1,
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

// Offset (em minutos, convenção "GMT-3" = -180) entre UTC e `timeZone` no
// instante `date`. Calculado via Intl, sem depender do fuso horário do
// processo Node (process.env.TZ) — diferente do truque comum de fazer
// round-trip por toLocaleString + `new Date(string)`, que só funciona por
// acaso quando o processo já está rodando em UTC.
function getOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(date);
  const offset =
    parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";
  const match = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(offset);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);
  return sign * (hours * 60 + minutes);
}

export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string = TIMEZONE,
): Date {
  const naiveUtc = new Date(Date.UTC(year, month, day, hour, minute));
  const offsetMinutes = getOffsetMinutes(naiveUtc, timeZone);
  return new Date(naiveUtc.getTime() - offsetMinutes * 60 * 1000);
}
