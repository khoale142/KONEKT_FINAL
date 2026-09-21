import { ApiError } from '../../utils/ApiError.js';

const validators = new Map();
const snapshotExtensions = new Map();

export function registerDocumentValidator(documentType, validator) {
  if (typeof validator !== 'function') throw new Error('Document validator must be a function.');
  validators.set(documentType, validator);
}

// Typed workflow modules must register every approval-relevant detail that lives outside the
// generic document header/lines. The returned value is folded into the canonical submission hash.
export function registerSubmissionSnapshotExtension(documentType, extensionProvider) {
  if (typeof extensionProvider !== 'function') throw new Error('Submission snapshot extension must be a function.');
  snapshotExtensions.set(documentType, extensionProvider);
}

export async function getSubmissionSnapshotExtension(document, lines, client) {
  const provider = snapshotExtensions.get(document.document_type);
  if (!provider) return null;
  return provider(document, lines, client);
}

export async function validateDocumentForSubmission(document, lines, client) {
  const validator = validators.get(document.document_type);
  if (!validator) {
    throw new ApiError(409, 'DOCUMENT_TYPE_NOT_OPERATIONAL');
  }
  await validator(document, lines, client);
}
