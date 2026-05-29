from decimal import Decimal

import pytest

from app.domain import ledger


def test_apply_debit_subtracts():
    assert ledger.apply_debit(Decimal("100.00"), Decimal("30.00")) == Decimal("70.00")


def test_apply_debit_exact_balance_allowed():
    assert ledger.apply_debit(Decimal("30.00"), Decimal("30.00")) == Decimal("0.00")


def test_apply_debit_overdraw_raises():
    with pytest.raises(ledger.InsufficientBalanceError):
        ledger.apply_debit(Decimal("10.00"), Decimal("30.00"))


def test_apply_refund_adds():
    assert ledger.apply_refund(Decimal("70.00"), Decimal("30.00")) == Decimal("100.00")
