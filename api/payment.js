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
  return res.status(404).send("Invoice not found");
}

if (invoice.balance_due <= 0) {
  res.setHeader("Content-Type", "text/html");
  return res.status(200).send(paidHtml(invoice));
}

const processUrl = `${supabaseUrl}/functions/v1/process-payment`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Shield Low Voltage — Payment</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
  background: #0D1117;
  color: #FFFFFF;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}
.container {
  background: #161B22;
  border-radius: 16px;
  border: 1px solid #30363D;
  padding: 32px;
  max-width: 480px;
  width: 100%;
}
.logo {
  text-align: center;
  margin-bottom: 24px;
}
.logo h1 {
  font-size: 22px;
  font-weight: 700;
  color: #4A90D9;
}
.logo p {
  font-size: 13px;
  color: #8B949E;
  margin-top: 4px;
}
.invoice-info {
  background: #0D1117;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
  border: 1px solid #21262D;
}
.invoice-info .row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}
.invoice-info .row:last-child { margin-bottom: 0; }
.invoice-info .label { color: #8B949E; font-size: 14px; }
.invoice-info .value { color: #FFFFFF; font-size: 14px; font-weight: 600; }
.invoice-info .total .value {
  color: #4A90D9;
  font-size: 20px;
  font-weight: 700;
}
.field-label {
  font-size: 13px;
  color: #8B949E;
  margin-bottom: 6px;
  display: block;
}
.collect-field {
  background: #0D1117;
  border: 1px solid #30363D;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 16px;
  min-height: 48px;
}
.collect-field iframe { min-height: 20px !important; }
#pay-btn {
  width: 100%;
  padding: 16px;
  background: #4A90D9;
  color: #FFFFFF;
  border: none;
  border-radius: 12px;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
  transition: opacity 0.2s;
}
#pay-btn:hover { opacity: 0.9; }
#pay-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
#status {
  text-align: center;
  margin-top: 16px;
  font-size: 14px;
  min-height: 20px;
}
.success { color: #3FB950; }
.error { color: #F85149; }
.processing { color: #D29922; }
</style>
</head>
<body>
<div class="container">
<div class="logo">
  <h1>Shield Low Voltage</h1>
  <p>Secure Payment</p>
</div>

<div class="invoice-info">
  <div class="row">
    <span class="label">Invoice</span>
    <span class="value">${invoice.invoice_number || invoiceId.slice(0, 8)}</span>
  </div>
  <div class="row">
    <span class="label">Customer</span>
    <span class="value">${invoice.customer_name || 'N/A'}</span>
  </div>
  <div class="row total">
    <span class="label">Amount Due</span>
    <span class="value">$${Number(invoice.balance_due).toFixed(2)}</span>
  </div>
</div>

<label class="field-label">Card Number</label>
<div id="ccnumber" class="collect-field"></div>

<div style="display: flex; gap: 12px;">
  <div style="flex: 1;">
    <label class="field-label">Expiration</label>
    <div id="ccexp" class="collect-field"></div>
  </div>
  <div style="flex: 1;">
    <label class="field-label">CVV</label>
    <div id="cvv" class="collect-field"></div>
  </div>
</div>

<button id="pay-btn" onclick="submitPayment()">
  Pay $${Number(invoice.balance_due).toFixed(2)}
</button>
<div id="status"></div>
</div>

<script src="https://secure.nmi.com/token/Collect.js"
      data-tokenization-key="${nmiPublicKey}"
      data-variant="inline"
      data-field-ccnumber-selector="#ccnumber"
      data-field-ccexp-selector="#ccexp"
      data-field-cvv-selector="#cvv"
      data-style-input="color: #FFFFFF; font-size: 16px; font-family: -apple-system, sans-serif; background: transparent; border: none; outline: none;"
></script>

<script>
let paymentToken = null;

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

  try {
    const res = await fetch('${processUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_token: paymentToken,
        invoice_id: '${invoiceId}',
        amount: ${invoice.balance_due}
      })
    });

    const data = await res.json();

    if (data.success) {
      status.className = 'success';
      status.textContent = 'Payment successful! Thank you.';
      btn.textContent = 'Paid';
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

function paidHtml(invoice) {
return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Payment Complete</title>
<style>
body { font-family: -apple-system, sans-serif; background: #0D1117; color: #fff;
display: flex; justify-content: center; align-items: center; min-height: 100vh; }
.container { text-align: center; padding: 32px; }
.check { font-size: 64px; margin-bottom: 16px; }
h2 { color: #3FB950; margin-bottom: 8px; }
p { color: #8B949E; }
</style></head><body><div class="container">
<div class="check">✓</div>
<h2>Invoice Paid</h2>
<p>This invoice has been paid in full. Thank you!</p>
</div></body></html>`;
}
