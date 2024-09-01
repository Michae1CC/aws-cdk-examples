import os
import argparse
import itertools
import json

from threading import Thread, Event
from abc import ABC, abstractmethod
from enum import StrEnum
from typing import Final, Iterable, Literal, Any

from websockets.sync.client import connect, ClientConnection

WEBSOCKET_URL: str = os.getenv("WEBSOCKET_URL") or ""

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
        print(self._message, end="")

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


class Spinner(Graphic):

    def __init__(self):
        self._spinner_event = Event()
        self._spinner_thread = Thread(
            target=self._create_spinner, args=(self._spinner_event,)
        )

    @classmethod
    def _create_spinner(cls, done: Event):
        char_sequence = itertools.cycle(r"\|/-")
        print(" ", flush=True, end="")
        for char in char_sequence:
            print(f"\b{char}", flush=True, end="")
            if done.wait(0.1):
                break

    def draw(self):
        self._spinner_thread.start()

    def clear(self):
        self._spinner_event.set()
        self._spinner_thread.join()
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

    _EMPTY: Final[Literal[" "]] = " "

    def __init__(self) -> None:
        self._board: list[
            list[Literal[" "] | Literal[Players.PLAYER_1] | Literal[Players.PLAYER_2]]
        ] = [
            [self._EMPTY, self._EMPTY, self._EMPTY],
            [self._EMPTY, self._EMPTY, self._EMPTY],
            [self._EMPTY, self._EMPTY, self._EMPTY],
        ]
        self._current_player = Players.PLAYER_1

    @property
    def current_player(self):
        return self._current_player

    def board_as_str(self):
        board_str = """
 0,0            0,2
     {} | {} | {}
    -----------
     {} | {} | {}
    -----------
     {} | {} | {}
 2,0            2,2\n
""".format(
            *flatten(self._board)
        )
        return board_str

    def play_round(self, row: int, column: int):
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
    def last_player_ended_game(self):
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
                # Win condition
                if (
                    row_count[row] == 3
                    or column_count[column] == 3
                    or diagonal_1_count == 3
                    or diagonal_2_count == 3
                ):
                    return True
        # Draw condition
        return all(tile != self._EMPTY for tile in flatten(self._board))


class App:

    def __init__(
        self, player: Players, websocket: ClientConnection, game_id: str | None = None
    ):
        self._game = NaughtsAndCrossesGame()
        self._player = player
        self._websocket = websocket
        self._game_id = game_id or self._start_new_game(websocket)

    def _start_new_game(self, websocket: ClientConnection) -> str:
        websocket.send(json.dumps({"type": "start"}))
        event = json.loads(websocket.recv())
        assert event["type"] == "init"
        return event["id"]

    @staticmethod
    def _parse_tile_from_input(player_input: str) -> tuple[int, int]:
        row_str, column_str = player_input.split(",")
        return (int(row_str), int(column_str))

    def _get_tile_from_player(self, prompt: str = "Enter turn: ") -> tuple[int, int]:
        game_graphic = Message(self._game.board_as_str())
        prompt_turn = Prompt(prompt)
        graphic_component = GraphicComponent(game_graphic, prompt_turn)
        graphic_component.draw()
        graphic_component.clear()
        return self._parse_tile_from_input(prompt_turn.response)

    def _handle_player_turn(self) -> tuple[int, int]:
        if self._game.current_player != self._player:
            raise Exception(f"Player is playing out of turn")

        entered_valid: bool = False
        tile = self._get_tile_from_player()

        try:
            self._game.play_round(*tile)
        except (IndexError, ValueError):
            pass
        else:
            entered_valid = True

        while not entered_valid:
            tile = self._get_tile_from_player("Invalid turn, try again: ")

            try:
                self._game.play_round(*tile)
            except (IndexError, ValueError):
                pass
            else:
                entered_valid = True

        return tile

    def _handler_opponent_turn(self) -> tuple[int, int]:
        if self._game.current_player == self._player:
            raise Exception(f"Player is playing out of turn")

        game_graphic = Message(self._game.board_as_str())
        message = Message("Waiting for player opponent: ")
        spinner = Spinner()
        graphic_component = GraphicComponent(game_graphic, message, spinner)
        graphic_component.draw()
        event = json.loads(self._websocket.recv())
        assert event["type"] == "play"
        tile = self._parse_tile_from_input(event["tile"])
        graphic_component.clear()
        self._game.play_round(*tile)
        return tile

    def _wait_for_opponent(self):
        cli_message = Message(
            f"Connected to game: {self._game_id}\nWaiting for opponent to connect "
        )
        spinner = Spinner()
        graphic_component = GraphicComponent(cli_message, spinner)
        graphic_component.draw()
        event = json.loads(self._websocket.recv(timeout=None))
        assert event["type"] == "join"
        graphic_component.clear()

    def _connect_to_game(self):
        self._websocket.send(json.dumps({"type": "join", "id": self._game_id}))
        event = json.loads(self._websocket.recv(timeout=None))
        assert event["type"] == "join"

    def _broadcast_play(self, row: int, column: int):
        self._websocket.send(
            json.dumps({"type": "play", "tile": f"{row},{column}", "id": self._game_id})
        )

    def play_game(self):
        if self._player == Players.PLAYER_1:
            self._wait_for_opponent()
        else:
            self._connect_to_game()

        while not self._game.last_player_ended_game:
            if self._game.current_player == self._player:
                row, column = self._handle_player_turn()
                self._broadcast_play(row, column)
            else:
                self._handler_opponent_turn()

        print(self._game.board_as_str())
        print("Game over")


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="Naughts and Crosses", description="Play x and o's over a network."
    )

    verb_parser = parser.add_subparsers(dest="command")
    parser_new = verb_parser.add_parser("new", help="Starts a new game.")
    parser_join = verb_parser.add_parser("join", help="Join a game.")
    parser_join.add_argument(
        "--id", type=str, required=True, help="The game id to join."
    )

    cli_args = parser.parse_args()

    with connect(WEBSOCKET_URL, close_timeout=None) as websocket:
        app = App(
            player=Players.PLAYER_1 if cli_args.command == "new" else Players.PLAYER_2,
            websocket=websocket,
            game_id=cli_args.id if cli_args.command == "join" else None,
        )
        app.play_game()


if __name__ == "__main__":
    main()
