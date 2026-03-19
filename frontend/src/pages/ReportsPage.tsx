import { useEffect, useState } from 'react';
import api from '../services/api';
import Spinner from '../components/Spinner';

interface DeliveryStats {
  totalPackages: number;
  deliveredPackages: number;
  pendingPackages: number;
  deliverySuccessRate: number;
  byMethod: Record<string, number>;
  byStatus: Record<string, number>;
}

interface RevenueReport {
  totalRevenue: number;
  deliveryFeeRevenue: number;
  itemPriceRevenue: number;
  shelfRentalRevenue: number;
  byMonth: Array<{ month: string; revenue: number }>;
}

function printReport(type: 'deliveries' | 'revenue', stats: DeliveryStats | null, revenue: RevenueReport | null) {
  const date = new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });

  const deliveriesHtml = stats ? `
    <h2>Delivery Statistics</h2>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Total Packages</div><div class="stat-value">${stats.totalPackages}</div></div>
      <div class="stat-card"><div class="stat-label">Delivered</div><div class="stat-value">${stats.deliveredPackages}</div></div>
      <div class="stat-card"><div class="stat-label">Pending</div><div class="stat-value">${stats.pendingPackages}</div></div>
      <div class="stat-card"><div class="stat-label">Success Rate</div><div class="stat-value">${stats.deliverySuccessRate?.toFixed(1)}%</div></div>
    </div>
    <div class="two-col">
      <div>
        <h3>By Delivery Method</h3>
        <table><thead><tr><th>Method</th><th>Count</th></tr></thead><tbody>
          ${Object.entries(stats.byMethod || {}).map(([m, c]) => `<tr><td>${m.replace(/_/g, ' ')}</td><td>${c}</td></tr>`).join('')}
        </tbody></table>
      </div>
      <div>
        <h3>By Status</h3>
        <table><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>
          ${Object.entries(stats.byStatus || {}).map(([s, c]) => `<tr><td>${s.replace(/_/g, ' ')}</td><td>${c}</td></tr>`).join('')}
        </tbody></table>
      </div>
    </div>
  ` : '';

  const revenueHtml = revenue ? `
    <h2>Revenue Report</h2>
    <div class="stat-grid">
      <div class="stat-card highlight"><div class="stat-label">Total Revenue</div><div class="stat-value">KES ${revenue.totalRevenue?.toLocaleString()}</div></div>
      <div class="stat-card"><div class="stat-label">Delivery Fees</div><div class="stat-value">KES ${revenue.deliveryFeeRevenue?.toLocaleString()}</div></div>
      <div class="stat-card"><div class="stat-label">Item Prices</div><div class="stat-value">KES ${revenue.itemPriceRevenue?.toLocaleString()}</div></div>
      <div class="stat-card"><div class="stat-label">Shelf Rentals</div><div class="stat-value">KES ${revenue.shelfRentalRevenue?.toLocaleString()}</div></div>
    </div>
    ${revenue.byMonth?.length > 0 ? `
      <h3>Monthly Revenue</h3>
      <table>
        <thead><tr><th>Month</th><th>Revenue (KES)</th></tr></thead>
        <tbody>
          ${revenue.byMonth.map(m => `<tr><td>${m.month}</td><td>${m.revenue?.toLocaleString()}</td></tr>`).join('')}
        </tbody>
      </table>
    ` : ''}
  ` : '';

  const content = type === 'deliveries' ? deliveriesHtml : revenueHtml;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>DashDelivery — ${type === 'deliveries' ? 'Delivery Report' : 'Revenue Report'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; padding: 40px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #16a34a; padding-bottom: 16px; margin-bottom: 28px; }
    .brand { font-size: 22px; font-weight: 800; color: #16a34a; }
    .meta { text-align: right; color: #555; font-size: 12px; line-height: 1.6; }
    h2 { font-size: 16px; font-weight: 700; color: #111; margin: 24px 0 14px; border-left: 4px solid #16a34a; padding-left: 10px; }
    h3 { font-size: 13px; font-weight: 600; color: #333; margin: 16px 0 8px; }
    .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .stat-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
    .stat-card.highlight { background: #f0fdf4; border-color: #86efac; }
    .stat-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 6px; }
    .stat-value { font-size: 20px; font-weight: 700; color: #111; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f9fafb; text-align: left; padding: 8px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
    td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #374151; }
    tr:last-child td { border-bottom: none; }
    td:first-child { text-transform: capitalize; }
    .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
    @media print {
      body { padding: 20px; }
      @page { margin: 1.5cm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">DashDelivery</div>
      <div style="color:#555;font-size:12px;margin-top:4px;">${type === 'deliveries' ? 'Delivery Statistics Report' : 'Revenue Report'}</div>
    </div>
    <div class="meta">
      <div>Generated: ${date}</div>
      <div>DashDelivery Platform</div>
    </div>
  </div>
  ${content}
  <div class="footer">This report was generated by DashDelivery · ${date}</div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export default function ReportsPage() {
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [revenue, setRevenue] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/reports/deliveries'), api.get('/reports/revenue')])
      .then(([s, r]) => { setStats(s.data.data); setRevenue(r.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Delivery and revenue analytics</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => printReport('deliveries', stats, revenue)}
            className="text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl font-medium transition-colors"
          >
            🖨 Print Deliveries
          </button>
          <button
            onClick={() => printReport('revenue', stats, revenue)}
            className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-sm transition-colors"
          >
            🖨 Print Revenue
          </button>
        </div>
      </div>

      {/* Delivery Stats */}
      {stats && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Delivery Statistics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Packages" value={stats.totalPackages} color="blue" />
            <StatCard label="Delivered" value={stats.deliveredPackages} color="green" />
            <StatCard label="Pending" value={stats.pendingPackages} color="yellow" />
            <StatCard label="Success Rate" value={`${stats.deliverySuccessRate?.toFixed(1)}%`} color="purple" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-700 mb-3">By Delivery Method</h3>
              {Object.entries(stats.byMethod || {}).map(([method, count]) => (
                <BarRow key={method} label={method.replace(/_/g, ' ')} value={count as number} max={stats.totalPackages} />
              ))}
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-700 mb-3">By Status</h3>
              {Object.entries(stats.byStatus || {}).map(([status, count]) => (
                <BarRow key={status} label={status.replace(/_/g, ' ')} value={count as number} max={stats.totalPackages} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Revenue Report */}
      {revenue && (
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Revenue</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Revenue" value={`KES ${revenue.totalRevenue?.toLocaleString()}`} color="green" />
            <StatCard label="Delivery Fees" value={`KES ${revenue.deliveryFeeRevenue?.toLocaleString()}`} color="blue" />
            <StatCard label="Item Prices" value={`KES ${revenue.itemPriceRevenue?.toLocaleString()}`} color="purple" />
            <StatCard label="Shelf Rentals" value={`KES ${revenue.shelfRentalRevenue?.toLocaleString()}`} color="yellow" />
          </div>
          {revenue.byMonth?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-700 mb-4">Monthly Revenue</h3>
              <div className="space-y-2">
                {revenue.byMonth.map(m => (
                  <BarRow key={m.month} label={m.month} value={m.revenue} max={Math.max(...revenue.byMonth.map(x => x.revenue))} prefix="KES " />
                ))}
              </div>
            </div>
          )}
          {revenue.totalRevenue === 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm p-4 rounded-xl mt-4">
              No revenue recorded yet. Revenue is calculated from delivered packages and completed M-Pesa payments.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700', green: 'bg-green-50 text-green-700',
    yellow: 'bg-yellow-50 text-yellow-700', purple: 'bg-purple-50 text-purple-700',
  };
  return (
    <div className={`rounded-2xl p-5 ${colors[color]}`}>
      <p className="text-xs font-semibold opacity-60 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function BarRow({ label, value, max, prefix = '' }: { label: string; value: number; max: number; prefix?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span className="capitalize">{label}</span>
        <span>{prefix}{value?.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
