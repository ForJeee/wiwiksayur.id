export const fmtQty = (qty, unit) => {
  if (unit === "kg") {
    const g = Math.round(qty * 1000);
    return g < 1000 ? `${g} g` : `${parseFloat((g / 1000).toFixed(3))} kg`;
  }
  return `${qty} ${unit}`;
};

export const lineTotal = (price, qty) => Math.round(price * qty);

export const KG_PRESETS = [
  { label: "250 g", kg: 0.25 },
  { label: "500 g", kg: 0.5 },
  { label: "1 kg", kg: 1 },
  { label: "2 kg", kg: 2 },
];
