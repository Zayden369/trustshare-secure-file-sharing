from src.ai_auth import get_ai_user
import time

from fastapi import APIRouter, BackgroundTasks, Depends, Response, status
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user
from src.database.core import get_db
from src.entities.user import User
from src.file_summaries import service
from src.file_summaries.models import SummaryCreate, SummaryList, SummaryOut
from src.security.rate_limiter import check_rate_limit

router = APIRouter()


def _rate_limit(user_id: int, db: Session):
    result = check_rate_limit(str(user_id), "file_summary", db)
    if not result["allowed"]:
        from fastapi import HTTPException
        retry_after = max(1, int(result["reset_in"] + 0.999))
        raise HTTPException(status_code=429, detail={"message": "Too many summary requests.", "retry_after": retry_after})


@router.post("/{file_id}/summaries", response_model=SummaryOut)
def create(file_id: int, data: SummaryCreate, background_tasks: BackgroundTasks, response: Response, db: Session = Depends(get_db), current_user: User = Depends(get_ai_user)):
    _rate_limit(current_user.id, db)
    summary, cached = service.create_summary(db, file_id, current_user.id, data)
    if cached:
        output = SummaryOut.model_validate(summary).model_copy(update={"cached": True})
        response.status_code = status.HTTP_200_OK
        return output
    background_tasks.add_task(service.process_summary, summary.id, 0, time.perf_counter())
    response.status_code = status.HTTP_202_ACCEPTED
    return summary


@router.get("/{file_id}/summaries", response_model=SummaryList)
def list_all(file_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_ai_user)):
    items = service.list_summaries(db, file_id, current_user.id)
    return {"summaries": items, "total": len(items)}


@router.get("/{file_id}/summaries/latest", response_model=SummaryOut)
def latest(file_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_ai_user)):
    items = service.list_summaries(db, file_id, current_user.id)
    file=service.authorize_file(db,file_id,current_user.id)
    items=[item for item in items if item.source_file_version==(file.version or 1) and
           (not file.hash_sha256 or item.source_checksum==file.hash_sha256)]
    if not items:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Summary not found")
    return items[0]


@router.get("/{file_id}/summaries/{summary_id}", response_model=SummaryOut)
def get_one(file_id: int, summary_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_ai_user)):
    return service.get_summary(db, file_id, summary_id, current_user.id)


@router.post("/{file_id}/summaries/{summary_id}/regenerate", response_model=SummaryOut, status_code=202)
def regenerate(file_id: int, summary_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_ai_user)):
    _rate_limit(current_user.id, db)
    old = service.get_summary(db, file_id, summary_id, current_user.id)
    data = SummaryCreate(summary_length=old.summary_length, output_language=old.output_language, output_format=old.output_format, force_regenerate=True)
    summary, _ = service.create_summary(db, file_id, current_user.id, data)
    variation = summary.id * 1_000_003 + int(time.time() * 1000) % 1_000_003
    background_tasks.add_task(service.process_summary, summary.id, variation, time.perf_counter())
    return summary


@router.get('/{file_id}/summaries/{summary_id}/revisions')
def revisions(file_id: int, summary_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_ai_user)):
    return {'revisions': service.summary_history(db, file_id, summary_id, current_user.id)}


@router.delete("/{file_id}/summaries/{summary_id}", status_code=204)
def delete(file_id: int, summary_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_ai_user)):
    service.delete_summary(db, file_id, summary_id, current_user.id)
    return Response(status_code=204)
