import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountDue, canPayInvoice } from '../src/lib/invoicePayment.js';

test('payment links require an open invoice with a positive balance', () => {
  assert.equal(canPayInvoice({ paymentStatus: 'Pending', totalAmount: 0 }), false);
  assert.equal(canPayInvoice({ paymentStatus: 'Pending', totalAmount: 100, amountPaid: 100 }), false);
  assert.equal(canPayInvoice({ paymentStatus: 'Pending', totalAmount: 100, amountPaid: 25 }), true);
  assert.equal(canPayInvoice({ paymentStatus: 'Paid', amountDue: 100 }), false);
  assert.equal(canPayInvoice({ paymentStatus: 'Draft', amountDue: 100 }), false);
  assert.equal(canPayInvoice({ paymentStatus: 'Overdue', amountDue: 100 }), true);
  assert.equal(amountDue({ totalAmount: '100', amountPaid: '25' }), 75);
  assert.equal(amountDue({ totalAmount: 'invalid' }), 0);
});
