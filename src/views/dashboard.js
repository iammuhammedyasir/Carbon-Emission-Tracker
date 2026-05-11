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
          <a href="/dashboard" class="nav-item active" data-link>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
             Dashboard
          </a>
          <a href="/profile" class="nav-item" data-link>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
             My Profile
          </a>
          <a href="/analytics" class="nav-item" data-link>
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
            <h1>Overview</h1>
            <p>Welcome back, ${state.user?.user_metadata?.full_name || 'Driver'}.</p>
          </div>
          <div class="user-profile">
            <div class="eco-status" title="Eco Streak">
               <svg id="eco-leaf-icon" class="eco-leaf ${state.ecoStreak > 5 ? 'growing' : ''}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path>
                  <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path>
               </svg>
               <span>Streak: ${state.ecoStreak}</span>
            </div>
            <div class="avatar">${(state.user?.user_metadata?.full_name || 'U').charAt(0).toUpperCase()}</div>
          </div>
        </header>

        <div class="dashboard-grid">
          <!-- Live Pollution Score -->
          <div class="card glass" style="grid-column: span 8;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
              <h3>Live Pollution Score</h3>
              <span id="live-risk-badge" style="
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 0.8rem;
                font-weight: 600;
                background: #e2e8f0;
                color: #333;
              ">Waiting...</span>
            </div>
            <div style="display:grid; grid-template-columns: repeat(3,1fr); gap:1rem;">
              <div class="stat-card card glass">
                <div class="stat-info">
                  <p class="stat-label">Pollution Score</p>
                  <h3 class="stat-value" id="live-pollution-score">--</h3>
                </div>
              </div>
              <div class="stat-card card glass">
                <div class="stat-info">
                  <p class="stat-label">Combustion Score</p>
                  <h3 class="stat-value" id="live-combustion-score">--</h3>
                </div>
              </div>
              <div class="stat-card card glass">
                <div class="stat-info">
                  <p class="stat-label">AfterTreatment Score</p>
                  <h3 class="stat-value" id="live-aftertreatment-score">--</h3>
                </div>
              </div>
              <div class="stat-card card glass">
                <div class="stat-info">
                  <p class="stat-label">Fuel Trim Score</p>
                  <h3 class="stat-value" id="live-fuel-trim">--</h3>
                </div>
              </div>
              <div class="stat-card card glass">
                <div class="stat-info">
                  <p class="stat-label">Lambda Stability</p>
                  <h3 class="stat-value" id="live-lambda">--</h3>
                </div>
              </div>
              <div class="stat-card card glass">
                <div class="stat-info">
                  <p class="stat-label">Catalyst Efficiency</p>
                  <h3 class="stat-value" id="live-catalyst">--</h3>
                </div>
              </div>
            </div>
            <p style="margin-top:1rem; font-size:0.75rem; color:var(--color-text-muted);">
              Last updated: <span id="live-timestamp">--</span>
            </p>
          </div>

          <!-- Carbon Ring -->
          <div class="card glass carbon-ring-card">
            <h3>Monthly Emissions</h3>
            <div class="chart-container" style="position: relative; height: 200px; width: 100%; display: flex; justify-content: center; align-items: center;">
              <canvas id="carbonRingChart"></canvas>
              <div class="ring-center-text" style="position: absolute; text-align: center;">
                 <span style="font-size: 1.5rem; font-weight: 700; color: var(--color-primary);">--</span><br>
                 <span style="font-size: 0.8rem; color: var(--color-text-muted);">kg CO₂</span>
              </div>
            </div>
            <p style="text-align: center; margin-top: 1rem; font-size: 0.9rem; color: var(--color-text-muted);">Goal: 300 kg CO₂</p>
          </div>

          <!-- Quick Stats -->
          <div class="quick-stats">
            <div class="stat-card card glass">
               <div class="stat-icon" style="color: var(--color-secondary);">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
               </div>
               <div class="stat-info">
                 <p class="stat-label">Total Mileage</p>
                 <h3 class="stat-value">-- <small>mi</small></h3>
               </div>
            </div>
            <div class="stat-card card glass">
               <div class="stat-icon" style="color: var(--color-primary);">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"></path><path d="m19 9-5 5-4-4-3 3"></path></svg>
               </div>
               <div class="stat-info">
                 <p class="stat-label">Avg. Efficiency</p>
                 <h3 class="stat-value">-- <small>MPG</small></h3>
               </div>
            </div>
            <div class="stat-card card glass alert-bg-soft" style="background-color: var(--color-alert-success-bg);">
               <div class="stat-icon" style="color: var(--color-alert-success);">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path></svg>
               </div>
               <div class="stat-info">
                 <p class="stat-label">Trees to Offset</p>
                 <h3 class="stat-value" style="color: var(--color-alert-success);">--</h3>
               </div>
            </div>
          </div>

          <!-- Fleet Summary -->
          <div class="card glass fleet-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
               <h3>Fleet Summary</h3>
               <a href="/profile" class="btn btn-sm" data-link style="font-size: 0.8rem; padding: 0.25rem 0.5rem; border: 1px solid var(--color-text-muted); color: var(--color-text-muted);">Manage</a>
            </div>
            <ul class="fleet-list" id="dashboard-fleet-list">
              <li class="skeleton-text" style="height: 40px; border-radius: 8px;"></li>
              <li class="skeleton-text" style="height: 40px; border-radius: 8px;"></li>
            </ul>
          </div>

          <!-- ── HISTORY SECTION ── -->
          <div class="card glass" style="grid-column: 1 / -1; margin-top: 1.5rem;">
            <h3 style="margin-bottom: 1.5rem;">📊 History &amp; Summary</h3>

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

            <!-- Risk Breakdown + Chart side by side -->
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

        </div>
      </main>
    </div>
  `;
}

function updateLiveUI(data) {
   if (!data) return;
   const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val ?? '--';
   };
   set('live-pollution-score', data.pollution_score);
   set('live-combustion-score', data.combustion_score);
   set('live-aftertreatment-score', data.aftertreatment_score);
   set('live-fuel-trim', data.fuel_trim_score);
   set('live-lambda', data.lambda_stability_score);
   set('live-catalyst', data.catalyst_efficiency_score);
   set('live-timestamp', data.timestamp);

   const badge = document.getElementById('live-risk-badge');
   if (badge) {
      badge.innerText = data.risk ?? '--';
      badge.style.color = '#fff';
      if (data.risk === 'LOW RISK') badge.style.background = '#22c55e';
      else if (data.risk === 'MODERATE') badge.style.background = '#f59e0b';
      else if (data.risk === 'HIGH RISK') badge.style.background = '#ef4444';
      else badge.style.background = '#e2e8f0';
   }
}

function renderHistory(rows) {
   if (!rows || rows.length === 0) {
      document.getElementById('history-table-body').innerHTML =
         '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--color-text-muted);">No history yet.</td></tr>';
      return;
   }

   // Summary stats
   const scores = rows.map(r => r.pollution_score).filter(s => s != null);
   const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
   const best = Math.max(...scores);
   const worst = Math.min(...scores);

   const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
   set('hist-avg-pollution', avg.toFixed(1));
   set('hist-total-readings', rows.length);
   set('hist-best-score', best.toFixed(1));
   set('hist-worst-score', worst.toFixed(1));

   // Risk breakdown
   const low  = rows.filter(r => r.risk === 'LOW RISK').length;
   const mod  = rows.filter(r => r.risk === 'MODERATE').length;
   const high = rows.filter(r => r.risk === 'HIGH RISK').length;
   const total = rows.length;

   const lowPct  = Math.round((low / total) * 100);
   const modPct  = Math.round((mod / total) * 100);
   const highPct = Math.round((high / total) * 100);

   set('risk-low-pct',  `${lowPct}%`);
   set('risk-mod-pct',  `${modPct}%`);
   set('risk-high-pct', `${highPct}%`);

   setTimeout(() => {
      const lowBar  = document.getElementById('risk-low-bar');
      const modBar  = document.getElementById('risk-mod-bar');
      const highBar = document.getElementById('risk-high-bar');
      if (lowBar)  lowBar.style.width  = `${lowPct}%`;
      if (modBar)  modBar.style.width  = `${modPct}%`;
      if (highBar) highBar.style.width = `${highPct}%`;
   }, 100);

   // Line chart — last 20 readings reversed (oldest → newest)
   const chartRows = [...rows].reverse().slice(0, 20);
   const chartCtx = document.getElementById('historyLineChart');
   if (chartCtx && window.Chart) {
      if (window._historyChart) window._historyChart.destroy();
      window._historyChart = new Chart(chartCtx, {
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
   document.getElementById('history-table-body').innerHTML = rows.map(r => `
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

export async function init(state) {
   if (!state.user) return;

   // Fetch trips and vehicles
   const { data: trips } = await supabase.from('trips').select('*').eq('user_id', state.user.id);
   const { data: vehicles } = await supabase.from('vehicles').select('*').eq('user_id', state.user.id).limit(3);

   let totalMiles = 0, totalCO2 = 0;
   if (trips && trips.length > 0) {
      trips.forEach(t => {
         totalMiles += Number(t.distance_miles);
         totalCO2 += Number(t.co2_kg);
      });
   }

   // ── Live Pollution Score ──
   const { data: liveData } = await supabase
      .from('results').select('*').order('created_at', { ascending: false }).limit(1).single();
   updateLiveUI(liveData);

   // ── History (last 50 readings) ──
   const { data: historyData } = await supabase
      .from('results').select('*').order('created_at', { ascending: false }).limit(50);
   renderHistory(historyData);

   // ── Auto refresh every 5 seconds ──
   setInterval(async () => {
      const { data: fresh } = await supabase
         .from('results').select('*').order('created_at', { ascending: false }).limit(1).single();
      updateLiveUI(fresh);

      const { data: freshHistory } = await supabase
         .from('results').select('*').order('created_at', { ascending: false }).limit(50);
      renderHistory(freshHistory);
   }, 5000);

   // Fleet UI
   let avgEfficiency = 0;
   if (vehicles && vehicles.length > 0) {
      let totalMpg = 0, count = 0;
      vehicles.forEach(v => { if (v.avg_mpg) { totalMpg += Number(v.avg_mpg); count++; } });
      if (count > 0) avgEfficiency = totalMpg / count;
   }

   const treesToOffset = Math.ceil(totalCO2 / 21);
   const statsElements = document.querySelectorAll('.stat-value');
   if (statsElements.length >= 3) {
      statsElements[0].innerHTML = `${totalMiles.toLocaleString()} <small>mi</small>`;
      statsElements[1].innerHTML = `${avgEfficiency.toFixed(1)} <small>MPG</small>`;
      statsElements[2].innerHTML = treesToOffset.toString();
   }

   const fleetList = document.getElementById('dashboard-fleet-list');
   if (fleetList) {
      if (!vehicles || vehicles.length === 0) {
         fleetList.innerHTML = '<li style="text-align:center; padding: 1rem; color: var(--color-text-muted);">No vehicles registered yet.</li>';
      } else {
         fleetList.innerHTML = vehicles.map((v, index) => {
            const isOptimal = v.fuel_type === 'EV' || v.fuel_type === 'Hybrid' || v.avg_mpg > 30;
            const statusClass = isOptimal ? 'status-good' : 'status-warning';
            const statusText = isOptimal ? 'Optimal' : 'High Emission';
            const colorClass = isOptimal ? '' : 'color: var(--color-alert-danger);';
            const borderTop = index > 0 ? 'margin-top: 1rem; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 1rem;' : '';
            return `
              <li class="fleet-item" style="${borderTop}">
                 <div class="fleet-icon" style="${colorClass}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a2 2 0 0 0-1.6-.8H9.3a2 2 0 0 0-1.6.8L5 11l-5.16.86a1 1 0 0 0-.84.99V16h3m10 0a3 3 0 1 1-6 0m10 0a3 3 0 1 1-6 0"></path></svg></div>
                 <div class="fleet-details">
                    <p class="fleet-name">${v.year || ''} ${v.make} ${v.model}</p>
                    <p class="fleet-type">${v.fuel_type} ${v.avg_mpg ? `• ${v.avg_mpg} MPG avg` : ''}</p>
                 </div>
                 <div class="fleet-status ${statusClass}">${statusText}</div>
              </li>
            `;
         }).join('');
      }
   }

   // Carbon Ring Chart
   const ctx = document.getElementById('carbonRingChart');
   const centerText = document.querySelector('.ring-center-text span');
   if (centerText) centerText.innerText = Math.round(totalCO2).toString();
   if (ctx && window.Chart) {
      const root = getComputedStyle(document.documentElement);
      const primaryColor = root.getPropertyValue('--color-primary').trim() || '#004D4D';
      const goal = 300;
      const remaining = Math.max(0, goal - totalCO2);
      const overage = Math.max(0, totalCO2 - goal);
      let chartData = [totalCO2, remaining];
      let chartColors = [primaryColor, '#E2E8F0'];
      if (overage > 0) { chartData = [goal, overage]; chartColors = [primaryColor, '#D48C00']; }
      new Chart(ctx, {
         type: 'doughnut',
         data: {
            labels: ['Current Emissions', 'Remaining/Overage'],
            datasets: [{ data: chartData, backgroundColor: chartColors, borderWidth: 0, cutout: '80%', borderRadius: 20 }]
         },
         options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            animation: { animateScale: true, animateRotate: true }
         }
      });
   }

   // Leaf animation
   const leafIcon = document.getElementById('eco-leaf-icon');
   if (leafIcon && state.ecoStreak > 5) {
      setTimeout(() => leafIcon.classList.add('growing'), 500);
      setTimeout(() => leafIcon.classList.remove('growing'), 1500);
   }
}
