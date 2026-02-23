from __future__ import annotations

import json
import time
from typing import Dict, Optional, Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["f2f-ws"])

# In-memory rooms (MVP)
# room_id -> {
#   "host": WebSocket|None,
#   "guest": WebSocket|None,
#   "lang": {"host_lang":"tr","guest_lang":"en"},
#   "host_credits": int,
#   "updated_at": float
# }
ROOMS: Dict[str, Dict[str, Any]] = {}

DEFAULT_HOST_LANG = "tr"
DEFAULT_GUEST_LANG = "en"
DEFAULT_HOST_CREDITS = 999999  # MVP: sınırsız gibi davranır (sonra Supabase jetona bağlarız)

def now() -> float:
    return time.time()

def room_init(room_id: str) -> Dict[str, Any]:
    return {
        "host": None,
        "guest": None,
        "lang": {"host_lang": DEFAULT_HOST_LANG, "guest_lang": DEFAULT_GUEST_LANG},
        "host_credits": DEFAULT_HOST_CREDITS,
        "updated_at": now(),
    }

async def ws_send(ws: Optional[WebSocket], msg: Dict[str, Any]) -> None:
    if ws is None:
        return
    try:
        await ws.send_text(json.dumps(msg))
    except Exception:
        return

async def broadcast_room(room_id: str, msg: Dict[str, Any]) -> None:
    room = ROOMS.get(room_id)
    if not room:
        return
    await ws_send(room.get("host"), msg)
    await ws_send(room.get("guest"), msg)

def deduct_host(room_id: str, cost: int = 1) -> int:
    room = ROOMS.get(room_id)
    if not room:
        return 0
    credits = int(room.get("host_credits") or 0)
    credits = max(0, credits - int(cost))
    room["host_credits"] = credits
    room["updated_at"] = now()
    return credits

@router.websocket("/f2f/ws/{room_id}")
async def f2f_ws(ws: WebSocket, room_id: str):
    await ws.accept()

    role: Optional[str] = None
    room = ROOMS.setdefault(room_id, room_init(room_id))

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw or "{}")
            mtype = msg.get("type")

            # ---- HELLO ----
            if mtype == "hello":
                role = msg.get("role")
                if role not in ("host", "guest"):
                    await ws_send(ws, {"type":"info","message":"invalid role"})
                    continue

                # only 1 host, 1 guest
                if room.get(role) is not None:
                    await ws_send(ws, {"type":"info","message":f"{role} already connected"})
                    continue

                room[role] = ws
                room["updated_at"] = now()

                await ws_send(ws, {"type":"info","message":f"connected as {role}"})

                # send current language state + credits to both
                await broadcast_room(room_id, {
                    "type":"lang_state",
                    "host_lang": room["lang"]["host_lang"],
                    "guest_lang": room["lang"]["guest_lang"],
                })
                await ws_send(room.get("host"), {
                    "type":"host_credits",
                    "credits": room.get("host_credits", 0)
                })

                # notify host when guest joins
                if role == "guest" and room.get("host") is not None:
                    await ws_send(room.get("host"), {"type":"peer_joined"})
                continue

            # ---- HOST SET LANG (sync) ----
            if mtype == "set_lang":
                # Only host can set languages in MVP
                if role != "host":
                    await ws_send(ws, {"type":"info","message":"only host can set languages"})
                    continue

                host_lang = (msg.get("host_lang") or "").strip().lower()
                guest_lang = (msg.get("guest_lang") or "").strip().lower()
                if not host_lang or not guest_lang:
                    await ws_send(ws, {"type":"info","message":"missing host_lang/guest_lang"})
                    continue

                room["lang"]["host_lang"] = host_lang
                room["lang"]["guest_lang"] = guest_lang
                room["updated_at"] = now()

                await broadcast_room(room_id, {
                    "type":"lang_state",
                    "host_lang": host_lang,
                    "guest_lang": guest_lang
                })
                continue

            # ---- TRANSLATED MESSAGE ----
            if mtype == "translated":
                # Host pays for every translated turn (both directions)
                # MVP: in-memory credits; later wire Supabase RPC here
                remaining = deduct_host(room_id, cost=1)
                await ws_send(room.get("host"), {"type":"host_credits","credits": remaining})

                # Pass-through to peer
                target = "guest" if role == "host" else "host"
                peer = room.get(target)
                if peer is None:
                    await ws_send(ws, {"type":"info","message":"peer not connected yet"})
                    continue

                await ws_send(peer, msg)
                continue

            await ws_send(ws, {"type":"info","message":"unknown message type"})

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        # cleanup
        if role in ("host","guest") and room.get(role) is ws:
            room[role] = None

        # remove empty room
        if room.get("host") is None and room.get("guest") is None:
            ROOMS.pop(room_id, None)
