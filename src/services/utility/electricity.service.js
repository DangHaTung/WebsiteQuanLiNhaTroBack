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
    // Bậc 1 (0-50): từ kWh 1 đến 50 = 50 kWh (không tính 0)
    // Bậc 2 (51-100): từ kWh 51 đến 100 = 50 kWh
    // Bậc 3 (101-200): từ kWh 101 đến 200 = 100 kWh
    // Công thức: cap = max - min (vì min là giá trị bắt đầu, max là giá trị kết thúc)
    // Ví dụ: bậc 1 (0-50) = 50 - 0 = 50 kWh
    // Bậc 2 (51-100) = 100 - 51 = 49? Không, phải là 50
    // Thực tế: từ 51 đến 100 có 50 số = 100 - 51 + 1 = 50
    // Nhưng trong tính tiền điện, bậc 1 là từ 1-50 (50 kWh), bậc 2 là từ 51-100 (50 kWh)
    // Vậy công thức đúng: cap = max - min (nếu min = 0 thì cap = max), hoặc cap = max - min + 1 (nếu min > 0)
    let cap;
    if (t.max == null) {
      cap = Infinity;
    } else if (t.min === 0) {
      // Bậc 1: từ 0 đến 50 = 50 kWh (từ kWh 1 đến 50, không tính 0)
      cap = t.max;
    } else {
      // Bậc 2 trở đi: từ min đến max = max - min + 1 kWh (vì min và max đều inclusive)
      // Ví dụ: bậc 2 (51-100) = 100 - 51 + 1 = 50 kWh
      cap = t.max - t.min + 1;
    }
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