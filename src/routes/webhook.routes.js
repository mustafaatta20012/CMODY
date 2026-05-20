// src/routes/webhook.routes.js
// Stripe sends POST to /api/v1/webhooks/stripe
// Body must be RAW (not parsed by express.json) — handled in server.js
const router = require("express").Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { prisma } = require("../config/database");
const { logger } = require("../utils/logger");

router.post("/", async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object;
      await prisma.order.updateMany({
        where: { paymentIntentId: pi.id },
        data: { status: "PAID", paidAt: new Date() },
      });
      logger.info(`✅ Payment succeeded for PI: ${pi.id}`);
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      await prisma.order.updateMany({
        where: { paymentIntentId: pi.id },
        data: { status: "CANCELLED" },
      });
      logger.warn(`❌ Payment failed for PI: ${pi.id}`);
      break;
    }

    default:
      logger.debug(`Unhandled Stripe event: ${event.type}`);
  }

  res.json({ received: true });
});

module.exports = router;
