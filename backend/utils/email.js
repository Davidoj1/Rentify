const RESEND_API_URL = 'https://api.resend.com/emails';

function getConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY || '',
    from:
      process.env.EMAIL_FROM ||
      'Rentify <onboarding@resend.dev>'
  };
}

export function getEmailMode() {
  const {
    apiKey,
    from
  } = getConfig();

  return {
    provider: 'Resend',
    configured: Boolean(apiKey),
    from
  };
}

function safeString(
  value,
  fallback = ''
) {
  return String(
    value ?? fallback
  ).trim();
}

function escapeHtml(value) {
  return safeString(value)
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      "'",
      '&#039;'
    );
}

function layout({
  title,
  preheader = '',
  body
}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>

<body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,Helvetica,sans-serif;line-height:1.6">

<div style="display:none;max-height:0;overflow:hidden;opacity:0">
${escapeHtml(preheader)}
</div>

<table
  role="presentation"
  width="100%"
  cellspacing="0"
  cellpadding="0"
  style="background:#f8fafc;padding:32px 16px"
>
<tr>
<td align="center">

<table
  role="presentation"
  width="100%"
  cellspacing="0"
  cellpadding="0"
  style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden"
>

<tr>
<td
  style="background:#0f766e;padding:24px 28px;color:#ffffff"
>
<div style="font-size:22px;font-weight:800">
Rentify
</div>

<div style="font-size:13px;opacity:.9;margin-top:3px">
Nigeria's rental marketplace
</div>
</td>
</tr>

<tr>
<td style="padding:30px 28px">
${body}
</td>
</tr>

<tr>
<td
  style="padding:20px 28px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px"
>
Rentify.ng · Lagos, Nigeria<br>
Questions? Contact support@rentify.ng
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>`;
}

export async function sendEmail({
  to,
  subject,
  html,
  idempotencyKey
}) {
  const {
    apiKey,
    from
  } = getConfig();

  if (!apiKey) {
    console.warn(
      `Email skipped: RESEND_API_KEY is not configured. Subject: ${subject}`
    );

    return {
      skipped: true,
      reason: 'not_configured'
    };
  }

  const recipients =
    Array.isArray(to)
      ? to
      : [to];

  const validRecipients =
    recipients
      .map(value =>
        safeString(value)
      )
      .filter(Boolean);

  if (!validRecipients.length) {
    throw new Error(
      'Email recipient is missing.'
    );
  }

  const response =
    await fetch(
      RESEND_API_URL,
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${apiKey}`,

          'Content-Type':
            'application/json',

          ...(idempotencyKey
            ? {
                'Idempotency-Key':
                  safeString(
                    idempotencyKey
                  )
              }
            : {})
        },

        body: JSON.stringify({
          from,
          to: validRecipients,
          subject:
            safeString(subject),
          html
        })
      }
    );

  const data =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.message ||
      'Resend could not send the email.';

    throw new Error(message);
  }

  return {
    skipped: false,
    id:
      data?.id || null
  };
}

export async function sendWelcomeEmail({
  email,
  name
}) {
  const safeName =
    escapeHtml(
      name || 'there'
    );

  return sendEmail({
    to: email,

    subject:
      'Welcome to Rentify',

    idempotencyKey:
      `welcome:${safeString(email).toLowerCase()}`,

    html: layout({
      title:
        'Welcome to Rentify',

      preheader:
        'Your Rentify account is ready.',

      body: `
        <h1 style="margin:0 0 12px;font-size:28px">
          Welcome to Rentify, ${safeName}.
        </h1>

        <p>
          Your Rentify account has been created successfully.
        </p>

        <p>
          You can use one account to discover rentals,
          make bookings, and—when you are ready—start
          hosting your own listings.
        </p>

        <p style="margin-bottom:0">
          Thanks for joining the Rentify private beta.
        </p>
      `
    })
  });
}

export async function sendPaymentConfirmationEmail({
  email,
  name,
  bookingReference,
  listingTitle,
  startDate,
  endDate,
  total
}) {
  return sendEmail({
    to: email,

    subject:
      `Payment received — ${bookingReference}`,

    idempotencyKey:
      `payment-confirmed:${bookingReference}`,

    html: layout({
      title:
        'Payment received',

      preheader:
        `Your Rentify payment for ${listingTitle || 'your rental'} was verified.`,

      body: `
        <h1 style="margin:0 0 12px;font-size:28px">
          Payment received
        </h1>

        <p>
          Hello ${escapeHtml(name || 'there')},
          your Paystack payment has been successfully verified.
        </p>

        <div
          style="background:#f1f5f9;border-radius:14px;padding:18px;margin:20px 0"
        >
          <strong>
            ${escapeHtml(
              listingTitle ||
              'Rental booking'
            )}
          </strong>
          <br>

          ${escapeHtml(startDate)}
          →
          ${escapeHtml(endDate)}
          <br>

          Reference:
          ${escapeHtml(bookingReference)}
          <br>

          Total:
          ${escapeHtml(total)}
        </div>

        <p>
          Your booking is now recorded in your Rentify account.
          The owner can continue the booking process from
          their Hosting dashboard.
        </p>
      `
    })
  });
}

export async function sendOwnerNewBookingEmail({
  email,
  name,
  bookingReference,
  listingTitle,
  renterName,
  startDate,
  endDate,
  total
}) {
  return sendEmail({
    to: email,

    subject:
      `New paid booking — ${listingTitle || 'your listing'}`,

    idempotencyKey:
      `owner-new-booking:${bookingReference}`,

    html: layout({
      title:
        'New paid booking',

      preheader:
        `A renter has paid for ${listingTitle || 'your listing'}.`,

      body: `
        <h1 style="margin:0 0 12px;font-size:28px">
          You have a new paid booking
        </h1>

        <p>
          Hello ${escapeHtml(name || 'there')},
          a renter has successfully paid for your listing.
        </p>

        <div
          style="background:#f1f5f9;border-radius:14px;padding:18px;margin:20px 0"
        >
          <strong>
            ${escapeHtml(
              listingTitle ||
              'Rental booking'
            )}
          </strong>
          <br>

          Renter:
          ${escapeHtml(
            renterName ||
            'Rentify renter'
          )}
          <br>

          ${escapeHtml(startDate)}
          →
          ${escapeHtml(endDate)}
          <br>

          Reference:
          ${escapeHtml(bookingReference)}
          <br>

          Total paid:
          ${escapeHtml(total)}
        </div>

        <p>
          Sign in to Rentify to review and manage the booking.
        </p>
      `
    })
  });
}

export async function sendBookingStatusEmail({
  email,
  name,
  bookingReference,
  listingTitle,
  status,
  startDate,
  endDate
}) {
  const labels = {
    confirmed:
      'Booking confirmed',

    cancelled:
      'Booking cancelled',

    completed:
      'Booking completed'
  };

  const subject =
    `${labels[status] || 'Booking update'} — ${bookingReference}`;

  return sendEmail({
    to: email,

    subject,

    idempotencyKey:
      `booking-status:${status}:${bookingReference}`,

    html: layout({
      title:
        subject,

      preheader:
        `${labels[status] || 'Your booking has been updated'}.`,

      body: `
        <h1 style="margin:0 0 12px;font-size:28px">
          ${escapeHtml(
            labels[status] ||
            'Booking update'
          )}
        </h1>

        <p>
          Hello ${escapeHtml(name || 'there')},
          your Rentify booking has been updated.
        </p>

        <div
          style="background:#f1f5f9;border-radius:14px;padding:18px;margin:20px 0"
        >
          <strong>
            ${escapeHtml(
              listingTitle ||
              'Rental booking'
            )}
          </strong>
          <br>

          ${escapeHtml(startDate)}
          →
          ${escapeHtml(endDate)}
          <br>

          Reference:
          ${escapeHtml(bookingReference)}
          <br>

          Status:
          ${escapeHtml(status)}
        </div>

        <p>
          Sign in to your Rentify account for the latest
          booking details.
        </p>
      `
    })
  });
}