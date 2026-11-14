export function buildEmail({ provider = 'your provider', status, monthlyPrice, durationMonths }) {
  if (status === 'offer_obtained') {
    return {
      subject: `CallE: offer obtained from ${provider}`,
      body:
        `CallE obtained an offer from ${provider}: $${monthlyPrice} per month for ${durationMonths} months.\n` +
        'The offer has not been accepted. No changes were made to your plan or contract.',
    };
  }
  if (status === 'verification_blocked') {
    return {
      subject: `CallE: ${provider} needed verification we cannot provide`,
      body:
        `${provider} required identity verification that CallE is not allowed to provide, so no offer was obtained.\n` +
        'No changes were made to your plan or contract.',
    };
  }
  return {
    subject: `CallE: no offer from ${provider}`,
    body: `${provider} did not make an offer on this call. No changes were made to your plan or contract.`,
  };
}

// Delivery is a preview only; real sending is a stretch goal and must never be reported as sent unless verified.
export async function previewDelivery() {
  return { status: 'preview' };
}
