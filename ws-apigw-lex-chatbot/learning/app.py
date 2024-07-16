#!/usr/bin/env python

import asyncio

import websockets
from pprint import pprint

async def handler(websocket):
    while True:
        message = await websocket.recv()
        print(message)


async def main():
    # async with websockets.serve(handler, "", 8001):
    #     await asyncio.Future()  # run forever

    stop = asyncio.Future()
    print(stop)

    # https://websockets.readthedocs.io/en/stable/reference/asyncio/server.html#websockets.server.serve
    server = await websockets.serve(handler, "", 8001)
    print(stop)
    await stop
    print(stop)
    await server.close()


if __name__ == "__main__":
    asyncio.run(main())