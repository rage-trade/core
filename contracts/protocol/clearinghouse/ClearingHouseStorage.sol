// SPDX-License-Identifier: BUSL-1.1

pragma solidity =0.8.14;

import { Account } from '../../libraries/Account.sol';
import { BatchedLoop } from '../../libraries/BatchedLoop.sol';
import { Protocol } from '../../libraries/Protocol.sol';
import { AtomicVTokenSwap } from '../../libraries/AtomicVTokenSwap.sol';

import { IInsuranceFund } from '../../interfaces/IInsuranceFund.sol';
import { IOracle } from '../../interfaces/IOracle.sol';

abstract contract ClearingHouseStorage {
    // rest slots reserved for any states from inheritance in future
    uint256[100] private _emptySlots1;

    // at slot # 100
    Protocol.Info internal protocol;

    uint256 public numAccounts;
    mapping(uint256 => Account.Info) accounts;

    address public rageTradeFactoryAddress;
    IInsuranceFund public insuranceFund;

    // progress index, used for performing for loop
    // over an unbounded array in multiple txs
    BatchedLoop.Info internal pauseLoop;
    BatchedLoop.Info internal unpauseLoop;
    BatchedLoop.Info internal withdrawProtocolFeeLoop;

    // storage for atomic token swap
    mapping(uint256 => AtomicVTokenSwap.Info) atomicSwaps;
    uint256 public numAtomicSwaps;

    // reserved for adding slots in future
    uint256[98] private _emptySlots2;
}
