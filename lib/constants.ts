export const CREDIT_COST_LISTING = 2;
export const CREDIT_COST_BOOST = 10;
export const PLATFORM_FEE_PERCENT = 0.05;
export const LOW_CREDIT_THRESHOLD = 20;
export const CREDIT_LOW_THRESHOLD = 50;

export const CREDIT_PACKAGES = [
  { amount: 100, credits: 100, label: '₹100 = 100 credits' },
  { amount: 500, credits: 550, label: '₹500 = 550 credits' },
  { amount: 1000, credits: 1200, label: '₹1000 = 1200 credits' }
];

export const CATEGORIES = [
  'Clothing',
  'Footwear',
  'Accessories',
  'Home Textiles',
  'Pharmacy',
  'Other'
];

export const SLACK_MESSAGES = {
  newOrder: (productName: string, amount: number, buyerName: string, credits: number) =>
    `🛍 New order — ${productName} ₹${amount} from ${buyerName}. ${credits} credits deducted.`,
  lowCredits: (balance: number) =>
    `⚠️ Your Crevis wallet is running low (${balance} credits). Recharge to keep listings active: ${process.env.NEXT_PUBLIC_APP_URL}/wallet`,
  deactivated: () =>
    `❌ Your listings have been paused due to zero credits. Recharge at ${process.env.NEXT_PUBLIC_APP_URL}/wallet`,
  walletRecharged: (credits: number, balance: number) =>
    `✅ Wallet recharged! ${credits} credits added. New balance: ${balance} credits.`
};
