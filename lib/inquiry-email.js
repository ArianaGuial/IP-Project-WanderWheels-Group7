"use strict";

const oauthUrl = "https://oauth2.googleapis.com/token";
const sendUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const mailbox = /^[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
const attempts = new Map();
const attemptWindow = 60_000;
const attemptLimit = 20;
let accessToken;
let refreshing;

function reserveSend(email) {
  const now = Date.now();
  for (const [recipient, expiresAt] of attempts) {
    if (expiresAt <= now) {
      attempts.delete(recipient);
    }
  }
  if (attempts.has(email) || attempts.size >= attemptLimit) {
    return false;
  }
  attempts.set(email, now + attemptWindow);
  return true;
}

async function refreshAccessToken(credentials) {
  const response = await fetch(oauthUrl, {
    method: "POST",
    body: credentials,
    redirect: "error",
    signal: AbortSignal.timeout(4000),
  });
  const result = await response.json();
  if (!response.ok || typeof result.access_token !== "string" || !result.access_token) {
    const reason = typeof result.error === "string" && /^[a-z_]+$/.test(result.error)
      ? result.error
      : "invalid_token_response";
    console.error("Gmail OAuth refresh failed:", response.status, reason);
    return null;
  }
  accessToken = {
    value: result.access_token,
    expiresAt: Date.now() + Math.max(0, (Number(result.expires_in) || 0) - 60) * 1000,
  };
  return accessToken.value;
}

async function getAccessToken(credentials) {
  if (accessToken?.expiresAt > Date.now()) {
    return accessToken.value;
  }
  refreshing ??= refreshAccessToken(credentials).finally(() => {
    refreshing = undefined;
  });
  return refreshing;
}

function inquiryMessage(sender, { id, email, pickupDate, dropoffDate }) {
  const reference = `Q-${id}`;
  const message = [
    `From: Wander Wheels <${sender}>`,
    `To: ${email}`,
    `Subject: We received your rental inquiry (${reference})`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    "Wander Wheels received your rental inquiry.",
    `Request reference: ${reference}`,
    `Requested pickup: ${pickupDate}`,
    `Requested drop-off: ${dropoffDate}`,
    "Your request is pending review. This email does not confirm a booking.",
    "",
  ].join("\r\n");
  return Buffer.from(message, "utf8").toString("base64url");
}

async function acknowledgeInquiry(inquiry) {
  const clientId = process.env.GMAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN?.trim();
  const sender = process.env.GMAIL_SENDER_EMAIL?.trim();
  if (!clientId || !clientSecret || !refreshToken || !sender) {
    return "skipped";
  }
  if (!mailbox.test(sender) || !mailbox.test(inquiry.email)) {
    return "failed";
  }
  if (!reserveSend(inquiry.email.toLowerCase())) {
    return "limited";
  }

  try {
    const credentials = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    const token = await getAccessToken(credentials);
    if (!token) {
      return "failed";
    }
    const response = await fetch(sendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: inquiryMessage(sender, inquiry) }),
      redirect: "error",
      signal: AbortSignal.timeout(4000),
    });
    if (response.ok) {
      const result = await response.json();
      if (typeof result.id === "string" && result.id.trim()) {
        return "accepted";
      }
      console.error("Gmail did not return an inquiry email message ID.");
      return "failed";
    }
    if (response.status === 401 && accessToken?.value === token) {
      accessToken = undefined;
    }
    console.error("Gmail rejected an inquiry email:", response.status);
  } catch {
    console.error("Could not send an inquiry acknowledgment through Gmail.");
  }
  return "failed";
}

module.exports = { acknowledgeInquiry };
