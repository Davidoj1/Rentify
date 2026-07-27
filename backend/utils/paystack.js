const PAYSTACK_BASE = 'https://api.paystack.co';

function getSecretKey() {
  return process.env.PAYSTACK_SECRET_KEY || '';
}

export function getPaymentMode() {
  const publicKey = process.env.PAYSTACK_PUBLIC_KEY || '';
  const secretKey = getSecretKey();

  return {
    provider: 'Paystack',
    mode: secretKey.startsWith('sk_live_') ? 'live' : 'test',
    configured:
      publicKey.startsWith('pk_test_') ||
      publicKey.startsWith('pk_live_') ||
      secretKey.startsWith('sk_test_') ||
      secretKey.startsWith('sk_live_'),
    commissionRate: Number(process.env.PLATFORM_FEE_RATE || 0.04),
    publicKey: publicKey || 'missing_public_key'
  };
}

export async function initializePayment({ email, amount, reference, metadata }) {
  const secretKey = getSecretKey();

  if (!secretKey || secretKey.includes('your_key_here')) {
    throw new Error('Paystack secret key is missing. Add PAYSTACK_SECRET_KEY to backend/.env.');
  }

  const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/#/payment/verify?reference=${encodeURIComponent(reference)}`;

  const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amount * 100), // Paystack amount is in kobo
      reference,
      callback_url: callbackUrl,
      metadata
    })
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    throw new Error(data.message || 'Could not initialize Paystack payment.');
  }

  return data.data;
}

export async function verifyPayment(reference) {
  const secretKey = getSecretKey();

  if (!secretKey || secretKey.includes('your_key_here')) {
    throw new Error('Paystack secret key is missing. Add PAYSTACK_SECRET_KEY to backend/.env.');
  }

  const response = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`
    }
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    throw new Error(data.message || 'Could not verify Paystack payment.');
  }

  return data.data;
}
