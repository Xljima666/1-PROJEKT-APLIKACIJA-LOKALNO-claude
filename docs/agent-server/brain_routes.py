"""
brain_routes.py — Stellan Brain endpointi za agent_server.py.

Koristenje u agent_server.py (dodaj 2 linije nakon `app = FastAPI(...)`):

    from brain_routes import register_brain_routes
    register_brain_routes(app)

Sve ostalo je automatsko. Endpointi su zasticeni istim X-API-Key headerom kao i ostali.
"""

from __future__ import annotations
import sys
from pathlib import Path
from typing import Any, Optional
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel

# Brain folder (absolute path)
BRAIN_DIR = Path(r"D:\1 PROJEKT APLIKACIJA LOKALNO\1 PROJEKT APLIKACIJA LOKALNO claude\0 MOZAK")

# Dodaj brain folder u sys.path da mozemo importati brain_loader/embeddings/vector_store
if str(BRAIN_DIR) not in sys.path:
    sys.path.insert(0, str(BRAIN_DIR))


# ---- lazy init: brain se ucitava tek pri prvom pozivu (brzo startanje servera) ----
_BRAIN = None


def get_brain():
    global _BRAIN
    if _BRAIN is None:
        from brain_loader import StellanBrain
        from embeddings import Embedder
        print("[BRAIN] Ucitavam Stellan Brain...")
        _BRAIN = StellanBrain(
            brain_dir=BRAIN_DIR,
            embedder=Embedder(provider="gemini"),
            llm_call=_gemini_llm_call,
        )
        stats = _BRAIN.stats()
        print(f"[BRAIN] OK: {stats}")
    return _BRAIN


def _gemini_llm_call(prompt: str) -> str:
    """LLM poziv za rerank/learn/reflect. Koristi isti Gemini API key."""
    import os
    from google import genai
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    resp = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
    )
    return resp.text or ""


# ============ REQUEST MODELI ============

class SearchKnowledgeReq(BaseModel):
    query: str
    k: int = 5
    rerank: bool = False

class RecallMemoryReq(BaseModel):
    query: str
    k: int = 3
    layer: str = "all"  # "all" | "episodic" | "semantic" | "procedural"

class AddEpisodeReq(BaseModel):
    user: str
    text: str
    meta: Optional[dict] = None

class AddFactReq(BaseModel):
    fact: str
    source: str = ""
    entities: Optional[list[str]] = None

class AddProcedureReq(BaseModel):
    name: str
    steps: list[str]
    context: str = ""

class LearnReq(BaseModel):
    transcript: str
    user: str = "marko"

class ReflectReq(BaseModel):
    task: str
    outcome: str
    success: bool

class KgLinkReq(BaseModel):
    source: str
    target: str
    relation: str

class SystemPromptReq(BaseModel):
    user: str = "marko"
    include_recall_for: Optional[str] = None  # ako je postavljeno, doda top memorije vezane uz ovaj query


# ============ REGISTRACIJA ============

def register_brain_routes(app: FastAPI, verify_key=None):
    """
    Dodaje /brain/* endpointe u postojeci FastAPI app.

    verify_key: opcionalna dependencija za autentifikaciju (npr. verify_api_key iz agent_servera).
                Ako nije navedeno, endpointi su nezasticeni (samo za lokalni test).
    """
    deps = [] if verify_key is None else [__import__("fastapi").Depends(verify_key)]

    @app.get("/brain/stats", dependencies=deps)
    def brain_stats():
        return get_brain().stats()

    @app.post("/brain/reindex", dependencies=deps)
    def brain_reindex():
        return get_brain().reindex_vectors()

    @app.post("/brain/system_prompt", dependencies=deps)
    def brain_system_prompt(req: SystemPromptReq):
        b = get_brain()
        prompt = b.get_system_prompt(user=req.user)
        if req.include_recall_for:
            mem = b.recall_memory(req.include_recall_for, k=3)
            blocks = []
            for layer, items in mem.items():
                if not items:
                    continue
                blocks.append(f"### {layer}")
                for it in items:
                    txt = it.get("text") or it.get("fact") or it.get("name") or ""
                    blocks.append(f"- {txt[:200]}")
            if blocks:
                prompt += "\n\n## RELEVANTNE MEMORIJE\n" + "\n".join(blocks)
        return {"prompt": prompt}

    @app.post("/brain/search_knowledge", dependencies=deps)
    def brain_search(req: SearchKnowledgeReq):
        return {"results": get_brain().search_knowledge(req.query, k=req.k, rerank=req.rerank)}

    @app.post("/brain/recall_memory", dependencies=deps)
    def brain_recall(req: RecallMemoryReq):
        return {"results": get_brain().recall_memory(req.query, k=req.k, layer=req.layer)}

    @app.post("/brain/add_episode", dependencies=deps)
    def brain_add_episode(req: AddEpisodeReq):
        idx = get_brain().add_episode(user=req.user, text=req.text, meta=req.meta)
        return {"ok": True, "idx": idx}

    @app.post("/brain/add_fact", dependencies=deps)
    def brain_add_fact(req: AddFactReq):
        idx = get_brain().add_semantic_fact(req.fact, source=req.source, entities=req.entities)
        return {"ok": True, "idx": idx}

    @app.post("/brain/add_procedure", dependencies=deps)
    def brain_add_procedure(req: AddProcedureReq):
        idx = get_brain().add_procedure(req.name, req.steps, req.context)
        return {"ok": True, "idx": idx}

    @app.post("/brain/learn_from_conversation", dependencies=deps)
    def brain_learn(req: LearnReq):
        return get_brain().learn_from_conversation(req.transcript, user=req.user)

    @app.post("/brain/reflect", dependencies=deps)
    def brain_reflect(req: ReflectReq):
        return get_brain().reflect(req.task, req.outcome, req.success)

    @app.post("/brain/kg_link", dependencies=deps)
    def brain_kg_link(req: KgLinkReq):
        get_brain().kg_link(req.source, req.target, req.relation)
        return {"ok": True}

    @app.get("/brain/kg_neighbors", dependencies=deps)
    def brain_kg_neighbors(entity: str):
        return {"neighbors": get_brain().kg_neighbors(entity)}

    print("[BRAIN] Registrirani endpointi: /brain/stats, /brain/search_knowledge, /brain/recall_memory, /brain/add_episode, /brain/add_fact, /brain/add_procedure, /brain/learn_from_conversation, /brain/reflect, /brain/system_prompt, /brain/reindex, /brain/kg_link, /brain/kg_neighbors")
