import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { downloadFinanceCsv, printFinanceReport } from '../../lib/financeExport';
const money = (value) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
const dateLabel = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(
        new Date(value),
      )
    : '';
const periods = [
  { id: 'daily', label: 'Daily · Today' },
  { id: 'weekly', label: 'Weekly · This week' },
  { id: 'monthly', label: 'Monthly · This month' },
  { id: 'annual', label: 'Annual · This year' },
  { id: 'custom', label: 'Custom date range' },
];

export default function FinanceRevenueReports() {
  const [filters, setFilters] = useState({ period: 'monthly', from: '', to: '', technicianId: '' });
  const [applied, setApplied] = useState({ period: 'monthly' });
  const [report, setReport] = useState(null);
  const [serviceReport, setServiceReport] = useState(null);
  const [partsReport, setPartsReport] = useState(null);
  const [technicianReport, setTechnicianReport] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api.get('/finance/reports', { params: applied, signal: controller.signal }),
      api.get('/finance/reports/by-service', { params: applied, signal: controller.signal }),
      api.get('/finance/reports/parts', { params: applied, signal: controller.signal }),
      api.get('/finance/reports/technicians', { params: applied, signal: controller.signal }),
    ])
      .then(([{ data }, { data: serviceData }, { data: partsData }, { data: technicianData }]) => {
        if (!controller.signal.aborted) {
          setReport(data);
          setServiceReport(serviceData);
          setPartsReport(partsData);
          setTechnicianReport(technicianData);
          setError('');
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted)
          setError(
            requestError.response?.data?.message || 'Unable to generate this revenue report.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [applied]);

  useEffect(() => {
    const afterPrint = () => setPrinting(false);
    window.addEventListener('afterprint', afterPrint);
    return () => window.removeEventListener('afterprint', afterPrint);
  }, []);

  const maxRevenue = Math.max(1, ...(report?.trend || []).map((item) => item.revenue));
  const chartTicks = useMemo(() => {
    const count = report?.trend.length || 0;
    const every = count > 16 ? Math.ceil(count / 12) : 1;
    return (
      report?.trend
        .map((item, index) => ({ ...item, index }))
        .filter((item, index, all) => item.index % every === 0 || item.index === all.length - 1) ||
      []
    );
  }, [report]);

  function apply(event) {
    event.preventDefault();
    setLoading(true);
    setApplied({
      ...(filters.period === 'custom' ? filters : { period: filters.period }),
      ...(filters.technicianId ? { technicianId: filters.technicianId } : {}),
    });
  }

  function exportReport() {
    if (!report) return;
    const rows = [
      [
        'Summary',
        'Total revenue',
        report.summary.totalRevenue,
        `${report.summary.transactionCount} completed payments`,
      ],
      [
        'Summary',
        'Average invoice value',
        report.summary.averageInvoiceValue,
        `${report.summary.invoiceCount} invoices`,
      ],
      ...report.trend.map((item) => ['Revenue trend', item.label, item.revenue, report.period]),
      ...(serviceReport?.services || []).map((item) => [
        'Revenue by service',
        item.name,
        item.revenue,
        `${item.transactions} payments`,
      ]),
      ...(partsReport?.parts || []).map((item) => [
        'Parts',
        item.name,
        item.revenue,
        `${item.quantity} units · cost ${item.cost}`,
      ]),
      ...(technicianReport?.rows || []).map((item) => [
        'Technician',
        item.technicianName,
        item.revenue,
        `${item.jobsCompleted} jobs · ${item.labourHours} labour hours · ${item.averageCompletionHours} h average`,
      ]),
    ];
    downloadFinanceCsv(
      `finance-revenue-report-${report.period}`,
      ['Section', 'Name', 'Value (LKR)', 'Details'],
      rows,
    );
  }

  return (
    <main className={`finance-revenue-reports ${printing ? 'printing' : ''}`}>
      <header className="finance-reports-heading">
        <div>
          <p>FINANCE · ANALYTICS</p>
          <h1>Revenue reports</h1>
          <span>
            Revenue reflects Finance-verified payments; invoice value uses invoices issued in the
            period.
          </span>
        </div>
        <div className="finance-reports-actions">
          <button type="button" onClick={exportReport} disabled={!report}>
            Export Excel (CSV)
          </button>
          <button type="button" onClick={() => printFinanceReport(setPrinting)} disabled={!report}>
            Save as PDF
          </button>
          <button type="button" onClick={() => printFinanceReport(setPrinting)} disabled={!report}>
            Print report
          </button>
        </div>
      </header>
      <form className="finance-reports-filters section-card" onSubmit={apply}>
        <label>
          Report period
          <select
            value={filters.period}
            onChange={(event) =>
              setFilters((current) => ({ ...current, period: event.target.value }))
            }
          >
            {periods.map((period) => (
              <option value={period.id} key={period.id}>
                {period.label}
              </option>
            ))}
          </select>
        </label>
        {filters.period === 'custom' && (
          <>
            <label>
              From
              <input
                type="date"
                required
                value={filters.from}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, from: event.target.value }))
                }
              />
            </label>
            <label>
              To
              <input
                type="date"
                required
                value={filters.to}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, to: event.target.value }))
                }
              />
            </label>
          </>
        )}
        <label>
          Technician
          <select
            value={filters.technicianId}
            onChange={(event) =>
              setFilters((current) => ({ ...current, technicianId: event.target.value }))
            }
          >
            <option value="">All technicians</option>
            {(technicianReport?.technicians || []).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={loading}>
          Generate report
        </button>
      </form>
      {error && (
        <p className="finance-reports-error" role="alert">
          {error}
        </p>
      )}
      {loading && !report && (
        <p className="finance-reports-loading" role="status">
          Generating report…
        </p>
      )}
      {report && (
        <>
          <div className="finance-reports-period">
            {dateLabel(report.range.from)} – {dateLabel(report.range.to)}{' '}
            <span>
              Compared with {dateLabel(report.comparisonRange.from)} –{' '}
              {dateLabel(report.comparisonRange.to)}
            </span>
          </div>
          <section className="finance-reports-summary" aria-label="Revenue report totals">
            <article>
              <span>Total revenue</span>
              <strong>{money(report.summary.totalRevenue)}</strong>
              <small>
                {report.summary.transactionCount} completed payment
                {report.summary.transactionCount === 1 ? '' : 's'}
              </small>
            </article>
            <article className={report.summary.revenueChange >= 0 ? 'positive' : 'negative'}>
              <span>Change vs previous period</span>
              <strong>
                {report.summary.revenueChange >= 0 ? '+' : ''}
                {money(report.summary.revenueChange)}
              </strong>
              <small>
                {report.summary.revenueChangePercent == null
                  ? 'No previous-period base'
                  : `${report.summary.revenueChangePercent >= 0 ? '+' : ''}${report.summary.revenueChangePercent}%`}
              </small>
            </article>
            <article>
              <span>Average invoice value</span>
              <strong>{money(report.summary.averageInvoiceValue)}</strong>
              <small>
                {report.summary.invoiceCount} issued invoice
                {report.summary.invoiceCount === 1 ? '' : 's'}
              </small>
            </article>
          </section>
          <section className="finance-revenue-trend section-card">
            <header>
              <div>
                <h2>Revenue trend</h2>
                <p>
                  {periods.find((period) => period.id === report.period)?.label ||
                    'Custom date range'}{' '}
                  · Completed payments grouped in UTC.
                </p>
              </div>
            </header>
            <svg
              viewBox="0 0 760 300"
              role="img"
              aria-label={`${report.period} revenue chart: ${report.trend.map((item) => `${item.label} ${money(item.revenue)}`).join('; ')}`}
            >
              {[0, 1, 2, 3].map((tick) => (
                <g key={tick}>
                  <line x1="62" x2="744" y1={218 - tick * 54} y2={218 - tick * 54} />
                  <text x="54" y={222 - tick * 54}>
                    {money((maxRevenue * tick) / 3)}
                  </text>
                </g>
              ))}
              {report.trend.map((item, index) => {
                const step = 682 / Math.max(1, report.trend.length);
                const barWidth = Math.max(3, Math.min(30, step * 0.58));
                const height = item.revenue ? Math.max(3, (item.revenue / maxRevenue) * 162) : 0;
                const x = 65 + index * step + (step - barWidth) / 2;
                const showLabel = chartTicks.some((tick) => tick.index === index);
                return (
                  <g key={item.key}>
                    <title>
                      {item.label}: {money(item.revenue)}
                    </title>
                    <rect x={x} y={218 - height} width={barWidth} height={height} rx="3" />
                    {showLabel && (
                      <text className="finance-chart-label" x={x + barWidth / 2} y="242">
                        {item.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </section>
          {serviceReport && (
            <section className="finance-report-table section-card">
              <header>
                <div>
                  <h2>Revenue by service</h2>
                  <span className="finance-service-report-range">
                    Completed payments in this report period
                  </span>
                </div>
                <strong>
                  {serviceReport.highestEarning
                    ? `Top: ${serviceReport.highestEarning}`
                    : 'No service revenue yet'}
                </strong>
              </header>
              <div>
                <table>
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Completed payments</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceReport.services.map((service) => (
                      <tr key={service.name}>
                        <td>
                          {service.name}
                          {service.name === serviceReport.highestEarning && (
                            <span className="finance-service-top"> · Highest</span>
                          )}
                        </td>
                        <td>{service.transactions}</td>
                        <td>{money(service.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {partsReport && (
            <section className="finance-report-table section-card">
              <header>
                <div>
                  <h2>Parts revenue and cost</h2>
                  <span className="finance-service-report-range">
                    Issued invoices · {partsReport.summary.partTypes} part types ·{' '}
                    {partsReport.summary.quantity} units
                  </span>
                </div>
                <strong>
                  {partsReport.summary.mostUsedPart
                    ? `Most used: ${partsReport.summary.mostUsedPart}`
                    : 'No parts recorded'}
                </strong>
              </header>
              <div>
                <table>
                  <thead>
                    <tr>
                      <th>Part</th>
                      <th>Qty used</th>
                      <th>Invoices</th>
                      <th>Revenue</th>
                      <th>Recorded cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partsReport.parts.map((part, index) => (
                      <tr key={`${part.partNumber}-${part.name}-${index}`}>
                        <td>
                          {part.name}
                          {part.partNumber && (
                            <small className="finance-part-number">Part {part.partNumber}</small>
                          )}
                        </td>
                        <td>{part.quantity}</td>
                        <td>{part.invoices}</td>
                        <td>{money(part.revenue)}</td>
                        <td>{money(part.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>Total</th>
                      <th>{partsReport.summary.quantity}</th>
                      <th>—</th>
                      <th>{money(partsReport.summary.revenue)}</th>
                      <th>{money(partsReport.summary.cost)}</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}
          {technicianReport && (
            <section className="finance-report-table section-card">
              <header>
                <div>
                  <h2>Technician productivity</h2>
                  <span className="finance-service-report-range">
                    Revenue is total issued invoice value for jobs completed by each technician.
                    Completion time runs from inspection start (or job creation when unavailable) to
                    final report.
                  </span>
                </div>
                <strong>
                  {technicianReport.summary.jobsCompleted} completed jobs ·{' '}
                  {technicianReport.summary.labourHours} labour hours ·{' '}
                  {money(technicianReport.summary.revenue)}
                </strong>
              </header>
              <div>
                <table>
                  <thead>
                    <tr>
                      <th>Technician</th>
                      <th>Jobs completed</th>
                      <th>Labour hours</th>
                      <th>Revenue</th>
                      <th>Avg. completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {technicianReport.rows.map((person) => (
                      <tr key={person.technicianId}>
                        <td>{person.technicianName}</td>
                        <td>{person.jobsCompleted}</td>
                        <td>{person.labourHours}</td>
                        <td>{money(person.revenue)}</td>
                        <td>{person.averageCompletionHours} h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <section className="finance-report-table section-card">
            <header>
              <h2>Period breakdown</h2>
              <strong>{report.trend.length} buckets</strong>
            </header>
            <div>
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.trend.map((item) => (
                    <tr key={item.key}>
                      <td>{item.label}</td>
                      <td>{money(item.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
