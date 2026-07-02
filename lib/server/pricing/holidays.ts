export type Holiday = {
  date: string; // YYYY-MM-DD
  name: string;
  type: string;
};

// BrasilAPI — gratuita, sem chave, mantida pela comunidade. Usada só como
// dado de apoio para o gestor criar uma PriceRule de feriado na Etapa 6 (não
// entra no cálculo automático de preço).
const cache = new Map<number, Promise<Holiday[]>>();

export function getHolidays(year: number): Promise<Holiday[]> {
  let cached = cache.get(year);
  if (!cached) {
    cached = fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`BrasilAPI respondeu ${response.status}`);
        }
        return response.json() as Promise<Holiday[]>;
      })
      .catch((error) => {
        cache.delete(year);
        throw error;
      });
    cache.set(year, cached);
  }
  return cached;
}
