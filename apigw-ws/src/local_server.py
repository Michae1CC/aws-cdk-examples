#!/usr/bin/env python

import asyncio
import json
import uuid

from pprint import pprint

import websockets

ALL_CONNECTIONS = set()


async def play(websocket, event):
    for connection in ALL_CONNECTIONS:
        if connection is websocket:
            continue
        await connection.send(json.dumps(event))


async def start(websocket):
    global ALL_CONNECTIONS
    ALL_CONNECTIONS.add(websocket)
    await websocket.send(
        json.dumps(
            {
                "type": "init",
                "id": str(uuid.uuid4()),
            }
        )
    )


async def join(websocket):
    global ALL_CONNECTIONS
    ALL_CONNECTIONS.add(websocket)
    for connection in ALL_CONNECTIONS:
        await connection.send(json.dumps({"type": "join"}))


async def handler(websocket):
    """
    Handle a connection and dispatch it according to who is connecting.

    """
    # Receive and parse the "init" event from the UI.
    async for message in websocket:
        event = json.loads(message)
        pprint(event)
        event_type = event["type"]

        if event_type == "play":
            await play(websocket, event)
        elif event_type == "join":
            await join(websocket)
        elif event_type == "start":
            await start(websocket)


async def main():
    async with websockets.serve(handler, "", 8002):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())
