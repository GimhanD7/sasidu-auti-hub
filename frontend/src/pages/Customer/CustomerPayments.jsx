// Submit bank-transfer evidence or a pay-at-workshop request, then display verification status and payment receipts.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
const money = (value) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
const dateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

function downloadReceipt(payment, invoice) {
  const completed = payment.status === 'Completed';
  const lines = [
    completed
      ? 'AUTOSERV PRO — PAYMENT RECEIPT'
      : 'AUTOSERV PRO — PAYMENT SUBMISSION ACKNOWLEDGMENT',
    `Receipt/reference: ${payment.receiptNumber}`,
    `Invoice: ${invoice?.invoiceNumber || payment.invoiceNumber || payment.invoiceId}`,
    `Amount: ${money(payment.amount)}`,
    `Method: ${payment.method}`,
    `Transaction reference: ${payment.transactionReference}`,
    `Status: ${payment.status}`,
    `Submitted: ${dateTime(payment.createdAt)}`,
    ...(payment.reviewedAt ? [`Reviewed: ${dateTime(payment.reviewedAt)}`] : []),
    ...(payment.failureReason ? [`Review note: ${payment.failureReason}`] : []),
    '',
    completed
      ? 'Payment confirmed by the workshop.'
      : payment.status === 'Failed'
        ? 'This payment was not confirmed. Contact the workshop or submit a new payment.'
        : 'This is not a final receipt. Payment is pending workshop verification.',
  ];
  const url = URL.createObjectURL(
    new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${payment.receiptNumber.toLowerCase()}-receipt.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CustomerPayments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedInvoice = searchParams.get('invoice') || '';
  const [data, setData] = useState(null);
  const selectedId = requestedInvoice || data?.invoices[0]?.id || '';
  const [method, setMethod] = useState('Bank Transfer');
  const [transactionReference, setTransactionReference] = useState('');
  const [slipFile, setSlipFile] = useState(null); // { data, fileName, contentType, fileSize }
  const [slipError, setSlipError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const selectedInvoice = data?.invoices.find((invoice) => invoice.id === selectedId);
  const selectedPendingPayment = data?.payments.find(
    (payment) => payment.invoiceId === selectedId && payment.status === 'Pending Verification',
  );

  // Load server data when these effect dependencies change; cleanup below prevents stale work from updating this view.
  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/customer-payments', { signal: controller.signal })
      .then(({ data: response }) => {
        if (!controller.signal.aborted) {
          setData(response);
          setError('');
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err.response?.data?.message || 'Unable to load payment options.');
      });
    return () => controller.abort();
  }, [retry]);

  const handleSlipChange = (event) => {
    const file = event.target.files?.[0];
    setSlipError('');
    if (!file) return;

    if (file.size > 7 * 1024 * 1024) {
      setSlipError('Payment slip file must be under 7MB.');
      event.target.value = '';
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|pdf)$/i)) {
      setSlipError('Please upload an image (JPG, PNG, WebP) or PDF document.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSlipFile({
        data: reader.result,
        fileName: file.name,
        contentType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        fileSize: file.size,
      });
    };
    reader.onerror = () => {
      setSlipError('Could not read the uploaded file.');
    };
    reader.readAsDataURL(file);
  };

  const removeSlip = () => {
    setSlipFile(null);
    setSlipError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!selectedInvoice || busy) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      // Send the submitted data to the server; the response below determines the success message and local state changes.
      const { data: payment } = await api.post('/customer-payments', {
        invoiceId: selectedId,
        method,
        transactionReference,
        paymentSlip: slipFile || undefined,
      });
      setResult(payment);
      setTransactionReference('');
      setSlipFile(null);
      setRetry((value) => value + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Payment submission failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const downloadSlip = (slip) => {
    if (!slip?.data) return;
    const anchor = document.createElement('a');
    anchor.href = slip.data;
    anchor.download = slip.fileName || `payment-slip-${Date.now()}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const paymentInvoice = (payment) =>
    data?.invoices.find((invoice) => invoice.id === payment.invoiceId) || {
      invoiceNumber: payment.invoiceNumber,
    };
  const chooseInvoice = (id) => {
    setSearchParams(id ? { invoice: id } : {});
    setResult(null);
  };

  return (
    <main className="customer-payments-page">
      <header className="customer-payments-heading">
        <div>
          <p className="payments-eyebrow">ACCOUNT</p>
          <h1>Make a Payment</h1>
          <p>Select an outstanding invoice and submit payment details.</p>
          <Link to="/customer/invoices">Back to invoices</Link>
        </div>
      </header>
      <div className="payment-notice">
        <strong>Payment verification</strong>
        <p>
          Bank transfer references and pay-at-workshop requests are recorded as pending until
          Admin confirms receipt. This site does not collect card details or charge a card.
        </p>
      </div>
      {error && (
        <div className="payment-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Retry
          </button>
        </div>
      )}
      {!data && !error && (
        <p className="payment-loading" role="status">
          Loading open invoices…
        </p>
      )}
      {data && requestedInvoice && !selectedInvoice && <section className="payment-empty" role="status"><h2>This invoice is not available for payment</h2><p>It may have no outstanding balance, already be paid, or no longer be available. Review the invoice or contact the workshop if charges are missing.</p><Link to="/customer/invoices">Back to invoices</Link></section>}
      {data && !requestedInvoice && data.invoices.length === 0 && (
        <section className="payment-empty">
          <h2>No outstanding invoices</h2>
          <p>There are no invoices available for payment.</p>
        </section>
      )}
      {data?.invoices.length > 0 && (
        <div className="payment-grid">
          <section className="payment-invoice-picker">
            <h2>Select invoice</h2>
            {data.invoices.map((invoice) => (
              <button
                key={invoice.id}
                type="button"
                className={`payment-invoice-option ${invoice.id === selectedId ? 'selected' : ''}`}
                onClick={() => chooseInvoice(invoice.id)}
              >
                <span>
                  <strong>{invoice.invoiceNumber}</strong>
                  <small>
                    {invoice.serviceNumber} · {invoice.serviceType}
                  </small>
                </span>
                <strong>{money(invoice.amountDue)}</strong>
              </button>
            ))}
          </section>
          <section className="payment-form-card">
            {selectedInvoice && (
              <>
                <div className="payment-due">
                  <span>Amount due</span>
                  <strong>{money(selectedInvoice.amountDue)}</strong>
                  <p>
                    {selectedInvoice.invoiceNumber} · {selectedInvoice.serviceNumber} ·{' '}
                    {selectedInvoice.vehicle}
                  </p>
                </div>
                {selectedPendingPayment ? (
                  <div className="payment-pending" role="status">
                    <strong>Payment submitted · Pending Verification</strong>
                    <p>
                      Reference {selectedPendingPayment.receiptNumber}. The workshop will update the
                      invoice after confirming receipt.
                    </p>
                    <button
                      type="button"
                      onClick={() => downloadReceipt(selectedPendingPayment, selectedInvoice)}
                    >
                      Download submission receipt
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submit}>
                    <fieldset className="payment-methods">
                      <legend>Payment method</legend>
                      <label>
                        <input
                          type="radio"
                          name="payment-method"
                          value="Bank Transfer"
                          checked={method === 'Bank Transfer'}
                          onChange={() => setMethod('Bank Transfer')}
                        />
                        Bank transfer
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="payment-method"
                          value="Pay at Workshop"
                          checked={method === 'Pay at Workshop'}
                          onChange={() => setMethod('Pay at Workshop')}
                        />
                        Pay at workshop
                      </label>
                    </fieldset>
                    {method === 'Bank Transfer' ? (
                      <div style={{ display: 'grid', gap: '1rem' }}>
                        <label className="payment-reference-label">
                          Bank transaction reference
                          <input
                            value={transactionReference}
                            onChange={(event) => setTransactionReference(event.target.value)}
                            maxLength={100}
                            minLength={3}
                            required
                            placeholder="Reference shown by your bank"
                          />
                          <small>
                            Transfer the amount due using the workshop’s bank details, then submit
                            your bank reference for verification.
                          </small>
                        </label>

                        <div className="payment-slip-upload-section" style={{ display: 'grid', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '10px', border: '1px dashed var(--border-color, #3f3f46)' }}>
                          <label style={{ display: 'grid', gap: '0.4rem', fontWeight: '500' }}>
                            Upload Payment Slip / Bank Receipt (PDF, JPG, PNG)
                            <input
                              type="file"
                              accept=".pdf, .jpg, .jpeg, .png, .webp, image/*, application/pdf"
                              onChange={handleSlipChange}
                              style={{ padding: '0.5rem', border: '1px solid var(--border-color, #3f3f46)', borderRadius: '6px', background: 'var(--bg-input, #1c1c21)' }}
                            />
                            <small style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
                              Attach an image or PDF of your payment deposit slip / online transaction receipt.
                            </small>
                          </label>

                          {slipError && <p style={{ color: '#f87171', fontSize: '0.85rem', margin: 0 }}>{slipError}</p>}

                          {slipFile && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.6rem 0.8rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                                {slipFile.contentType.startsWith('image/') ? (
                                  <img src={slipFile.data} alt="Payment Slip Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                                ) : (
                                  <span style={{ padding: '0.3rem 0.6rem', background: '#dc2626', color: '#fff', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700' }}>PDF</span>
                                )}
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <strong style={{ fontSize: '0.9rem', color: '#fff' }}>{slipFile.fileName}</strong>
                                  <br />
                                  <small style={{ color: '#93c5fd' }}>{Math.round((slipFile.fileSize || 0) / 1024)} KB · Ready to submit</small>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={removeSlip}
                                style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="payment-workshop-note">
                        This records your intention to pay at the workshop. Bring the invoice
                        number; payment is confirmed by Admin after collection.
                      </p>
                    )}
                    <button
                      className="payment-submit"
                      type="submit"
                      disabled={
                        busy ||
                        selectedInvoice.amountDue <= 0 ||
                        selectedInvoice.pendingVerification
                      }
                    >
                      {busy ? 'Submitting…' : 'Submit payment details'}
                    </button>
                  </form>
                )}
              </>
            )}
          </section>
        </div>
      )}
      {result && (
        <section className="payment-result success" role="status">
          <div>
            <h2>Payment details submitted</h2>
            <p>{result.message}</p>
            <p>
              <strong>Reference:</strong> {result.receiptNumber} · <strong>Status:</strong>{' '}
              {result.status}
            </p>
            {result.paymentSlip && (
              <p style={{ color: '#4ade80', fontSize: '0.9rem' }}>
                ✓ Attached slip: {result.paymentSlip.fileName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => downloadReceipt(result, { invoiceNumber: result.invoiceNumber })}
          >
            Download receipt
          </button>
        </section>
      )}
      {data?.payments.length > 0 && (
        <section className="payment-history">
          <h2>Payment submissions</h2>
          <div className="payment-history-list">
            {data.payments.map((payment) => (
              <article key={payment.id}>
                <div>
                  <strong>{payment.receiptNumber}</strong>
                  <p>
                    {payment.invoiceNumber || paymentInvoice(payment).invoiceNumber || 'Invoice'} ·{' '}
                    {payment.method} · {dateTime(payment.createdAt)}
                  </p>
                  {payment.paymentSlip && (
                    <p style={{ color: '#60a5fa', fontSize: '0.85rem', margin: '0.2rem 0' }}>
                      📎 Slip: {payment.paymentSlip.fileName || 'Attached document'}
                    </p>
                  )}
                  {payment.failureReason && (
                    <p className="payment-failure-note">{payment.failureReason}</p>
                  )}
                </div>
                <div className="payment-history-actions">
                  <span
                    className={`payment-history-status ${payment.status.toLowerCase().replaceAll(' ', '-')}`}
                  >
                    {payment.status}
                  </span>
                  {payment.paymentSlip && (
                    <button
                      type="button"
                      onClick={() => downloadSlip(payment.paymentSlip)}
                      style={{ background: '#1e293b', border: '1px solid #475569', color: '#e2e8f0', padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      View Slip
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => downloadReceipt(payment, paymentInvoice(payment))}
                  >
                    Receipt
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
