import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';

/**
 * The team's test inbox (team decision 2026-11-17): a Gmail account that plays the outside world - it sends e-mail to
 * the portal's mailbox and receives what the portal sends. Its address and app password are in `.env` only
 * (TEST_INBOX_ADDRESS, TEST_INBOX_APP_PASSWORD, TEST_INBOX_IMAP_HOST, TEST_INBOX_SMTP_HOST).
 */

const settings = (): { address: string; password: string; imapHost: string; smtpHost: string } | undefined => {
  const address = process.env.TEST_INBOX_ADDRESS?.trim();
  const password = process.env.TEST_INBOX_APP_PASSWORD?.replace(/\s+/g, '');
  if (!address || !password) {
    return undefined;
  }
  return { address, password, imapHost: process.env.TEST_INBOX_IMAP_HOST?.trim() || 'imap.gmail.com', smtpHost: process.env.TEST_INBOX_SMTP_HOST?.trim() || 'smtp.gmail.com' };
};

/** Whether the test inbox is set up on this computer. */
export const hasTestInbox = (): boolean => settings() !== undefined;

/** The test inbox's address. */
export const testInboxAddress = (): string => {
  const inbox = settings();
  if (!inbox) {
    throw new Error('TEST_INBOX_NOT_SET: TEST_INBOX_ADDRESS and TEST_INBOX_APP_PASSWORD are missing from .env.');
  }
  return inbox.address;
};

/** Sends an e-mail from the test inbox. */
export const sendFromTestInbox = async (mail: { to: string; subject: string; text: string; attachments?: { filename: string; path: string }[] }): Promise<void> => {
  const inbox = settings();
  if (!inbox) {
    throw new Error('TEST_INBOX_NOT_SET: TEST_INBOX_ADDRESS and TEST_INBOX_APP_PASSWORD are missing from .env.');
  }
  const transport = nodemailer.createTransport({ host: inbox.smtpHost, port: 465, secure: true, auth: { user: inbox.address, pass: inbox.password } });
  try {
    // Like a mail client: the text in a plain part and an HTML part (a plain-only message showed no body in the portal, 2026-11-17)
    const html = `<div dir="rtl">${mail.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>`;
    await transport.sendMail({ from: inbox.address, to: mail.to, subject: mail.subject, text: mail.text, html, attachments: mail.attachments });
  } finally {
    transport.close();
  }
};

export type ReceivedMail = { subject: string; from: string; to: string; text: string; attachments: string[]; folder: string };

/**
 * Waits for an e-mail in the test inbox (its Inbox or Spam) whose subject matches, received after `since`. Returns it,
 * or undefined when none came within the time.
 */
export const waitForTestInboxMail = async (subject: RegExp | string, { since, timeout = 120_000 }: { since: Date; timeout?: number }): Promise<ReceivedMail | undefined> => {
  const inbox = settings();
  if (!inbox) {
    throw new Error('TEST_INBOX_NOT_SET: TEST_INBOX_ADDRESS and TEST_INBOX_APP_PASSWORD are missing from .env.');
  }
  const matches = (text: string): boolean => (typeof subject === 'string' ? text.includes(subject) : subject.test(text));
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const client = new ImapFlow({ host: inbox.imapHost, port: 993, secure: true, auth: { user: inbox.address, pass: inbox.password }, logger: false });
    await client.connect();
    try {
      for (const folder of ['INBOX', '[Gmail]/Spam']) {
        const lock = await client.getMailboxLock(folder).catch(() => undefined);
        if (!lock) {
          continue;
        }
        try {
          // IMAP's SINCE is by day: the time is checked on each message
          const uids = (await client.search({ since: new Date(since.getTime() - 24 * 3600 * 1000) }, { uid: true })) || [];
          for (const uid of [...uids].reverse().slice(0, 40)) {
            const message = await client.fetchOne(String(uid), { envelope: true, internalDate: true, source: true }, { uid: true });
            if (!message || !message.envelope?.subject || !matches(message.envelope.subject)) {
              continue;
            }
            const received = new Date(message.internalDate ?? 0);
            if (received.getTime() < since.getTime() - 60_000) {
              continue;
            }
            const parsed = await simpleParser(message.source as Buffer);
            return {
              subject: parsed.subject ?? '',
              from: parsed.from?.text ?? '',
              to: Array.isArray(parsed.to) ? parsed.to.map((to) => to.text).join(', ') : (parsed.to?.text ?? ''),
              text: parsed.text ?? '',
              attachments: parsed.attachments.map((attachment) => attachment.filename ?? ''),
              folder,
            };
          }
        } finally {
          lock.release();
        }
      }
    } finally {
      await client.logout().catch(() => undefined);
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  return undefined;
};
