/**
 * @file Placements (build brief slide 13). The table exists in the data model now; the screen ships in V2
 * (G-01 to G-05, G-08), so this page explains what is coming instead of showing a half-built tool.
 */
import { ctx } from '../context.js';

/** Planned placement features with their story IDs and phase. */
const PLANNED = [
  ['Placement details: engagement, dates, extension likelihood, next deal', 'G-01, G-05', 'V2'],
  ['Roll-off timeline at 90 and 180 days', 'G-02', 'V2'],
  ['“Hunt” flag and BD task when someone rolls off with no next assignment', 'G-03', 'V2'],
  ['Hours per placement from Buddy Punch', 'G-04', 'V2'],
  ['Candidates tracked as placements with status “candidate”', 'G-08', 'V2'],
  ['Revenue at risk from ending placements', 'G-06', 'V3'],
];

export function renderPlacements(root) {
  void ctx; // signed-in context is required by the router; nothing to read yet
  root.innerHTML = `<div class="pagehead"><div><h1>Placements</h1><div class="sub">Who is placed where, who is rolling off, and what it means for revenue</div></div></div>
  <div class="card placeholder" style="max-width:760px"><div class="cardh"><h2>Coming in V2</h2><span class="v2">V2</span></div>
    <p class="muted" style="margin-top:0">The MVP replaces HubSpot first. Placement records already exist in the data model, with bill rate, cost rate and margin restricted to Finance and Admin, so this screen can be added without changing anything else.</p>
    <ul class="mini">${PLANNED.map(([l, ids, phase]) => `<li><span class="tx">${l}<span> · ${ids}</span></span><span class="v2">${phase}</span></li>`).join('')}</ul></div>`;
}
