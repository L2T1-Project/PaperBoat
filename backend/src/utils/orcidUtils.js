function normalizeOrcId(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return raw.replace(/^https?:\/\/orcid\.org\//i, "").replace(/\s+/g, "").toUpperCase();
}

function isOrcIdFormatValid(normalizedOrcId) {
  return /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(String(normalizedOrcId || ""));
}

function isOrcIdCheckDigitValid(normalizedOrcId) {
  if (!isOrcIdFormatValid(normalizedOrcId)) return false;

  const compact = normalizedOrcId.replace(/-/g, "");
  let total = 0;

  for (let i = 0; i < 15; i += 1) {
    total = (total + Number(compact[i])) * 2;
  }

  const remainder = total % 11;
  const result = (12 - remainder) % 11;
  const expected = result === 10 ? "X" : String(result);
  return compact[15] === expected;
}

function normalizeAndValidateOrcId(value) {
  const normalizedOrcId = normalizeOrcId(value);
  if (!normalizedOrcId) {
    return { normalizedOrcId: null, error: null };
  }

  if (!isOrcIdFormatValid(normalizedOrcId)) {
    return {
      normalizedOrcId: null,
      error: "ORCID must match format XXXX-XXXX-XXXX-XXXX (last character can be X).",
    };
  }

  if (!isOrcIdCheckDigitValid(normalizedOrcId)) {
    return {
      normalizedOrcId: null,
      error: "ORCID check digit is invalid.",
    };
  }

  return { normalizedOrcId, error: null };
}

module.exports = {
  normalizeOrcId,
  normalizeAndValidateOrcId,
  isOrcIdFormatValid,
  isOrcIdCheckDigitValid,
};
