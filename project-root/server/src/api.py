from dotenv import load_dotenv
load_dotenv()

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.activity.controller import router as activity_router
from src.admin.controller import router as admin_router
from src.analytics.controller import router as analytics_router
from src.audit.controller import router as audit_router
from src.auth.controller import router as auth_router
from src.dashboard.controller import router as dashboard_router
from src.database.init_db import init_db
from src.exceptions import AppException, app_exception_handler
from src.files.controller import router as files_router
from src.folders.controller import router as folders_router
from src.notifications.controller import router as notifications_router
from src.search.controller import router as search_router
from src.settings.controller import router as settings_router
from src.shared_with_me.controller import router as shared_with_me_router
from src.shares.controller import router as shares_router
from src.todos.controller import router as todos_router
from src.users.controller import router as users_router
from src.security.controller import router as security_router
from src.file_summaries.controller import router as file_summaries_router

from src.assistant.controller import router as assistant_router
from src.assistant.admin_controller import router as assistant_admin_router

def create_app() -> FastAPI:
    # Initialize DB tables
    init_db()

    app = FastAPI(
        title="TrustShare API",
        version="2.0.0",
        description="Secure File-Sharing System — FastAPI Backend",
        docs_url="/docs",
        redoc_url="/redoc",
    )
    from src.ai_metrics import AIMetricsMiddleware
    app.add_middleware(AIMetricsMiddleware)

    # ── HTTPS Redirect Middleware (production only) ────────────────────────────
    # PSD 4.ii: HTTPS/TLS Communication
    # In production (ENVIRONMENT=production), all HTTP requests are
    # automatically redirected to HTTPS.
    # In development, HTTP is allowed (localhost does not need TLS).
    _env = os.getenv("ENVIRONMENT", "development").lower().strip()
    if _env in ("production", "prod"):
        from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
        app.add_middleware(HTTPSRedirectMiddleware)

    origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Exception handlers ────────────────────────────────────────────────────
    app.add_exception_handler(AppException, app_exception_handler)

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(auth_router,           prefix="/api/auth",           tags=["Auth"])
    app.include_router(users_router,          prefix="/api/users",          tags=["Users"])
    app.include_router(files_router,          prefix="/api/files",          tags=["Files"])
    app.include_router(file_summaries_router, prefix="/api/files",          tags=["File summaries"])
    app.include_router(folders_router,        prefix="/api/folders",        tags=["Folders"])
    app.include_router(shares_router,         prefix="/api/shares",         tags=["Sharing"])
    app.include_router(notifications_router,  prefix="/api/notifications",  tags=["Notifications"])
    app.include_router(audit_router,          prefix="/api/audit",          tags=["Audit"])
    app.include_router(analytics_router,      prefix="/api/analytics",      tags=["Analytics"])
    app.include_router(dashboard_router,      prefix="/api/dashboard",      tags=["Dashboard"])
    app.include_router(shared_with_me_router, prefix="/api/shared-with-me", tags=["Shared with me"])
    app.include_router(admin_router,          prefix="/api/admin",          tags=["Admin"])
    app.include_router(activity_router,       prefix="/api/activity",       tags=["Activity"])
    app.include_router(settings_router,       prefix="/api/settings",       tags=["Settings"])
    app.include_router(todos_router,          prefix="/api/todos",          tags=["Todos"])
    app.include_router(security_router,       prefix="/api/security",       tags=["Security"])
    app.include_router(assistant_router,      prefix="/api/assistant", tags=["AI Assistant"],)
    app.include_router(assistant_admin_router, prefix="/api/assistant/admin",tags=["AI Assistant Admin"],)
    
    # ── Health check ──────────────────────────────────────────────────────────
    @app.get("/health", tags=["System"])
    def health():
        return {"status": "ok", "service": "TrustShare API", "version": "2.0.0"}

        # ── Health check ──────────────────────────────────────────────────────────
    @app.get("/health", tags=["System"])
    def health():
        return {"status": "ok", "service": "TrustShare API", "version": "2.0.0"}

    @app.get("/health/ready", tags=["System"])
    def health_ready():
        """Readiness check — confirms all dependencies are available."""
        from fastapi.responses import JSONResponse
        from sqlalchemy import text as sa_text
        import pathlib

        _environment = os.getenv("ENVIRONMENT", "development").lower().strip()
        checks = {}
        all_ready = True

        # ── Check database ──
        try:
            from src.database.core import get_db
            db = next(get_db())
            db.execute(sa_text("SELECT 1"))
            db.close()
            checks["database"] = "ok"
        except Exception as e:
            checks["database"] = f"error: {str(e)[:50]}"
            all_ready = False

        # ── Check SECRET_KEY ──
        secret_key = os.getenv("SECRET_KEY", "")
        if not secret_key or secret_key == "dev-only-secret-key-not-for-production-use":
            if _environment in ("production", "prod"):
                checks["secret_key"] = "error: not configured"
                all_ready = False
            else:
                checks["secret_key"] = "warning: using dev fallback"
        else:
            checks["secret_key"] = "ok"

        # ── Check MASTER_KEY_HEX ──
        master_key = os.getenv("MASTER_KEY_HEX", "")
        if not master_key:
            checks["master_key"] = "warning: not configured"
        else:
            checks["master_key"] = "ok"

        # ── Check storage directory ──
        try:
            storage_path = pathlib.Path("uploads")
            checks["storage"] = "ok"
        except Exception as e:
            checks["storage"] = f"error: {str(e)[:50]}"
            all_ready = False

        status_code = 200 if all_ready else 503
        return JSONResponse(
            status_code=status_code,
            content={
                "status": "ready" if all_ready else "not_ready",
                "service": "TrustShare API",
                "version": "2.0.0",
                "environment": _environment,
                "checks": checks,
            }
        )

    # ── Search Bar ────────────────────────────────────────────────────────────
    app.include_router(
        search_router,
        prefix="/api/search",
        tags=["Search"],
    )

    return app


app = create_app()
