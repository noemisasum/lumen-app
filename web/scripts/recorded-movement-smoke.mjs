import assert from 'node:assert/strict';
import { summarizeRecordedMovements } from '../src/lib/recorded-movement.ts';
import { movementWindowStart } from '../src/lib/dashboard-dates.ts';
import { buildLedgerDashboardPayload } from '../src/lib/server/ledger-dashboard.ts';
const transactions = [
 {id:'receipt', entityId:'e', bankAccountId:'a', source:'manual',transactionDate:'2026-10-21',description:'Customer',signedAmount:100,amount:100,direction:'inflow',currency:'USD',status:'posted'},
 {id:'payment', entityId:'e', bankAccountId:'b', source:'manual',transactionDate:'2026-10-21',description:'Unrelated supplier',signedAmount:-100,amount:100,direction:'outflow',currency:'USD',status:'posted'},
];
const summary = (items, usdRates=new Map([["USD",{status:"available",rateToUsd:1}]])) => summarizeRecordedMovements(buildLedgerDashboardPayload({entities:[{id:'e',name:'Fictional',code:null,orgId:'o'}],accounts:[{id:'a',entityId:'e',accountName:'A',currency:'USD',status:'active',source:'manual'},{id:'b',entityId:'e',accountName:'B',currency:'USD',status:'active',source:'manual'}],balances:[],transactions:items,usdRates}).transactionBreakdowns);
const matched = summary(transactions);
assert.equal(matched.usdInflow,100);assert.equal(matched.usdOutflow,100);assert.equal(matched.usdNet,0);assert.equal(matched.headline,'Zero Net Recorded Movement');
assert.equal(summary([transactions[0]]).headline,'Net Recorded Inflow');
assert.equal(summary([transactions[1]]).headline,'Net Recorded Outflow');
const missing={...transactions[1],currency:'EUR'};
assert.equal(summary([missing]).headline,'USD Estimate Unavailable');
const partial=summary([transactions[0],missing]);assert.equal(partial.partial,true);assert.equal(partial.converted,1);assert.equal(partial.count,2);
assert.equal(summary([]).headline,'No Recorded Movements');
for (const [asAt,days,expected] of [['2026-10-21',30,'2026-09-22'],['2026-10-21',1,'2026-10-21'],['2024-03-01',30,'2024-02-01'],['2026-01-02',7,'2025-12-27']]) {
 const start=movementWindowStart(asAt,days);assert.equal(start,expected);
 assert.equal((Date.parse(asAt)-Date.parse(start))/86400000+1,days);
 const preceding=new Date(Date.parse(start)-86400000).toISOString().slice(0,10);
 assert.equal([preceding,start,asAt].filter(d=>d>=start&&d<=asAt).length,2);
}
// Separate source/currency groups must cancel at monetary precision in either direction.
for (const nets of [[0.10, 0.20, -0.30], [-0.10, -0.20, 0.30]]) {
 const cancelled = summarizeRecordedMovements(nets.map(net => ({
  transactionCount: 1, usdConvertibleTransactionCount: 1,
  usdInflow: Math.max(0, net), usdOutflow: Math.max(0, -net), usdNet: net,
 })));
 assert.equal(cancelled.usdNet, 0);
 assert.equal(cancelled.usdInflow, 0.30);
 assert.equal(cancelled.usdOutflow, 0.30);
 assert.equal(cancelled.headline, 'Zero Net Recorded Movement');
}
console.log('recorded movement smoke passed');
