// Website accounts (sign in, Account Center, coach dashboard, buying video
// analysis) are on only when running locally for now. The live site keeps
// the Get Started menu and the /user payment portal. Flip to `true` to launch.
export const ACCOUNTS_LIVE = import.meta.env.DEV;

/** Where signed-out visitors sign in, and where bills are paid. */
export const SIGN_IN_PATH = ACCOUNTS_LIVE ? '/signin' : '/user';
export const PAYMENTS_PATH = ACCOUNTS_LIVE ? '/account/payments' : '/user/payments';
