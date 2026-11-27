"""Conservative intent routing. No user-supplied operation names or arguments."""
import re
import unicodedata
from dataclasses import dataclass

from fastapi import HTTPException
from src.entities.assistant_suggested_query import AssistantSuggestedQuery, AssistantSuggestionIntent


def normalize(text):
    text = unicodedata.normalize("NFKC", text).replace("’", "'").strip().lower()
    return re.sub(r"\s+", " ", text).rstrip("?.!")


@dataclass(frozen=True)
class Intent:
    id: str
    title: str
    operation: str
    arguments: dict
    aliases: tuple


INTENTS = [
    Intent("files.recent", "Recent Files", "list_files", {}, ("Show me my recent files", "Show my recent files", "My recent files")),
    Intent("files.pdf_month", "PDFs This Month", "list_files", {"file_type": "pdf", "calendar_month": True}, ("Find all PDFs I uploaded this month", "Show my PDFs from this month")),
    Intent("files.largest", "Largest Files", "list_files", {"sort_by": "size", "sort_order": "desc"}, ("What are my largest files?", "Show my largest files")),
    Intent("storage.overview", "Storage Overview", "get_storage_info", {}, ("How much storage do I have left?", "How much storage is available?", "Show my storage usage")),
    Intent("storage.breakdown", "Storage Breakdown", "get_storage_breakdown", {}, ("Show my storage breakdown by category", "Show my storage breakdown")),
    Intent("shares.files", "Shared Files", "find_shares", {"active_only": False}, ("What files have I shared with others?", "Show my shared files")),
    Intent("shares.active_links", "Active Share Links", "find_shares", {"links_only": True, "active_only": True}, ("Show my active share links", "List my active share links")),
    Intent("account.sessions", "Active Sessions", "list_active_sessions", {}, ("Show my active login sessions", "Show my active sessions")),
    Intent("account.notifications", "Unread Notifications", "get_notifications", {"unread_only": True}, ("Do I have any unread notifications?", "Show my unread notifications")),
    Intent("account.profile", "Account Information", "get_user_profile", {}, ("What's my account information?", "What is my account information?", "Show my account information")),
]
BY_ID = {intent.id: intent for intent in INTENTS}
BY_TEXT = {normalize(alias): intent for intent in INTENTS for alias in intent.aliases}


def resolve(db, text, intent_id=None, suggestion_id=None):
    intent = BY_TEXT.get(normalize(text))
    if suggestion_id is not None:
        row = db.query(AssistantSuggestedQuery).filter(
            AssistantSuggestedQuery.id == suggestion_id, AssistantSuggestedQuery.is_active == True,
        ).first()
        if not row or normalize(row.query_text) != normalize(text):
            raise HTTPException(400, "This suggestion is no longer available. Refresh the suggestions.")
        mapping=db.get(AssistantSuggestionIntent,row.id)
        if mapping and mapping.intent_id in BY_ID:
            if intent and intent.id!=mapping.intent_id:
                raise HTTPException(400,'This suggestion has a conflicting intent mapping.')
            intent=BY_ID[mapping.intent_id]
    elif not intent:
        # Only exact admin-curated labels qualify. Conflicting labels remain AI.
        matches={mapping.intent_id for row,mapping in db.query(AssistantSuggestedQuery,AssistantSuggestionIntent)
                 .join(AssistantSuggestionIntent,AssistantSuggestionIntent.suggestion_id==AssistantSuggestedQuery.id)
                 .filter(AssistantSuggestedQuery.is_active==True).limit(200).all()
                 if normalize(row.query_text)==normalize(text) and mapping.intent_id in BY_ID}
        if len(matches)==1:intent=BY_ID[matches.pop()]
    if intent_id is not None and (intent_id not in BY_ID or not intent or intent.id != intent_id):
        raise HTTPException(400, "Intent does not match the requested question.")
    return intent


def suggestion_intents(db,rows):
    mappings={row.suggestion_id:row.intent_id for row in db.query(AssistantSuggestionIntent)
              .filter(AssistantSuggestionIntent.suggestion_id.in_([item.id for item in rows])).all()}
    return {row.id:(BY_TEXT[normalize(row.query_text)].id if normalize(row.query_text) in BY_TEXT else
                    mappings.get(row.id) if mappings.get(row.id) in BY_ID else None) for row in rows}


def response_text(intent, data):
    if data.get("error"):
        return data["message"]
    operation = intent.operation
    if operation in {"list_files", "search_files"}:
        total, shown = data["total_matched"], data["shown"]
        return (f"I found {total} matching file{'s' if total != 1 else ''}. Showing {shown}." if total else "No files match this request.")
    if operation == "get_storage_info":
        return f"You've used {data['used']} of {data['quota']}; {data['remaining']} remains."
    if operation == "get_storage_breakdown":
        count = sum(item['count'] for item in data['categories'])
        return f"Your {count} file{'s' if count != 1 else ''} use {data['total']}." if count else "You have no stored files to break down."
    if operation == "find_shares":
        return f"Found {data['direct_shares_count']} direct shares and {data['share_links_count']} {'active ' if intent.id == 'shares.active_links' else ''}share links (up to 50 of each)."
    if operation == "list_active_sessions":
        count = data['total_sessions']
        return f"You have {count} active login session{'s' if count != 1 else ''}."
    if operation == "get_notifications":
        count = data['total_matched']
        return f"You have {count} unread notification{'s' if count != 1 else ''}." if count else "You have no unread notifications."
    return f"Here is your account information. Your role is {data['role']} and your plan is {data['plan']}."
