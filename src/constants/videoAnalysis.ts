// Online video analysis. Keep in sync with register-clinic's VIDEO_ANALYSIS
// and ANALYSIS_COACHES (app repo: functions/register-clinic/src/main.js):
// the function rejects a payment whose amount doesn't match its own quote.

export const VIDEO_ANALYSIS = {
  name: 'Online Video Analysis',
  pricePerAnalysis: 150, // dollars
  maxCount: 10,
  turnaroundDays: 7,
  /** What players can upload: phone and camera exports. */
  acceptedTypes: '.mp4,.mov,.m4v,.webm,video/mp4,video/quicktime,video/webm',
  maxFileBytes: 5_000_000_000,
};

/** Coaches a buyer can ask for. */
export const ANALYSIS_COACHES = ['Paul Torres', 'Patrick Mullins', 'Gabriel Segal'];

const PROCESSING_FEE_RATE = 0.03; // same 3% as every other checkout

/** All amounts in cents. */
export const quoteVideoAnalysis = (count: number) => {
  const subtotal = count * VIDEO_ANALYSIS.pricePerAnalysis * 100;
  const fee = Math.round(subtotal * PROCESSING_FEE_RATE);
  return { subtotal, fee, total: subtotal + fee };
};

export const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;
