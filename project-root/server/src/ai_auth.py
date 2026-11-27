"""Measure AI-route authorization using the unchanged application validator."""
from contextlib import nullcontext
from fastapi import Depends, Request
from sqlalchemy.orm import Session
from src.auth.dependencies import get_current_user, oauth2_scheme
from src.database.core import get_db


def get_ai_user(request:Request,token:str=Depends(oauth2_scheme),db:Session=Depends(get_db)):
    trace=request.scope.get('ai_trace')
    with trace.stage('authorization') if trace else nullcontext():
        return get_current_user(token=token,db=db)
