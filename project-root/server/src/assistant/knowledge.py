"""Verified product facts. Never reads secrets or another user's account."""
import os
from src.assistant.intents import normalize
from src.security.validation import validators
from src.file_summaries.text_extraction import SUPPORTED_EXTENSIONS

ALIASES = {
    "uploads": ["How many files can I upload at once?", "What is the upload limit?", "What is the maximum file size?", "Can I upload more than five files?"],
    "formats": ["What file formats does TrustShare support?", "Which file types can I upload?", "What file types are unsupported?"],
    "preview": ["Which files can I preview?", "What file previews does TrustShare support?"],
    "encryption": ["How does TrustShare encrypt files?", "Is TrustShare end-to-end encrypted?", "Is TrustShare zero knowledge?"],
    "sharing": ["How does secure sharing work?", "What sharing permissions are available?", "Can view-only users take screenshots?", "Does TrustShare guarantee that nobody can photograph a screen?", "Do share links expire?", "Can I password protect a share link?", "Can I limit share link access?"],
    "registration": ["How do I create an account?", "Does TrustShare verify my email?"],
    "mfa": ["How does MFA work?", "How do I enable MFA?"],
    "sessions": ["How do active sessions work?", "Can I revoke a login session?"],
    "notifications": ["How do notifications work?", "What notifications does TrustShare support?"],
    "versions": ["Does TrustShare support file version history?", "How does file version history work?"],
    "assistant": ["What can the TrustShare assistant do?", "Can the assistant delete files?"],
    "summary": ["What can AI summaries do?", "Which files support AI summary?", "Can TrustShare summarize scanned PDFs?", "What are AI summary limitations?"],
    "roles": ["What roles does TrustShare have?", "What permissions do admins have?"],
    "quota": ["What is my storage quota?", "What are the storage quotas?"],
}
LOOKUP = {normalize(alias): topic for topic, aliases in ALIASES.items() for alias in aliases}


def facts(db, user):
    formats = sorted(validators._get_allowed_extensions(db))
    summary_formats = ", ".join(sorted(SUPPORTED_EXTENSIONS))
    return {
        "uploads": f"The current file upload validator permits up to {validators.MAX_FILE_SIZE // (1024 * 1024)} MiB per file. The API accepts one file per request; the web app queues a selected batch sequentially. There is no implemented five-file batch limit. File type checks, your remaining storage and rate limits still apply.",
        "formats": "Currently enabled upload extensions: " + ", ".join(formats) + ". Other extensions are rejected. Extension, MIME and content checks apply; enabling an extension does not guarantee a browser preview or an AI summary.",
        "preview": "The web client provides previews for PDFs, images, text/CSV/JSON/XML and browser-supported audio/video. Other files can be downloaded when permission allows. Browser codec support varies; Office documents are not rendered as native Office previews.",
        "encryption": "TrustShare uses server-side AES-256-GCM encryption with a separate per-file key protected by a master key. Authorized processing decrypts files in server memory. This is not end-to-end or zero-knowledge encryption; the server can decrypt authorized content.",
        "sharing": "Owners can grant recipients view or download access, or create revocable share links with optional expiry, a password and an access limit. Revocation and expiry prevent future authorized access; they cannot erase copies already obtained. View-only access does not prevent screenshots or every method of copying.",
        "registration": "Password registration requires email ownership verification with an expiring, one-use code before account creation. Google sign-in verifies the provider's email claim. Microsoft sign-in is disabled in this launch.",
        "mfa": "When email MFA is enabled, password or Google authentication must complete the email code step before an access session is issued. Use Settings to configure MFA. Delivery requires a working SMTP service; codes expire and have attempt limits.",
        "sessions": "Access tokens are bound to a current login session. Logging out or revoking the session prevents future authenticated requests. The current sign-in policy marks older sessions non-current; historical login records are not active sessions.",
        "notifications": "Notifications are scoped to your account and include sharing, security, download and activity updates. Read state and notification preferences affect what you see. The assistant can read your notifications; it does not change notification preferences.",
        "versions": "Uploading a replacement file creates version history. Authorized users can inspect versions, download permitted versions and restore a version through My Files. Summary requests currently support the active file version; explicit historical version IDs are rejected.",
        "assistant": "The assistant retrieves your own files, storage, shares, sessions, notifications and profile using authorized read-only operations. Known questions use live database answers; custom questions can use the configured AI model. It cannot delete files, change passwords, revoke shares or change permissions on your behalf.",
        "summary": f"AI summaries extract readable text from {summary_formats}, up to {max(1, int(os.getenv('SUMMARY_MAX_FILE_SIZE_MB', '20')))} MiB per file. Scanned image-only PDFs require OCR, which is not enabled. Summary lengths and paragraph/bullet formats are supported in the source language. Long sources use bounded excerpts with a visible coverage warning. The extractive fallback is labelled separately. Generated text can omit details or contain mistakes; verify important facts in the original. The configured summary model is {os.getenv('SUMMARY_OLLAMA_MODEL') or os.getenv('OLLAMA_MODEL', 'qwen2.5:1.5b')}.",
        "roles": "The application distinguishes admin, member and guest roles. Administrative APIs require admin authorization. Having an admin role does not make assistant file-retrieval operations return other users' private files; each operation still applies its ownership filters.",
        "quota": f"Your stored account quota is {user.storage_quota or 0} bytes and recorded usage is {user.storage_used or 0} bytes. Plans and account settings can differ; no universal quota is assumed for every account.",
    }


def answer(db, user, message):
    topic = LOOKUP.get(normalize(message))
    if topic:
        return topic, facts(db, user)[topic]
    return None


def model_context(db, user, message):
    # Only public policy facts; account values never enter this grounding block.
    import re
    lower=message.lower()
    # Generic computing explanations need no catalogue of application policy.
    # Direct product questions still receive the verified facts they require.
    if not re.search(r'\b(trustshare|my|our|here)\b|this (app|application|platform)|how (do|can) i',lower):
        return ''
    cues={'uploads':['upload','file size','batch'],'encryption':['encrypt','zero-knowledge','end-to-end'],
          'sharing':['sharing','share link','screenshot','photograph'],'mfa':['mfa','verification code'],
          'assistant':['assistant'],'summary':['summar']}
    selected=[key for key,terms in cues.items() if any(term in message.lower() for term in terms)]
    if not selected:
        return 'Unverified TrustShare product facts must be described as unknown.' if 'trustshare' in message.lower() else ''
    values=facts(db,user)
    return 'Verified TrustShare facts:\n'+'\n'.join(values[key] for key in selected)[:2600]
