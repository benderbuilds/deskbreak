#!/usr/bin/env node
/**
 * Prints a fresh VAPID key pair for Web Push.
 *
 * Put the public key in NEXT_PUBLIC_VAPID_PUBLIC_KEY (and VAPID_PUBLIC_KEY),
 * the private key in VAPID_PRIVATE_KEY, and a contact in VAPID_SUBJECT.
 * Generate once per deployment; rotating keys invalidates every subscription.
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:hello@deskbreak.app`);
