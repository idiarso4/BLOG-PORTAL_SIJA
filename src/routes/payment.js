const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/PaymentController');
const { authenticate } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/security');

// Payment creation
router.post('/create',
  authenticate,
  generalRateLimit,
  PaymentController.createPayment
);

// Payment status
router.get('/status/:subscriptionId',
  authenticate,
  PaymentController.getPaymentStatus
);

// Payment methods
router.get('/methods',
  PaymentController.getPaymentMethods
);

// Webhook endpoints (no authentication required)
router.post('/webhook/midtrans',
  PaymentController.handleMidtransWebhook
);

router.post('/webhook/xendit',
  PaymentController.handleXenditWebhook
);

router.post('/webhook/stripe',
  PaymentController.handleStripeWebhook
);

// Payment result pages
router.get('/success',
  PaymentController.paymentSuccess
);

router.get('/error',
  PaymentController.paymentError
);

router.get('/pending',
  PaymentController.paymentPending
);

module.exports = router;