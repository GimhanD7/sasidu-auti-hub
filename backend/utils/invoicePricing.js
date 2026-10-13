const money = value => Math.round(value * 100) / 100;
const number = (value, label, max) => {
  if (!['number', 'string'].includes(typeof value) || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > max) throw new Error(`Enter a valid ${label}.`);
  return Number(value);
};
const text = (value, label, max) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`Enter a valid ${label}.`);
  return value.trim();
};

// Recalculate every line on the server. Client-supplied totals never determine billing.
export function invoicePricing(body, existing) {
  const changes = {};
  if (body.parts !== undefined) {
    if (!Array.isArray(body.parts) || body.parts.length > 500 || body.parts.length !== (existing.parts || []).length) throw new Error('Price each recorded spare part.');
    changes.parts = body.parts.map((part, index) => {
      const original = existing.parts[index];
      if (!part || part.name !== original.name || Number(part.quantity) !== Number(original.quantity) || (part.partNumber || '') !== (original.partNumber || '')) throw new Error('Recorded spare-part details cannot be changed through pricing.');
      const quantity = number(original.quantity, 'part quantity', 10000);
      const unitPrice = money(number(part.unitPrice, 'spare-part unit price', 100000000));
      return { name: original.name, partNumber: original.partNumber || '', quantity, unitPrice, total: money(quantity * unitPrice) };
    });
    changes.partsCost = money(changes.parts.reduce((sum, item) => sum + item.total, 0));
  }
  if (body.labourItems !== undefined) {
    if (!Array.isArray(body.labourItems) || body.labourItems.length > 100) throw new Error('Enter no more than 100 labour lines.');
    changes.labourItems = body.labourItems.map(item => {
      if (!item) throw new Error('Enter a valid labour line.');
      const description = text(item.description, 'labour description', 200);
      const hours = number(item.hours, 'labour hours', 8760);
      const rate = money(number(item.rate, 'hourly rate', 100000000));
      return { description, hours, rate, total: money(hours * rate) };
    });
    changes.labourCost = money(changes.labourItems.reduce((sum, item) => sum + item.total, 0));
  }
  return changes;
}
