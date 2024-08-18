import asyncio
import itertools

from abc import ABC, abstractmethod
from enum import StrEnum
from typing import Final, Iterable, Literal, Any

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


class GraphicComponent(Graphic):

    def __init__[T_: Graphic](self, *components: T_):
        self._components = components

    def draw(self):
        for component in self._components:
            component.draw()

    def clear(self):
        for component in reversed(self._components):
            component.clear()


class NaughtsAndCrossesGame:

    def __init__(self):
        self._board: list[
            list[Literal[" "] | Literal[Players.PLAYER_1] | Literal[Players.PLAYER_2]]
        ] = [[" ", " ", " "], [" ", " ", " "], [" ", " ", " "]]
        self._current_player = Players.PLAYER_1

    @property
    def current_player(self):
        return self._current_player

    def board_graphic(self):
        board_str = """
(0,0)          (2,0)
     {} | {} | {}
    -----------
     {} | {} | {}
    -----------
     {} | {} | {}
(0,2)          (2,2)\n
""".format(
            *flatten(self._board)
        )
        return board_str

    def play(self, row: int, column: int):
        if row >= BOARD_LENGTH or column >= BOARD_LENGTH:
            raise IndexError("Row or column values are beyond game board.")
        if self._board[row][column] != " ":
            raise ValueError(f"Position ({row},{column}) has been claimed.")
        self._board[row][column] = self._current_player
        self._current_player = (
            Players.PLAYER_2
            if self._current_player == Players.PLAYER_1
            else Players.PLAYER_1
        )

    @property
    def last_player_won(self):
        last_player = (
            Players.PLAYER_2
            if self._current_player == Players.PLAYER_1
            else Players.PLAYER_1
        )
        row_count, column_count = [0] * BOARD_LENGTH, [0] * BOARD_LENGTH
        diagonal_1_count = 0
        diagonal_2_count = 0
        for row, column in itertools.product(range(BOARD_LENGTH), range(BOARD_LENGTH)):
            if self._board[row][column] == last_player:
                row_count[row] += 1
                column_count[column] += 1
                if row == column:
                    diagonal_1_count += 1
                if row + column == BOARD_LENGTH - 1:
                    diagonal_2_count += 1
                if (
                    row_count[row] == 3
                    or column_count[column] == 3
                    or diagonal_1_count == 3
                    or diagonal_2_count == 3
                ):
                    return True
        return False


def parse_turn_from_input(player_input: str) -> tuple[int, int]:
    row_str, column_str = player_input.split(",")
    return (int(row_str), int(column_str))


def handle_players_turn(game: NaughtsAndCrossesGame):
    game_graphic = Message(game.board_graphic())
    prompt_turn = Prompt("Enter turn: ")
    entered_valid: bool = False

    graphic_component = GraphicComponent(game_graphic, prompt_turn)
    graphic_component.draw()
    graphic_component.clear()
    turn = parse_turn_from_input(prompt_turn.response)

    try:
        game.play(*turn)
    except (IndexError, ValueError):
        pass
    else:
        entered_valid = True

    while not entered_valid:
        game_graphic = Message(game.board_graphic())
        prompt_turn = Prompt("Invalid turn, try again: ")
        entered_valid: bool = False

        graphic_component = GraphicComponent(game_graphic, prompt_turn)
        graphic_component.draw()
        graphic_component.clear()
        turn = parse_turn_from_input(prompt_turn.response)

        try:
            game.play(*turn)
        except (IndexError, ValueError):
            pass
        else:
            entered_valid = True

    # TODO: Send turn to websocket


p2t = iter([(0, 0), (0, 1), (0, 2)])


async def get_turn_from_slow():
    # await asyncio.sleep(1)
    return next(p2t)


async def handler_opponents_turn(game: NaughtsAndCrossesGame):
    game_graphic = Message(game.board_graphic())
    message = Message("Waiting for player 2: ")
    spinner = Spinner()
    graphic_component = GraphicComponent(game_graphic, message, spinner)
    graphic_component.draw()
    turn = await get_turn_from_slow()
    graphic_component.clear()
    game.play(*turn)


async def play_game(player: Players):

    game: NaughtsAndCrossesGame = NaughtsAndCrossesGame()

    # TODO: handle draw
    while not game.last_player_won:

        if game.current_player == player:
            handle_players_turn(game)
        else:
            await handler_opponents_turn(game)

    print(game.board_graphic())
    print("Game over")


async def slow() -> int:
    await asyncio.sleep(1)  # <4>
    return 42


async def supervisor() -> None:
    message = Message("Waiting for player 2: ")
    spinner = Spinner()
    gc = GraphicComponent(message, spinner)
    gc.draw()
    result = await slow()
    gc.clear()
    return result


def main() -> None:  # <1>
    asyncio.run(play_game(Players.PLAYER_1))


if __name__ == "__main__":
    main()
