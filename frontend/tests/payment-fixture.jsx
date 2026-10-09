import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CustomerInvoices from '../src/pages/Customer/CustomerInvoices';
import CustomerPayments from '../src/pages/Customer/CustomerPayments';
import { api } from '../src/lib/api';
import '../src/index.css';
const invoice = { id: '507f1f77bcf86cd799439011', invoiceNumber: 'INV-TEST', serviceType: 'Oil service', serviceNumber: 'JOB-TEST', paymentStatus: 'Pending', parts: [], labourItems: [], partsCost: 1000, labourCost: 1000, tax: 0, totalAmount: 2000, amountDue: 2000, issuedAt: '2026-10-09T00:00:00Z', vehicle: { make: 'Toyota', model: 'Test car' } };
const scenario = new URLSearchParams(window.location.search).get('scenario');
if (scenario === 'zero') { invoice.totalAmount = 0; invoice.amountDue = 0; invoice.partsCost = 0; invoice.labourCost = 0; }
let payments = [];
api.defaults.adapter = async config => {
  let data;
  if (config.url === '/customer-invoices') data = [invoice];
  else if (config.url === '/customer-payments' && config.method === 'get') data = { invoices: scenario === 'missing' ? [] : [{ ...invoice, vehicle: 'Toyota Test car', pendingVerification: payments.length > 0 }], payments };
  else if (config.url === '/customer-payments' && config.method === 'post') {
    const body = JSON.parse(config.data);
    const payment = { ...body, id: 'test-payment', invoiceNumber: invoice.invoiceNumber, amount: 2000, status: 'Pending Verification', receiptNumber: 'RCPT-TEST', createdAt: new Date().toISOString(), message: 'Test submission recorded for verification.' };
    payments = [payment]; data = payment;
  } else throw new Error('Unexpected fixture request: ' + config.url);
  return { data, status: 200, statusText: 'OK', headers: {}, config };
};
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[scenario === 'missing' ? `/customer/payments?invoice=${invoice.id}` : '/customer/invoices']}><Routes><Route path="/customer/invoices" element={<CustomerInvoices />} /><Route path="/customer/payments" element={<CustomerPayments />} /></Routes></MemoryRouter>);
