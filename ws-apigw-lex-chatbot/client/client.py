import asyncio
import itertools

from abc import ABC, abstractmethod
from enum import StrEnum
from typing import Final, Iterable, Any

BOARD_LENGTH: Final[int] = 3


class Players(StrEnum):
    PLAYER_1 = "x"
    PLAYER_2 = "o"


def flatten(x: Any):
    if isinstance(x, Iterable) and not isinstance(x, str | bytes):
        for i in x:
            yield from flatten(i)
    else:
        yield x


def draw_board(board: list[list[str]]):
    board_str = """
 (0,0)           (2,0)
       {} | {} | {}
       ---------
       {} | {} | {}
       ---------
       {} | {} | {}
 (0,2)           (2,2)\n
""".format(
        *flatten(board)
    )
    print(board_str, end="")
    return board_str


class Graphic(ABC):

    @classmethod
    def _clear_single_line(cls, s: str):
        print("\r" + " " * len(s) + "\r", end="")

    @classmethod
    def _clear_string(cls, ss: str):
        first_line, *remaining_lines = ss.split("\n")[::-1]
        cls._clear_single_line(first_line)
        for s in remaining_lines:
            # Move up a line
            print("\033[A", end="")
            cls._clear_single_line(s)

    @abstractmethod
    def draw(self): ...

    @abstractmethod
    def clear(self): ...


class Message(Graphic):

    def __init__(self, message: str):
        self._message = message

    def draw(self):
        print(self._message, end="\n")

    def clear(self):
        self._clear_string(self._message)


class Prompt(Graphic):

    def __init__(self, prompt: str):
        self._prompt = prompt
        self._response: str = ""

    @property
    def response(self):
        return self._response

    def draw(self):
        self._response = input(self._prompt)

    def clear(self):
        # The new line is added for the user hitting enter after the response
        self._clear_string(self._prompt + self._response + "\n")


class Message(Graphic):

    def __init__(self, message: str):
        self._message = message

    def draw(self):
        print(self._message, end="")

    def clear(self):
        self._clear_string(self._message)


class Spinner(Graphic):

    def __init__(self):
        self._task = None

    @classmethod
    async def _create_spinner(cls):
        char_sequence = itertools.cycle(r"\|/-")
        print(" ", flush=True, end="")
        for char in char_sequence:
            print(f"\b{char}", flush=True, end="")
            try:
                await asyncio.sleep(0.1)
            except asyncio.CancelledError:
                break

    def draw(self):
        self._task = asyncio.create_task(self._create_spinner())

    def clear(self):
        self._task.cancel()
        print(f"\b ", flush=True, end="")


async def slow() -> int:
    await asyncio.sleep(1)  # <4>
    return 42


async def supervisor() -> None:
    message = Message("Waiting for player 2: ")
    spinner = Spinner()
    message.draw()
    spinner.draw()
    result = await slow()
    spinner.clear()
    message.clear()
    return result


def main() -> None:  # <1>
    result = asyncio.run(supervisor())  # <2>
    print(f"Answer: {result}")


if __name__ == "__main__":
    main()
