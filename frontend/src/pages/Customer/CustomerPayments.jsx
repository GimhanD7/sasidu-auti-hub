import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  const selectedId = data?.invoices.some((invoice) => invoice.id === requestedInvoice)
    ? requestedInvoice
    : data?.invoices[0]?.id || requestedInvoice;
  const [method, setMethod] = useState('Bank Transfer');
  const [transactionReference, setTransactionReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const selectedInvoice = data?.invoices.find((invoice) => invoice.id === selectedId);
  const selectedPendingPayment = data?.payments.find(
    (payment) => payment.invoiceId === selectedId && payment.status === 'Pending Verification',
  );

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

  useEffect(() => {
    if (!data) return;
    const next = data.invoices.some((invoice) => invoice.id === requestedInvoice)
      ? requestedInvoice
      : data.invoices[0]?.id || '';
    if (next && next !== requestedInvoice) setSearchParams({ invoice: next }, { replace: true });
    if (!next && requestedInvoice) setSearchParams({}, { replace: true });
  }, [data, requestedInvoice, setSearchParams]);

  const submit = async (event) => {
    event.preventDefault();
    if (!selectedInvoice || busy) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { data: payment } = await api.post('/customer-payments', {
        invoiceId: selectedId,
        method,
        transactionReference,
      });
      setResult(payment);
      setTransactionReference('');
      setRetry((value) => value + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Payment submission failed. Please try again.');
    } finally {
      setBusy(false);
    }
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
        </div>
      </header>
      <div className="payment-notice">
        <strong>Payment verification</strong>
        <p>
          Bank transfer references and pay-at-workshop requests are recorded as pending until
          Finance confirms receipt. This site does not collect card details or charge a card.
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
      {data && data.invoices.length === 0 && (
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
                    ) : (
                      <p className="payment-workshop-note">
                        This records your intention to pay at the workshop. Bring the invoice
                        number; payment is confirmed by Finance after collection.
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
