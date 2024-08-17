from typing import *


_get_id = id


class IdentitySet:
    """A set that considers only object id() for uniqueness.

    This strategy has edge cases for builtin types- it's possible to have
    two 'foo' strings in one of these sets, for example.  Use sparingly.

    """

    __slots__ = ("_members",)
    _members: Dict[int, Any]

    def __init__(self, iterable: Optional[Iterable[Any]] = None):
        # the code assumes this class is ordered
        self._members = {}
        if iterable:
            self.update(iterable)

    def add(self, value: Any, /) -> None:
        self._members[_get_id(value)] = value

    def __contains__(self, value) -> bool:
        return _get_id(value) in self._members

    def remove(self, value: Any, /):
        del self._members[_get_id(value)]

    def discard(self, value, /) -> None:
        try:
            self.remove(value)
        except KeyError:
            pass

    def pop(self) -> Any:
        pair: Tuple[Any, Any]
        try:
            pair = self._members.popitem()
            return pair[1]
        except KeyError:
            raise KeyError("pop from an empty set")

    def clear(self) -> None:
        self._members.clear()

    def __eq__(self, other: Any) -> bool:
        other_: "IdentitySet"
        if isinstance(other, IdentitySet):
            other_ = other
            return self._members == other_._members
        else:
            return False

    def __ne__(self, other: Any) -> bool:
        other_: "IdentitySet"
        if isinstance(other, IdentitySet):
            other_ = other
            return self._members != other_._members
        else:
            return True

    def issubset(self, iterable: Iterable[Any], /):
        other: "IdentitySet"
        if isinstance(iterable, IdentitySet):
            other = iterable
        else:
            other = self.__class__(iterable)

        return self._members.keys() <= other._members.keys()

    def __le__(self, other: Any) -> bool:
        if not isinstance(other, IdentitySet):
            return NotImplemented
        return self.issubset(other)

    def __lt__(self, other: Any) -> bool:
        if not isinstance(other, IdentitySet):
            return NotImplemented
        return len(self) < len(other) and self.issubset(other)

    def issuperset(self, iterable: Iterable[Any], /):
        other: "IdentitySet"
        if isinstance(iterable, IdentitySet):
            other = iterable
        else:
            other = self.__class__(iterable)

        return self._members.keys() >= other._members.keys()

    def __ge__(self, other: Any) -> bool:
        if not isinstance(other, IdentitySet):
            return NotImplemented
        return self.issuperset(other)

    def __gt__(self, other: Any) -> bool:
        if not isinstance(other, IdentitySet):
            return NotImplemented
        return len(self) > len(other) and self.issuperset(other)

    def union(self, iterable: Iterable[Any], /) -> "IdentitySet":
        result: "IdentitySet" = self.__class__()
        result._members.update(self._members)
        result.update(iterable)
        return result

    def __or__(self, other: Any) -> "IdentitySet":
        if not isinstance(other, IdentitySet):
            return NotImplemented
        return self.union(other)

    def update(self, iterable: Iterable[Any], /):
        members: Dict[int, Any] = self._members
        if isinstance(iterable, IdentitySet):
            members.update(cast("IdentitySet", iterable)._members)
        else:
            for obj in iterable:
                members[_get_id(obj)] = obj

    def __ior__(self, other: Any) -> "IdentitySet":
        if not isinstance(other, IdentitySet):
            return NotImplemented
        self.update(other)
        return self

    def difference(self, iterable: Iterable[Any], /) -> "IdentitySet":
        result: "IdentitySet" = self.__new__(self.__class__)
        if isinstance(iterable, IdentitySet):
            other = cast("IdentitySet", iterable)._members.keys()
        else:
            other = {_get_id(obj) for obj in iterable}

        result._members = {k: v for k, v in self._members.items() if k not in other}
        return result

    def __sub__(self, other: "IdentitySet") -> "IdentitySet":
        if not isinstance(other, IdentitySet):
            return NotImplemented
        return self.difference(other)

    # def difference_update(self, iterable: Iterable[Any]) -> None:

    def difference_update(self, iterable: Iterable[Any], /):
        other: "IdentitySet" = self.difference(iterable)
        self._members = other._members

    def __isub__(self, other: "IdentitySet") -> "IdentitySet":
        if not isinstance(other, IdentitySet):
            return NotImplemented
        self.difference_update(other)
        return self

    def intersection(self, iterable: Iterable[Any], /) -> "IdentitySet":
        result: "IdentitySet" = self.__new__(self.__class__)
        if isinstance(iterable, IdentitySet):
            other = cast("IdentitySet", iterable)._members
        else:
            other = {_get_id(obj) for obj in iterable}
        result._members = {k: v for k, v in self._members.items() if k in other}
        return result

    def __and__(self, other):
        if not isinstance(other, IdentitySet):
            return NotImplemented
        return self.intersection(other)

    # def intersection_update(self, iterable: Iterable[Any]) -> None:

    def intersection_update(self, iterable: Iterable[Any], /):
        other: "IdentitySet" = self.intersection(iterable)
        self._members = other._members

    def __iand__(self, other: "IdentitySet") -> "IdentitySet":
        if not isinstance(other, IdentitySet):
            return NotImplemented
        self.intersection_update(other)
        return self

    def symmetric_difference(self, iterable: Iterable[Any], /) -> "IdentitySet":
        result: "IdentitySet" = self.__new__(self.__class__)
        other: Dict[int, Any]
        if isinstance(iterable, IdentitySet):
            other = cast("IdentitySet", iterable)._members
        else:
            other = {_get_id(obj): obj for obj in iterable}
        result._members = {k: v for k, v in self._members.items() if k not in other}
        result._members.update(
            [(k, v) for k, v in other.items() if k not in self._members]
        )
        return result

    def __xor__(self, other: "IdentitySet") -> "IdentitySet":
        if not isinstance(other, IdentitySet):
            return NotImplemented
        return self.symmetric_difference(other)

    # def symmetric_difference_update(self, iterable: Iterable[Any]) -> None:

    def symmetric_difference_update(self, iterable: Iterable[Any], /):
        other: "IdentitySet" = self.symmetric_difference(iterable)
        self._members = other._members

    def __ixor__(self, other: "IdentitySet") -> "IdentitySet":
        if not isinstance(other, IdentitySet):
            return NotImplemented
        self.symmetric_difference(other)
        return self

    def copy(self) -> "IdentitySet":
        cp: "IdentitySet" = self.__new__(self.__class__)
        cp._members = self._members.copy()
        return cp

    def __copy__(self) -> "IdentitySet":
        return self.copy()

    def __len__(self) -> int:
        return len(self._members)

    def __iter__(self) -> Iterator[Any]:
        return iter(self._members.values())

    def __hash__(self) -> NoReturn:
        raise TypeError("set objects are unhashable")

    def __repr__(self) -> str:
        return "%s(%r)" % (
            self.__class__.__name__,
            list(self._members.values()),
        )


s1 = IdentitySet([1, 2, 3])
s2 = IdentitySet([2, 3, 4])
s3 = s1.difference(s2)
print(s3)
