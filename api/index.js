const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const Stripe = require('stripe');
const admin = require('firebase-admin');

dotenv.config();

const app = express();
const port = 3000

app.use(cors());
app.use(bodyParser.json());


if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is not set. Payments will fail.');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

const serviceAccount = require("./serviceAccountKey.json");

// Initialize Firebase Admin
if (admin.apps && !admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL, // Make sure to set this in your environment
    });
  } catch (e) {
    console.error('Firebase admin initialization error', e.stack);
  }
}

const rtdb = admin.database();

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'stripe-backend', port });
});

app.post('/api/stripe/createApi', async (req, res) => {
  try {
    const { name, email, amount } = req.body || {};
    if (!name || !email || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let customer;
    const list = await stripe.customers.list({ email });
    customer = list.data[0];
    if (!customer) {
      customer = await stripe.customers.create({ name, email });
    }

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2024-06-20' }
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
      capture_method: 'manual', // Only authorize, don't capture immediately
    });

    res.json({ paymentIntent, ephemeralKey, customer: customer.id });
  } catch (err) {
    console.error('createApi error', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/stripe/createTipIntent', async (req, res) => {
    try {
        const { amount, rideId, customerId } = req.body;
        if (!amount || !rideId || !customerId) {
            return res.status(400).json({ error: 'Missing amount, rideId, or customerId' });
        }

        // List payment methods for the customer
        const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: 'card',
        });

        if (!paymentMethods.data.length) {
            return res.status(400).json({ error: "No payment method found for customer." });
        }
        const paymentMethodId = paymentMethods.data[0].id;

        // Create and confirm a new Payment Intent for the tip
        const tipIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: 'usd',
            customer: customerId,
            payment_method: paymentMethodId,
            confirm: true, // This confirms the payment immediately
            off_session: true, // Indicates the customer is not in a session
            description: `Tip for ride ${rideId}`,
        });

        res.json({ success: true, paymentIntent: tipIntent });

    } catch (err) {
        console.error('createTipIntent error', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

app.post('/api/stripe/createTipPaymentSheetIntent', async (req, res) => {
  try {
    const { name, email, amount } = req.body || {};
    if (!name || !email || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let customer;
    const list = await stripe.customers.list({ email });
    customer = list.data[0];
    if (!customer) {
      customer = await stripe.customers.create({ name, email });
    }

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2024-06-20' }
    );

    // Create a PaymentIntent that will be captured immediately upon confirmation
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Amount is now converted to cents
      currency: 'usd',
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
      description: 'Tip payment',
    });

    res.json({ paymentIntent, ephemeralKey, customer: customer.id });
  } catch (err) {
    console.error('createTipPaymentSheetIntent error', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/stripe/capturePayment', async (req, res) => {
  try {
    const { paymentIntentId } = req.body || {};
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Missing paymentIntentId' });
    }
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
    res.json({ success: true, paymentIntent });
  } catch (err) {
    console.error('capturePayment error', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
});

app.post('/api/stripe/cancelPayment', async (req, res) => {
  try {
    const { paymentIntentId } = req.body || {};
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Missing paymentIntentId' });
    }
    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
    res.json({ success: true, paymentIntent });
  } catch (err) {
    console.error('cancelPayment error', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
});

// This endpoint is not used in the new flow but is kept for reference
app.post('/api/stripe/payApi', async (req, res) => {
  try {
    const { payment_method_id, payment_intent_id, customer_id } = req.body || {};
    if (!payment_method_id || !payment_intent_id || !customer_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const paymentMethod = await stripe.paymentMethods.attach(payment_method_id, { customer: customer_id });
    const result = await stripe.paymentIntents.confirm(payment_intent_id, { payment_method: paymentMethod.id });

    res.json({ success: true, client_secret: result.client_secret, result });
  } catch (err) {
    console.error('payApi error', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// app.post('/api/stripe/createAndSendInvoice', async (req, res) => {
//   try {
//     const { rideId } = req.body;
//     if (!rideId) {
//       return res.status(400).json({ error: 'Missing rideId' });
//     }

//     // 1. Fetch ride data from Realtime Database
//     const rideSnapshot = await rtdb.ref(`rideRequests/${rideId}`).once('value');
//     const rideData = rideSnapshot.val();

//     if (!rideData) {
//       return res.status(404).json({ error: 'Ride not found' });
//     }

//     const { customerId, farePriceCents, tipAmount, userId } = rideData;

//     if (!customerId) {
//       return res.status(400).json({ error: 'No Stripe customer associated with this ride' });
//     }

//     // 2. Create an invoice
//     const invoice = await stripe.invoices.create({
//       customer: customerId,
//       collection_method: 'send_invoice',
//       days_until_due: 30,
//       description: `Invoice for Ride ${rideId}`,
//       auto_advance: true, // Automatically finalize and send
//     });

//     // 3. Add line items
//     await stripe.invoiceItems.create({
//       customer: customerId,
//       invoice: invoice.id,
//       amount: farePriceCents, // Amount is already in cents
//       currency: 'usd',
//       description: 'Ride Fare',
//     });

//     if (tipAmount && tipAmount > 0) {
//       await stripe.invoiceItems.create({
//         customer: customerId,
//         invoice: invoice.id,
//         amount: Math.round(tipAmount * 100), // Convert tip to cents
//         currency: 'usd',
//         description: 'Driver Tip',
//       });
//     }

//     // 4. Finalize and send the invoice
//     const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
//     await stripe.invoices.sendInvoice(finalizedInvoice.id);

//     res.json({ success: true, invoiceId: finalizedInvoice.id });

//   } catch (err) {
//     console.error('createAndSendInvoice error', err);
//     res.status(500).json({ error: 'Internal Server Error', details: err.message });
//   }
// });


app.listen(port, '0.0.0.0', () => {
  console.log(`Stripe backend listening on http://0.0.0.0:${port}`);
});
