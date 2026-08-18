"""
encryption.py — Symmetric encryption for per-user API keys at rest.

Uses the `cryptography` library's Fernet (AES-128 in CBC mode with HMAC).
The key is read from the required DB_ENCRYPTION_KEY environment variable, which
must be provided (e.g. in the Railway dashboard). If it is missing the app
refuses to start, mirroring the existing SESSION_SECRET_KEY / JWT_SECRET_KEY
fail-fast pattern.

IMPORTANT: decrypted keys are never logged or printed.
"""

import os
from cryptography.fernet import Fernet, InvalidToken

# Fail fast if the encryption key is not configured.
_DB_ENCRYPTION_KEY = os.getenv("DB_ENCRYPTION_KEY")
if not _DB_ENCRYPTION_KEY:
    raise RuntimeError(
        "DB_ENCRYPTION_KEY env var is required to encrypt/decrypt stored API keys. "
        "Generate one with: python -c \"from cryptography.fernet import Fernet; "
        "print(Fernet.generate_key().decode())\""
    )

# Fernet keys are base64-encoded bytes; the env var holds the string form.
_fernet = Fernet(_DB_ENCRYPTION_KEY.encode() if isinstance(_DB_ENCRYPTION_KEY, str) else _DB_ENCRYPTION_KEY)


def encrypt_key(plain: str) -> str:
    """
    Encrypt a plaintext API key and return the base64 ciphertext as a string.
    Never logs or prints the plaintext or ciphertext.
    """
    if plain is None:
        return None
    token = _fernet.encrypt(plain.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_key(encrypted: str) -> str:
    """
    Decrypt a ciphertext (as stored in the DB) back to the plaintext API key.
    Never logs or prints the plaintext or ciphertext.
    Returns None if encrypted is None/empty.
    """
    if not encrypted:
        return None
    try:
        return _fernet.decrypt(encrypted.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError):
        # Corrupt or key-mismatched value — treat as no key rather than crashing.
        return None
