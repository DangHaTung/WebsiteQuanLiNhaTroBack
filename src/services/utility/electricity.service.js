// Electricity cost calculation service
// Default tier rates per instruction (VND/kWh)
export const DEFAULT_ELECTRICITY_TIERS = [
  { min: 0, max: 50, rate: 1984 },
  { min: 51, max: 100, rate: 2050 },
  { min: 101, max: 200, rate: 2380 },
  { min: 201, max: 300, rate: 2998 },
  { min: 301, max: 400, rate: 3350 },
  { min: 401, max: undefined, rate: 3460 },
];

/**
 * Calculate electricity cost using tiered rates and VAT.
 * @param {number} kwh - Total consumption in kWh.
 * @param {Array<{min:number,max?:number,rate:number}>} tiers - Tier configuration.
 * @param {number} vatPercent - VAT percentage (default 8).
 * @returns {{
 *  items: Array<{tier:number,from:number,to:number|undefined,kwh:number,rate:number,amount:number}>,
 *  subtotal:number,
 *  vat:number,
 *  total:number
 * }}
 */
export function calculateElectricityCost(kwh, tiers = DEFAULT_ELECTRICITY_TIERS, vatPercent = 8) {
  const items = [];
  let remaining = Math.max(0, Number(kwh) || 0);
  let subtotal = 0;

  tiers.forEach((t, idx) => {
    if (remaining <= 0) return;
    // Tính số kWh tối đa trong bậc này
    // Bậc 1 (0-50): max = 50, vì đếm từ kWh thứ 1
    // Bậc 2 (51-100): max - min + 1 = 100 - 51 + 1 = 50
    const cap = t.max != null 
      ? (t.min === 0 ? t.max : t.max - t.min + 1)
      : Infinity;
    const used = Math.min(remaining, cap);
    const amount = used * t.rate;
    items.push({
      tier: idx + 1,
      from: t.min,
      to: t.max,
      kwh: used,
      rate: t.rate,
      amount,
    });
    subtotal += amount;
    remaining -= used;
  });

  const vat = Math.round((subtotal * vatPercent) / 100);
  const total = subtotal + vat;

  return { items, subtotal, vat, total };
}