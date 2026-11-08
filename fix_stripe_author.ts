import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

// Replace in create-checkout
content = content.replace(
  "if (!author || !author.stripe_account_id) return res.status(400).json({ error: 'Author has not connected Stripe' });",
  "// if (!author || !author.stripe_account_id) return res.status(400).json({ error: 'Author has not connected Stripe' });"
);

// We need to also conditionally add transfer_data in create-checkout
content = content.replace(
  `payment_intent_data: {
        application_fee_amount: Math.floor(amount * 0.1),
        transfer_data: {
          destination: author.stripe_account_id,
        },
      }`,
  `payment_intent_data: author?.stripe_account_id ? {
        application_fee_amount: Math.floor(amount * 0.1),
        transfer_data: {
          destination: author.stripe_account_id,
        },
      } : undefined`
);

// Replace in create-checkout-buyout
content = content.replace(
  `payment_intent_data: {
        application_fee_amount: Math.floor(buyout.winning_price * 0.1),
        transfer_data: {
          destination: author.stripe_account_id,
        },
      }`,
  `payment_intent_data: author?.stripe_account_id ? {
        application_fee_amount: Math.floor(buyout.winning_price * 0.1),
        transfer_data: {
          destination: author.stripe_account_id,
        },
      } : undefined`
);


fs.writeFileSync('server.ts', content);
