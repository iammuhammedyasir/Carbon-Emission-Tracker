import { supabase } from '../supabaseClient.js';

export function render(state) {
    return `
    <div class="app-container">
      <!-- Sidebar Navigation -->
      <aside class="sidebar">
        <div class="sidebar-header">
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path>
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path>
           </svg>
           <h2>EcoTrek</h2>
        </div>
        <nav class="sidebar-nav">
          <a href="/dashboard" class="nav-item" data-link>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
             Dashboard
          </a>
          <a href="/profile" class="nav-item" data-link>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
             My Profile
          </a>
          <a href="/analytics" class="nav-item active" data-link>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"></path><path d="m19 9-5 5-4-4-3 3"></path></svg>
             Analytics
          </a>
          <a href="/" class="nav-item" data-link style="margin-top: auto;">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
             Sign Out
          </a>
        </nav>
      </aside>

      <!-- Main Content Area -->
      <main class="main-content">
        <header class="topbar">
          <div class="page-title">
            <h1>Analytics & Reports</h1>
            <p>Dive deep into your emission trends.</p>
          </div>
          <div class="header-actions" style="display: flex; gap: 1rem;">
             <button class="btn btn-sm export-csv-btn" style="background-color: white; border: 1px solid var(--color-text-muted); color: var(--color-text-main);">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Export CSV
             </button>
          </div>
        </header>

        <div class="analytics-grid">

           <!-- Time-Series Chart -->
           <div class="card glass trend-chart-card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                 <h3>12-Month Emission Trend</h3>
                 <select class="form-input" id="vehicle-filter" style="width: auto; padding: 0.4rem 2rem 0.4rem 1rem;">
                    <option value="all">All Vehicles</option>
                 </select>
              </div>
              <div class="chart-container" style="position: relative; height: 300px; width: 100%;">
                 <canvas id="trendChart"></canvas>
              </div>
           </div>

           <!-- Vehicle Comparison Chart -->
           <div class="card glass comparison-chart-card">
              <h3>Vehicle Comparison</h3>
              <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 1.5rem;">Average emissions per 100 miles</p>
              <div class="chart-container" style="position: relative; height: 250px; width: 100%;">
                 <canvas id="comparisonChart"></canvas>
              </div>
           </div>

        </div>

        <!-- ── HISTORY & SUMMARY SECTION ── -->
        <div class="card glass" style="margin-top: 2rem;">
          <h3 style="margin-bottom: 1.5rem;">📊 OBD History & Summary</h3>

          <!-- Summary Stats Row -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
            <div class="stat-card card glass" style="text-align:center;">
              <p class="stat-label">Avg Pollution Score</p>
              <h3 class="stat-value" id="hist-avg-pollution" style="color: var(--color-primary);">--</h3>
            </div>
            <div class="stat-card card glass" style="text-align:center;">
              <p class="stat-label">Total Readings</p>
              <h3 class="stat-value" id="hist-total-readings">--</h3>
            </div>
            <div class="stat-card card glass" style="text-align:center;">
              <p class="stat-label">Best Score</p>
              <h3 class="stat-value" id="hist-best-score" style="color: #22c55e;">--</h3>
            </div>
            <div class="stat-card card glass" style="text-align:center;">
              <p class="stat-label">Worst Score</p>
              <h3 class="stat-value" id="hist-worst-score" style="color: #ef4444;">--</h3>
            </div>
          </div>

          <!-- Risk Breakdown + Line Chart -->
          <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1.5rem; margin-bottom: 2rem;">

            <!-- Risk Level Breakdown -->
            <div class="card glass" style="padding: 1rem;">
              <h4 style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--color-text-muted);">Risk Level Breakdown</h4>
              <div style="display:flex; flex-direction:column; gap: 0.75rem;">
                <div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-size:0.85rem; color:#22c55e; font-weight:600;">🟢 LOW RISK</span>
                    <span id="risk-low-pct" style="font-size:0.85rem; font-weight:700;">--%</span>
                  </div>
                  <div style="background:#e2e8f0; border-radius:999px; height:8px;">
                    <div id="risk-low-bar" style="background:#22c55e; height:8px; border-radius:999px; width:0%; transition: width 0.8s ease;"></div>
                  </div>
                </div>
                <div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-size:0.85rem; color:#f59e0b; font-weight:600;">🟡 MODERATE</span>
                    <span id="risk-mod-pct" style="font-size:0.85rem; font-weight:700;">--%</span>
                  </div>
                  <div style="background:#e2e8f0; border-radius:999px; height:8px;">
                    <div id="risk-mod-bar" style="background:#f59e0b; height:8px; border-radius:999px; width:0%; transition: width 0.8s ease;"></div>
                  </div>
                </div>
                <div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-size:0.85rem; color:#ef4444; font-weight:600;">🔴 HIGH RISK</span>
                    <span id="risk-high-pct" style="font-size:0.85rem; font-weight:700;">--%</span>
                  </div>
                  <div style="background:#e2e8f0; border-radius:999px; height:8px;">
                    <div id="risk-high-bar" style="background:#ef4444; height:8px; border-radius:999px; width:0%; transition: width 0.8s ease;"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Pollution Score Over Time Chart -->
            <div class="card glass" style="padding: 1rem;">
              <h4 style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--color-text-muted);">Pollution Score Over Time (last 20 readings)</h4>
              <div style="position:relative; height:160px;">
                <canvas id="historyLineChart"></canvas>
              </div>
            </div>

          </div>

          <!-- Recent Readings Table -->
          <h4 style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--color-text-muted);">Recent Readings</h4>
          <div style="overflow-x: auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
              <thead>
                <tr style="border-bottom: 2px solid rgba(0,0,0,0.08);">
                  <th style="padding:0.6rem 0.8rem; text-align:left; color:var(--color-text-muted); font-weight:600;">Time</th>
                  <th style="padding:0.6rem 0.8rem; text-align:center; color:var(--color-text-muted); font-weight:600;">Pollution</th>
                  <th style="padding:0.6rem 0.8rem; text-align:center; color:var(--color-text-muted); font-weight:600;">Combustion</th>
                  <th style="padding:0.6rem 0.8rem; text-align:center; color:var(--color-text-muted); font-weight:600;">Lambda</th>
                  <th style="padding:0.6rem 0.8rem; text-align:center; color:var(--color-text-muted); font-weight:600;">Catalyst</th>
                  <th style="padding:0.6rem 0.8rem; text-align:center; color:var(--color-text-muted); font-weight:600;">RPM</th>
                  <th style="padding:0.6rem 0.8rem; text-align:center; color:var(--color-text-muted); font-weight:600;">Speed</th>
                  <th style="padding:0.6rem 0.8rem; text-align:center; color:var(--color-text-muted); font-weight:600;">Risk</th>
                </tr>
              </thead>
              <tbody id="history-table-body">
                <tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--color-text-muted);">Loading history...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <!-- ── END HISTORY SECTION ── -->

      </main>
    </div>
  `;
}

function renderHistory(rows) {
   if (!rows || rows.length === 0) {
      const tbody = document.getElementById('history-table-body');
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--color-text-muted);">No history yet.</td></tr>';
      return;
   }

   // Summary stats
   const scores = rows.map(r => r.pollution_score).filter(s => s != null);
   if (scores.length === 0) return;

   const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
   const best = Math.max(...scores);
   const worst = Math.min(...scores);

   const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
   set('hist-avg-pollution', avg.toFixed(1));
   set('hist-total-readings', rows.length);
   set('hist-best-score', best.toFixed(1));
   set('hist-worst-score', worst.toFixed(1));

   // Risk breakdown
   const total = rows.length;
   const low  = rows.filter(r => r.risk === 'LOW RISK').length;
   const mod  = rows.filter(r => r.risk === 'MODERATE').length;
   const high = rows.filter(r => r.risk === 'HIGH RISK').length;

   const lowPct  = Math.round((low / total) * 100);
   const modPct  = Math.round((mod / total) * 100);
   const highPct = Math.round((high / total) * 100);

   set('risk-low-pct',  `${lowPct}%`);
   set('risk-mod-pct',  `${modPct}%`);
   set('risk-high-pct', `${highPct}%`);

   setTimeout(() => {
      const lb = document.getElementById('risk-low-bar');
      const mb = document.getElementById('risk-mod-bar');
      const hb = document.getElementById('risk-high-bar');
      if (lb) lb.style.width = `${lowPct}%`;
      if (mb) mb.style.width = `${modPct}%`;
      if (hb) hb.style.width = `${highPct}%`;
   }, 100);

   // Line chart — last 20 readings oldest → newest
   const chartRows = [...rows].reverse().slice(0, 20);
   const chartCtx = document.getElementById('historyLineChart');
   if (chartCtx && window.Chart) {
      if (window._historyChart) window._historyChart.destroy();
      window._historyChart = new window.Chart(chartCtx, {
         type: 'line',
         data: {
            labels: chartRows.map(r => r.timestamp ? r.timestamp.slice(11, 16) : ''),
            datasets: [{
               label: 'Pollution Score',
               data: chartRows.map(r => r.pollution_score),
               borderColor: '#004D4D',
               backgroundColor: 'rgba(0,77,77,0.1)',
               borderWidth: 2,
               pointRadius: 3,
               fill: true,
               tension: 0.4
            }]
         },
         options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
               y: { min: 0, max: 100, ticks: { font: { size: 10 } } },
               x: { ticks: { font: { size: 10 } } }
            }
         }
      });
   }

   // Table rows
   const riskColor = r => r === 'LOW RISK' ? '#22c55e' : r === 'MODERATE' ? '#f59e0b' : '#ef4444';
   const tbody = document.getElementById('history-table-body');
   if (tbody) {
      tbody.innerHTML = rows.map(r => `
         <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
            <td style="padding:0.6rem 0.8rem; color:var(--color-text-muted);">${r.timestamp ? r.timestamp.slice(0,19).replace('T',' ') : '--'}</td>
            <td style="padding:0.6rem 0.8rem; text-align:center; font-weight:600;">${r.pollution_score?.toFixed(1) ?? '--'}</td>
            <td style="padding:0.6rem 0.8rem; text-align:center;">${r.combustion_score?.toFixed(1) ?? '--'}</td>
            <td style="padding:0.6rem 0.8rem; text-align:center;">${r.lambda_stability_score?.toFixed(1) ?? '--'}</td>
            <td style="padding:0.6rem 0.8rem; text-align:center;">${r.catalyst_efficiency_score?.toFixed(1) ?? '--'}</td>
            <td style="padding:0.6rem 0.8rem; text-align:center;">${r.rpm?.toFixed(0) ?? '--'}</td>
            <td style="padding:0.6rem 0.8rem; text-align:center;">${r.speed ?? '--'} km/h</td>
            <td style="padding:0.6rem 0.8rem; text-align:center;">
               <span style="padding:2px 10px; border-radius:999px; font-size:0.75rem; font-weight:700; background:${riskColor(r.risk)}22; color:${riskColor(r.risk)};">
                  ${r.risk ?? '--'}
               </span>
            </td>
         </tr>
      `).join('');
   }
}

export async function init(state) {
    if (!state.user) return;

    // Fetch trips and vehicles
    const { data: trips } = await supabase.from('trips').select('*').eq('user_id', state.user.id);
    const { data: vehicles } = await supabase.from('vehicles').select('*').eq('user_id', state.user.id);

    // Fetch OBD history
    const { data: historyData } = await supabase
       .from('results')
       .select('*')
       .order('created_at', { ascending: false })
       .limit(50);
    renderHistory(historyData);

    if (!window.Chart) return;

    // Monthly trend chart
    const currentYear = new Date().getFullYear();
    const monthlyEmissions = new Array(12).fill(0);
    if (trips && trips.length > 0) {
        trips.forEach(t => {
            const date = new Date(t.log_date);
            if (date.getFullYear() === currentYear) {
                monthlyEmissions[date.getMonth()] += Number(t.co2_kg);
            }
        });
    }

    const trendCtx = document.getElementById('trendChart');
    if (trendCtx) {
        new window.Chart(trendCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'CO₂ Emissions (kg)',
                    data: monthlyEmissions,
                    borderColor: '#004D4D',
                    backgroundColor: 'rgba(0, 77, 77, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#004D4D',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false } },
                    x: { grid: { display: false }, border: { display: false } }
                }
            }
        });
    }

    // Vehicle comparison chart
    let compLabels = [], compData = [], compColors = [];
    if (vehicles && vehicles.length > 0) {
        vehicles.forEach(v => {
            compLabels.push(`${v.make} ${v.model}`);
            const vTrips = trips ? trips.filter(t => t.vehicle_id === v.id) : [];
            let dist = 0, co2 = 0;
            vTrips.forEach(t => { dist += Number(t.distance_miles); co2 += Number(t.co2_kg); });
            let avg100 = dist > 0 ? (co2 / dist) * 100 : (v.avg_mpg ? (100 / v.avg_mpg) * 8.89 : 25);
            compData.push(Number(avg100.toFixed(1)));
            compColors.push(avg100 < 20 ? '#93C572' : (avg100 > 35 ? '#D48C00' : '#A7C7B0'));
        });
    } else {
        compLabels = ['No Vehicles']; compData = [0]; compColors = ['#E2E8F0'];
    }

    const compCtx = document.getElementById('comparisonChart');
    if (compCtx) {
        new window.Chart(compCtx, {
            type: 'bar',
            data: {
                labels: compLabels,
                datasets: [{ label: 'kg CO₂ per 100m', data: compData, backgroundColor: compColors, borderRadius: 8, barPercentage: 0.6 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false } },
                    x: { grid: { display: false }, border: { display: false } }
                }
            }
        });
    }

    // Vehicle filter dropdown
    const filterSelect = document.getElementById('vehicle-filter');
    if (filterSelect && vehicles) {
        let options = '<option value="all">All Vehicles</option>';
        vehicles.forEach(v => { options += `<option value="${v.id}">${v.year || ''} ${v.make} ${v.model}</option>`; });
        filterSelect.innerHTML = options;
    }

    // CSV Export
    const csvBtn = document.querySelector('.export-csv-btn');
    if (csvBtn) {
        csvBtn.addEventListener('click', () => {
            if (!historyData || historyData.length === 0) { alert('No data to export.'); return; }
            const headers = ['timestamp','vehicle_type','rpm','speed','coolant','load','pollution_score','combustion_score','lambda_stability_score','catalyst_efficiency_score','aftertreatment_score','fuel_trim_score','risk'];
            const rows = historyData.map(r => headers.map(h => r[h] ?? '').join(','));
            const csv = [headers.join(','), ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'obd_history.csv'; a.click();
            URL.revokeObjectURL(url);
        });
    }
}
