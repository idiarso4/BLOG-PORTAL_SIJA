const axios = require('axios');
const crypto = require('crypto');
const logger = require('../config/logger');
const UserSubscription = require('../models/UserSubscription');
const Subscription = require('../models/Subscription');

/**
 * Payment Service untuk integrasi payment gateway
 */
class PaymentService {
  
  constructor() {
    this.midtrans = {
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY,
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      baseUrl: process.env.MIDTRANS_IS_PRODUCTION === 'true' 
        ? 'https://api.midtrans.com/v2'
        : 'https://api.sandbox.midtrans.com/v2'
    };
    
    this.xendit = {
      secretKey: process.env.XENDIT_SECRET_KEY,
      baseUrl: 'https://api.xendit.co'
    };
    
    this.stripe = {
      secretKey: process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      baseUrl: 'https://api.stripe.com/v1'
    };
  }
  
  /**
   * Create payment for subscription
   * @param {Object} subscriptionData - Subscription data
   * @param {String} gateway - Payment gateway (midtrans, xendit, stripe)
   * @returns {Object} Payment result
   */
  async createSubscriptionPayment(subscriptionData, gateway = 'midtrans') {
    try {
      const { userSubscription, user, plan } = subscriptionData;
      
      switch (gateway) {
        case 'midtrans':
          return await this.createMidtransPayment(userSubscription, user, plan);
        case 'xendit':
          return await this.createXenditPayment(userSubscription, user, plan);
        case 'stripe':
          return await this.createStripePayment(userSubscription, user, plan);
        default:
          throw new Error('Payment gateway tidak didukung');
      }
      
    } catch (error) {
      logger.error('Create subscription payment error:', error);
      throw error;
    }
  }
  
  /**
   * Create Midtrans payment
   * @param {Object} userSubscription - User subscription
   * @param {Object} user - User data
   * @param {Object} plan - Subscription plan
   * @returns {Object} Midtrans payment result
   */
  async createMidtransPayment(userSubscription, user, plan) {
    try {
      const orderId = `SUB-${userSubscription._id}-${Date.now()}`;
      const grossAmount = userSubscription.payment.amount;
      
      const payload = {
        transaction_details: {
          order_id: orderId,
          gross_amount: grossAmount
        },
        credit_card: {
          secure: true
        },
        customer_details: {
          first_name: user.profile.nama || user.username,
          email: user.email,
          phone: user.profile.telepon || ''
        },
        item_details: [{
          id: plan._id.toString(),
          price: grossAmount,
          quantity: 1,
          name: `${plan.name} - ${userSubscription.billingCycle}`,
          category: 'subscription'
        }],
        callbacks: {
          finish: `${process.env.APP_URL}/payment/finish`,
          error: `${process.env.APP_URL}/payment/error`,
          pending: `${process.env.APP_URL}/payment/pending`
        },
        expiry: {
          start_time: new Date().toISOString(),
          unit: 'minutes',
          duration: 60
        },
        custom_field1: userSubscription._id.toString(),
        custom_field2: 'subscription',
        custom_field3: userSubscription.billingCycle
      };\n      
      const auth = Buffer.from(this.midtrans.serverKey + ':').toString('base64');
      
      const response = await axios.post(\n        `${this.midtrans.baseUrl}/charge`,\n        payload,\n        {\n          headers: {\n            'Accept': 'application/json',\n            'Content-Type': 'application/json',\n            'Authorization': `Basic ${auth}`\n          }\n        }\n      );\n      \n      // Update subscription with payment info\n      userSubscription.payment.transactionId = orderId;\n      userSubscription.payment.gateway = 'midtrans';\n      userSubscription.payment.gatewayTransactionId = response.data.transaction_id;\n      await userSubscription.save();\n      \n      logger.info('Midtrans payment created', {\n        orderId,\n        subscriptionId: userSubscription._id,\n        amount: grossAmount,\n        transactionId: response.data.transaction_id\n      });\n      \n      return {\n        success: true,\n        gateway: 'midtrans',\n        paymentToken: response.data.token,\n        redirectUrl: response.data.redirect_url,\n        orderId,\n        amount: grossAmount,\n        expiryTime: payload.expiry\n      };\n      \n    } catch (error) {\n      logger.error('Midtrans payment creation error:', error);\n      throw new Error('Gagal membuat pembayaran Midtrans: ' + error.message);\n    }\n  }\n  \n  /**\n   * Create Xendit payment\n   * @param {Object} userSubscription - User subscription\n   * @param {Object} user - User data\n   * @param {Object} plan - Subscription plan\n   * @returns {Object} Xendit payment result\n   */\n  async createXenditPayment(userSubscription, user, plan) {\n    try {\n      const externalId = `SUB-${userSubscription._id}-${Date.now()}`;\n      const amount = userSubscription.payment.amount;\n      \n      const payload = {\n        external_id: externalId,\n        payer_email: user.email,\n        description: `${plan.name} Subscription - ${userSubscription.billingCycle}`,\n        amount: amount,\n        success_redirect_url: `${process.env.APP_URL}/payment/success`,\n        failure_redirect_url: `${process.env.APP_URL}/payment/failed`,\n        currency: 'IDR',\n        invoice_duration: 3600, // 1 hour\n        customer: {\n          given_names: user.profile.nama || user.username,\n          email: user.email,\n          mobile_number: user.profile.telepon || ''\n        },\n        customer_notification_preference: {\n          invoice_created: ['email'],\n          invoice_reminder: ['email'],\n          invoice_paid: ['email']\n        },\n        items: [{\n          name: `${plan.name} - ${userSubscription.billingCycle}`,\n          quantity: 1,\n          price: amount,\n          category: 'Subscription'\n        }]\n      };\n      \n      const response = await axios.post(\n        `${this.xendit.baseUrl}/v2/invoices`,\n        payload,\n        {\n          headers: {\n            'Authorization': `Basic ${Buffer.from(this.xendit.secretKey + ':').toString('base64')}`,\n            'Content-Type': 'application/json'\n          }\n        }\n      );\n      \n      // Update subscription with payment info\n      userSubscription.payment.transactionId = externalId;\n      userSubscription.payment.gateway = 'xendit';\n      userSubscription.payment.gatewayTransactionId = response.data.id;\n      await userSubscription.save();\n      \n      logger.info('Xendit payment created', {\n        externalId,\n        subscriptionId: userSubscription._id,\n        amount,\n        invoiceId: response.data.id\n      });\n      \n      return {\n        success: true,\n        gateway: 'xendit',\n        invoiceUrl: response.data.invoice_url,\n        invoiceId: response.data.id,\n        externalId,\n        amount,\n        expiryDate: response.data.expiry_date\n      };\n      \n    } catch (error) {\n      logger.error('Xendit payment creation error:', error);\n      throw new Error('Gagal membuat pembayaran Xendit: ' + error.message);\n    }\n  }\n  \n  /**\n   * Create Stripe payment\n   * @param {Object} userSubscription - User subscription\n   * @param {Object} user - User data\n   * @param {Object} plan - Subscription plan\n   * @returns {Object} Stripe payment result\n   */\n  async createStripePayment(userSubscription, user, plan) {\n    try {\n      const amount = Math.round(userSubscription.payment.amount * 100); // Stripe uses cents\n      \n      // Create payment intent\n      const payload = {\n        amount: amount,\n        currency: 'idr',\n        automatic_payment_methods: {\n          enabled: true\n        },\n        description: `${plan.name} Subscription - ${userSubscription.billingCycle}`,\n        metadata: {\n          subscription_id: userSubscription._id.toString(),\n          user_id: user._id.toString(),\n          plan_id: plan._id.toString(),\n          billing_cycle: userSubscription.billingCycle\n        },\n        receipt_email: user.email\n      };\n      \n      const response = await axios.post(\n        `${this.stripe.baseUrl}/payment_intents`,\n        new URLSearchParams(payload).toString(),\n        {\n          headers: {\n            'Authorization': `Bearer ${this.stripe.secretKey}`,\n            'Content-Type': 'application/x-www-form-urlencoded'\n          }\n        }\n      );\n      \n      // Update subscription with payment info\n      userSubscription.payment.transactionId = response.data.id;\n      userSubscription.payment.gateway = 'stripe';\n      userSubscription.payment.gatewayTransactionId = response.data.id;\n      await userSubscription.save();\n      \n      logger.info('Stripe payment created', {\n        paymentIntentId: response.data.id,\n        subscriptionId: userSubscription._id,\n        amount: userSubscription.payment.amount\n      });\n      \n      return {\n        success: true,\n        gateway: 'stripe',\n        clientSecret: response.data.client_secret,\n        paymentIntentId: response.data.id,\n        amount: userSubscription.payment.amount,\n        publishableKey: this.stripe.publishableKey\n      };\n      \n    } catch (error) {\n      logger.error('Stripe payment creation error:', error);\n      throw new Error('Gagal membuat pembayaran Stripe: ' + error.message);\n    }\n  }\n  \n  /**\n   * Handle Midtrans webhook\n   * @param {Object} notification - Webhook notification\n   * @returns {Object} Processing result\n   */\n  async handleMidtransWebhook(notification) {\n    try {\n      const {\n        order_id,\n        transaction_status,\n        fraud_status,\n        signature_key,\n        gross_amount\n      } = notification;\n      \n      // Verify signature\n      const serverKey = this.midtrans.serverKey;\n      const input = order_id + transaction_status + gross_amount + serverKey;\n      const hash = crypto.createHash('sha512').update(input).digest('hex');\n      \n      if (hash !== signature_key) {\n        throw new Error('Invalid signature');\n      }\n      \n      // Find subscription\n      const userSubscription = await UserSubscription.findOne({\n        'payment.transactionId': order_id\n      }).populate('user').populate('subscription');\n      \n      if (!userSubscription) {\n        throw new Error('Subscription not found');\n      }\n      \n      // Process payment status\n      let newStatus = userSubscription.status;\n      \n      if (transaction_status === 'capture' || transaction_status === 'settlement') {\n        if (fraud_status === 'accept' || !fraud_status) {\n          newStatus = 'active';\n          await this.activateSubscription(userSubscription);\n        }\n      } else if (transaction_status === 'pending') {\n        newStatus = 'pending';\n      } else if (['deny', 'cancel', 'expire', 'failure'].includes(transaction_status)) {\n        newStatus = 'cancelled';\n      }\n      \n      // Update subscription status\n      userSubscription.status = newStatus;\n      await userSubscription.save();\n      \n      logger.info('Midtrans webhook processed', {\n        orderId: order_id,\n        transactionStatus: transaction_status,\n        subscriptionId: userSubscription._id,\n        newStatus\n      });\n      \n      return {\n        success: true,\n        status: newStatus,\n        subscriptionId: userSubscription._id\n      };\n      \n    } catch (error) {\n      logger.error('Midtrans webhook error:', error);\n      throw error;\n    }\n  }\n  \n  /**\n   * Handle Xendit webhook\n   * @param {Object} notification - Webhook notification\n   * @returns {Object} Processing result\n   */\n  async handleXenditWebhook(notification) {\n    try {\n      const {\n        external_id,\n        status,\n        id: invoice_id,\n        paid_amount\n      } = notification;\n      \n      // Find subscription\n      const userSubscription = await UserSubscription.findOne({\n        'payment.transactionId': external_id\n      }).populate('user').populate('subscription');\n      \n      if (!userSubscription) {\n        throw new Error('Subscription not found');\n      }\n      \n      // Process payment status\n      let newStatus = userSubscription.status;\n      \n      if (status === 'PAID') {\n        newStatus = 'active';\n        await this.activateSubscription(userSubscription);\n      } else if (status === 'PENDING') {\n        newStatus = 'pending';\n      } else if (['EXPIRED', 'FAILED'].includes(status)) {\n        newStatus = 'cancelled';\n      }\n      \n      // Update subscription status\n      userSubscription.status = newStatus;\n      await userSubscription.save();\n      \n      logger.info('Xendit webhook processed', {\n        externalId: external_id,\n        status,\n        subscriptionId: userSubscription._id,\n        newStatus\n      });\n      \n      return {\n        success: true,\n        status: newStatus,\n        subscriptionId: userSubscription._id\n      };\n      \n    } catch (error) {\n      logger.error('Xendit webhook error:', error);\n      throw error;\n    }\n  }\n  \n  /**\n   * Handle Stripe webhook\n   * @param {Object} event - Stripe event\n   * @returns {Object} Processing result\n   */\n  async handleStripeWebhook(event) {\n    try {\n      const { type, data } = event;\n      \n      if (type === 'payment_intent.succeeded') {\n        const paymentIntent = data.object;\n        \n        // Find subscription\n        const userSubscription = await UserSubscription.findOne({\n          'payment.transactionId': paymentIntent.id\n        }).populate('user').populate('subscription');\n        \n        if (!userSubscription) {\n          throw new Error('Subscription not found');\n        }\n        \n        // Activate subscription\n        userSubscription.status = 'active';\n        await userSubscription.save();\n        \n        await this.activateSubscription(userSubscription);\n        \n        logger.info('Stripe webhook processed', {\n          paymentIntentId: paymentIntent.id,\n          subscriptionId: userSubscription._id,\n          status: 'active'\n        });\n        \n        return {\n          success: true,\n          status: 'active',\n          subscriptionId: userSubscription._id\n        };\n      }\n      \n      return { success: true, message: 'Event not handled' };\n      \n    } catch (error) {\n      logger.error('Stripe webhook error:', error);\n      throw error;\n    }\n  }\n  \n  /**\n   * Activate subscription after successful payment\n   * @param {Object} userSubscription - User subscription\n   */\n  async activateSubscription(userSubscription) {\n    try {\n      // Update user subscription reference\n      const user = userSubscription.user;\n      user.subscription.plan = userSubscription.subscription._id;\n      user.subscription.status = 'active';\n      user.subscription.endDate = userSubscription.endDate;\n      await user.save();\n      \n      // Update plan statistics\n      const plan = userSubscription.subscription;\n      await plan.updateStats({\n        activeSubscribers: 1,\n        [`revenue.${userSubscription.billingCycle}`]: userSubscription.payment.amount,\n        'revenue.total': userSubscription.payment.amount\n      });\n      \n      // Send activation email\n      // TODO: Implement email notification\n      \n      logger.info('Subscription activated', {\n        userId: user._id,\n        subscriptionId: userSubscription._id,\n        planId: plan._id\n      });\n      \n    } catch (error) {\n      logger.error('Activate subscription error:', error);\n      throw error;\n    }\n  }\n  \n  /**\n   * Get payment status\n   * @param {String} transactionId - Transaction ID\n   * @param {String} gateway - Payment gateway\n   * @returns {Object} Payment status\n   */\n  async getPaymentStatus(transactionId, gateway) {\n    try {\n      switch (gateway) {\n        case 'midtrans':\n          return await this.getMidtransStatus(transactionId);\n        case 'xendit':\n          return await this.getXenditStatus(transactionId);\n        case 'stripe':\n          return await this.getStripeStatus(transactionId);\n        default:\n          throw new Error('Payment gateway tidak didukung');\n      }\n    } catch (error) {\n      logger.error('Get payment status error:', error);\n      throw error;\n    }\n  }\n  \n  /**\n   * Get Midtrans payment status\n   * @param {String} orderId - Order ID\n   * @returns {Object} Payment status\n   */\n  async getMidtransStatus(orderId) {\n    try {\n      const auth = Buffer.from(this.midtrans.serverKey + ':').toString('base64');\n      \n      const response = await axios.get(\n        `${this.midtrans.baseUrl}/${orderId}/status`,\n        {\n          headers: {\n            'Accept': 'application/json',\n            'Authorization': `Basic ${auth}`\n          }\n        }\n      );\n      \n      return {\n        success: true,\n        gateway: 'midtrans',\n        status: response.data.transaction_status,\n        fraudStatus: response.data.fraud_status,\n        amount: response.data.gross_amount\n      };\n      \n    } catch (error) {\n      logger.error('Get Midtrans status error:', error);\n      throw error;\n    }\n  }\n  \n  /**\n   * Get Xendit payment status\n   * @param {String} invoiceId - Invoice ID\n   * @returns {Object} Payment status\n   */\n  async getXenditStatus(invoiceId) {\n    try {\n      const response = await axios.get(\n        `${this.xendit.baseUrl}/v2/invoices/${invoiceId}`,\n        {\n          headers: {\n            'Authorization': `Basic ${Buffer.from(this.xendit.secretKey + ':').toString('base64')}`\n          }\n        }\n      );\n      \n      return {\n        success: true,\n        gateway: 'xendit',\n        status: response.data.status,\n        amount: response.data.amount,\n        paidAmount: response.data.paid_amount\n      };\n      \n    } catch (error) {\n      logger.error('Get Xendit status error:', error);\n      throw error;\n    }\n  }\n  \n  /**\n   * Get Stripe payment status\n   * @param {String} paymentIntentId - Payment Intent ID\n   * @returns {Object} Payment status\n   */\n  async getStripeStatus(paymentIntentId) {\n    try {\n      const response = await axios.get(\n        `${this.stripe.baseUrl}/payment_intents/${paymentIntentId}`,\n        {\n          headers: {\n            'Authorization': `Bearer ${this.stripe.secretKey}`\n          }\n        }\n      );\n      \n      return {\n        success: true,\n        gateway: 'stripe',\n        status: response.data.status,\n        amount: response.data.amount / 100, // Convert from cents\n        currency: response.data.currency\n      };\n      \n    } catch (error) {\n      logger.error('Get Stripe status error:', error);\n      throw error;\n    }\n  }\n}\n\nmodule.exports = new PaymentService();