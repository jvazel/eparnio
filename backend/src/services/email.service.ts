import net from 'node:net';
import tls from 'node:tls';
import { env } from '../config/env';
import { AppError } from '../middlewares/error.middleware';

export interface SmtpMailOptions {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  rejectUnauthorized?: boolean;
}

export interface PasswordResetEmailParams {
  to: string;
  displayName: string;
  code: string;
  ttlMinutes: number;
}

export type EmailSenderFn = (params: PasswordResetEmailParams) => Promise<void>;

let customEmailSender: EmailSenderFn | null = null;

/**
 * Permet aux tests automatisés d'intercepter l'envoi d'e-mails sans contacter un vrai serveur SMTP.
 */
export function setEmailSenderForTests(sender: EmailSenderFn | null): void {
  customEmailSender = sender;
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function extractEmailAddress(value: string): string | null {
  const bracketMatch = /<([^<>@\s]+@[^<>@\s]+)>/.exec(value);
  if (bracketMatch?.[1]) {
    return bracketMatch[1].trim();
  }
  const plain = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(plain) ? plain : null;
}

function isLocalHostname(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

interface SmtpSocketReader {
  readResponse: () => Promise<{ code: number; text: string }>;
  sendCommand: (command: string, expectedCodes: number[]) => Promise<{ code: number; text: string }>;
  sendRaw: (payload: string) => Promise<void>;
  rebindSocket: (nextSocket: net.Socket | tls.TLSSocket) => void;
  close: () => void;
}

function createSmtpSocketReader(initialSocket: net.Socket | tls.TLSSocket): SmtpSocketReader {
  let socket = initialSocket;
  let buffer = '';
  let closedError: Error | null = null;
  let pendingResolve: ((res: { code: number; text: string }) => void) | null = null;
  let pendingReject: ((err: Error) => void) | null = null;
  let collectedLines: string[] = [];

  const failPending = (err: Error) => {
    closedError = err;
    if (pendingReject) {
      const reject = pendingReject;
      pendingResolve = null;
      pendingReject = null;
      reject(err);
    }
  };

  const processBuffer = () => {
    if (!pendingResolve) return;

    while (true) {
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex === -1) break;

      const line = buffer.slice(0, newlineIndex).replace(/\r$/, '');
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;

      collectedLines.push(line);
      const match = /^(\d{3})([ -])/.exec(line);
      if (match && match[2] === ' ') {
        const code = Number(match[1]);
        const text = collectedLines.join('\n');
        const resolve = pendingResolve;
        collectedLines = [];
        pendingResolve = null;
        pendingReject = null;
        resolve({ code, text });
        return;
      }
    }
  };

  const onData = (chunk: Buffer | string) => {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    processBuffer();
  };

  const onError = (err: Error) => failPending(err);
  const onClose = () => failPending(new Error('Connexion SMTP fermée de manière inattendue'));
  const onTimeout = () => failPending(new Error('Délai dépassé lors de la communication SMTP'));

  const attachListeners = (target: net.Socket | tls.TLSSocket) => {
    target.setTimeout(env.SMTP_TIMEOUT_MS);
    target.on('data', onData);
    target.on('error', onError);
    target.on('close', onClose);
    target.on('timeout', onTimeout);
  };

  const detachListeners = (target: net.Socket | tls.TLSSocket) => {
    target.off('data', onData);
    target.off('error', onError);
    target.off('close', onClose);
    target.off('timeout', onTimeout);
  };

  attachListeners(socket);

  const readResponse = (): Promise<{ code: number; text: string }> => {
    if (closedError) {
      return Promise.reject(closedError);
    }
    return new Promise((resolve, reject) => {
      collectedLines = [];
      pendingResolve = resolve;
      pendingReject = reject;
      processBuffer();
    });
  };

  const sendRaw = (payload: string): Promise<void> =>
    new Promise((resolve, reject) => {
      socket.write(payload, 'utf8', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

  const sendCommand = async (
    command: string,
    expectedCodes: number[]
  ): Promise<{ code: number; text: string }> => {
    await sendRaw(`${command}\r\n`);
    const response = await readResponse();
    if (!expectedCodes.includes(response.code)) {
      throw new Error(`Erreur SMTP (${response.code}) : ${response.text}`);
    }
    return response;
  };

  const rebindSocket = (nextSocket: net.Socket | tls.TLSSocket) => {
    detachListeners(socket);
    buffer = '';
    collectedLines = [];
    socket = nextSocket;
    attachListeners(socket);
  };

  const close = () => {
    detachListeners(socket);
    if (!socket.destroyed) {
      socket.end();
      socket.destroy();
    }
  };

  return { readResponse, sendCommand, sendRaw, rebindSocket, close };
}

function connectSocket(options: SmtpMailOptions): Promise<net.Socket | tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    if (options.secure) {
      const tlsSocket = tls.connect(
        {
          host: options.host,
          port: options.port,
          servername: options.host,
          rejectUnauthorized: options.rejectUnauthorized ?? true
        },
        () => resolve(tlsSocket)
      );
      tlsSocket.once('error', reject);
    } else {
      const tcpSocket = net.connect({ host: options.host, port: options.port }, () =>
        resolve(tcpSocket)
      );
      tcpSocket.once('error', reject);
    }
  });
}

function upgradeToStartTls(
  tcpSocket: net.Socket,
  options: SmtpMailOptions
): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const tlsSocket = tls.connect(
      {
        socket: tcpSocket,
        servername: options.host,
        rejectUnauthorized: options.rejectUnauthorized ?? true
      },
      () => resolve(tlsSocket)
    );
    tlsSocket.once('error', reject);
  });
}

/**
 * Envoie un e-mail en texte brut via le protocole SMTP standard (compatible Gmail port 465 SSL et 587 STARTTLS)
 * sans aucune dépendance payante ni module tiers.
 */
export async function sendSmtpMail(options: SmtpMailOptions): Promise<void> {
  const socket = await connectSocket(options);
  const client = createSmtpSocketReader(socket);

  try {
    const greeting = await client.readResponse();
    if (greeting.code !== 220) {
      throw new Error(`Accueil SMTP invalide (${greeting.code}) : ${greeting.text}`);
    }

    let ehlo = await client.sendCommand('EHLO eparnio.local', [250]);

    if (!options.secure) {
      const supportsStartTls = ehlo.text.toUpperCase().includes('STARTTLS');
      if (supportsStartTls) {
        await client.sendCommand('STARTTLS', [220]);
        const upgraded = await upgradeToStartTls(socket, options);
        client.rebindSocket(upgraded);
        ehlo = await client.sendCommand('EHLO eparnio.local', [250]);
      } else if (!isLocalHostname(options.host)) {
        throw new Error('STARTTLS est requis pour authentifier un serveur SMTP distant');
      }
    }

    const cleanUser = sanitizeHeaderValue(options.user);
    const cleanPass = options.pass.replace(/\s+/g, '');
    const authPayload = Buffer.from(`\u0000${cleanUser}\u0000${cleanPass}`, 'utf8').toString(
      'base64'
    );
    await client.sendCommand(`AUTH PLAIN ${authPayload}`, [235]);

    const safeFromHeader = sanitizeHeaderValue(options.from);
    const safeToHeader = sanitizeHeaderValue(options.to);
    const envelopeFrom = extractEmailAddress(cleanUser) ?? extractEmailAddress(safeFromHeader);
    const envelopeTo = extractEmailAddress(safeToHeader);

    if (!envelopeFrom || !envelopeTo) {
      throw new Error('Adresses e-mail SMTP expéditeur ou destinataire invalides');
    }

    await client.sendCommand(`MAIL FROM:<${envelopeFrom}>`, [250]);
    await client.sendCommand(`RCPT TO:<${envelopeTo}>`, [250, 251]);
    await client.sendCommand('DATA', [354]);

    const safeSubject = sanitizeHeaderValue(options.subject);
    const encodedSubject = `=?UTF-8?B?${Buffer.from(safeSubject, 'utf8').toString('base64')}?=`;
    const normalizedBody = options.text.replace(/\r?\n/g, '\r\n').replace(/(^|\r\n)\./g, '$1..');

    const message = [
      `From: ${safeFromHeader}`,
      `To: ${safeToHeader}`,
      `Subject: ${encodedSubject}`,
      `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      normalizedBody,
      ''
    ].join('\r\n');

    await client.sendRaw(`${message}.\r\n`);
    const dataAck = await client.readResponse();
    if (dataAck.code !== 250) {
      throw new Error(`Rejet du message SMTP (${dataAck.code}) : ${dataAck.text}`);
    }

    try {
      await client.sendCommand('QUIT', [221]);
    } catch {
      // Certains serveurs ferment le socket immédiatement après DATA
    }
  } finally {
    client.close();
  }
}

/**
 * Envoie le code à 6 chiffres de réinitialisation par SMTP Gmail gratuit (ou journalise en dev si non configuré).
 */
export async function sendPasswordResetCodeEmail(
  params: PasswordResetEmailParams
): Promise<{ deliveredVia: 'smtp' | 'console' | 'custom' }> {
  if (customEmailSender) {
    await customEmailSender(params);
    return { deliveredVia: 'custom' };
  }

  const smtpUser = env.SMTP_USER.trim();
  const smtpPass = env.SMTP_PASS.replace(/\s+/g, '');

  if (smtpUser && smtpPass) {
    const subject = 'Eparnio — Code de réinitialisation de votre mot de passe';
    const text = [
      `Bonjour ${params.displayName},`,
      '',
      'Vous avez demandé à réinitialiser votre mot de passe Eparnio.',
      `Votre code de vérification à 6 chiffres est : ${params.code}`,
      '',
      `Ce code est valable pendant ${params.ttlMinutes} minutes.`,
      "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.",
      '',
      "— L'équipe Eparnio"
    ].join('\n');

    await sendSmtpMail({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: smtpUser,
      pass: smtpPass,
      from: env.SMTP_FROM,
      to: params.to,
      subject,
      text
    });

    return { deliveredVia: 'smtp' };
  }

  if (env.NODE_ENV === 'production') {
    throw new AppError(
      'Le service d’envoi d’e-mail (SMTP) n’est pas configuré sur ce serveur',
      503
    );
  }

  if (env.NODE_ENV === 'development') {
    console.info(
      `[Eparnio DEV SMTP] Code de réinitialisation pour ${params.to} : ${params.code} (valable ${params.ttlMinutes} min)`
    );
  }

  return { deliveredVia: 'console' };
}
