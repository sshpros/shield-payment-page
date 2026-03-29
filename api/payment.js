import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
const url = new URL(req.url, `https://${req.headers.host}`);
const invoiceId = url.searchParams.get("invoice_id");

if (!invoiceId) {
  return res.status(400).send("Missing invoice_id");
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const nmiPublicKey = process.env.NMI_PUBLIC_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const { data: invoice, error } = await supabase
  .from("invoices")
  .select("*")
  .eq("id", invoiceId)
  .single();

if (error || !invoice) {
  return res.status(404).send(notFoundHtml());
}

if (invoice.balance_due <= 0) {
  res.setHeader("Content-Type", "text/html");
  return res.status(200).send(paidHtml(invoice));
}

const processUrl = `${supabaseUrl}/functions/v1/process-payment`;

const depositAmount = invoice.deposit_amount || 0;
const depositPaid = invoice.deposit_paid || false;
const totalAmount = invoice.total_amount || invoice.balance_due;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Shield Low Voltage — Payment</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
  background: linear-gradient(145deg, #0a0e1a 0%, #0d1117 50%, #0f1520 100%);
  color: #FFFFFF;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}
.header {
  text-align: center;
  margin: 40px 0 32px;
}
.shield-icon {
  width: 56px; height: 56px;
  background: linear-gradient(135deg, #1a5fc7, #3b82f6);
  border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 8px 32px rgba(59,130,246,0.3);
}
.shield-icon svg { width: 28px; height: 28px; fill: white; }
.header h1 {
  font-size: 24px; font-weight: 700;
  letter-spacing: -0.3px;
}
.header p {
  font-size: 14px; color: #6b7280; margin-top: 4px;
}
.container {
  background: rgba(22, 27, 34, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 0;
  max-width: 460px;
  width: 100%;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}
.invoice-section {
  padding: 24px 24px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.invoice-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px;
}
.invoice-number {
  font-size: 13px; color: #6b7280;
  font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase;
}
.invoice-status {
  font-size: 12px; font-weight: 600;
  padding: 4px 10px; border-radius: 20px;
}
.status-pending { background: rgba(234,179,8,0.15); color: #eab308; }
.status-partial { background: rgba(59,130,246,0.15); color: #3b82f6; }
.customer-name {
  font-size: 18px; font-weight: 600; margin-bottom: 16px;
  letter-spacing: -0.2px;
}
.amount-grid {
  display: grid; gap: 10px;
}
.amount-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px;
  background: rgba(255,255,255,0.03);
  border-radius: 10px;
}
.amount-row .label { font-size: 14px; color: #9ca3af; }
.amount-row .value { font-size: 14px; font-weight: 600; }
.amount-row.total {
  background: linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.06));
  border: 1px solid rgba(59,130,246,0.2);
}
.amount-row.total .value {
  color: #60a5fa; font-size: 22px; font-weight: 700;
}
.deposit-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; padding: 4px 10px;
  border-radius: 8px; margin-top: 8px;
}
.deposit-paid { background: rgba(34,197,94,0.12); color: #22c55e; }
.deposit-unpaid { background: rgba(234,179,8,0.12); color: #eab308; }

.payment-section { padding: 24px; }
.method-toggle {
  display: flex; gap: 8px; margin-bottom: 24px;
  background: rgba(255,255,255,0.04);
  border-radius: 12px; padding: 4px;
}
.method-btn {
  flex: 1; padding: 10px; border: none;
  border-radius: 10px; font-size: 14px; font-weight: 600;
  cursor: pointer; transition: all 0.25s ease;
  background: transparent; color: #6b7280;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.method-btn.active {
  background: linear-gradient(135deg, #1a5fc7, #3b82f6);
  color: white;
  box-shadow: 0 4px 12px rgba(59,130,246,0.3);
}
.method-btn svg { width: 18px; height: 18px; fill: currentColor; }

.fields-group { display: none; }
.fields-group.active { display: block; }

.field-label {
  font-size: 12px; color: #6b7280; margin-bottom: 6px;
  display: block; font-weight: 500; letter-spacing: 0.3px;
  text-transform: uppercase;
}
.collect-field {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
  min-height: 48px;
  transition: border-color 0.2s ease;
}
.collect-field:focus-within {
  border-color: rgba(59,130,246,0.5);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
}
.collect-field iframe { min-height: 20px !important; }
.row-2 { display: flex; gap: 12px; }
.row-2 > div { flex: 1; }

.save-vault {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 20px; padding: 12px 14px;
  background: rgba(255,255,255,0.03);
  border-radius: 10px; cursor: pointer;
  user-select: none;
}
.save-vault input[type="checkbox"] {
  width: 18px; height: 18px; accent-color: #3b82f6;
  cursor: pointer;
}
.save-vault label {
  font-size: 13px; color: #9ca3af; cursor: pointer;
}

#pay-btn {
  width: 100%; padding: 16px;
  background: linear-gradient(135deg, #1a5fc7, #3b82f6);
  color: #FFFFFF; border: none;
  border-radius: 14px; font-size: 17px;
  font-weight: 600; cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 8px 24px rgba(59,130,246,0.3);
  letter-spacing: -0.2px;
}
#pay-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 32px rgba(59,130,246,0.4);
}
#pay-btn:active { transform: translateY(0); }
#pay-btn:disabled {
  opacity: 0.5; cursor: not-allowed;
  transform: none; box-shadow: none;
}

#status {
  text-align: center; margin-top: 16px;
  font-size: 14px; min-height: 20px;
}
.success { color: #22c55e; }
.error { color: #ef4444; }
.processing { color: #eab308; }

.footer {
  text-align: center; margin-top: 24px;
  font-size: 12px; color: #4b5563;
}
.footer svg { width: 14px; height: 14px; fill: #4b5563; vertical-align: -2px; margin-right: 4px; }

.success-container {
  padding: 48px 24px; text-align: center;
}
.success-icon {
  width: 64px; height: 64px;
  background: rgba(34,197,94,0.12);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 20px;
}
.success-icon svg { width: 32px; height: 32px; fill: #22c55e; }
</style>
</head>
<body>

<div class="header">
<div class="shield-icon">
  <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v2h-2V7zm0 4h2v6h-2v-6z"/></svg>
</div>
<h1>Shield Low Voltage</h1>
<p>Secure Payment Portal</p>
</div>

<div class="container">
<div class="invoice-section">
  <div class="invoice-header">
    <span class="invoice-number">Invoice ${invoice.invoice_number || invoiceId.slice(0, 8).toUpperCase()}</span>
    <span class="invoice-status ${depositPaid ? 'status-partial' : 'status-pending'}">
      ${depositPaid ? 'Deposit Paid' : 'Payment Due'}
    </span>
  </div>
  <div class="customer-name">${invoice.customer_name || 'Customer'}</div>
  <div class="amount-grid">
    <div class="amount-row">
      <span class="label">Invoice Total</span>
      <span class="value">$${Number(totalAmount).toFixed(2)}</span>
    </div>
    ${depositAmount > 0 ? `
    <div class="amount-row">
      <span class="label">Deposit</span>
      <span class="value" style="color: ${depositPaid ? '#22c55e' : '#eab308'}">
        ${depositPaid ? '−' : ''}$${Number(depositAmount).toFixed(2)}
        ${depositPaid ? ' ✓' : ' (unpaid)'}
      </span>
    </div>` : ''}
    ${(invoice.payments_made || 0) > 0 ? `
    <div class="amount-row">
      <span class="label">Payments Made</span>
      <span class="value" style="color: #22c55e">−$${Number(invoice.payments_made).toFixed(2)}</span>
    </div>` : ''}
    <div class="amount-row total">
      <span class="label">Balance Due</span>
      <span class="value">$${Number(invoice.balance_due).toFixed(2)}</span>
    </div>
  </div>
</div>

<div class="payment-section">
  <div class="method-toggle">
    <button class="method-btn active" id="card-tab" onclick="switchMethod('card')">
      <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
      Credit Card
    </button>
    <button class="method-btn" id="ach-tab" onclick="switchMethod('ach')">
      <svg viewBox="0 0 24 24"><path d="M4 10h3v7H4zm6.5 0h3v7h-3zM2 19h20v3H2zm15-9h3v7h-3zm-5-9L2 6v2h20V6z"/></svg>
      Bank Account
    </button>
  </div>

  <!-- Credit Card Fields -->
  <div id="card-fields" class="fields-group active">
    <label class="field-label">Card Number</label>
    <div id="ccnumber" class="collect-field"></div>
    <div class="row-2">
      <div>
        <label class="field-label">Expiration</label>
        <div id="ccexp" class="collect-field"></div>
      </div>
      <div>
        <label class="field-label">CVV</label>
        <div id="cvv" class="collect-field"></div>
      </div>
    </div>
  </div>

  <!-- ACH / Bank Account Fields -->
  <div id="ach-fields" class="fields-group">
    <label class="field-label">Account Holder Name</label>
    <div id="checkname" class="collect-field"></div>
    <label class="field-label">Routing Number</label>
    <div id="checkaba" class="collect-field"></div>
    <label class="field-label">Account Number</label>
    <div id="checkaccount" class="collect-field"></div>
  </div>

  <div class="save-vault">
    <input type="checkbox" id="save-payment" checked>
    <label for="save-payment">Save payment method for future use</label>
  </div>

  <button id="pay-btn" onclick="submitPayment()">
    Pay $${Number(invoice.balance_due).toFixed(2)}
  </button>
  <div id="status"></div>
</div>
</div>

<div class="footer">
<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>
Secured by NMI &bull; PCI-DSS Compliant
</div>

<script src="https://secure.nmi.com/token/Collect.js"
data-tokenization-key="${nmiPublicKey}"
data-variant="inline"
data-field-ccnumber-selector="#ccnumber"
data-field-ccexp-selector="#ccexp"
data-field-cvv-selector="#cvv"
data-field-checkname-selector="#checkname"
data-field-checkaba-selector="#checkaba"
data-field-checkaccount-selector="#checkaccount"
data-style-input="color: #FFFFFF; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: transparent; border: none; outline: none;"
data-style-input-placeholder="color: #4b5563;"
></script>

<script>
let paymentToken = null;
let currentMethod = 'card';

document.addEventListener('DOMContentLoaded', function() {
  if (typeof CollectJS !== 'undefined') {
    CollectJS.configure({
      callback: function(response) {
        paymentToken = response.token;
        submitToServer();
      }
    });
  }
});

function switchMethod(method) {
  currentMethod = method;
  document.getElementById('card-fields').classList.toggle('active', method === 'card');
  document.getElementById('ach-fields').classList.toggle('active', method === 'ach');
  document.getElementById('card-tab').classList.toggle('active', method === 'card');
  document.getElementById('ach-tab').classList.toggle('active', method === 'ach');
}

function submitPayment() {
  const btn = document.getElementById('pay-btn');
  const status = document.getElementById('status');
  btn.disabled = true;
  status.className = 'processing';
  status.textContent = 'Processing...';
  CollectJS.startPaymentRequest();
}

async function submitToServer() {
  const btn = document.getElementById('pay-btn');
  const status = document.getElementById('status');
  const saveToVault = document.getElementById('save-payment').checked;

  try {
    const res = await fetch('${processUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_token: paymentToken,
        invoice_id: '${invoiceId}',
        amount: ${invoice.balance_due},
        payment_method: currentMethod,
        save_to_vault: saveToVault,
        customer_name: '${(invoice.customer_name || '').replace(/'/g, "\\'")}',
        customer_email: '${(invoice.customer_email || '').replace(/'/g, "\\'")}'
      })
    });

    const data = await res.json();

    if (data.success) {
      document.querySelector('.payment-section').innerHTML = \`
        <div class="success-container">
          <div class="success-icon">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          </div>
          <h2 style="font-size: 22px; font-weight: 700; margin-bottom: 8px;">Payment Successful</h2>
          <p style="color: #9ca3af; font-size: 15px;">Thank you for your payment of <strong style="color: #fff;">$${Number(invoice.balance_due).toFixed(2)}</strong></p>
          <p style="color: #6b7280; font-size: 13px; margin-top: 12px;">A confirmation will be sent to your email.</p>
        </div>
      \`;
    } else {
      status.className = 'error';
      status.textContent = data.error || 'Payment failed. Please try again.';
      btn.disabled = false;
    }
  } catch (e) {
    status.className = 'error';
    status.textContent = 'Connection error. Please try again.';
    btn.disabled = false;
  }
}
</script>
</body>
</html>`;

res.setHeader("Content-Type", "text/html");
return res.status(200).send(html);
}

function notFoundHtml() {
return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Not Found</title>
<style>
body { font-family: -apple-system, sans-serif; background: #0a0e1a; color: #fff;
display: flex; justify-content: center; align-items: center; min-height: 100vh; }
.container { text-align: center; padding: 32px; }
h2 { color: #ef4444; margin-bottom: 8px; }
p { color: #6b7280; }
</style></head><body><div class="container">
<h2>Invoice Not Found</h2>
<p>This invoice could not be located. Please check the link and try again.</p>
</div></body></html>`;
}

function paidHtml(invoice) {
return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Payment Complete — Shield Low Voltage</title>
<style>
body { font-family: -apple-system, sans-serif; background: linear-gradient(145deg, #0a0e1a, #0d1117);
color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
.container { text-align: center; padding: 48px 32px; max-width: 400px; }
.icon { width: 72px; height: 72px; background: rgba(34,197,94,0.12); border-radius: 50%;
display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
.icon svg { width: 36px; height: 36px; fill: #22c55e; }
h2 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
p { color: #6b7280; font-size: 15px; line-height: 1.5; }
.invoice { color: #9ca3af; font-size: 13px; margin-top: 16px; }
</style></head><body><div class="container">
<div class="icon"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>
<h2>Invoice Paid in Full</h2>
<p>Thank you for your payment!</p>
<p class="invoice">Invoice ${invoice.invoice_number || ''} &bull; ${invoice.customer_name || ''}</p>
</div></body></html>`;
}
