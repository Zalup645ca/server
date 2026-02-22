const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

// 🔐 Токен хранится в .env
const CRYPTO_TOKEN = process.env.CRYPTO_PAY_TOKEN;

// 💰 Фиксированные тарифы
const PLANS = {
  monthly: 9,
  pro: 29,
  premium: 59,
};

// 🗄 Временное хранилище (заменить на БД в проде)
const invoices = {};
const subscriptions = {};

/**
 * 🚀 Создание инвойса
 */
app.post("/api/create-invoice", async (req, res) => {
  try {
    const { planId, telegramId } = req.body;

    if (!planId || !telegramId) {
      return res.status(400).json({ error: "Missing data" });
    }

    if (!PLANS[planId]) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const amount = PLANS[planId];

    const response = await axios.post(
      "https://pay.crypt.bot/api/createInvoice",
      {
        asset: "USDT",
        amount,
        description: `Subscription: ${planId}`,
      },
      {
        headers: {
          "Crypto-Pay-API-Token": CRYPTO_TOKEN,
        },
      }
    );

    const invoice = response.data.result;

    // сохраняем invoice
    invoices[invoice.invoice_id] = {
      telegramId,
      planId,
      status: "pending",
    };

    res.json({ pay_url: invoice.pay_url });

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Invoice creation failed" });
  }
});

/**
 * 📡 Webhook от CryptoBot
 */
app.post("/webhook", (req, res) => {
  const update = req.body;

  if (update.update_type === "invoice_paid") {
    const invoiceId = update.payload.invoice_id;

    if (invoices[invoiceId]) {
      const { telegramId, planId } = invoices[invoiceId];

      invoices[invoiceId].status = "paid";

      // 🔥 Активируем подписку
      subscriptions[telegramId] = {
        plan: planId,
        active: true,
        activatedAt: new Date(),
      };

      console.log(
        `✅ User ${telegramId} activated ${planId} subscription`
      );
    }
  }

  res.sendStatus(200);
});

/**
 * 🔎 Проверка статуса подписки
 */
app.get("/api/subscription/:telegramId", (req, res) => {
  const { telegramId } = req.params;

  const subscription = subscriptions[telegramId];

  if (!subscription) {
    return res.json({ active: false });
  }

  res.json({
    active: subscription.active,
    plan: subscription.plan,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Payment server running on port ${PORT}`);
});