// Website accounts: sign in, the Account Center, the coach dashboard and
// buying video analysis. Set to `import.meta.env.DEV` to keep them local only
// (the live site then shows the Get Started menu and the /user payment portal).
export const ACCOUNTS_LIVE = true;

/** Where signed-out visitors sign in, and where bills are paid. */
export const SIGN_IN_PATH = ACCOUNTS_LIVE ? '/signin' : '/user';
export const PAYMENTS_PATH = ACCOUNTS_LIVE ? '/account/payments' : '/user/payments';
