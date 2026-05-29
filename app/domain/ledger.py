"""Pure money math for the buyer ledger. No framework, no DB.

Atomicity (the actual anti double-charge guarantee) is enforced by the use case
via a row-locked transaction. This module owns only the arithmetic and the
invariant that a debit can never overdraw a balance.
"""

from decimal import Decimal


class InsufficientBalanceError(Exception):
    pass


def apply_debit(balance_before: Decimal, price: Decimal) -> Decimal:
    if price > balance_before:
        raise InsufficientBalanceError(f"balance {balance_before} < price {price}")
    return balance_before - price


def apply_refund(balance_before: Decimal, amount: Decimal) -> Decimal:
    return balance_before + amount
