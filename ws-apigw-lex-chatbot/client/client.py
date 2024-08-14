from abc import ABC, abstractmethod


class Graphic(ABC):

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
        print("\033[A" + "\r" + " " * len(self._message) + "\r", end="")


my_message = Message("Hi world")
my_message.draw()
my_message.clear()
