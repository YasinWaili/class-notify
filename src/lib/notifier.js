import nodemailer from "nodemailer";
import twilio from "twilio";
import { config } from "../config.js";

let mailer;
let twilioClient;

function canSendEmail() {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass && config.smtp.from);
}

function canSendSms() {
  return Boolean(config.twilio.accountSid && config.twilio.authToken && config.twilio.from);
}

function getMailer() {
  if (!mailer) {
    mailer = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass
      }
    });
  }

  return mailer;
}

function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
  }

  return twilioClient;
}

function buildMessage(monitor, section) {
  const course = `${section.subject} ${section.section}`.trim();
  const term = monitor.termLabel || monitor.termCode;

  return {
    subject: `${course} is ${section.status}`,
    text: [
      `${course} is now ${section.status}.`,
      `Term: ${term}`,
      `CRN: ${section.crn}`,
      `Title: ${section.title}`,
      `Instructor: ${section.instructor || "TBA"}`,
      "Carleton public class schedule: https://central.carleton.ca/prod/bwysched.p_select_term?wsea_code=EXT"
    ].join("\n")
  };
}

export async function notifyOpenSection(monitor, section) {
  const emailTo = monitor.notifyEmail || config.defaultNotifyEmail;
  const phoneTo = monitor.notifyPhone || config.defaultNotifyPhone;
  const message = buildMessage(monitor, section);
  const deliveries = [];

  if (emailTo && canSendEmail()) {
    await getMailer().sendMail({
      from: config.smtp.from,
      to: emailTo,
      subject: message.subject,
      text: message.text
    });
    deliveries.push(`email:${emailTo}`);
  } else if (emailTo) {
    console.log(`[notify] Email not configured. Would send to ${emailTo}:\n${message.text}`);
    deliveries.push(`email-log:${emailTo}`);
  }

  if (phoneTo && canSendSms()) {
    await getTwilioClient().messages.create({
      from: config.twilio.from,
      to: phoneTo,
      body: message.text
    });
    deliveries.push(`sms:${phoneTo}`);
  } else if (phoneTo) {
    console.log(`[notify] SMS not configured. Would send to ${phoneTo}:\n${message.text}`);
    deliveries.push(`sms-log:${phoneTo}`);
  }

  if (deliveries.length === 0) {
    console.log(`[notify] No recipients configured. Would send:\n${message.text}`);
    deliveries.push("log-only");
  }

  return deliveries;
}
